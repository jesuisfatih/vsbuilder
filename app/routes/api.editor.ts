/**
 * 🛡️ EDITOR API ACTIONS
 * Handles all editor save/update operations via Remix actions
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

    if (!admin?.rest?.resources?.Asset) {
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

        const template = JSON.parse(templateData);
        await saveThemeAsset(admin, themeId, "templates/index.json", template);

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

        const header = JSON.parse(headerData);
        await saveThemeAsset(admin, themeId, "sections/header-group.json", header);

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

        const footer = JSON.parse(footerData);
        await saveThemeAsset(admin, themeId, "sections/footer-group.json", footer);

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

        const results = await Promise.allSettled([
          templateData ? saveThemeAsset(admin, themeId, "templates/index.json", JSON.parse(templateData)) : Promise.resolve(),
          headerData ? saveThemeAsset(admin, themeId, "sections/header-group.json", JSON.parse(headerData)) : Promise.resolve(),
          footerData ? saveThemeAsset(admin, themeId, "sections/footer-group.json", JSON.parse(footerData)) : Promise.resolve(),
        ]);

        const failures = results.filter(r => r.status === 'rejected');

        if (failures.length > 0) {
          console.error("[Editor] Some saves failed:", failures);
          return json({
            success: false,
            error: `${failures.length} save(s) failed`,
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
// HELPER: Save Theme Asset
// ============================================

async function saveThemeAsset(admin: any, themeId: string, assetKey: string, data: any): Promise<void> {
  const Asset = admin.rest.resources.Asset;

  const asset = new Asset({ session: admin.rest.session });
  asset.theme_id = parseInt(themeId, 10);
  asset.key = assetKey;
  asset.value = JSON.stringify(data, null, 2);

  await asset.save({ update: true });

  console.log(`[Editor] Saved asset: ${assetKey} to theme ${themeId}`);
}
