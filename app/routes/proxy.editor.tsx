/**
 * 🎨 App Proxy Editor Route
 * =========================
 * Mağaza domain'inde tam editor - App Proxy auth ile
 *
 * IMPORTANT: Uses AppProxyProvider for proper asset loading and hydration
 */
import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { AppProxyProvider } from "@shopify/shopify-app-remix/react";
import { authenticate } from "../shopify.server";
import { downloadThemeForEditor } from "../utils/theme.server";

// Import the EditorCore component
import { EditorCore } from "./app.editor";

// Sabit şablon tipleri
const TEMPLATE_TYPES = [
  { value: "index", label: "Home Page", path: "templates/index.json" },
  { value: "product", label: "Product Page", path: "templates/product.json" },
  { value: "collection", label: "Collection Page", path: "templates/collection.json" },
  { value: "page", label: "Regular Page", path: "templates/page.json" },
  { value: "article", label: "Blog Post", path: "templates/article.json" },
  { value: "blog", label: "Blog Landing", path: "templates/blog.json" },
  { value: "cart", label: "Cart", path: "templates/cart.json" },
  { value: "404", label: "404 Page", path: "templates/404.json" },
  { value: "search", label: "Search Page", path: "templates/search.json" }
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const appUrl = process.env.SHOPIFY_APP_URL || "https://vsbuilder.techifyboost.com";

  try {
    const { session, admin } = await authenticate.public.appProxy(request);

    if (!session || !admin) {
      return json({
        error: "Unauthorized",
        appUrl,
        shop: "",
        themeId: null,
        themeName: null,
        themeRole: null,
        sourceThemeId: null,
        currentTemplate: "index",
        availableTemplates: TEMPLATE_TYPES,
        initialData: { template: { sections: {}, order: [] }, header: { sections: {}, order: [] }, footer: { sections: {}, order: [] } },
        previewUrl: "/",
        apiConfig: null,
      }, { status: 401 });
    }

    const url = new URL(request.url);
    const themeIdParam = url.searchParams.get("themeId");
    const templateParam = url.searchParams.get("template") || "index";

    if (!themeIdParam) {
      return json({
        error: "Theme ID is required",
        appUrl,
        shop: session.shop,
        themeId: null,
        themeName: null,
        themeRole: null,
        sourceThemeId: null,
        currentTemplate: templateParam,
        availableTemplates: TEMPLATE_TYPES,
        initialData: { template: { sections: {}, order: [] }, header: { sections: {}, order: [] }, footer: { sections: {}, order: [] } },
        previewUrl: "/",
        apiConfig: null,
      }, { status: 400 });
    }

    console.log(`[ProxyEditor] Loading for Shop: ${session.shop}, Theme: ${themeIdParam}`);

    // Download theme
    const themeData = await downloadThemeForEditor(admin, themeIdParam, templateParam);

    if (!themeData) {
      throw new Error("Theme data unavailable");
    }

    // Build preview URL - use absolute URL since we're in proxy context
    const previewUrl = `${appUrl}/proxy/api.render-local?themeId=${themeData.theme.numericId}&template=${templateParam}`;

    return json({
      appUrl,
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
      // API configuration for App Proxy mode - use ABSOLUTE URLs
      apiConfig: {
        syncCheck: `${appUrl}/proxy/api.sync`,
        syncAction: `${appUrl}/proxy/api.sync`,
        renderLocal: `${appUrl}/proxy/api.render-local`,
        render: `${appUrl}/proxy/api.render`,
      },
      error: null,
    });
  } catch (error) {
    console.error("[ProxyEditor] Loader error:", error);
    return json({
      appUrl,
      shop: "",
      themeId: null,
      themeName: null,
      themeRole: null,
      sourceThemeId: null,
      currentTemplate: "index",
      availableTemplates: TEMPLATE_TYPES,
      initialData: { template: { sections: {}, order: [] }, header: { sections: {}, order: [] }, footer: { sections: {}, order: [] } },
      previewUrl: "/",
      apiConfig: null,
      error: "Failed to load editor. Please try again.",
    });
  }
};

/**
 * Proxy Editor Component - wraps EditorCore with AppProxyProvider
 */
export default function ProxyEditor() {
  const data = useLoaderData<typeof loader>();

  // Show error if no themeId
  if (data.error && !data.themeId) {
    return (
      <AppProxyProvider appUrl={data.appUrl}>
        <div style={{
          padding: "40px",
          textAlign: "center",
          fontFamily: "system-ui, sans-serif",
          color: "#333"
        }}>
          <h1 style={{ color: "#dc2626", marginBottom: "16px" }}>Error Loading Editor</h1>
          <p style={{ marginBottom: "24px" }}>{data.error}</p>
          <a
            href="/"
            style={{
              display: "inline-block",
              padding: "12px 24px",
              backgroundColor: "#4f46e5",
              color: "white",
              borderRadius: "8px",
              textDecoration: "none"
            }}
          >
            Go Back
          </a>
        </div>
      </AppProxyProvider>
    );
  }

  return (
    <AppProxyProvider appUrl={data.appUrl}>
      <EditorCore
        loaderData={data as any}
        isProxyMode={true}
      />
    </AppProxyProvider>
  );
}
