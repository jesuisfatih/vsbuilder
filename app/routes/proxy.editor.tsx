/**
 * 🎨 App Proxy Editor Route
 * =========================
 * Mağaza domain'inde tam editor - App Proxy auth ile
 */
import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { downloadThemeForEditor } from "../utils/theme.server";
// Import main Editor component to reuse logic
import EditorComponent from "./app.editor";

// Sabit şablon tipleri
const TEMPLATE_TYPES = [
  { value: "index", label: "Home Page" },
  { value: "product", label: "Product Page" },
  { value: "collection", label: "Collection Page" },
  { value: "page", label: "Regular Page" },
  { value: "article", label: "Blog Post" },
  { value: "blog", label: "Blog Landing" },
  { value: "cart", label: "Cart" },
  { value: "404", label: "404 Page" },
  { value: "search", label: "Search Page" }
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const { session, admin } = await authenticate.public.appProxy(request);

    if (!session || !admin) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const themeIdParam = url.searchParams.get("themeId");
    const templateParam = url.searchParams.get("template") || "index";

    if (!themeIdParam) {
      return json({ error: "Theme ID is required" }, { status: 400 });
    }

    console.log(`[ProxyEditor] Loading for Shop: ${session.shop}, Theme: ${themeIdParam}`);

    // Download theme
    const themeData = await downloadThemeForEditor(admin, themeIdParam, templateParam);

    if (!themeData) {
      throw new Error("Theme data unavailable");
    }

    // Build preview URL
    const previewUrl = `/api/render-local?themeId=${themeData.theme.numericId}&template=${templateParam}`;

    return json({
      shop: session.shop,
      themeId: themeData.theme.numericId,
      themeName: themeData.theme.name,
      themeRole: themeData.theme.role,
      sourceThemeId: themeData.theme.numericId,
      currentTemplate: templateParam,
      availableTemplates: TEMPLATE_TYPES,
      initialData: {
        template: {
          sections: themeData.template.sections,
          order: themeData.template.order,
        },
        header: {
          sections: themeData.header.sections,
          order: themeData.header.order,
        },
        footer: {
          sections: themeData.footer.sections,
          order: themeData.footer.order,
        },
      },
      previewUrl,
      // API configuration for App Proxy mode - uses proxy API routes
      apiConfig: {
        syncCheck: '/proxy/api.sync',
        syncAction: '/proxy/api.sync',
        renderLocal: '/proxy/api.render-local',
        render: '/proxy/api.render',
      },
      error: null,
    });
  } catch (error) {
    console.error("[ProxyEditor] Loader error:", error);
    return json({
      shop: "",
      themeId: null,
      initialData: null,
      error: "Failed to load editor. Please try again.",
    });
  }
};

export default EditorComponent;
