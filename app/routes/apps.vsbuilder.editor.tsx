/**
 * 🎨 App Proxy Editor Route
 * =========================
 * Bu dosya hem Admin Proxy hem de Client tarafında kullanılır
 * Route ID: routes/apps.vsbuilder.editor
 * URL: /apps/vsbuilder/editor
 */
import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import * as fs from "fs";
import { ClientOnlyEditor } from "../components/ClientOnlyEditor";
import { authenticate } from "../shopify.server";
import { getMinimalEditorScript } from "../utils/editorBridge";
import { createShopifyLiquidEngine } from "../utils/liquidEngine.server";
import { deleteThemeFolder, downloadThemeForEditor, getLocalThemePath, isThemeSyncedProperly, saveThemeToLocal } from "../utils/theme.server";
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

    const shopHandle = session.shop.replace(".myshopify.com", "");

    // Check if theme is properly synced using hash verification
    const isSynced = isThemeSyncedProperly(shopHandle, themeIdParam);

    if (!isSynced) {
      // Delete old/corrupted folder and re-sync
      console.log(`[Editor] Theme not properly synced, deleting and re-syncing...`);
      deleteThemeFolder(shopHandle, themeIdParam);

      const syncResult = await saveThemeToLocal(admin, themeIdParam, shopHandle);
      if (syncResult) {
        console.log(`[Editor] Theme synced successfully!`);
      } else {
        console.error(`[Editor] Theme sync failed!`);
      }
    } else {
      console.log(`[Editor] Theme already properly synced`);
    }

    // Download theme data (structure, templates, etc.)
    const themeData = await downloadThemeForEditor(admin, themeIdParam, templateParam);

    if (!themeData) {
      throw new Error("Theme data unavailable");
    }

    // ======================================
    // PRE-RENDER: Generate HTML server-side
    // ======================================
    let preRenderedHtml = "";
    let renderError = null;

    try {
      console.log(`[Editor] Pre-rendering template: ${templateParam}`);
      const themeDir = getLocalThemePath(shopHandle, themeIdParam);

      if (fs.existsSync(themeDir)) {
        const engine = createShopifyLiquidEngine(themeDir);
        preRenderedHtml = await engine.renderPage(templateParam);

        // Inject base styles
        const baseStyles = `
          <style>
            *, *::before, *::after { box-sizing: border-box; }
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a2e; margin: 0; padding: 0; }
            img { max-width: 100%; height: auto; }
            a { color: inherit; }
            .shopify-section { padding: 20px 0; border-bottom: 1px solid #eee; }
            .shopify-section:hover { outline: 2px dashed #5c5cf0; outline-offset: -2px; }
            .grid { display: grid; gap: 20px; }
            .page-width, .container { max-width: 1200px; margin: 0 auto; padding: 0 20px; }
            h1, h2, h3 { margin-top: 0; line-height: 1.2; }
          </style>
        `;

        // Inject editor script
        const editorScript = getMinimalEditorScript();

        // Rewrite asset URLs
        const assetBaseUrl = `/apps/vsbuilder/assets?themeId=${themeIdParam}&shopHandle=${shopHandle}&file=`;
        preRenderedHtml = preRenderedHtml.replace(/\/theme-assets\//g, assetBaseUrl);
        preRenderedHtml = preRenderedHtml.replace(/\/theme-files\//g, assetBaseUrl);

        // Inject styles and script
        if (preRenderedHtml.includes("</head>")) {
          preRenderedHtml = preRenderedHtml.replace("</head>", `${baseStyles}</head>`);
        } else {
          preRenderedHtml = baseStyles + preRenderedHtml;
        }

        if (preRenderedHtml.includes("</body>")) {
          preRenderedHtml = preRenderedHtml.replace("</body>", `${editorScript}</body>`);
        } else {
          preRenderedHtml += editorScript;
        }

        console.log(`[Editor] Pre-render complete: ${preRenderedHtml.length} bytes`);
      } else {
        renderError = "Theme directory not found";
      }
    } catch (err) {
      console.error("[Editor] Pre-render error:", err);
      renderError = err instanceof Error ? err.message : "Unknown render error";
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
      preRenderedHtml,  // NEW: Pre-rendered HTML from server
      renderError,      // NEW: Any render error
      themeSynced: true, // NEW: Theme is definitely synced
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

/**
 * Client Loader - Prevents Remix from fetching loader data client-side
 * This is critical because client-side fetch won't have Shopify signature
 * and will get 403 from authenticate.public.appProxy
 */
import type { ClientLoaderFunctionArgs } from "@remix-run/react";

export async function clientLoader({ serverLoader }: ClientLoaderFunctionArgs) {
  console.log('[apps.vsbuilder.editor] clientLoader - looking for SSR data');

  // Try to get data from Remix context (SSR data)
  if (typeof window !== 'undefined') {
    const context = (window as any).__remixContext;

    // Server uses proxy.editor route, client expects apps.vsbuilder.editor
    // We need to check BOTH route IDs
    const routeIds = [
      "routes/apps.vsbuilder.editor",  // Client route
      "routes/proxy.editor",            // Server route (via App Proxy)
    ];

    for (const routeId of routeIds) {
      const data = context?.state?.loaderData?.[routeId] ||
                   context?.loaderData?.[routeId];

      if (data) {
        console.log(`[apps.vsbuilder.editor] Found SSR data from route: ${routeId}`);
        return data;
      }
    }
  }

  console.warn('[apps.vsbuilder.editor] No SSR data found in any route');
  return null;
}

// This tells Remix to run clientLoader during hydration
clientLoader.hydrate = true;
