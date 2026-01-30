/**
 * Entry Client - URL Normalization for App Proxy
 * Browser URL: /apps/vsbuilder/editor or /en-us/apps/vsbuilder/editor
 * Internal Route: /proxy/editor
 *
 * We normalize the URL before React hydration so Router can match correctly.
 */

import { RemixBrowser } from "@remix-run/react";
import { startTransition, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";

// Normalize App Proxy URLs to internal route format BEFORE hydration
function normalizeAppProxyUrl() {
  const pathname = window.location.pathname;

  // Pattern: /apps/vsbuilder/... or /XX-XX/apps/vsbuilder/...
  // Convert to: /proxy/...
  const appProxyPattern = /^(\/[a-z]{2}-[a-z]{2})?\/apps\/vsbuilder\//;

  if (appProxyPattern.test(pathname)) {
    const newPath = pathname.replace(appProxyPattern, '/proxy/');
    console.log('[entry.client] Normalizing URL:', pathname, '->', newPath);
    window.history.replaceState(null, '', newPath + window.location.search);
  }
}

// Normalize URL before hydration
normalizeAppProxyUrl();

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <RemixBrowser />
    </StrictMode>
  );
});
