/**
 * 📁 App Proxy Assets Route
 * =========================
 * Serves theme assets (CSS, JS, images, fonts) from local storage
 */
import { type LoaderFunctionArgs } from "@remix-run/node";
import * as fs from "fs";
import * as path from "path";
import { authenticate } from "../shopify.server";

const THEMES_DIR = process.env.THEMES_DIR || path.join(process.cwd(), "themes");

// MIME types mapping
const MIME_TYPES: Record<string, string> = {
  // Styles
  ".css": "text/css",
  ".scss": "text/css",

  // Scripts
  ".js": "application/javascript",
  ".mjs": "application/javascript",

  // Images
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".avif": "image/avif",

  // Fonts
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".eot": "application/vnd.ms-fontobject",

  // Data
  ".json": "application/json",
  ".xml": "application/xml",

  // Media
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",

  // Documents
  ".pdf": "application/pdf",
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    // App Proxy authentication is optional for assets
    let shopHandle = "";
    let themeId = "";

    const url = new URL(request.url);

    // Try to authenticate
    try {
      const { session } = await authenticate.public.appProxy(request);
      if (session) {
        shopHandle = session.shop.replace(".myshopify.com", "");
      }
    } catch {
      // Fall back to query params
    }

    // Get params from URL if not from session
    themeId = url.searchParams.get("themeId") || "";
    if (!shopHandle) {
      shopHandle = url.searchParams.get("shopHandle") || "";
    }
    const file = url.searchParams.get("file") || "";

    if (!themeId || !shopHandle || !file) {
      return new Response("Missing parameters", { status: 400 });
    }

    // Sanitize file path to prevent directory traversal
    const sanitizedFile = file
      .replace(/\.\./g, "")
      .replace(/^\/+/, "")
      .replace(/[<>:"|?*]/g, "");

    // Build file path
    const themeDir = path.join(THEMES_DIR, shopHandle, themeId);
    const filePath = path.join(themeDir, "assets", sanitizedFile);

    // Security check: ensure path is within themes directory
    const resolvedPath = path.resolve(filePath);
    const resolvedThemesDir = path.resolve(THEMES_DIR);
    if (!resolvedPath.startsWith(resolvedThemesDir)) {
      console.error(`[ProxyAssets] Security: Path traversal attempt blocked: ${file}`);
      return new Response("Forbidden", { status: 403 });
    }

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.log(`[ProxyAssets] Primary path not found: ${filePath}`);

      // Try .liquid version for CSS/JS
      const liquidPath = filePath + ".liquid";
      if (fs.existsSync(liquidPath)) {
        console.log(`[ProxyAssets] Found .liquid version: ${liquidPath}`);
        return await serveLiquidAsset(liquidPath, themeDir);
      }

      // Try without assets prefix
      const altPath = path.join(themeDir, sanitizedFile);
      if (fs.existsSync(altPath)) {
        console.log(`[ProxyAssets] Found at alt path: ${altPath}`);
        return serveFile(altPath);
      }

      // Try .liquid version of alt path
      const altLiquidPath = altPath + ".liquid";
      if (fs.existsSync(altLiquidPath)) {
        console.log(`[ProxyAssets] Found .liquid at alt path: ${altLiquidPath}`);
        return await serveLiquidAsset(altLiquidPath, themeDir);
      }

      // List files in assets dir for debugging
      const assetsDir = path.join(themeDir, "assets");
      if (fs.existsSync(assetsDir)) {
        const files = fs.readdirSync(assetsDir);
        const matchingFiles = files.filter(f => f.includes(sanitizedFile.split('.')[0]));
        console.log(`[ProxyAssets] Similar files in assets: ${matchingFiles.slice(0, 5).join(', ') || 'none'}`);
      }

      // FALLBACK: Redirect to Shopify CDN if file not found locally
      // This handles files that weren't synced properly
      console.log(`[ProxyAssets] File not found locally, attempting Shopify CDN fallback: ${sanitizedFile}`);

      // Build Shopify theme asset URL
      // Format: https://store.myshopify.com/cdn/shop/t/theme-id/assets/filename
      const shopDomain = shopHandle + ".myshopify.com";
      const cdnUrl = `https://${shopDomain}/cdn/shop/t/${themeId}/assets/${encodeURIComponent(sanitizedFile)}`;

      // Return a 302 redirect to Shopify CDN
      return new Response(null, {
        status: 302,
        headers: {
          "Location": cdnUrl,
          "Cache-Control": "public, max-age=60",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // Check if it's a .liquid file that needs processing
    if (filePath.endsWith(".liquid")) {
      return await serveLiquidAsset(filePath, themeDir);
    }

    return serveFile(filePath);

  } catch (error) {
    console.error("[ProxyAssets] Error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
};

function serveFile(filePath: string): Response {
  const ext = path.extname(filePath).toLowerCase();
  const mimeType = MIME_TYPES[ext] || "application/octet-stream";

  const content = fs.readFileSync(filePath);

  // Cache headers based on file type
  let cacheControl = "public, max-age=31536000"; // 1 year for static assets
  if (ext === ".css" || ext === ".js") {
    cacheControl = "public, max-age=3600"; // 1 hour for CSS/JS
  }

  return new Response(content, {
    headers: {
      "Content-Type": mimeType,
      "Cache-Control": cacheControl,
      "Access-Control-Allow-Origin": "*",
    },
  });
}

// Process .liquid assets (CSS/JS with Liquid syntax)
async function serveLiquidAsset(filePath: string, themeDir: string): Promise<Response> {
  const { Liquid } = await import("liquidjs");

  const content = fs.readFileSync(filePath, "utf-8");

  // Determine output type from filename (e.g., base.css.liquid -> css, theme.css.liquid -> css)
  // Extract the actual extension from the filename before .liquid
  const baseName = path.basename(filePath);
  let outputType = "text/plain";
  let cacheControl = "public, max-age=3600";

  // Check for CSS files (theme.css.liquid, base.css.liquid, etc.)
  if (baseName.endsWith(".css.liquid") || baseName.endsWith(".scss.liquid") ||
      baseName.includes(".css") || filePath.includes(".css")) {
    outputType = "text/css";
  }
  // Check for JS files (empire.aio.min.js.liquid, etc.)
  else if (baseName.endsWith(".js.liquid") || baseName.includes(".js") || filePath.includes(".js")) {
    outputType = "application/javascript";
  }

  try {
    // Create a simple Liquid engine for asset processing
    const engine = new Liquid({
      root: [path.join(themeDir, "snippets"), path.join(themeDir, "assets")],
      extname: ".liquid",
      strictVariables: false,
      strictFilters: false,
    });

    // Load theme settings for CSS variables
    const settingsPath = path.join(themeDir, "config", "settings_data.json");
    let settings: Record<string, any> = {};
    if (fs.existsSync(settingsPath)) {
      try {
        const settingsData = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
        settings = settingsData.current?.settings || settingsData.current || {};
      } catch {
        // Ignore settings parse errors
      }
    }

    const context = {
      settings,
      shop: {
        name: "Store",
        url: "/",
      },
    };

    const rendered = await engine.parseAndRender(content, context);

    return new Response(rendered, {
      headers: {
        "Content-Type": outputType,
        "Cache-Control": cacheControl,
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error(`[ProxyAssets] Error processing Liquid asset ${filePath}:`, error);
    // Return original content if Liquid processing fails
    return new Response(content, {
      headers: {
        "Content-Type": outputType,
        "Cache-Control": "no-cache",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
}
