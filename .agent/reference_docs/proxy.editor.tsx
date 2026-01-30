import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { ClientOnlyEditor } from "~/components/ClientOnlyEditor";
import { EditorCore } from "~/routes/app.editor"; // Mevcut editor component'iniz

/**
 * Proxy Editor Route
 * 
 * Shopify App Proxy üzerinden açılan editor için özel route.
 * SSR'dan kaçınmak için ClientOnlyEditor wrapper kullanır.
 * 
 * URL Flow:
 * https://dtfbank.com/apps/vsbuilder/editor
 *   ↓ (Shopify Proxy)
 * https://vsbuilder.techifyboost.com/proxy/editor
 *   ↓ (Bu route)
 * Minimal HTML + Client-side mount
 */

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  
  // Shopify proxy headers
  const shop = request.headers.get("x-shopify-shop-domain");
  const signature = request.headers.get("x-shopify-signature");
  
  // Query params
  const themeId = url.searchParams.get("themeId");
  const sessionToken = url.searchParams.get("token");

  // App URL (proxy endpoint'ler için)
  const appUrl = process.env.APP_URL || "https://vsbuilder.techifyboost.com";

  // API endpoints configuration
  const apiConfig = {
    // Tüm API istekleri /proxy/* üzerinden gitmeli
    syncCheck: `${appUrl}/proxy/api.sync`,
    syncAction: `${appUrl}/proxy/api.sync`,
    renderSection: `${appUrl}/proxy/api.render`,
  };

  return json({
    shop,
    themeId,
    sessionToken,
    appUrl,
    apiConfig,
    isProxyMode: true, // Flag to indicate proxy mode
  });
}

export default function ProxyEditor() {
  const loaderData = useLoaderData<typeof loader>();

  return (
    <ClientOnlyEditor>
      <EditorCore 
        loaderData={loaderData}
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
