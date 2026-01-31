/**
 * 🎨 Proxy API - Local Theme Render
 * Handles local render requests when accessed via App Proxy
 * Route: /proxy/api.render-local
 * INJECTS CSS/JS inline to bypass proxy issues
 */
import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import * as fs from "fs";
import * as path from "path";
import { authenticate } from "../shopify.server";
import { getMinimalEditorScript } from "../utils/editorBridge";
import { createShopifyLiquidEngine } from "../utils/liquidEngine.server";

const THEMES_DIR = process.env.THEMES_DIR || path.join(process.cwd(), "themes");

// Helper to create HTML response
function htmlResponse(html: string, status = 200): Response {
  return new Response(html, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "X-Frame-Options": "SAMEORIGIN",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}

// Helper to create error HTML
function errorHtml(message: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Render Error</title>
  <style>
    body { font-family: system-ui, sans-serif; padding: 40px; background: #1a1a2e; color: #fff; }
    .error { background: #dc2626; color: white; padding: 20px; border-radius: 8px; }
  </style>
</head>
<body>
  <div class="error">
    <h2>Render Error</h2>
    <p>${message}</p>
  </div>
</body>
</html>`;
}

/**
 * Inject ALL theme CSS files inline
 */
function injectAllThemeCSS(html: string, themeDir: string): string {
  const assetsDir = path.join(themeDir, "assets");

  if (!fs.existsSync(assetsDir)) return html;

  // Priority order for CSS files
  const cssOrder = [
    "base.css",
    "reset.css",
    "typography.css",
    "variables.css",
    "theme.css",
    "component-",
    "section-",
  ];

  let allCSS = "";
  const processedFiles = new Set<string>();

  try {
    const files = fs.readdirSync(assetsDir).filter(f => f.endsWith(".css"));

    // Process in priority order first
    for (const prefix of cssOrder) {
      for (const file of files) {
        if (file.startsWith(prefix) || file === prefix) {
          if (!processedFiles.has(file)) {
            const content = fs.readFileSync(path.join(assetsDir, file), "utf-8");
            allCSS += `\n/* === ${file} === */\n${content}\n`;
            processedFiles.add(file);
          }
        }
      }
    }

    // Then process remaining CSS files
    for (const file of files) {
      if (!processedFiles.has(file)) {
        const content = fs.readFileSync(path.join(assetsDir, file), "utf-8");
        allCSS += `\n/* === ${file} === */\n${content}\n`;
        processedFiles.add(file);
      }
    }

    console.log(`[RenderLocal] Injected ${processedFiles.size} CSS files (${allCSS.length} bytes)`);
  } catch (e) {
    console.error("[RenderLocal] CSS injection error:", e);
    return html;
  }

  if (allCSS) {
    const cssBlock = `
<style data-vsbuilder-theme-css="true">
/* VSBuilder Injected Theme CSS */
${allCSS}
</style>
`;

    if (html.includes("</head>")) {
      html = html.replace("</head>", `${cssBlock}</head>`);
    } else if (html.includes("<body")) {
      html = html.replace("<body", `<head>${cssBlock}</head><body`);
    } else {
      html = cssBlock + html;
    }
  }

  return html;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  console.log("[ProxyApiRenderLocal] Request received");

  try {
    const { session } = await authenticate.public.appProxy(request);

    if (!session) {
      return htmlResponse(errorHtml("Unauthorized - Please authenticate"), 401);
    }

    const url = new URL(request.url);
    const themeId = url.searchParams.get("themeId");
    const template = url.searchParams.get("template") || "index";
    const sectionId = url.searchParams.get("sectionId");
    const returnJson = url.searchParams.get("format") === "json";

    if (!themeId) {
      const errorMsg = "Missing themeId parameter";
      return returnJson
        ? json({ error: errorMsg }, { status: 400 })
        : htmlResponse(errorHtml(errorMsg), 400);
    }

    const shopHandle = session.shop.replace(".myshopify.com", "");
    const themeDir = path.join(THEMES_DIR, shopHandle, themeId);

    if (!fs.existsSync(themeDir)) {
      const errorMsg = "Theme not found locally. Please sync the theme first.";
      return returnJson
        ? json({ error: errorMsg, needsSync: true }, { status: 404 })
        : htmlResponse(errorHtml(errorMsg), 404);
    }

    const engine = createShopifyLiquidEngine(themeDir);

    // Set asset context for proper URL generation
    engine.setAssetContext(themeId, shopHandle, session.shop);

    let html: string;

    if (sectionId) {
      const sectionData = url.searchParams.get("sectionData");
      const context = sectionData ? JSON.parse(sectionData) : {};
      html = await engine.renderSection(sectionId, context);
    } else {
      html = await engine.renderPage(template);
    }

    // ========================================
    // INLINE CSS INJECTION (Bypass Proxy)
    // ========================================
    html = injectAllThemeCSS(html, themeDir);

    // Base styles for preview
    const baseStyles = `
      <style data-editor-preview="true">
        /* Editor preview styles */
        body { margin: 0; padding: 0; }
        .shopify-section { position: relative; }
        .shopify-section:hover { outline: 2px dashed rgba(99, 102, 241, 0.5); outline-offset: -2px; }
        img { max-width: 100%; height: auto; }
        /* Hide broken images gracefully */
        img[src=""], img:not([src]) { visibility: hidden; height: 0; }
      </style>
    `;

    // Get editor communication script
    const editorScript = getMinimalEditorScript();

    // Convert shopify:// URLs to CDN URLs
    html = html.replace(/shopify:\/\/shop_images\//g, `https://${session.shop}/cdn/shop/files/`);
    html = html.replace(/shopify:\/\/product_images\//g, `https://${session.shop}/cdn/shop/products/`);
    html = html.replace(/shopify:\/\/collection_images\//g, `https://${session.shop}/cdn/shop/collections/`);

    // Remove broken CDN links (they'll 404 for draft themes)
    html = html.replace(/<link[^>]*cdn\.shopify\.com[^>]*>/gi, "<!-- CDN link removed -->");
    html = html.replace(/<script[^>]*cdn\.shopify\.com\/s\/files[^>]*><\/script>/gi, "<!-- CDN script removed -->");

    // Inject editor script before </body>
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

    console.log(`[RenderLocal] Rendered ${template} with inline CSS (${html.length} bytes)`);

    // Return HTML directly or JSON based on format parameter
    if (returnJson) {
      return json({ html, success: true });
    }

    return htmlResponse(html);
  } catch (error) {
    console.error("[ProxyApiRenderLocal] Error:", error);
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    return htmlResponse(errorHtml(`Failed to render: ${errorMsg}`), 500);
  }
};

// POST handler for dynamic section updates
export const action = async ({ request }: ActionFunctionArgs) => {
  console.log("[ProxyApiRenderLocal] POST request received");

  try {
    const { session } = await authenticate.public.appProxy(request);

    if (!session) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const themeId = formData.get("themeId") as string;
    const sectionId = formData.get("sectionId") as string;
    const sectionData = formData.get("sectionData") as string;
    const template = (formData.get("template") as string) || "index";

    if (!themeId) {
      return json({ error: "Missing themeId" }, { status: 400 });
    }

    const shopHandle = session.shop.replace(".myshopify.com", "");
    const themeDir = path.join(THEMES_DIR, shopHandle, themeId);

    if (!fs.existsSync(themeDir)) {
      return json({ error: "Theme not found", needsSync: true }, { status: 404 });
    }

    const engine = createShopifyLiquidEngine(themeDir);

    let html: string;

    if (sectionId) {
      const context = sectionData ? JSON.parse(sectionData) : {};
      html = await engine.renderSection(sectionId, context);
    } else {
      html = await engine.renderPage(template);
    }

    // Inject asset base URL
    const baseUrl = `/apps/vsbuilder/assets?themeId=${themeId}&shopHandle=${shopHandle}&file=`;
    html = html.replace(/\/theme-assets\//g, baseUrl);
    html = html.replace(/\/theme-files\//g, baseUrl);

    // Convert shopify:// URLs
    html = html.replace(/shopify:\/\/shop_images\//g, `https://${session.shop}/cdn/shop/files/`);

    return json({ html, success: true });
  } catch (error) {
    console.error("[ProxyApiRenderLocal] POST Error:", error);
    return json({
      error: "Failed to render",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
};
