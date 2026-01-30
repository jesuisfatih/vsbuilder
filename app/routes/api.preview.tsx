import { type LoaderFunctionArgs, json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const themeId = url.searchParams.get("themeId");
  const template = url.searchParams.get("template") || "index"; // e.g. 'product', 'collection'

  if (!session || !themeId) {
    return new Response("Missing parameters", { status: 400 });
  }

  try {
    const shopUrl = `https://${session.shop}`;
    // Fetch the storefront page
    // We should pass the preview_theme_id to see the draft
    // If template is index, url is /. If product, we need a product URL?
    // For simplicity, let's start with Homepage and handle dynamic routes later or fetch from context?
    // Actually, PageFly asks user to select a product to preview for Product Templates.
    // For now, let's just fetch root / and hope.

    // Better: Allow passing a 'path' param.
    const path = url.searchParams.get("path") || "/";
    const fetchUrl = `${shopUrl}${path}${path.includes('?') ? '&' : '?'}preview_theme_id=${themeId}`;

    const response = await fetch(fetchUrl, {
       // Pass some headers to mimic a browser if needed, but usually not required for public access
       headers: {
         "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
       }
    });

    // Handle redirects (fetch handles them by default usually)

    if (!response.ok) {
        return new Response(`Failed to fetch preview: ${response.statusText}`, { status: response.status });
    }

    let html = await response.text();

    // Check password
    if (html.includes('id="password-login"') || html.includes('type="password"')) {
         return new Response(
           `<html><body style="font-family:system-ui;padding:2rem;text-align:center;">
              <h2>Store is Password Protected</h2>
              <p>Please disable the storefront password to use the editor.</p>
              <a href="https://${session.shop}/admin/online_store/preferences" target="_blank" style="color:blue;">Go to Preferences</a>
            </body></html>`,
           { headers: { "Content-Type": "text/html" } }
         );
    }

    // INJECTIONS
    // 1. Base Tag for assets
    if (!html.includes("<base")) {
      html = html.replace("<head>", `<head><base href="${shopUrl}/">`);
    } else {
        // If base exists (rare), replace it? Usually themes don't have it.
    }

    // 2. Inject Editor Communication Script
    // This script will listen to postMessages from the parent (Editor) and update the DOM
    const script = `
    <script>
      window.addEventListener('message', function(event) {
        if (event.data.type === 'vsbuilder:section:update') {
           // Handle section update
           const { sectionId, html } = event.data;
           // Find section and replace
           // Shopify sections usually have div id="shopify-section-{id}"
           // or similar.
           // However, for pure preview proxy, we just reload or use sophisticated replacement.
           // For now, let's start with basic viewing.
        }
      });

      // Prevent navigation
      document.addEventListener('click', function(e) {
        if (e.target.closest('a')) {
           e.preventDefault();
           console.log('Navigation prevented in editor');
           // Optionally notify parent
        }
      });

      // Notify parent ready
      window.parent.postMessage({ type: 'vsbuilder:ready' }, '*');
    </script>
    `;

    html = html.replace("</body>", `${script}</body>`);

    // Return HTML wrapping in JSON for useFetcher compatibility
    return json({ html });

  } catch (error) {
    console.error("Preview proxy error:", error);
    return json({ error: "Internal Proxy Error" }, { status: 500 });
  }
};
