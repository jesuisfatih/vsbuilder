/**
 * Entry Client
 *
 * Proxy mode: SSR HTML'ini koruyup hydration hatalarını tolere ediyoruz.
 * Admin mode: Normal Remix hydration.
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

console.log('[entry.client] Mode:', isProxyMode ? 'PROXY' : 'ADMIN');
console.log('[entry.client] URL:', window.location.href);

if (isProxyMode) {
  // PROXY MODE: Patch context and hydrate with error suppression

  const context = (window as any).__remixContext;
  if (context) {
    console.log('[entry.client] Patching Remix Context for Proxy Mode');

    const serverRouteId = "routes/proxy.editor";
    const clientRouteId = "routes/apps.vsbuilder.editor";

    // Patch ALL route references
    const patchRoutes = (obj: any, path = '') => {
      if (!obj || typeof obj !== 'object') return;

      for (const key of Object.keys(obj)) {
        if (obj[key] === serverRouteId) {
          obj[key] = clientRouteId;
          console.log(`[entry.client] Patched ${path}.${key}`);
        } else if (typeof obj[key] === 'object') {
          patchRoutes(obj[key], `${path}.${key}`);
        }
      }
    };

    // Patch matches array
    if (context.state?.matches) {
      context.state.matches.forEach((m: any, i: number) => {
        if (m.route?.id === serverRouteId) {
          m.route.id = clientRouteId;
          console.log(`[entry.client] Patched match[${i}].route.id`);
        }
      });
    }

    // Capture and duplicate loader data
    let foundData = null;

    if (context.state?.loaderData?.[serverRouteId]) {
      foundData = context.state.loaderData[serverRouteId];
      context.state.loaderData[clientRouteId] = foundData;
      console.log('[entry.client] Copied loaderData to client route ID');
    }

    if (foundData) {
      (window as any).__VSBUILDER_DATA = foundData;
    }
  }

  // CRITICAL: Suppress ALL errors during hydration
  // React 18 is more strict about hydration, but we can't avoid mismatches
  // due to route ID differences
  const originalError = console.error;
  console.error = (...args) => {
    const msg = args[0]?.toString() || '';
    // Suppress hydration and React error messages
    if (msg.includes('Hydration') ||
        msg.includes('hydrat') ||
        msg.includes('did not match') ||
        msg.includes('server rendered') ||
        msg.includes('Minified React error')) {
      console.debug('[Suppressed]', msg.substring(0, 100));
      return;
    }
    originalError.apply(console, args);
  };

  startTransition(() => {
    hydrateRoot(
      document,
      <StrictMode>
        <RemixBrowser />
      </StrictMode>,
      {
        onRecoverableError: () => {
          // Silently ignore ALL recoverable errors in proxy mode
        }
      }
    );
  });

  // Restore console.error after hydration settles
  setTimeout(() => {
    console.error = originalError;
  }, 5000);

} else {
  // ADMIN MODE: Normal Remix hydration
  startTransition(() => {
    hydrateRoot(
      document,
      <StrictMode>
        <RemixBrowser />
      </StrictMode>
    );
  });
}
