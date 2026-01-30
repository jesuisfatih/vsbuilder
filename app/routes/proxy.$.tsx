/**
 * 🗂️ App Proxy Asset Server (Splat Route)
 * ========================================
 * Serves static assets (JS, CSS) from the build directory
 * Also handles Remix __manifest requests
 * URL Pattern: /proxy/assets/* -> build/client/assets/*
 */
import { type LoaderFunctionArgs } from "@remix-run/node";
import * as fs from "fs";
import * as path from "path";

const ASSET_DIR = path.join(process.cwd(), "build", "client");
const APP_URL = process.env.SHOPIFY_APP_URL || "https://vsbuilder.techifyboost.com";

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
  const url = new URL(request.url);

  console.log(`[ProxySplat] Request for: ${splat}`);

  // Handle __manifest requests - forward to internal Remix endpoint
  if (splat === "__manifest" || splat.startsWith("__manifest")) {
    console.log(`[ProxySplat] Forwarding __manifest request`);

    // Build internal manifest URL (replace /apps/vsbuilder/ with /)
    const internalUrl = new URL(`/${splat}${url.search}`, APP_URL);

    try {
      const manifestResponse = await fetch(internalUrl.toString(), {
        headers: {
          "Accept": "application/json",
        },
      });

      const manifestData = await manifestResponse.text();

      return new Response(manifestData, {
        status: manifestResponse.status,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    } catch (error) {
      console.error(`[ProxySplat] Error fetching manifest:`, error);
      return new Response("Manifest fetch failed", { status: 500 });
    }
  }

  // Security: prevent directory traversal
  if (splat.includes("..")) {
    return new Response("Forbidden", { status: 403 });
  }

  // Build the file path
  const filePath = path.join(ASSET_DIR, splat);

  console.log(`[ProxySplat] Looking for file: ${filePath}`);

  // Check if file exists
  if (!fs.existsSync(filePath)) {
    console.log(`[ProxySplat] File not found: ${filePath}`);
    return new Response("Not Found", { status: 404 });
  }

  // Read the file
  const fileContent = fs.readFileSync(filePath);

  // Determine MIME type
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";

  console.log(`[ProxySplat] Serving ${splat} as ${contentType}`);

  return new Response(fileContent, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "Access-Control-Allow-Origin": "*",
    },
  });
};
