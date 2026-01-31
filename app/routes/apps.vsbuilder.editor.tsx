/**
 * 🎨 App Proxy Editor Route
 * =========================
 * Bu dosya hem Admin Proxy hem de Client tarafında kullanılır
 * Route ID: routes/apps.vsbuilder.editor
 * URL: /apps/vsbuilder/editor
 */
import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { ClientOnlyEditor } from "../components/ClientOnlyEditor";
import { authenticate } from "../shopify.server";
import { downloadThemeForEditor } from "../utils/theme.server";
import { EditorCore } from "./app.editor";

// Available template types
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

/**
 * Server-side loader - App Proxy Authentication
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const appUrl = process.env.SHOPIFY_APP_URL || "https://vsbuilder.techifyboost.com";

  // API endpoints - relative URLs for proxy mode
  const apiConfig = {
    syncCheck: `/apps/vsbuilder/api/sync`,
    syncAction: `/apps/vsbuilder/api/sync`,
    renderLocal: `/apps/vsbuilder/api/render-local`,
    render: `/apps/vsbuilder/api/render`,
  };

  try {
    const { session, admin } = await authenticate.public.appProxy(request);

    if (!session || !admin) {
      console.error("[Editor] Authentication failed");
      return json({
        error: "Unauthorized - Please access through Shopify",
        appUrl,
        apiConfig,
        shop: "",
        themeId: null,
        themeName: null,
        themeRole: null,
        sourceThemeId: null,
        currentTemplate: "index",
        availableTemplates: TEMPLATE_TYPES,
        initialData: {
          template: { sections: {}, order: [] },
          header: { sections: {}, order: [] },
          footer: { sections: {}, order: [] }
        },
        previewUrl: "/",
      }, { status: 401 });
    }

    const url = new URL(request.url);
    const themeIdParam = url.searchParams.get("themeId");
    const templateParam = url.searchParams.get("template") || "index";

    if (!themeIdParam) {
      console.error("[Editor] Missing themeId");
      return json({
        error: "Theme ID is required",
        appUrl,
        apiConfig,
        shop: session.shop,
        themeId: null,
        themeName: null,
        themeRole: null,
        sourceThemeId: null,
        currentTemplate: templateParam,
        availableTemplates: TEMPLATE_TYPES,
        initialData: {
          template: { sections: {}, order: [] },
          header: { sections: {}, order: [] },
          footer: { sections: {}, order: [] }
        },
        previewUrl: "/",
      }, { status: 400 });
    }

    console.log(`[Editor] Loading for Shop: ${session.shop}, Theme: ${themeIdParam}`);

    // Download theme data
    const themeData = await downloadThemeForEditor(admin, themeIdParam, templateParam);

    if (!themeData) {
      throw new Error("Theme data unavailable");
    }

    const previewUrl = `/apps/vsbuilder/api/render-local?themeId=${themeData.theme.numericId}&template=${templateParam}`;

    return json({
      appUrl,
      apiConfig,
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
      error: null,
    });
  } catch (error) {
    console.error("[Editor] Loader error:", error);
    return json({
      appUrl,
      apiConfig,
      shop: "",
      themeId: null,
      themeName: null,
      themeRole: null,
      sourceThemeId: null,
      currentTemplate: "index",
      availableTemplates: TEMPLATE_TYPES,
      initialData: {
        template: { sections: {}, order: [] },
        header: { sections: {}, order: [] },
        footer: { sections: {}, order: [] }
      },
      previewUrl: "/",
      error: "Failed to load editor. Please try again.",
    });
  }
};

/**
 * Editor Component
 */
export default function AppProxyEditor() {
  const data = useLoaderData<typeof loader>();

  if (!data) {
    return (
      <div style={{
        padding: '40px',
        textAlign: 'center',
        fontFamily: 'system-ui, sans-serif',
        color: '#fff',
        background: '#1a1a2e',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <h2 style={{ marginBottom: '16px' }}>Initializing Editor...</h2>
        <p style={{ color: '#94a3b8' }}>Please wait while we connect to the server.</p>
        <button
          onClick={() => window.location.reload()}
          style={{
            marginTop: '20px',
            padding: '10px 20px',
            background: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Reload Page
        </button>
      </div>
    );
  }

  return (
    <ClientOnlyEditor>
      <EditorCore
        loaderData={data as any}
        isProxyMode={true}
      />
    </ClientOnlyEditor>
  );
}

/**
 * Headers for App Proxy - Allow iframe embedding
 */
export function headers() {
  return {
    "Content-Security-Policy":
      "frame-ancestors https://*.myshopify.com https://admin.shopify.com",
  };
}
