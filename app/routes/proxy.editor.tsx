/**
 * 🎨 App Proxy Editor Route
 * =========================
 * Mağaza domain'inde tam editor - App Proxy auth ile
 * URL: https://STORE.myshopify.com/apps/vsbuilder/editor?themeId=XXX
 */
import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { downloadThemeForEditor } from "../utils/theme.server";

// app.editor.tsx'den component'i import et
import EditorComponent from "./app.editor";

// Available template types
const TEMPLATE_TYPES = [
  { value: "index", label: "Home page", path: "templates/index.json" },
  { value: "product", label: "Product pages", path: "templates/product.json" },
  { value: "collection", label: "Collection pages", path: "templates/collection.json" },
  { value: "page", label: "Pages", path: "templates/page.json" },
  { value: "blog", label: "Blog", path: "templates/blog.json" },
  { value: "article", label: "Article", path: "templates/article.json" },
  { value: "cart", label: "Cart", path: "templates/cart.json" },
  { value: "search", label: "Search results", path: "templates/search.json" },
  { value: "404", label: "404 page", path: "templates/404.json" },
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  console.log('[ProxyEditor] === Loader starting ===');

  try {
    // App Proxy authentication - mağaza domain'inden gelen istekler için
    const { admin, session } = await authenticate.public.appProxy(request);

    if (!session) {
      console.error('[ProxyEditor] No session');
      return json({
        shop: "",
        themeId: null,
        themeName: null,
        themeRole: null,
        sourceThemeId: null,
        currentTemplate: "index",
        availableTemplates: TEMPLATE_TYPES,
        initialData: {
          template: { sections: {}, order: [] as string[] },
          header: { sections: {}, order: [] as string[] },
          footer: { sections: {}, order: [] as string[] },
        },
        previewUrl: "/",
        error: "Unauthorized - No session",
      });
    }

    const url = new URL(request.url);
    const themeIdParam = url.searchParams.get("themeId");
    const templateParam = url.searchParams.get("template") || "index";

    console.log('[ProxyEditor] Theme ID:', themeIdParam);
    console.log('[ProxyEditor] Template:', templateParam);
    console.log('[ProxyEditor] Shop:', session.shop);

    if (!admin) {
      console.error('[ProxyEditor] No admin context');
      return json({
        shop: session.shop,
        themeId: null,
        themeName: null,
        themeRole: null,
        sourceThemeId: null,
        currentTemplate: templateParam,
        availableTemplates: TEMPLATE_TYPES,
        initialData: {
          template: { sections: {}, order: [] as string[] },
          header: { sections: {}, order: [] as string[] },
          footer: { sections: {}, order: [] as string[] },
        },
        previewUrl: "/",
        error: "Admin context not available.",
      });
    }

    if (!themeIdParam) {
      console.error('[ProxyEditor] No theme ID provided');
      return json({
        shop: session.shop,
        themeId: null,
        themeName: null,
        themeRole: null,
        sourceThemeId: null,
        currentTemplate: templateParam,
        availableTemplates: TEMPLATE_TYPES,
        initialData: {
          template: { sections: {}, order: [] as string[] },
          header: { sections: {}, order: [] as string[] },
          footer: { sections: {}, order: [] as string[] },
        },
        previewUrl: "/",
        error: "No theme selected. Please go back and select a theme.",
      });
    }

    // Download theme data
    console.log('[ProxyEditor] Calling downloadThemeForEditor...');
    const themeData = await downloadThemeForEditor(admin, themeIdParam, templateParam);

    if (!themeData) {
      console.error('[ProxyEditor] downloadThemeForEditor returned null');
      return json({
        shop: session.shop,
        themeId: null,
        themeName: null,
        themeRole: null,
        sourceThemeId: null,
        currentTemplate: templateParam,
        availableTemplates: TEMPLATE_TYPES,
        initialData: {
          template: { sections: {}, order: [] as string[] },
          header: { sections: {}, order: [] as string[] },
          footer: { sections: {}, order: [] as string[] },
        },
        previewUrl: "/",
        error: "Failed to download theme data. Please try again.",
      });
    }

    console.log('[ProxyEditor] Theme downloaded successfully');
    console.log('[ProxyEditor] Theme name:', themeData.theme.name);

    // Build preview URL - kendi render motorumuzu kullan
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
      error: null,
    });
  } catch (error) {
    console.error("[ProxyEditor] Loader error:", error);
    return json({
      shop: "",
      themeId: null,
      themeName: null,
      themeRole: null,
      sourceThemeId: null,
      currentTemplate: "index",
      availableTemplates: TEMPLATE_TYPES,
      initialData: {
        template: { sections: {}, order: [] as string[] },
        header: { sections: {}, order: [] as string[] },
        footer: { sections: {}, order: [] as string[] },
      },
      previewUrl: "/",
      error: "Failed to load editor. Please try again.",
    });
  }
};

// Mevcut app.editor.tsx component'ini kullan
export default EditorComponent;
