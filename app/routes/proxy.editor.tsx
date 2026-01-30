/**
 * 🎨 App Proxy Editor Route
 * =========================
 * Mağaza domain'inde açılır, içinde uygulama sunucusundaki editörü iframe ile gösterir.
 * URL: https://STORE.myshopify.com/apps/vsbuilder/editor?themeId=XXX
 */
import { type LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    // App Proxy authentication
    const { session } = await authenticate.public.appProxy(request);

    if (!session) {
      return new Response("Unauthorized", { status: 401 });
    }

    const url = new URL(request.url);
    const themeId = url.searchParams.get("themeId") || "";
    const template = url.searchParams.get("template") || "index";

    // Build editor URL on application server
    const editorUrl = `https://vsbuilder.techifyboost.com/app/editor?themeId=${themeId}&template=${template}`;

    // Return full-page iframe wrapper
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>VSBuilder Editor</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    html, body {
      width: 100%;
      height: 100%;
      overflow: hidden;
    }
    .editor-frame {
      width: 100%;
      height: 100vh;
      border: none;
    }
    .loading-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: #f6f6f7;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      transition: opacity 0.3s ease;
    }
    .loading-overlay.hidden {
      opacity: 0;
      pointer-events: none;
    }
    .loading-spinner {
      width: 40px;
      height: 40px;
      border: 3px solid #e3e3e3;
      border-top-color: #5c6ac4;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    .loading-text {
      margin-top: 16px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 14px;
      color: #637381;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <div class="loading-overlay" id="loading">
    <div class="loading-spinner"></div>
    <div class="loading-text">Loading VSBuilder Editor...</div>
  </div>

  <iframe
    id="editor-frame"
    class="editor-frame"
    src="${editorUrl}"
    allow="clipboard-read; clipboard-write"
  ></iframe>

  <script>
    const iframe = document.getElementById('editor-frame');
    const loading = document.getElementById('loading');

    iframe.addEventListener('load', function() {
      setTimeout(function() {
        loading.classList.add('hidden');
      }, 500);
    });

    // Fallback: hide loading after 10 seconds anyway
    setTimeout(function() {
      loading.classList.add('hidden');
    }, 10000);
  </script>
</body>
</html>
    `;

    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "X-Frame-Options": "SAMEORIGIN",
      },
    });
  } catch (error) {
    console.error("[ProxyEditor] Error:", error);
    return new Response(`
      <!DOCTYPE html>
      <html>
      <head><title>Error</title></head>
      <body style="font-family: system-ui; padding: 40px; text-align: center;">
        <h1>Error Loading Editor</h1>
        <p>Please try again or contact support.</p>
        <button onclick="location.reload()" style="margin-top: 20px; padding: 10px 20px; cursor: pointer;">
          Retry
        </button>
      </body>
      </html>
    `, {
      status: 500,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
};
