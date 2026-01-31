/**
 * 📋 Schema API
 * Returns section schemas for editor sidebar
 */

import { json, type LoaderFunctionArgs } from "@remix-run/node";
import * as fs from "fs";
import * as path from "path";
import { authenticate } from "../shopify.server";
import {
    extractSchemaFromLiquid,
    loadAllSections,
    parseSection,
    parseTemplateJson,
} from "../utils/schemaParser.server";

// GET /apps/vsbuilder/api/schema?themeId=...&shopHandle=...&section=...
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const { session } = await authenticate.public.appProxy(request);

    if (!session) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const themeId = url.searchParams.get("themeId");
    const shopHandle = url.searchParams.get("shopHandle");
    const sectionType = url.searchParams.get("section");
    const template = url.searchParams.get("template");
    const action = url.searchParams.get("action") || "get";

    if (!themeId || !shopHandle) {
      return json({ error: "Missing required parameters" }, { status: 400 });
    }

    // Get themes directory
    const themesDir = process.env.THEMES_DIR || path.join(process.cwd(), ".themes");
    const themeDir = path.join(themesDir, shopHandle, themeId);

    if (!fs.existsSync(themeDir)) {
      return json({ error: "Theme not found" }, { status: 404 });
    }

    // Handle different actions
    switch (action) {
      case "list":
        // List all available sections
        const allSections = loadAllSections(themeDir);
        return json({
          success: true,
          sections: allSections.map(s => ({
            type: s.type,
            name: s.name,
            hasBlocks: s.hasBlocks,
            maxBlocks: s.maxBlocks,
            blockTypes: s.blockTypes,
            presets: s.presets.map(p => p.name),
          })),
        });

      case "template":
        // Get parsed template with sections
        if (!template) {
          return json({ error: "Template name required" }, { status: 400 });
        }
        const templatePath = path.join(themeDir, "templates", `${template}.json`);
        const templateJson = parseTemplateJson(templatePath);

        if (!templateJson) {
          return json({ error: "Template not found" }, { status: 404 });
        }

        // Parse each section in the template
        const sectionsDir = path.join(themeDir, "sections");
        const parsedSections = templateJson.order.map((sectionId, index) => {
          const sectionData = templateJson.sections[sectionId];
          if (!sectionData) return null;

          const sectionPath = path.join(sectionsDir, `${sectionData.type}.liquid`);
          const parsed = parseSection(sectionPath, sectionId, sectionData);
          if (parsed) {
            parsed.index = index;
          }
          return parsed;
        }).filter(Boolean);

        return json({
          success: true,
          template,
          layout: templateJson.layout,
          sections: parsedSections,
          order: templateJson.order,
        });

      case "get":
      default:
        // Get schema for a specific section
        if (!sectionType) {
          return json({ error: "Section type required" }, { status: 400 });
        }

        const sectionPath = path.join(themeDir, "sections", `${sectionType}.liquid`);

        if (!fs.existsSync(sectionPath)) {
          return json({ error: "Section not found" }, { status: 404 });
        }

        const sectionContent = fs.readFileSync(sectionPath, "utf-8");
        const schema = extractSchemaFromLiquid(sectionContent);

        if (!schema) {
          return json({
            success: true,
            sectionType,
            schema: null,
            message: "Section has no schema",
          });
        }

        return json({
          success: true,
          sectionType,
          schema: {
            name: schema.name,
            tag: schema.tag,
            class: schema.class,
            limit: schema.limit,
            maxBlocks: schema.max_blocks,
            settings: schema.settings || [],
            blocks: schema.blocks || [],
            presets: schema.presets || [],
            enabledOn: schema.enabled_on,
            disabledOn: schema.disabled_on,
          },
        });
    }
  } catch (error) {
    console.error("[API:schema] Error:", error);
    return json(
      { error: error instanceof Error ? error.message : "Failed to get schema" },
      { status: 500 }
    );
  }
}
