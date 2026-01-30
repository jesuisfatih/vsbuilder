/**
 * 🎨 App Proxy Editor Route
 * =========================
 * Mağaza domain'inde tam editor - App Proxy auth ile
 *
 * SSR'dan kaçınmak için ClientOnlyEditor wrapper kullanır.
 * Bu sayede hydration mismatch problemi ortadan kalkar.
 *
 * URL Flow:
 * https://dtfbank.com/apps/vsbuilder/editor
 *   ↓ (Shopify Proxy)
 * https://vsbuilder.techifyboost.com/proxy/editor
 *   ↓ (Bu route)
 * Minimal HTML (loading) + Client-side mount (full editor)
 */
import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { ClientOnlyEditor } from "../components/ClientOnlyEditor";
import { authenticate } from "../shopify.server";
import { downloadThemeForEditor } from "../utils/theme.server";
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

  // API endpoints configuration - ABSOLUTE URLs for proxy mode
  const apiConfig = {
    syncCheck: `${appUrl}/proxy/api.sync`,
    syncAction: `${appUrl}/proxy/api.sync`,
    renderLocal: `${appUrl}/proxy/api.render-local`,
    render: `${appUrl}/proxy/api.render`,
  };

  try {
    const { session, admin } = await authenticate.public.appProxy(request);

    if (!session || !admin) {
      console.error("[ProxyEditor] Authentication failed");
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
      console.error("[ProxyEditor] Missing themeId");
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

    console.log(`[ProxyEditor] Loading for Shop: ${session.shop}, Theme: ${themeIdParam}`);

    // Download theme data
    const themeData = await downloadThemeForEditor(admin, themeIdParam, templateParam);

    if (!themeData) {
      throw new Error("Theme data unavailable");
    }

    // Build preview URL - use absolute URL since we're in proxy context
    const previewUrl = `${appUrl}/proxy/api.render-local?themeId=${themeData.theme.numericId}&template=${templateParam}`;

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
    console.error("[ProxyEditor] Loader error:", error);
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
 * Proxy Editor Component
 * ClientOnlyEditor ile sarmalanmış - hydration mismatch olmaz
 */
export default function ProxyEditor() {
  const data = useLoaderData<typeof loader>();

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
 * Headers for App Proxy
 * Shopify iframe içinde açılabilmesi için gerekli
 */
export function headers() {
  return {
    "Content-Security-Policy":
      "frame-ancestors https://*.myshopify.com https://admin.shopify.com",
  };
}
