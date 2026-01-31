/**
 * 🎨 Proxy API - Local Theme Render
 * Handles local render requests when accessed via App Proxy
 * Route: /proxy/api.render-local
 */
import { json, type LoaderFunctionArgs } from "@remix-run/node";
import * as fs from "fs";
import * as path from "path";
import { authenticate } from "../shopify.server";
import { getMinimalEditorScript } from "../utils/editorBridge";
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

    // Inject base styles for preview (fallback when theme CSS fails)
    const baseStyles = `
      <style>
        /* VSBuilder Preview Base Styles */
        *, *::before, *::after { box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          line-height: 1.6;
          color: #1a1a2e;
          margin: 0;
          padding: 0;
        }
        img { max-width: 100%; height: auto; }
        a { color: inherit; }
        .shopify-section {
          padding: 20px 0;
          border-bottom: 1px solid #eee;
        }
        .shopify-section:hover {
          outline: 2px dashed #5c5cf0;
          outline-offset: -2px;
        }
        /* Grid system */
        .grid { display: grid; gap: 20px; }
        .grid--2-col { grid-template-columns: repeat(2, 1fr); }
        .grid--3-col { grid-template-columns: repeat(3, 1fr); }
        .grid--4-col { grid-template-columns: repeat(4, 1fr); }
        /* Container */
        .page-width, .container { max-width: 1200px; margin: 0 auto; padding: 0 20px; }
        /* Buttons */
        .button, .btn {
          display: inline-block;
          padding: 12px 24px;
          background: #1a1a2e;
          color: white;
          text-decoration: none;
          border-radius: 4px;
        }
        /* Headings */
        h1, h2, h3, h4, h5, h6 { margin-top: 0; line-height: 1.2; }
        h1 { font-size: 2.5rem; }
        h2 { font-size: 2rem; }
        h3 { font-size: 1.5rem; }
      </style>
    `;

    // Get editor communication script from shared module
    const editorScript = getMinimalEditorScript();

    // Inject base URL for assets - use relative proxy route
    // This goes through Shopify proxy (/apps/vsbuilder/...) -> our backend (/proxy/...)
    const baseUrl = `/apps/vsbuilder/assets?themeId=${themeId}&shopHandle=${shopHandle}&file=`;

    html = html.replace(/\/theme-assets\//g, baseUrl);
    html = html.replace(/\/theme-files\//g, baseUrl);

    if (html.includes("</body>")) {
      html = html.replace("</body>", `${editorScript}</body>`);
    } else {
      html += editorScript;
    }

    // Inject base styles into head
    if (html.includes("</head>")) {
      html = html.replace("</head>", `${baseStyles}</head>`);
    } else if (html.includes("<body")) {
      html = html.replace("<body", `${baseStyles}<body`);
    } else {
      html = baseStyles + html;
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
