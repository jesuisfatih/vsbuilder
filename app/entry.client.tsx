/**
 * Entry Client
 *
 * Proxy mode'da hydration yerine fresh render yapıyoruz.
 * Ve route ID uyuşmazlığını (Server: /proxy/editor vs Client: /apps/vsbuilder/editor)
 * context patching ile çözüyoruz.
 */

import { RemixBrowser } from "@remix-run/react";
import { startTransition, StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";

// Check if we're in proxy mode (accessed via Shopify storefront)
const isProxyMode = typeof window !== 'undefined' && (
  window.location.pathname.startsWith('/apps/') ||
  window.location.hostname.includes('.myshopify.com') ||
  // Also check if we're on a custom domain (not our backend)
  !window.location.hostname.includes('vsbuilder.techifyboost.com')
);

console.log('[entry.client] Mode:', isProxyMode ? 'PROXY (fresh render)' : 'ADMIN (hydration)');
console.log('[entry.client] URL:', window.location.href);

if (isProxyMode) {
  // PATCH: Route ID Mismatch Fix
  // Server rendered "routes/proxy.editor" but Client Router expects "routes/apps.vsbuilder.editor"
  // based on the URL pathname. We map the SSR data to the client route ID.
  const context = (window as any).__remixContext;
  if (context) {
    console.log('[entry.client] Patching Remix Context for Proxy Mode');

    // 1. Find the server route match using the file path convention
    // Server ID is usually "routes/proxy.editor"
    const serverRouteId = "routes/proxy.editor";
    const clientRouteId = "routes/apps.vsbuilder.editor";

    // 2. If we have data for the server route, alias it to the client route
    if (context.routeModules && context.routeModules[serverRouteId]) {
      // Note: routeModules are usually dynamically loaded, but manifests strictly map IDs
    }

    // 3. Update matches to point to the client route ID
    if (context.matches) {
      context.matches.forEach((m: any) => {
        if (m.route && m.route.id === serverRouteId) {
          console.log(`[entry.client] Patching match ID: ${serverRouteId} -> ${clientRouteId}`);
          m.route.id = clientRouteId;
        }
      });
    }

    // 4. Also patch the loaderData key using the client ID
    if (context.loaderData && context.loaderData[serverRouteId]) {
      console.log(`[entry.client] Patching loaderData: ${serverRouteId} -> ${clientRouteId}`);
      context.loaderData[clientRouteId] = context.loaderData[serverRouteId];
      // Keep serverRouteId data just in case? Or delete? Keep it.
    }

    // 5. IMPORTANT: Make sure the manifest knows about the aliasing if needed
    // But Remix uses window.__remixManifest for route definitions.
    // The "routes/apps.vsbuilder.editor" needs to exist in the manifest!
    // Since we created the file, it SHOULD exist.
  }

  // Pure Client Render
  startTransition(() => {
    createRoot(document).render(
      <StrictMode>
        <RemixBrowser />
      </StrictMode>
    );
  });
} else {
  // Normal hydration for admin routes
  startTransition(() => {
    hydrateRoot(
      document,
      <StrictMode>
        <RemixBrowser />
      </StrictMode>
    );
  });
}
