/**
 * Entry Client
 *
 * Proxy mode'da hydration yerine fresh render yapıyoruz.
 * Bu sayede SSR HTML'i ile client render arasındaki mismatch problemi ortadan kalkıyor.
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
  // In proxy mode, don't try to hydrate - just render fresh
  // This completely avoids hydration mismatch
  // RemixBrowser will use __remixContext from SSR to know which route to render
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
