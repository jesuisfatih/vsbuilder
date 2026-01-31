/**
 * 🎨 Section Render API
 * Renders individual sections for live preview updates
 */

import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import * as fs from "fs";
import * as path from "path";
import { authenticate } from "../shopify.server";
import { createShopifyLiquidEngine } from "../utils/liquidEngine.server";

const THEMES_DIR = process.env.THEMES_DIR || path.join(process.cwd(), "themes");

// POST /apps/vsbuilder/api/render-section
export async function action({ request }: ActionFunctionArgs) {
  try {
    // Authenticate the request
    const { session } = await authenticate.public.appProxy(request);

    if (!session) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { sectionType, sectionId, settings, blocks, blockOrder, themeId, shopHandle } = body;

    if (!sectionType || !themeId || !shopHandle) {
      return json({ error: "Missing required parameters" }, { status: 400 });
    }

    // Theme directory
    const themeDir = path.join(THEMES_DIR, shopHandle, themeId);

    if (!fs.existsSync(themeDir)) {
      return json({ error: "Theme not found" }, { status: 404 });
    }

    // Initialize LiquidJS engine
    const engine = createShopifyLiquidEngine(themeDir);

    // Build section context
    const sectionContext = {
      section: {
        id: sectionId || `section-${sectionType}`,
        type: sectionType,
        settings: settings || {},
        blocks: blocks || {},
        block_order: blockOrder || Object.keys(blocks || {}),
        disabled: false,
      },
    };

    // Render the section
    const html = await engine.renderSection(sectionType, sectionContext);

    return json({
      success: true,
      html,
      sectionId: sectionContext.section.id,
      sectionType,
    });
  } catch (error) {
    console.error("[API:render-section] Error:", error);
    return json(
      { error: error instanceof Error ? error.message : "Failed to render section" },
      { status: 500 }
    );
  }
}

// GET /apps/vsbuilder/api/render-section?type=...&themeId=...&shopHandle=...
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const { session } = await authenticate.public.appProxy(request);

    if (!session) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const sectionType = url.searchParams.get("type");
    const themeId = url.searchParams.get("themeId");
    const shopHandle = url.searchParams.get("shopHandle");
    const sectionId = url.searchParams.get("sectionId") || `section-${sectionType}`;

    if (!sectionType || !themeId || !shopHandle) {
      return json({ error: "Missing required parameters" }, { status: 400 });
    }

    // Theme directory
    const themeDir = path.join(THEMES_DIR, shopHandle, themeId);

    if (!fs.existsSync(themeDir)) {
      return json({ error: "Theme not found" }, { status: 404 });
    }

    // Initialize LiquidJS engine
    const engine = createShopifyLiquidEngine(themeDir);

    // Render with default settings
    const sectionContext = {
      section: {
        id: sectionId,
        type: sectionType,
        settings: {},
        blocks: {},
        block_order: [],
        disabled: false,
      },
    };

    const html = await engine.renderSection(sectionType, sectionContext);

    return json({
      success: true,
      html,
      sectionId,
      sectionType,
    });
  } catch (error) {
    console.error("[API:render-section] Error:", error);
    return json(
      { error: error instanceof Error ? error.message : "Failed to render section" },
      { status: 500 }
    );
  }
}
