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

    // 1. Zaten patchlenmiş veriyi kontrol et
    if (context?.loaderData?.["routes/apps.vsbuilder.editor"]) {
      console.log('[apps.vsbuilder.editor] Found patched data');
      return context.loaderData["routes/apps.vsbuilder.editor"];
    }

    // 2. Orijinal proxy.editor verisini kontrol et
    if (context?.loaderData?.["routes/proxy.editor"]) {
      console.log('[apps.vsbuilder.editor] Found proxy.editor data, using it');
      return context.loaderData["routes/proxy.editor"];
    }
  }

  console.warn('[apps.vsbuilder.editor] No data found in context');
  return null;
}

// Hydrate true olsa bile createRoot kullandığımız için ilk mount'ta çalışır
clientLoader.hydrate = true;
