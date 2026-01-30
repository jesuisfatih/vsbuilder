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
    const filePath = path.join(THEMES_DIR, shopHandle, themeId, "assets", sanitizedFile);

    // Security check: ensure path is within themes directory
    const resolvedPath = path.resolve(filePath);
    const resolvedThemesDir = path.resolve(THEMES_DIR);
    if (!resolvedPath.startsWith(resolvedThemesDir)) {
      console.error(`[ProxyAssets] Security: Path traversal attempt blocked: ${file}`);
      return new Response("Forbidden", { status: 403 });
    }

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      // Try without assets prefix
      const altPath = path.join(THEMES_DIR, shopHandle, themeId, sanitizedFile);
      if (fs.existsSync(altPath)) {
        return serveFile(altPath);
      }

      console.error(`[ProxyAssets] File not found: ${filePath}`);
      return new Response("Not Found", { status: 404 });
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
