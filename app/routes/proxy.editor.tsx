/**
 * App Proxy Editor Route
 * URL: /apps/vsbuilder/editor → /proxy/editor
 *
 * This route serves the full-screen editor experience via App Proxy.
 * It bypasses cross-origin restrictions by running on the store's domain.
 */
import { type LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const { session } = await authenticate.public.appProxy(request);

    if (!session) {
      return new Response("Unauthorized: Invalid signature", { status: 401 });
    }

    const url = new URL(request.url);
    const themeId = url.searchParams.get("themeId") || "";

    // Clean themeId - remove GID prefix if present
    const cleanThemeId = themeId.replace('gid://shopify/OnlineStoreTheme/', '').replace('gid://shopify/Theme/', '');

    // Full-screen editor HTML
    // This will be rendered directly in the store's domain context
    return new Response(`
      {% layout none %}
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>VSBuilder Editor</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          html, body { height: 100%; overflow: hidden; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background: #1a1a2e;
            color: white;
          }
          .editor-container {
            display: flex;
            height: 100vh;
          }
          .sidebar {
            width: 320px;
            background: #16213e;
            border-right: 1px solid #0f3460;
            display: flex;
            flex-direction: column;
          }
          .sidebar-header {
            padding: 16px;
            background: #0f3460;
            border-bottom: 1px solid #1a1a2e;
          }
          .sidebar-header h1 {
            font-size: 18px;
            font-weight: 600;
            color: #e94560;
          }
          .sidebar-content {
            flex: 1;
            overflow-y: auto;
            padding: 16px;
          }
          .preview-area {
            flex: 1;
            display: flex;
            flex-direction: column;
          }
          .preview-toolbar {
            height: 48px;
            background: #0f3460;
            display: flex;
            align-items: center;
            padding: 0 16px;
            gap: 12px;
          }
          .preview-toolbar button {
            background: #e94560;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 500;
          }
          .preview-toolbar button:hover {
            background: #ff6b6b;
          }
          .preview-toolbar .url-bar {
            flex: 1;
            background: #1a1a2e;
            border: 1px solid #0f3460;
            border-radius: 6px;
            padding: 8px 12px;
            color: #888;
            font-size: 13px;
          }
          .preview-frame {
            flex: 1;
            background: white;
          }
          .preview-frame iframe {
            width: 100%;
            height: 100%;
            border: none;
          }
          .theme-info {
            background: #0f3460;
            padding: 12px;
            border-radius: 8px;
            margin-bottom: 16px;
          }
          .theme-info p {
            font-size: 13px;
            color: #888;
          }
          .theme-info strong {
            color: #e94560;
          }
          .section-list {
            list-style: none;
          }
          .section-item {
            background: #1a1a2e;
            padding: 12px;
            border-radius: 6px;
            margin-bottom: 8px;
            cursor: pointer;
            transition: background 0.2s;
          }
          .section-item:hover {
            background: #0f3460;
          }
          .loading {
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100%;
            color: #888;
          }
        </style>
      </head>
      <body>
        <div class="editor-container">
          <div class="sidebar">
            <div class="sidebar-header">
              <h1>🎨 VSBuilder</h1>
            </div>
            <div class="sidebar-content">
              <div class="theme-info">
                <p>Shop: <strong>${session.shop}</strong></p>
                <p>Theme ID: <strong>${cleanThemeId || 'Not selected'}</strong></p>
              </div>
              <h3 style="margin-bottom: 12px; font-size: 14px; color: #888;">Sections</h3>
              <ul class="section-list">
                <li class="section-item">📦 Header</li>
                <li class="section-item">🖼️ Hero Banner</li>
                <li class="section-item">🛍️ Featured Collection</li>
                <li class="section-item">📝 Rich Text</li>
                <li class="section-item">🔲 Footer</li>
              </ul>
            </div>
          </div>
          <div class="preview-area">
            <div class="preview-toolbar">
              <button onclick="window.location.reload()">↻ Refresh</button>
              <div class="url-bar">https://${session.shop}/</div>
              <button onclick="alert('Save functionality coming soon!')">💾 Save</button>
            </div>
            <div class="preview-frame">
              <iframe src="https://${session.shop}/?preview_theme_id=${cleanThemeId}" title="Preview"></iframe>
            </div>
          </div>
        </div>
      </body>
      </html>
    `, {
      headers: {
        "Content-Type": "application/liquid"
      }
    });

  } catch (error) {
    console.error("Proxy Editor Error:", error);
    return new Response(`
      {% layout none %}
      <!DOCTYPE html>
      <html>
      <head><title>Error</title></head>
      <body style="font-family: system-ui; padding: 2rem; background: #fee; color: #c00;">
        <h1>Editor Error</h1>
        <p>${error instanceof Error ? error.message : "Unknown error"}</p>
        <p><a href="javascript:history.back()">Go Back</a></p>
      </body>
      </html>
    `, {
      status: 500,
      headers: { "Content-Type": "application/liquid" }
    });
  }
};

export default function ProxyEditor() {
  return null;
}
