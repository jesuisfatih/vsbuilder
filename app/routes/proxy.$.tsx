/**
 * 🗂️ App Proxy Asset Server (Splat Route)
 * ========================================
 * Serves static assets (JS, CSS) from the build directory
 * URL Pattern: /proxy/assets/* -> build/client/assets/*
 */
import { type LoaderFunctionArgs } from "@remix-run/node";
import * as fs from "fs";
import * as path from "path";

const ASSET_DIR = path.join(process.cwd(), "build", "client");

const MIME_TYPES: Record<string, string> = {
  ".js": "application/javascript",
  ".mjs": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
};

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  // Get the splat param (everything after /proxy/)
  const splat = params["*"] || "";

  console.log(`[ProxyAssets] Request for: ${splat}`);

  // Security: prevent directory traversal
  if (splat.includes("..")) {
    return new Response("Forbidden", { status: 403 });
  }

  // Build the file path
  const filePath = path.join(ASSET_DIR, splat);

  console.log(`[ProxyAssets] Looking for file: ${filePath}`);

  // Check if file exists
  if (!fs.existsSync(filePath)) {
    console.log(`[ProxyAssets] File not found: ${filePath}`);
    return new Response("Not Found", { status: 404 });
  }

  // Read the file
  const fileContent = fs.readFileSync(filePath);

  // Determine MIME type
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";

  console.log(`[ProxyAssets] Serving ${splat} as ${contentType}`);

  return new Response(fileContent, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "Access-Control-Allow-Origin": "*",
    },
  });
};
