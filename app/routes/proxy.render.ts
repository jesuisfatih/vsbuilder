/**
 * 🎨 App Proxy Render Route
 * =========================
 * Renders theme using local Liquid engine
 * Bypasses Shopify for true independence
 */
import { type LoaderFunctionArgs } from "@remix-run/node";
import * as fs from "fs";
import * as path from "path";
import { authenticate } from "../shopify.server";
import { createShopifyLiquidEngine } from "../utils/liquidEngine.server";

const THEMES_DIR = process.env.THEMES_DIR || path.join(process.cwd(), "themes");

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const { session } = await authenticate.public.appProxy(request);

    if (!session) {
      return new Response("Unauthorized", { status: 401 });
    }

    const url = new URL(request.url);
    const themeId = url.searchParams.get("themeId") || "";
    const template = url.searchParams.get("template") || "index";
    const sectionId = url.searchParams.get("sectionId");

    // Clean themeId
    const cleanThemeId = themeId.replace('gid://shopify/OnlineStoreTheme/', '').replace('gid://shopify/Theme/', '');
    const shopHandle = session.shop.replace(".myshopify.com", "");

    if (!cleanThemeId) {
      return new Response(`
        <!DOCTYPE html>
        <html>
        <head><title>No Theme</title></head>
        <body style="font-family: system-ui; padding: 2rem; background: #f5f5f5;">
          <h1>No Theme Selected</h1>
          <p>Please select a theme to preview.</p>
        </body>
        </html>
      `, {
        headers: { "Content-Type": "text/html; charset=utf-8" }
      });
    }

    // Theme directory
    const themeDir = path.join(THEMES_DIR, shopHandle, cleanThemeId);

    // Check if theme exists locally
    if (!fs.existsSync(themeDir)) {
      return new Response(`
        <!DOCTYPE html>
        <html>
        <head><title>Theme Not Synced</title></head>
        <body style="font-family: system-ui; padding: 2rem; background: #fff3cd; color: #856404;">
          <h1>⏳ Theme Not Synced</h1>
          <p>This theme hasn't been downloaded yet. Please wait while we sync it...</p>
          <script>
            // Auto-retry after sync
            setTimeout(() => location.reload(), 3000);
          </script>
        </body>
        </html>
      `, {
        headers: { "Content-Type": "text/html; charset=utf-8" }
      });
    }

    // Create Liquid engine
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
        // VSBuilder Preview Communication
        window.VSBuilder = {
          ready: false,
          highlightedSection: null,

          init: function() {
            this.ready = true;
            window.parent.postMessage({ type: 'vsbuilder:ready' }, '*');
            this.setupClickHandlers();
          },

          setupClickHandlers: function() {
            // Add click handlers to sections
            document.querySelectorAll('[id^="shopify-section-"]').forEach(section => {
              section.style.cursor = 'pointer';
              section.addEventListener('click', (e) => {
                e.stopPropagation();
                const sectionId = section.id.replace('shopify-section-', '');
                window.parent.postMessage({
                  type: 'vsbuilder:sectionClick',
                  sectionId: sectionId,
                  group: 'template'
                }, '*');
              });

              // Hover effects
              section.addEventListener('mouseenter', () => {
                if (this.highlightedSection !== section) {
                  section.style.outline = '2px dashed rgba(139, 92, 246, 0.5)';
                  section.style.outlineOffset = '-2px';
                }
              });

              section.addEventListener('mouseleave', () => {
                if (this.highlightedSection !== section) {
                  section.style.outline = 'none';
                }
              });
            });
          },

          highlightSection: function(sectionId) {
            this.clearAllHighlights();
            const el = document.getElementById('shopify-section-' + sectionId);
            if (el) {
              el.style.outline = '3px solid #8b5cf6';
              el.style.outlineOffset = '-3px';
              el.style.boxShadow = '0 0 20px rgba(139, 92, 246, 0.3)';
              this.highlightedSection = el;
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          },

          clearAllHighlights: function() {
            document.querySelectorAll('[id^="shopify-section-"]').forEach(el => {
              el.style.outline = 'none';
              el.style.boxShadow = 'none';
            });
            this.highlightedSection = null;
          }
        };

        // Prevent navigation
        document.addEventListener('click', function(e) {
          const link = e.target.closest('a');
          if (link && link.href && !link.href.startsWith('javascript:')) {
            e.preventDefault();
            window.parent.postMessage({
              type: 'vsbuilder:navigate',
              url: link.href
            }, '*');
          }
        });

        // Prevent form submissions
        document.addEventListener('submit', function(e) {
          e.preventDefault();
          console.log('Form submission blocked in preview');
        });

        // Listen for messages from editor
        window.addEventListener('message', function(e) {
          if (!e.data || !e.data.type) return;

          switch(e.data.type) {
            case 'vsbuilder:highlight':
              VSBuilder.highlightSection(e.data.sectionId);
              break;
            case 'vsbuilder:clearHighlight':
              VSBuilder.clearAllHighlights();
              break;
            case 'vsbuilder:reload':
              location.reload();
              break;
            case 'vsbuilder:updateSettings':
              // Handle live settings update
              break;
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

      <style>
        /* VSBuilder Preview Overlay Styles */
        [id^="shopify-section-"] {
          position: relative;
        }

        [id^="shopify-section-"]:hover::before {
          content: '';
          position: absolute;
          inset: 0;
          background: rgba(139, 92, 246, 0.03);
          pointer-events: none;
          z-index: 9998;
        }
      </style>
    `;

    // Build asset base URL
    const assetBaseUrl = `/apps/vsbuilder/assets?themeId=${cleanThemeId}&shopHandle=${shopHandle}&file=`;

    // Rewrite asset URLs
    html = html.replace(/\/theme-assets\//g, assetBaseUrl);
    html = html.replace(/\/theme-files\//g, assetBaseUrl);
    html = html.replace(/{{ 'assets\//g, `{{ '${assetBaseUrl}`);

    // Inject editor script before </body>
    if (html.includes("</body>")) {
      html = html.replace("</body>", `${editorScript}</body>`);
    } else {
      html += editorScript;
    }

    // Add base tag for relative URLs
    if (html.includes("<head>")) {
      html = html.replace("<head>", `<head><base href="https://${session.shop}/">`);
    }

    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "X-Frame-Options": "SAMEORIGIN",
      },
    });

  } catch (error) {
    console.error("[ProxyRender] Error:", error);
    return new Response(`
      <!DOCTYPE html>
      <html>
      <head><title>Render Error</title></head>
      <body style="font-family: system-ui; padding: 2rem; background: #fee2e2; color: #dc2626;">
        <h1>❌ Render Error</h1>
        <p>${error instanceof Error ? error.message : "Unknown error occurred"}</p>
        <p style="color: #666; font-size: 14px;">Please check that all theme files are properly synced.</p>
        <button onclick="location.reload()" style="background: #dc2626; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; margin-top: 16px;">
          Retry
        </button>
      </body>
      </html>
    `, {
      status: 500,
      headers: { "Content-Type": "text/html; charset=utf-8" }
    });
  }
};
