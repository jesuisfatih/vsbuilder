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

    // Server ID is usually "routes/proxy.editor"
    const serverRouteId = "routes/proxy.editor";
    const clientRouteId = "routes/apps.vsbuilder.editor";

    // Update matches to point to the client route ID
    // Matches might be in context.state.matches or context.matches
    const matches = context.matches || context.state?.matches;
    if (matches) {
      matches.forEach((m: any) => {
        if (m.route && m.route.id === serverRouteId) {
          console.log(`[entry.client] Patching match ID: ${serverRouteId} -> ${clientRouteId}`);
          m.route.id = clientRouteId;
        }
      });
    }

    // Patch loaderData
    // Might be in context.loaderData or context.state.loaderData
    if (context.loaderData && context.loaderData[serverRouteId]) {
      console.log(`[entry.client] Patching loaderData (root): ${serverRouteId} -> ${clientRouteId}`);
      context.loaderData[clientRouteId] = context.loaderData[serverRouteId];
    }

    if (context.state?.loaderData && context.state.loaderData[serverRouteId]) {
      console.log(`[entry.client] Patching loaderData (state): ${serverRouteId} -> ${clientRouteId}`);
      context.state.loaderData[clientRouteId] = context.state.loaderData[serverRouteId];
    }
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
