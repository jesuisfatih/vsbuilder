/**
 * 🛡️ EDITOR API ACTIONS - Production Ready
 * Handles all editor save/update operations
 * Uses GraphQL API for theme operations
 */
import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import {
    downloadThemeForEditor,
    getOrCreateDraftTheme,
    saveEditorChanges
} from "../utils/theme.server";

// ============================================
// LOADER - Fetch theme data
// ============================================

export const loader = async ({ request }: LoaderFunctionArgs) => {
  console.log('[API Editor] Loader called');

  try {
    const { admin } = await authenticate.admin(request);
    const url = new URL(request.url);
    const themeId = url.searchParams.get("themeId");
    const template = url.searchParams.get("template") || "index";

    if (!themeId) {
      return json({ error: "Theme ID is required" }, { status: 400 });
    }

    const themeData = await downloadThemeForEditor(admin, themeId, template);

    if (!themeData) {
      return json({ error: "Failed to download theme data" }, { status: 500 });
    }

    return json({
      success: true,
      theme: themeData.theme,
      template: themeData.template,
      header: themeData.header,
      footer: themeData.footer
    });
  } catch (error) {
    console.error("[API Editor] Loader error:", error);
    return json({
      error: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
};

// ============================================
// ACTION - Handle save operations
// ============================================

export const action = async ({ request }: ActionFunctionArgs) => {
  console.log('[API Editor] Action called');

  try {
    const { admin } = await authenticate.admin(request);

    if (!admin) {
      return json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const formData = await request.formData();
    const actionType = formData.get("_action") as string;

    console.log('[API Editor] Action type:', actionType);

    switch (actionType) {
      case "SAVE_AS_DRAFT": {
        const sourceThemeId = formData.get("sourceThemeId") as string;
        const templateData = formData.get("template") as string;
        const headerData = formData.get("header") as string;
        const footerData = formData.get("footer") as string;
        const currentTemplate = formData.get("currentTemplate") as string || "index";

        console.log('[API Editor] SAVE_AS_DRAFT');
        console.log('[API Editor] Source Theme ID:', sourceThemeId);
        console.log('[API Editor] Template:', currentTemplate);

        if (!sourceThemeId) {
          return json({ success: false, error: "Source theme ID is required" }, { status: 400 });
        }

        // Get or create draft theme
        const draftResult = await getOrCreateDraftTheme(admin, sourceThemeId);
        if (!draftResult) {
          return json({ success: false, error: "Failed to create or find draft theme" }, { status: 500 });
        }

        console.log('[API Editor] Draft theme:', draftResult.draft.name, '| isNew:', draftResult.isNew);

        // Parse the data
        let template, header, footer;
        try {
          template = templateData ? JSON.parse(templateData) : { sections: {}, order: [] };
          header = headerData ? JSON.parse(headerData) : { sections: {}, order: [] };
          footer = footerData ? JSON.parse(footerData) : { sections: {}, order: [] };
        } catch (parseError) {
          console.error('[API Editor] JSON parse error:', parseError);
          return json({ success: false, error: "Invalid JSON data" }, { status: 400 });
        }

        // Save changes to draft theme
        const saveSuccess = await saveEditorChanges(
          admin,
          draftResult.draft.id,
          currentTemplate,
          template,
          header,
          footer
        );

        if (!saveSuccess) {
          return json({ success: false, error: "Failed to save changes" }, { status: 500 });
        }

        return json({
          success: true,
          message: draftResult.isNew
            ? `Created new draft "${draftResult.draft.name}" and saved changes`
            : `Saved changes to "${draftResult.draft.name}"`,
          draftThemeId: draftResult.draft.numericId,
          draftThemeName: draftResult.draft.name,
          isNew: draftResult.isNew,
          savedAt: new Date().toISOString()
        });
      }

      case "SAVE_TO_THEME": {
        const themeId = formData.get("themeId") as string;
        const templateData = formData.get("template") as string;
        const headerData = formData.get("header") as string;
        const footerData = formData.get("footer") as string;
        const currentTemplate = formData.get("currentTemplate") as string || "index";

        console.log('[API Editor] SAVE_TO_THEME:', themeId);

        if (!themeId) {
          return json({ success: false, error: "Theme ID is required" }, { status: 400 });
        }

        let template, header, footer;
        try {
          template = templateData ? JSON.parse(templateData) : { sections: {}, order: [] };
          header = headerData ? JSON.parse(headerData) : { sections: {}, order: [] };
          footer = footerData ? JSON.parse(footerData) : { sections: {}, order: [] };
        } catch (parseError) {
          console.error('[API Editor] JSON parse error:', parseError);
          return json({ success: false, error: "Invalid JSON data" }, { status: 400 });
        }

        const saveSuccess = await saveEditorChanges(
          admin,
          themeId,
          currentTemplate,
          template,
          header,
          footer
        );

        if (!saveSuccess) {
          return json({ success: false, error: "Failed to save changes" }, { status: 500 });
        }

        return json({
          success: true,
          message: "Changes saved to theme",
          savedAt: new Date().toISOString()
        });
      }

      // Legacy compatibility
      case "SAVE_ALL": {
        const themeId = formData.get("themeId") as string;
        const templateData = formData.get("template") as string;
        const headerData = formData.get("header") as string;
        const footerData = formData.get("footer") as string;

        console.log('[API Editor] SAVE_ALL (legacy):', themeId);

        if (!themeId) {
          return json({ success: false, error: "Theme ID is required" }, { status: 400 });
        }

        let template, header, footer;
        try {
          template = templateData ? JSON.parse(templateData) : { sections: {}, order: [] };
          header = headerData ? JSON.parse(headerData) : { sections: {}, order: [] };
          footer = footerData ? JSON.parse(footerData) : { sections: {}, order: [] };
        } catch (parseError) {
          return json({ success: false, error: "Invalid JSON data" }, { status: 400 });
        }

        const saveSuccess = await saveEditorChanges(
          admin,
          themeId,
          "index",
          template,
          header,
          footer
        );

        if (!saveSuccess) {
          return json({ success: false, error: "Failed to save changes" }, { status: 500 });
        }

        return json({
          success: true,
          message: "All changes saved",
          savedAt: new Date().toISOString()
        });
      }

      default:
        return json({ success: false, error: `Unknown action: ${actionType}` }, { status: 400 });
    }
  } catch (error) {
    console.error("[API Editor] Action error:", error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred"
    }, { status: 500 });
  }
};
