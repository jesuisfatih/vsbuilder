/**
 * 🎨 Proxy API - Local Theme Render
 * Handles local render requests when accessed via App Proxy
 * Route: /proxy/api.render-local
 */
import { json, type LoaderFunctionArgs } from "@remix-run/node";
import * as fs from "fs";
import * as path from "path";
import { authenticate } from "../shopify.server";
import { createShopifyLiquidEngine } from "../utils/liquidEngine.server";

const THEMES_DIR = process.env.THEMES_DIR || path.join(process.cwd(), "themes");

export const loader = async ({ request }: LoaderFunctionArgs) => {
  console.log("[ProxyApiRenderLocal] Request received");

  try {
    const { session, admin } = await authenticate.public.appProxy(request);

    if (!session) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const themeId = url.searchParams.get("themeId");
    const template = url.searchParams.get("template") || "index";
    const sectionId = url.searchParams.get("sectionId");

    if (!themeId) {
      return json({ error: "Missing themeId" }, { status: 400 });
    }

    const shopHandle = session.shop.replace(".myshopify.com", "");
    const themeDir = path.join(THEMES_DIR, shopHandle, themeId);

    if (!fs.existsSync(themeDir)) {
      return json({
        error: "Theme not found locally. Please sync the theme first.",
        needsSync: true
      }, { status: 404 });
    }

    const engine = createShopifyLiquidEngine(themeDir);

    let html: string;

    if (sectionId) {
      const sectionData = url.searchParams.get("sectionData");
      const context = sectionData ? JSON.parse(sectionData) : {};
      html = await engine.renderSection(sectionId, context);
    } else {
      html = await engine.renderPage(template);
    }

    // Inject editor communication script
    const editorScript = `
      <script>
        window.VSBuilder = {
          ready: false,
          init: function() {
            this.ready = true;
            window.parent.postMessage({ type: 'vsbuilder:ready' }, '*');
          },
          highlightSection: function(sectionId) {
            const el = document.getElementById('shopify-section-' + sectionId);
            if (el) {
              el.style.outline = '2px solid #5c5cf0';
              el.style.outlineOffset = '-2px';
            }
          },
          clearHighlight: function(sectionId) {
            const el = document.getElementById('shopify-section-' + sectionId);
            if (el) {
              el.style.outline = 'none';
            }
          }
        };

        document.addEventListener('click', function(e) {
          const link = e.target.closest('a');
          if (link && link.href) {
            e.preventDefault();
            window.parent.postMessage({
              type: 'vsbuilder:navigate',
              url: link.href
            }, '*');
          }
        });

        window.addEventListener('message', function(e) {
          if (e.data.type === 'vsbuilder:highlight') {
            VSBuilder.highlightSection(e.data.sectionId);
          }
          if (e.data.type === 'vsbuilder:clearHighlight') {
            VSBuilder.clearHighlight(e.data.sectionId);
          }
          if (e.data.type === 'vsbuilder:reload') {
            location.reload();
          }
        });

        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', function() {
            VSBuilder.init();
          });
        } else {
          VSBuilder.init();
        }
      </script>
    `;

    // Inject base URL for assets - use proxy route
    const baseUrl = `${url.origin}/proxy/assets?themeId=${themeId}&shopHandle=${shopHandle}&file=`;

    html = html.replace(/\/theme-assets\//g, baseUrl);
    html = html.replace(/\/theme-files\//g, baseUrl);

    if (html.includes("</body>")) {
      html = html.replace("</body>", `${editorScript}</body>`);
    } else {
      html += editorScript;
    }

    return json({ html, success: true });
  } catch (error) {
    console.error("[ProxyApiRenderLocal] Error:", error);
    return json({
      error: "Failed to render theme",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
};
