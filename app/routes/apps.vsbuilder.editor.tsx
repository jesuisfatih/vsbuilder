/**
 * Frontend Route Alias
 *
 * Client-side router bu dosyayı kullanır çünkü URL /apps/vsbuilder/editor.
 * Server-side router ise proxy.editor.tsx kullanır çünkü URL /proxy/editor.
 *
 * Veri transferi için clientLoader kullanıyoruz.
 */

// UI Component ve Headers'ı aynen kullan
export { default, headers } from "./proxy.editor";

// Server Loader'ı export ETMİYORUZ.
// Çünkü client router'ın gereksiz fetch yapmasını (403 hatası) engellemek istiyoruz.
// Backend zaten proxy.editor.tsx loader'ını kullanıyor.

import type { ClientLoaderFunctionArgs } from "@remix-run/react";

// Client Loader
// Sunucuya istek atmak yerine, SSR sırasında yüklenmiş olan veriyi (context) kullanır.
export async function clientLoader({ request, params }: ClientLoaderFunctionArgs) {
  console.log('[apps.vsbuilder.editor] clientLoader running');

  if (typeof window !== 'undefined') {
    const context = (window as any).__remixContext;

    // Helper to find data in various possible context structures
    const findData = (key: string) => {
      // 1. Direct on context (some versions)
      if (context?.loaderData?.[key]) return context.loaderData[key];
      // 2. Inside state (most versions)
      if (context?.state?.loaderData?.[key]) return context.state.loaderData[key];
      return null;
    };

    const patchedData = findData("routes/apps.vsbuilder.editor");
    if (patchedData) {
      console.log('[apps.vsbuilder.editor] Found patched data');
      return patchedData;
    }

    const originalData = findData("routes/proxy.editor");
    if (originalData) {
      console.log('[apps.vsbuilder.editor] Found proxy.editor data, using it');
      return originalData;
    }
  }

  console.warn('[apps.vsbuilder.editor] No data found in context', (window as any).__remixContext);
  return null;
}

// Hydrate true olsa bile createRoot kullandığımız için ilk mount'ta çalışır
clientLoader.hydrate = true;
