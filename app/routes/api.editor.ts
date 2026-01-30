/**
 * 🛡️ EDITOR API ACTIONS
 * Handles all editor save/update operations via Remix actions
 * Uses GraphQL API for theme operations
 */
import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import {
    downloadThemeData,
    getOrCreateDraftTheme,
    getThemeById,
    saveThemeAssets
} from "../utils/theme.server";

// ============================================
// LOADER - Fetch theme data for editor
// ============================================

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const { admin } = await authenticate.admin(request);
    const url = new URL(request.url);
    const themeId = url.searchParams.get("themeId");

    if (!themeId) {
      return json({ error: "Theme ID is required" }, { status: 400 });
    }

    // Download full theme data
    const themeData = await downloadThemeData(admin, themeId);

    if (!themeData) {
      return json({ error: "Failed to download theme data" }, { status: 500 });
    }

    return json({
      success: true,
      theme: themeData.theme,
      templates: themeData.templates,
      sections: themeData.sections,
      config: themeData.config
    });
  } catch (error) {
    console.error("[Editor API] Loader error:", error);
    return json({
      error: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
};

// ============================================
// ACTION - Handle save operations
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

    switch (actionType) {
      case "SAVE_AS_DRAFT": {
        const sourceThemeId = formData.get("sourceThemeId") as string;
        const templateData = formData.get("template") as string;
        const headerData = formData.get("header") as string;
        const footerData = formData.get("footer") as string;
        const currentTemplate = formData.get("currentTemplate") as string || "index";

        if (!sourceThemeId) {
          return json({ success: false, error: "Source theme ID is required" }, { status: 400 });
        }

        // Get or create draft theme
        const draftResult = await getOrCreateDraftTheme(admin, sourceThemeId);
        if (!draftResult) {
          return json({ success: false, error: "Failed to create draft theme" }, { status: 500 });
        }

        const { draftId, isNew } = draftResult;

        // Prepare files to save
        const filesToSave: Array<{key: string, value: string}> = [];

        if (templateData) {
          const templatePath = `templates/${currentTemplate}.json`;
          filesToSave.push({ key: templatePath, value: templateData });
        }

        if (headerData) {
          filesToSave.push({ key: "sections/header-group.json", value: headerData });
        }

        if (footerData) {
          filesToSave.push({ key: "sections/footer-group.json", value: footerData });
        }

        if (filesToSave.length > 0) {
          await saveThemeAssets(admin, draftId, filesToSave);
        }

        // Get draft theme info for response
        const draftTheme = await getThemeById(admin, draftId);

        return json({
          success: true,
          message: isNew ? "Created new draft and saved changes" : "Saved changes to existing draft",
          draftThemeId: draftId,
          draftThemeName: draftTheme?.name,
          savedAt: new Date().toISOString()
        });
      }

      case "SAVE_TO_THEME": {
        const themeId = formData.get("themeId") as string;
        const templateData = formData.get("template") as string;
        const headerData = formData.get("header") as string;
        const footerData = formData.get("footer") as string;
        const currentTemplate = formData.get("currentTemplate") as string || "index";

        if (!themeId) {
          return json({ success: false, error: "Theme ID is required" }, { status: 400 });
        }

        // Prepare files to save
        const filesToSave: Array<{key: string, value: string}> = [];

        if (templateData) {
          const templatePath = `templates/${currentTemplate}.json`;
          filesToSave.push({ key: templatePath, value: templateData });
        }

        if (headerData) {
          filesToSave.push({ key: "sections/header-group.json", value: headerData });
        }

        if (footerData) {
          filesToSave.push({ key: "sections/footer-group.json", value: footerData });
        }

        if (filesToSave.length === 0) {
          return json({ success: false, error: "No data to save" }, { status: 400 });
        }

        await saveThemeAssets(admin, themeId, filesToSave);

        return json({
          success: true,
          message: "Changes saved to theme",
          savedAt: new Date().toISOString()
        });
      }

      case "DOWNLOAD_THEME": {
        const themeId = formData.get("themeId") as string;

        if (!themeId) {
          return json({ success: false, error: "Theme ID is required" }, { status: 400 });
        }

        const themeData = await downloadThemeData(admin, themeId);

        if (!themeData) {
          return json({ success: false, error: "Failed to download theme" }, { status: 500 });
        }

        return json({
          success: true,
          theme: themeData.theme,
          templates: themeData.templates,
          sections: themeData.sections,
          config: themeData.config
        });
      }

      case "CREATE_DRAFT": {
        const sourceThemeId = formData.get("sourceThemeId") as string;

        if (!sourceThemeId) {
          return json({ success: false, error: "Source theme ID is required" }, { status: 400 });
        }

        const draftResult = await getOrCreateDraftTheme(admin, sourceThemeId);

        if (!draftResult) {
          return json({ success: false, error: "Failed to create draft" }, { status: 500 });
        }

        const draftTheme = await getThemeById(admin, draftResult.draftId);

        return json({
          success: true,
          draftThemeId: draftResult.draftId,
          draftThemeName: draftTheme?.name,
          isNew: draftResult.isNew
        });
      }

      // Legacy action for backwards compatibility
      case "SAVE_ALL": {
        const themeId = formData.get("themeId") as string;
        const templateData = formData.get("template") as string;
        const headerData = formData.get("header") as string;
        const footerData = formData.get("footer") as string;

        if (!themeId) {
          return json({ success: false, error: "Theme ID is required" }, { status: 400 });
        }

        const filesToSave: Array<{key: string, value: string}> = [];

        if (templateData) {
          filesToSave.push({ key: "templates/index.json", value: templateData });
        }
        if (headerData) {
          filesToSave.push({ key: "sections/header-group.json", value: headerData });
        }
        if (footerData) {
          filesToSave.push({ key: "sections/footer-group.json", value: footerData });
        }

        if (filesToSave.length > 0) {
          await saveThemeAssets(admin, themeId, filesToSave);
        }

        return json({
          success: true,
          message: "All changes saved",
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
    console.error("[Editor API] Action error:", error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred"
    }, { status: 500 });
  }
};
