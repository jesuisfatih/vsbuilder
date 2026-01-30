/**
 * 🛡️ EDITOR API ACTIONS
 * Handles all editor save/update operations via Remix actions
 * Uses GraphQL API (REST API deprecated in v4.x)
 */
import { json, type ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

// ============================================
// ACTION TYPES
// ============================================

type EditorAction =
  | { type: 'SAVE_TEMPLATE'; payload: { template: any; themeId: string } }
  | { type: 'SAVE_HEADER'; payload: { header: any; themeId: string } }
  | { type: 'SAVE_FOOTER'; payload: { footer: any; themeId: string } }
  | { type: 'SAVE_ALL'; payload: { template: any; header: any; footer: any; themeId: string } };

// ============================================
// MAIN ACTION HANDLER
// ============================================

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    const { admin } = await authenticate.admin(request);

    if (!admin) {
      return json({
        success: false,
        error: "Not authenticated"
      }, { status: 401 });
    }

    const formData = await request.formData();
    const actionType = formData.get("_action") as string;
    const themeId = formData.get("themeId") as string;

    if (!themeId) {
      return json({
        success: false,
        error: "Theme ID is required"
      }, { status: 400 });
    }

    switch (actionType) {
      case "SAVE_TEMPLATE": {
        const templateData = formData.get("template") as string;
        if (!templateData) {
          return json({ success: false, error: "Template data is required" }, { status: 400 });
        }

        await saveThemeAsset(admin, themeId, "templates/index.json", templateData);

        return json({
          success: true,
          message: "Template saved successfully",
          savedAt: new Date().toISOString()
        });
      }

      case "SAVE_HEADER": {
        const headerData = formData.get("header") as string;
        if (!headerData) {
          return json({ success: false, error: "Header data is required" }, { status: 400 });
        }

        await saveThemeAsset(admin, themeId, "sections/header-group.json", headerData);

        return json({
          success: true,
          message: "Header saved successfully",
          savedAt: new Date().toISOString()
        });
      }

      case "SAVE_FOOTER": {
        const footerData = formData.get("footer") as string;
        if (!footerData) {
          return json({ success: false, error: "Footer data is required" }, { status: 400 });
        }

        await saveThemeAsset(admin, themeId, "sections/footer-group.json", footerData);

        return json({
          success: true,
          message: "Footer saved successfully",
          savedAt: new Date().toISOString()
        });
      }

      case "SAVE_ALL": {
        const templateData = formData.get("template") as string;
        const headerData = formData.get("header") as string;
        const footerData = formData.get("footer") as string;

        const files = [];
        if (templateData) {
          files.push({ filename: "templates/index.json", body: { type: "TEXT", value: templateData } });
        }
        if (headerData) {
          files.push({ filename: "sections/header-group.json", body: { type: "TEXT", value: headerData } });
        }
        if (footerData) {
          files.push({ filename: "sections/footer-group.json", body: { type: "TEXT", value: footerData } });
        }

        if (files.length === 0) {
          return json({ success: false, error: "No data to save" }, { status: 400 });
        }

        const gid = themeId.includes('gid://') ? themeId : `gid://shopify/Theme/${themeId}`;

        const response = await admin.graphql(`
          mutation themeFilesUpsert($themeId: ID!, $files: [OnlineStoreThemeFilesUpsertFileInput!]!) {
            themeFilesUpsert(themeId: $themeId, files: $files) {
              upsertedThemeFiles {
                filename
              }
              userErrors {
                field
                message
              }
            }
          }
        `, {
          variables: {
            themeId: gid,
            files: files
          }
        });

        const data = await response.json();

        if (data.data?.themeFilesUpsert?.userErrors?.length > 0) {
          console.error("[Editor] Save errors:", data.data.themeFilesUpsert.userErrors);
          return json({
            success: false,
            error: data.data.themeFilesUpsert.userErrors[0].message,
            savedAt: new Date().toISOString()
          }, { status: 500 });
        }

        return json({
          success: true,
          message: "All changes saved successfully",
          savedAt: new Date().toISOString()
        });
      }

      default:
        return json({
          success: false,
          error: `Unknown action: ${actionType}`
        }, { status: 400 });
    }
  } catch (error) {
    console.error("[Editor Action] Error:", error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred"
    }, { status: 500 });
  }
};

// ============================================
// HELPER: Save Theme Asset via GraphQL
// ============================================

async function saveThemeAsset(admin: any, themeId: string, assetKey: string, data: string): Promise<void> {
  const gid = themeId.includes('gid://') ? themeId : `gid://shopify/Theme/${themeId}`;

  const response = await admin.graphql(`
    mutation themeFilesUpsert($themeId: ID!, $files: [OnlineStoreThemeFilesUpsertFileInput!]!) {
      themeFilesUpsert(themeId: $themeId, files: $files) {
        upsertedThemeFiles {
          filename
        }
        userErrors {
          field
          message
        }
      }
    }
  `, {
    variables: {
      themeId: gid,
      files: [{
        filename: assetKey,
        body: {
          type: "TEXT",
          value: data
        }
      }]
    }
  });

  const result = await response.json();

  if (result.data?.themeFilesUpsert?.userErrors?.length > 0) {
    throw new Error(result.data.themeFilesUpsert.userErrors[0].message);
  }

  console.log(`[Editor] Saved asset: ${assetKey} to theme ${themeId}`);
}
