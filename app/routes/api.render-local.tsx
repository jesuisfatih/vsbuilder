/**
 * 🎨 Local Theme Render API
 * =========================
 * İndirilen tema dosyalarını kendi sunucumuzda render eder.
 * Shopify'a bağlanmaz - tamamen lokal.
 */

import { json, type LoaderFunctionArgs } from "@remix-run/node";
import * as fs from "fs";
import * as path from "path";
import { authenticate } from "../shopify.server";
import { createShopifyLiquidEngine } from "../utils/liquidEngine.server";

// Theme storage directory
const THEMES_DIR = process.env.THEMES_DIR || path.join(process.cwd(), "themes");

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);

  const themeId = url.searchParams.get("themeId");
  const template = url.searchParams.get("template") || "index";
  const sectionId = url.searchParams.get("sectionId");

  if (!session || !themeId) {
    return json({ error: "Missing themeId" }, { status: 400 });
  }

  // Theme directory for this shop/theme
  const shopHandle = session.shop.replace(".myshopify.com", "");
  const themeDir = path.join(THEMES_DIR, shopHandle, themeId);

  // Check if theme exists locally
  if (!fs.existsSync(themeDir)) {
    return json({
      error: "Theme not found locally. Please sync the theme first.",
      needsSync: true
    }, { status: 404 });
  }

  try {
    const engine = createShopifyLiquidEngine(themeDir);

    let html: string;

    if (sectionId) {
      // Render single section
      const sectionData = url.searchParams.get("sectionData");
      const context = sectionData ? JSON.parse(sectionData) : {};
      html = await engine.renderSection(sectionId, context);
    } else {
      // Render full page
      html = await engine.renderPage(template);
    }

    // Inject editor communication script
    const editorScript = `
      <script>
        // VSBuilder Editor Communication
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

        // Prevent navigation
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

        // Listen for messages from editor
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

        // Initialize when DOM ready
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', function() {
            VSBuilder.init();
          });
        } else {
          VSBuilder.init();
        }
      </script>
    `;

    // Inject base URL for assets
    const baseUrl = `${url.origin}/api/theme-assets?themeId=${themeId}&shopHandle=${shopHandle}&file=`;

    // Rewrite asset URLs in HTML
    html = html.replace(/\/theme-assets\//g, baseUrl);
    html = html.replace(/\/theme-files\//g, baseUrl);

    // Inject editor script before </body>
    if (html.includes("</body>")) {
      html = html.replace("</body>", `${editorScript}</body>`);
    } else {
      html += editorScript;
    }

    // Return as JSON for useFetcher compatibility
    return json({ html, success: true });
  } catch (error) {
    console.error("Theme render error:", error);
    return json({
      error: "Failed to render theme",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
};
