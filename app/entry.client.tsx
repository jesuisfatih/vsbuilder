/**
 * Entry Client - Simplified for App Proxy
 *
 * IMPORTANT: We do NOT rewrite URLs anymore!
 * AppProxyProvider handles asset loading via <base href={appUrl}>
 */

import { RemixBrowser } from "@remix-run/react";
import { startTransition, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";

// Simply hydrate - no URL manipulation needed
// AppProxyProvider in proxy.editor.tsx handles everything
startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <RemixBrowser />
    </StrictMode>
  );
});
