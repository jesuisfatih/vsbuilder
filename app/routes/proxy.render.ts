/**
 * 🎨 App Proxy Render Route
 * =========================
 * Renders theme using local Liquid engine
 * INJECTS CSS/JS inline to bypass proxy issues
 */
import { type LoaderFunctionArgs } from "@remix-run/node";
import * as fs from "fs";
import * as path from "path";
import { authenticate } from "../shopify.server";
import { getEditorBridgeScript } from "../utils/editorBridge";
import { createShopifyLiquidEngine } from "../utils/liquidEngine.server";

const THEMES_DIR = process.env.THEMES_DIR || path.join(process.cwd(), "themes");

/**
 * Inline CSS/JS assets to avoid proxy issues
 */
function inlineAssets(html: string, themeDir: string): string {
  const assetsDir = path.join(themeDir, "assets");

  if (!fs.existsSync(assetsDir)) {
    console.warn("[InlineAssets] Assets directory not found:", assetsDir);
    return html;
  }

  // Get list of available asset files
  const assetFiles = new Set<string>();
  try {
    const files = fs.readdirSync(assetsDir);
    files.forEach(f => assetFiles.add(f));
  } catch (e) {
    console.error("[InlineAssets] Error reading assets dir:", e);
    return html;
  }

  console.log(`[InlineAssets] Found ${assetFiles.size} assets in ${assetsDir}`);

  // Inline CSS files - match various URL patterns
  const cssPatterns = [
    // Pattern: href="...base.css..." or href='...base.css...'
    /<link[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+\.css[^"']*)["'][^>]*>/gi,
    /<link[^>]*href=["']([^"']+\.css[^"']*)["'][^>]*rel=["']stylesheet["'][^>]*>/gi,
  ];

  for (const pattern of cssPatterns) {
    html = html.replace(pattern, (match, href) => {
      // Extract filename from various URL formats
      let filename = "";

      // Try to extract filename from URL
      if (href.includes("file=")) {
        // Our proxy format: ?file=base.css
        const fileMatch = href.match(/file=([^&"']+)/);
        filename = fileMatch ? fileMatch[1] : "";
      } else if (href.includes("/assets/")) {
        // Shopify CDN or local: /assets/base.css
        filename = href.split("/assets/").pop()?.split("?")[0] || "";
      } else {
        // Just filename: base.css
        filename = href.split("/").pop()?.split("?")[0] || "";
      }

      if (!filename || !assetFiles.has(filename)) {
        console.log(`[InlineAssets] CSS not found: ${filename} (from ${href})`);
        return match; // Keep original if file not found
      }

      try {
        const cssPath = path.join(assetsDir, filename);
        const cssContent = fs.readFileSync(cssPath, "utf-8");
        console.log(`[InlineAssets] ✅ Inlined CSS: ${filename} (${cssContent.length} bytes)`);
        return `<style data-inline-from="${filename}">\n${cssContent}\n</style>`;
      } catch (e) {
        console.error(`[InlineAssets] Error reading CSS ${filename}:`, e);
        return match;
      }
    });
  }

  // Inline JS files - match script src patterns
  const jsPatterns = [
    /<script[^>]*src=["']([^"']+\.js[^"']*)["'][^>]*><\/script>/gi,
  ];

  for (const pattern of jsPatterns) {
    html = html.replace(pattern, (match, src) => {
      // Skip external scripts (not our theme assets)
      if (src.includes("shopify-analytics") || src.includes("google") || src.includes("facebook")) {
        return match;
      }

      // Extract filename
      let filename = "";
      if (src.includes("file=")) {
        const fileMatch = src.match(/file=([^&"']+)/);
        filename = fileMatch ? fileMatch[1] : "";
      } else if (src.includes("/assets/")) {
        filename = src.split("/assets/").pop()?.split("?")[0] || "";
      } else {
        filename = src.split("/").pop()?.split("?")[0] || "";
      }

      if (!filename || !assetFiles.has(filename)) {
        console.log(`[InlineAssets] JS not found: ${filename} (from ${src})`);
        return match;
      }

      try {
        const jsPath = path.join(assetsDir, filename);
        const jsContent = fs.readFileSync(jsPath, "utf-8");
        console.log(`[InlineAssets] ✅ Inlined JS: ${filename} (${jsContent.length} bytes)`);
        return `<script data-inline-from="${filename}">\n${jsContent}\n</script>`;
      } catch (e) {
        console.error(`[InlineAssets] Error reading JS ${filename}:`, e);
        return match;
      }
    });
  }

  // Also handle {{ 'file.css' | asset_url }} patterns that became URLs
  // Rewrite Shopify CDN URLs to inline content
  const cdnPattern = /https?:\/\/cdn\.shopify\.com\/[^"'\s]+\/assets\/([^"'\s?]+)/gi;
  html = html.replace(cdnPattern, (match, filename) => {
    if (assetFiles.has(filename)) {
      console.log(`[InlineAssets] Found CDN reference: ${filename}`);
      // We can't inline here directly (it's just a URL), but we'll mark it
      // The actual inline happens in the link/script replacement above
    }
    return match;
  });

  return html;
}

/**
 * Collect and inject all theme CSS at once
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

    console.log(`[InjectCSS] Injected ${processedFiles.size} CSS files (${allCSS.length} bytes total)`);
  } catch (e) {
    console.error("[InjectCSS] Error:", e);
    return html;
  }

  if (allCSS) {
    // Inject all CSS right after <head> tag
    const cssBlock = `
<style data-vsbuilder-theme-css="true">
/* ==========================================
   VSBuilder Injected Theme CSS
   All theme stylesheets inlined for editor
   ========================================== */
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

    // Set asset context for proper URL generation
    engine.setAssetContext(cleanThemeId, shopHandle, session.shop);

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

    // ========================================
    // INLINE ASSET INJECTION (Bypass Proxy)
    // ========================================

    // Method 1: Inject ALL theme CSS at once (most reliable)
    html = injectAllThemeCSS(html, themeDir);

    // Method 2: Also try to inline specific link/script tags
    html = inlineAssets(html, themeDir);

    // Get editor communication script
    const editorScript = getEditorBridgeScript();

    // Inject editor script before </body>
    if (html.includes("</body>")) {
      html = html.replace("</body>", `${editorScript}</body>`);
    } else {
      html += editorScript;
    }

    // Remove any remaining external Shopify CDN CSS/JS links (they'll 404)
    html = html.replace(/<link[^>]*cdn\.shopify\.com[^>]*>/gi, "<!-- CDN link removed -->");
    html = html.replace(/<script[^>]*cdn\.shopify\.com\/s\/files[^>]*><\/script>/gi, "<!-- CDN script removed -->");

    console.log(`[ProxyRender] Rendered ${template} with inline assets (${html.length} bytes)`);

    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "X-Frame-Options": "SAMEORIGIN",
        "Cache-Control": "no-cache, no-store, must-revalidate",
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
