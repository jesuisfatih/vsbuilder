/**
 * 🖼️ Theme Assets API
 * ====================
 * İndirilen tema dosyalarından asset'leri serve eder.
 * CSS, JS, resimler, fontlar vb.
 */

import { type LoaderFunctionArgs } from "@remix-run/node";
import * as fs from "fs";
import * as path from "path";

// Theme storage directory
const THEMES_DIR = process.env.THEMES_DIR || path.join(process.cwd(), "storage", "themes");

// MIME types
const MIME_TYPES: Record<string, string> = {
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".eot": "application/vnd.ms-fontobject",
  ".otf": "font/otf",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  const themeId = url.searchParams.get("themeId");
  const shopHandle = url.searchParams.get("shopHandle");
  const file = url.searchParams.get("file");

  if (!themeId || !shopHandle || !file) {
    return new Response("Missing parameters", { status: 400 });
  }

  // Security: prevent directory traversal
  const sanitizedFile = file.replace(/\.\./g, "").replace(/^\/+/, "");

  // Build file path
  const filePath = path.join(THEMES_DIR, shopHandle, themeId, "assets", sanitizedFile);

  // Check if file exists
  if (!fs.existsSync(filePath)) {
    // Try without assets folder (for direct paths)
    const altPath = path.join(THEMES_DIR, shopHandle, themeId, sanitizedFile);
    if (fs.existsSync(altPath)) {
      return serveFile(altPath);
    }

    console.log(`Asset not found: ${filePath}`);
    return new Response("File not found", { status: 404 });
  }

  return serveFile(filePath);
};

function serveFile(filePath: string): Response {
  try {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    // Read file
    const fileContent = fs.readFileSync(filePath);

    // For CSS files, rewrite relative URLs if needed
    if (ext === ".css") {
      let cssContent = fileContent.toString("utf-8");
      // Optionally process CSS here
      return new Response(cssContent, {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=31536000",
        },
      });
    }

    // Binary files
    return new Response(fileContent, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000",
      },
    });
  } catch (error) {
    console.error(`Error serving file ${filePath}:`, error);
    return new Response("Error serving file", { status: 500 });
  }
}
