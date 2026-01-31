/**
 * Entry Client
 *
 * Proxy mode'da hydration yerine fresh render yapıyoruz.
 * Ve route ID uyuşmazlığını context patching ile çözüyoruz.
 */

import { RemixBrowser } from "@remix-run/react";
import { startTransition, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";

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
  const context = (window as any).__remixContext;
  if (context) {
    console.log('[entry.client] Patching Remix Context for Proxy Mode');

    const serverRouteId = "routes/proxy.editor";
    const clientRouteId = "routes/apps.vsbuilder.editor";

    // Update matches
    const matches = context.matches || context.state?.matches;
    if (matches) {
      matches.forEach((m: any) => {
        if (m.route && m.route.id === serverRouteId) {
          console.log(`[entry.client] Patching match ID: ${serverRouteId} -> ${clientRouteId}`);
          m.route.id = clientRouteId;
        }
      });
    }

    // Capture data directly from source
    let foundData = null;

    // Check root loaderData
    if (context.loaderData && context.loaderData[serverRouteId]) {
      foundData = context.loaderData[serverRouteId];
      context.loaderData[clientRouteId] = foundData;
      console.log(`[entry.client] Patched root loaderData`);
    }

    // Check state loaderData
    if (context.state?.loaderData && context.state.loaderData[serverRouteId]) {
      foundData = context.state.loaderData[serverRouteId];
      context.state.loaderData[clientRouteId] = foundData;
      console.log(`[entry.client] Patched state loaderData`);
    }

    // Store globally for failsafe access
    if (foundData) {
      console.log('[entry.client] Saving data to global __VSBUILDER_DATA');
      (window as any).__VSBUILDER_DATA = foundData;
    } else {
      console.warn('[entry.client] Could not find any data to patch!');
    }
  }

  // Use hydrateRoot but suppress hydration mismatch errors
  // This is necessary because server renders with proxy.editor route
  // but client expects apps.vsbuilder.editor route
  startTransition(() => {
    hydrateRoot(
      document,
      <StrictMode>
        <RemixBrowser />
      </StrictMode>,
      {
        onRecoverableError: (error: unknown) => {
          // Silently ignore hydration mismatch errors in proxy mode
          // These are expected due to route ID differences
          const errorMessage = error instanceof Error ? error.message : String(error);
          if (errorMessage.includes('Hydration') || errorMessage.includes('hydrat')) {
            console.debug('[Hydration] Suppressed error:', errorMessage.substring(0, 100));
          } else {
            console.error('[React] Error:', error);
          }
        }
      }
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
