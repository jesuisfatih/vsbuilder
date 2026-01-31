/**
 * Entry Client
 *
 * Proxy mode'da Remix routing'i bypass edip doğrudan EditorCore render ediyoruz.
 * Bu, hydration hatalarını tamamen ortadan kaldırır.
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

console.log('[entry.client] Mode:', isProxyMode ? 'PROXY' : 'ADMIN');
console.log('[entry.client] URL:', window.location.href);

if (isProxyMode) {
  // PROXY MODE: Extract data and render EditorCore directly
  // This completely bypasses Remix routing to avoid hydration issues

  const context = (window as any).__remixContext;
  let loaderData = null;

  if (context) {
    // Try to find loader data from various possible locations
    const serverRouteId = "routes/proxy.editor";

    if (context.loaderData?.[serverRouteId]) {
      loaderData = context.loaderData[serverRouteId];
    } else if (context.state?.loaderData?.[serverRouteId]) {
      loaderData = context.state.loaderData[serverRouteId];
    }

    if (loaderData) {
      console.log('[entry.client] Found loader data');
      (window as any).__VSBUILDER_DATA = loaderData;
    } else {
      console.warn('[entry.client] Could not find loader data!');
    }
  }

  // Dynamic import to avoid bundling issues
  import('./routes/app.editor').then(({ EditorCore }) => {
    // Clear the entire document and start fresh
    document.open();
    document.write(`
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>VSBuilder Editor</title>
          <link rel="stylesheet" href="/styles.css">
          <link rel="stylesheet" href="/tailwind.css">
        </head>
        <body>
          <div id="vsbuilder-root"></div>
        </body>
      </html>
    `);
    document.close();

    const data = (window as any).__VSBUILDER_DATA || loaderData;

    if (!data) {
      document.getElementById('vsbuilder-root')!.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; height: 100vh; background: #1a1a2e; color: white; font-family: system-ui;">
          <div style="text-align: center;">
            <h1 style="font-size: 24px; margin-bottom: 16px;">Error Loading Editor</h1>
            <p style="color: #94a3b8;">Could not load editor data. Please try again.</p>
            <button onclick="window.location.reload()" style="margin-top: 20px; padding: 10px 20px; background: #3b82f6; border: none; border-radius: 4px; color: white; cursor: pointer;">
              Reload
            </button>
          </div>
        </div>
      `;
      return;
    }

    console.log('[entry.client] Rendering EditorCore directly');

    startTransition(() => {
      createRoot(document.getElementById('vsbuilder-root')!).render(
        <StrictMode>
          <EditorCore loaderData={data} isProxyMode={true} />
        </StrictMode>
      );
    });
  }).catch(err => {
    console.error('[entry.client] Failed to load EditorCore:', err);
    document.body.innerHTML = `<div style="padding: 40px; color: red;">Failed to load editor: ${err.message}</div>`;
  });

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
