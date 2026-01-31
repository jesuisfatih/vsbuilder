/**
 * Entry Client
 *
 * Standard Remix hydration.
 * Route ID mismatch artık yok çünkü tek route kullanıyoruz.
 */

import { RemixBrowser } from "@remix-run/react";
import { startTransition, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";

// Detect mode for logging
const isProxyMode = typeof window !== 'undefined' && (
  window.location.pathname.startsWith('/apps/') ||
  window.location.hostname.includes('.myshopify.com') ||
  !window.location.hostname.includes('vsbuilder.techifyboost.com')
);

console.log('[entry.client] Mode:', isProxyMode ? 'PROXY' : 'ADMIN');
console.log('[entry.client] URL:', window.location.href);

// Standard Remix hydration - no special handling needed
// Because server and client now use the same route ID
startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <RemixBrowser />
    </StrictMode>
  );
});
