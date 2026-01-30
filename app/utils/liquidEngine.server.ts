/**
 * 🧪 Shopify Liquid Render Engine
 * ================================
 * Kendi sunucumuzda Shopify temalarını render eder.
 * LiquidJS kullanarak Liquid şablonlarını işler.
 */

import * as fs from "fs";
import { Liquid } from "liquidjs";
import * as path from "path";

// ============================================
// TYPES
// ============================================

export interface ThemeFiles {
  templates: Record<string, string>;
  sections: Record<string, string>;
  snippets: Record<string, string>;
  layout: Record<string, string>;
  assets: Record<string, string>;
  config: {
    settings_schema: any[];
    settings_data: Record<string, any>;
  };
  locales: Record<string, Record<string, any>>;
}

export interface SectionSettings {
  [key: string]: any;
}

export interface BlockData {
  type: string;
  settings: Record<string, any>;
}

export interface SectionData {
  type: string;
  settings: SectionSettings;
  blocks?: Record<string, BlockData>;
  block_order?: string[];
}

export interface TemplateJSON {
  sections: Record<string, SectionData>;
  order: string[];
}

export interface RenderContext {
  shop: {
    name: string;
    url: string;
    currency: string;
    locale: string;
  };
  page_title: string;
  content_for_header: string;
  content_for_layout: string;
  template: string;
  request: {
    path: string;
    host: string;
  };
  settings: Record<string, any>;
  localization: {
    available_languages: { iso_code: string; name: string }[];
    language: { iso_code: string; name: string };
  };
}

// ============================================
// SHOPIFY LIQUID ENGINE
// ============================================

export class ShopifyLiquidEngine {
  private engine: Liquid;
  private themeDir: string;
  private themeFiles: ThemeFiles | null = null;
  private sectionSchemas: Map<string, any[]> = new Map();

  constructor(themeDir: string) {
    this.themeDir = themeDir;
    this.engine = new Liquid({
      root: [
        path.join(themeDir, "layout"),
        path.join(themeDir, "templates"),
        path.join(themeDir, "sections"),
        path.join(themeDir, "snippets"),
      ],
      extname: ".liquid",
      cache: false, // Disable cache for development
      strictFilters: false,
      strictVariables: false,
    });

    this.registerShopifyTags();
    this.registerShopifyFilters();
  }

  // ============================================
  // SHOPIFY CUSTOM TAGS
  // ============================================

  private registerShopifyTags() {
    const self = this;

    // {% section 'section-name' %}
    this.engine.registerTag("section", {
      parse(tagToken: any) {
        this.sectionName = tagToken.args.replace(/['"]/g, "").trim();
      },
      async render(scope: any) {
        try {
          const sectionContent = await self.renderSection(this.sectionName, scope.getAll());
          return sectionContent;
        } catch (error) {
          console.error(`Error rendering section ${this.sectionName}:`, error);
          return `<!-- Section Error: ${this.sectionName} -->`;
        }
      },
    });

    // {% sections 'group-name' %}
    this.engine.registerTag("sections", {
      parse(tagToken: any) {
        this.groupName = tagToken.args.replace(/['"]/g, "").trim();
      },
      async render(scope: any) {
        const context = scope.getAll();
        const contentForLayout = context.content_for_layout || "";
        return contentForLayout;
      },
    });

    // {% schema %} ... {% endschema %}
    this.engine.registerTag("schema", {
      parse(tagToken: any, remainTokens: any[]) {
        this.schemaContent = "";
        let token;
        while ((token = remainTokens.shift())) {
          if (token.name === "endschema") break;
          this.schemaContent += token.raw || token.getText?.() || "";
        }
      },
      render() {
        // Schema is not rendered, just parsed for settings
        return "";
      },
    });

    // {% stylesheet %} ... {% endstylesheet %}
    this.engine.registerTag("stylesheet", {
      parse(tagToken: any, remainTokens: any[]) {
        this.cssContent = "";
        let token;
        while ((token = remainTokens.shift())) {
          if (token.name === "endstylesheet") break;
          this.cssContent += token.raw || token.getText?.() || "";
        }
      },
      render() {
        if (this.cssContent) {
          return `<style>${this.cssContent}</style>`;
        }
        return "";
      },
    });

    // {% javascript %} ... {% endjavascript %}
    this.engine.registerTag("javascript", {
      parse(tagToken: any, remainTokens: any[]) {
        this.jsContent = "";
        let token;
        while ((token = remainTokens.shift())) {
          if (token.name === "endjavascript") break;
          this.jsContent += token.raw || token.getText?.() || "";
        }
      },
      render() {
        if (this.jsContent) {
          return `<script>${this.jsContent}</script>`;
        }
        return "";
      },
    });

    // {% render 'snippet-name' %}
    this.engine.registerTag("render", {
      parse(tagToken: any) {
        const args = tagToken.args.trim();
        const match = args.match(/['"]([^'"]+)['"]/);
        this.snippetName = match ? match[1] : args.split(/\s|,/)[0].replace(/['"]/g, "");

        // Parse variable assignments
        this.assignments = {};
        const assignMatch = args.matchAll(/(\w+)\s*:\s*([^,]+)/g);
        for (const m of assignMatch) {
          this.assignments[m[1]] = m[2].trim();
        }
      },
      async render(scope: any) {
        try {
          const snippetPath = path.join(self.themeDir, "snippets", `${this.snippetName}.liquid`);
          if (fs.existsSync(snippetPath)) {
            const snippetContent = fs.readFileSync(snippetPath, "utf-8");
            const context = { ...scope.getAll(), ...this.assignments };
            return await self.engine.parseAndRender(snippetContent, context);
          }
          return `<!-- Snippet not found: ${this.snippetName} -->`;
        } catch (error) {
          console.error(`Error rendering snippet ${this.snippetName}:`, error);
          return `<!-- Snippet Error: ${this.snippetName} -->`;
        }
      },
    });

    // {% form 'form-type' %}
    this.engine.registerTag("form", {
      parse(tagToken: any, remainTokens: any[]) {
        this.formType = tagToken.args.replace(/['"]/g, "").trim();
        this.formContent = [];
        let level = 1;
        let token;
        while ((token = remainTokens.shift())) {
          if (token.name === "form") level++;
          if (token.name === "endform") {
            level--;
            if (level === 0) break;
          }
          this.formContent.push(token);
        }
      },
      async render(scope: any, emitter: any) {
        let inner = "";
        for (const token of this.formContent) {
          if (token.raw) inner += token.raw;
        }
        return `<form action="/form/${this.formType}" method="post">${inner}</form>`;
      },
    });

    // {% paginate %} ... {% endpaginate %}
    this.engine.registerTag("paginate", {
      parse(tagToken: any, remainTokens: any[]) {
        this.paginateContent = [];
        let level = 1;
        let token;
        while ((token = remainTokens.shift())) {
          if (token.name === "paginate") level++;
          if (token.name === "endpaginate") {
            level--;
            if (level === 0) break;
          }
          this.paginateContent.push(token);
        }
      },
      async render(scope: any) {
        let inner = "";
        for (const token of this.paginateContent) {
          if (token.raw) inner += token.raw;
        }
        return inner;
      },
    });

    // {% style %} ... {% endstyle %}
    this.engine.registerTag("style", {
      parse(tagToken: any, remainTokens: any[]) {
        this.styleContent = "";
        let token;
        while ((token = remainTokens.shift())) {
          if (token.name === "endstyle") break;
          this.styleContent += token.raw || token.getText?.() || "";
        }
      },
      async render(scope: any) {
        // Process Liquid inside style tag
        const processed = await self.engine.parseAndRender(this.styleContent, scope.getAll());
        return `<style>${processed}</style>`;
      },
    });

    // {% layout 'theme' %} or {% layout none %}
    this.engine.registerTag("layout", {
      parse(tagToken: any) {
        this.layoutName = tagToken.args.replace(/['"]/g, "").trim();
      },
      render() {
        // Layout is handled at higher level
        return "";
      },
    });

    // {% liquid %} tag for multi-line liquid
    this.engine.registerTag("liquid", {
      parse(tagToken: any, remainTokens: any[]) {
        this.liquidContent = tagToken.args || "";
      },
      async render(scope: any) {
        // Process each line as liquid code
        const lines = this.liquidContent.split(/\r?\n/);
        let result = "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed) {
            result += await self.engine.parseAndRender(`{% ${trimmed} %}`, scope.getAll());
          }
        }
        return result;
      },
    });
  }

  // ============================================
  // SHOPIFY FILTERS
  // ============================================

  private registerShopifyFilters() {
    // Asset URL filter
    this.engine.registerFilter("asset_url", (asset: string) => {
      return `/theme-assets/${asset}`;
    });

    this.engine.registerFilter("asset_img_url", (asset: string, size?: string) => {
      return `/theme-assets/${asset}`;
    });

    // Image filters
    this.engine.registerFilter("img_url", (image: any, size?: string) => {
      if (typeof image === "string") return image;
      return image?.src || "/placeholder.jpg";
    });

    this.engine.registerFilter("image_url", (image: any, options?: any) => {
      if (typeof image === "string") return image;
      return image?.src || "/placeholder.jpg";
    });

    this.engine.registerFilter("image_tag", (url: string, options?: any) => {
      const alt = options?.alt || "";
      const cls = options?.class || "";
      return `<img src="${url}" alt="${alt}" class="${cls}" loading="lazy">`;
    });

    // File URL
    this.engine.registerFilter("file_url", (file: string) => {
      return `/theme-files/${file}`;
    });

    this.engine.registerFilter("file_img_url", (file: string, size?: string) => {
      return `/theme-files/${file}`;
    });

    // Money filters
    this.engine.registerFilter("money", (cents: number) => {
      if (typeof cents !== "number") return "$0.00";
      return `$${(cents / 100).toFixed(2)}`;
    });

    this.engine.registerFilter("money_with_currency", (cents: number) => {
      if (typeof cents !== "number") return "$0.00 USD";
      return `$${(cents / 100).toFixed(2)} USD`;
    });

    this.engine.registerFilter("money_without_currency", (cents: number) => {
      if (typeof cents !== "number") return "0.00";
      return (cents / 100).toFixed(2);
    });

    this.engine.registerFilter("money_without_trailing_zeros", (cents: number) => {
      if (typeof cents !== "number") return "$0";
      const amount = cents / 100;
      return amount % 1 === 0 ? `$${amount}` : `$${amount.toFixed(2)}`;
    });

    // URL filters
    this.engine.registerFilter("url", (value: any) => {
      if (typeof value === "string") return value;
      return value?.url || value?.handle || "#";
    });

    this.engine.registerFilter("link_to", (text: string, url: string, options?: any) => {
      const cls = options?.class || "";
      return `<a href="${url}" class="${cls}">${text}</a>`;
    });

    this.engine.registerFilter("link_to_tag", (tag: string, url?: string) => {
      return `<a href="${url || `/tags/${tag}`}">${tag}</a>`;
    });

    this.engine.registerFilter("within", (url: string, collection: any) => {
      return url;
    });

    // String filters
    this.engine.registerFilter("handle", (str: string) => {
      if (!str) return "";
      return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    });

    this.engine.registerFilter("handleize", (str: string) => {
      if (!str) return "";
      return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    });

    this.engine.registerFilter("pluralize", (count: number, singular: string, plural: string) => {
      return count === 1 ? singular : plural;
    });

    this.engine.registerFilter("t", (key: string, options?: any) => {
      // Translation filter - return key for now
      return key.split(".").pop() || key;
    });

    // JSON filter
    this.engine.registerFilter("json", (value: any) => {
      return JSON.stringify(value);
    });

    // Stylesheet/Script tags
    this.engine.registerFilter("stylesheet_tag", (url: string) => {
      return `<link rel="stylesheet" href="${url}" type="text/css">`;
    });

    this.engine.registerFilter("script_tag", (url: string) => {
      return `<script src="${url}"></script>`;
    });

    // Color filters
    this.engine.registerFilter("color_to_rgb", (color: string) => {
      return color;
    });

    this.engine.registerFilter("color_to_hex", (color: string) => {
      return color;
    });

    this.engine.registerFilter("color_lighten", (color: string, amount: number) => {
      return color;
    });

    this.engine.registerFilter("color_darken", (color: string, amount: number) => {
      return color;
    });

    this.engine.registerFilter("color_modify", (color: string, attr: string, value: number) => {
      return color;
    });

    // Font filters
    this.engine.registerFilter("font_face", (font: any) => {
      if (!font) return "";
      return `@font-face { font-family: "${font.family || "sans-serif"}"; }`;
    });

    this.engine.registerFilter("font_modify", (font: any, attr: string, value: any) => {
      return font;
    });

    // Metafield filter
    this.engine.registerFilter("metafield_tag", (metafield: any) => {
      if (!metafield) return "";
      return metafield.value || "";
    });

    // Default image filter
    this.engine.registerFilter("placeholder_svg_tag", (type: string) => {
      return `<svg class="placeholder-svg" viewBox="0 0 100 100"><rect fill="#f0f0f0" width="100" height="100"/></svg>`;
    });

    // External video filter
    this.engine.registerFilter("external_video_tag", (video: any) => {
      if (!video) return "";
      return `<iframe src="${video.url || ""}" frameborder="0" allowfullscreen></iframe>`;
    });

    this.engine.registerFilter("external_video_url", (video: any) => {
      return video?.url || "";
    });

    // Media filters
    this.engine.registerFilter("media_tag", (media: any) => {
      if (!media) return "";
      if (media.media_type === "image") {
        return `<img src="${media.src}" alt="${media.alt || ""}">`;
      }
      return "";
    });

    // Time filters
    this.engine.registerFilter("time_tag", (date: any, format?: string) => {
      const d = new Date(date);
      return `<time datetime="${d.toISOString()}">${d.toLocaleDateString()}</time>`;
    });

    // Weight filter
    this.engine.registerFilter("weight_with_unit", (grams: number) => {
      if (!grams) return "0 g";
      if (grams >= 1000) return `${(grams / 1000).toFixed(2)} kg`;
      return `${grams} g`;
    });

    // Shopify filter (global objects)
    this.engine.registerFilter("shopify_asset_url", (asset: string) => {
      // CDN for Shopify built-in assets
      return `https://cdn.shopify.com/shopifycloud/shopify/assets/${asset}`;
    });

    // Preload tag
    this.engine.registerFilter("preload_tag", (url: string, options?: any) => {
      const as = options?.as || "script";
      return `<link rel="preload" href="${url}" as="${as}">`;
    });
  }

  // ============================================
  // SECTION RENDERING
  // ============================================

  async renderSection(sectionType: string, context: Record<string, any>): Promise<string> {
    const sectionPath = path.join(this.themeDir, "sections", `${sectionType}.liquid`);

    if (!fs.existsSync(sectionPath)) {
      return `<!-- Section not found: ${sectionType} -->`;
    }

    let sectionContent = fs.readFileSync(sectionPath, "utf-8");

    // Extract and parse schema
    const schemaMatch = sectionContent.match(/\{%[-\s]*schema[-\s]*%\}([\s\S]*?)\{%[-\s]*endschema[-\s]*%\}/);
    let sectionSchema: any = {};
    if (schemaMatch) {
      try {
        sectionSchema = JSON.parse(schemaMatch[1]);
        this.sectionSchemas.set(sectionType, sectionSchema.settings || []);
      } catch (e) {
        console.error(`Failed to parse schema for ${sectionType}:`, e);
      }
    }

    // Build section context
    const sectionSettings = context.section?.settings || this.getDefaultSettings(sectionSchema.settings || []);
    const sectionBlocks = context.section?.blocks || {};
    const blockOrder = context.section?.block_order || Object.keys(sectionBlocks);

    const sectionContext = {
      ...context,
      section: {
        id: context.section?.id || `section-${sectionType}`,
        type: sectionType,
        settings: sectionSettings,
        blocks: Object.entries(sectionBlocks).map(([id, block]: [string, any]) => ({
          id,
          type: block.type,
          settings: block.settings || {},
        })),
      },
      block: null,
    };

    try {
      return await this.engine.parseAndRender(sectionContent, sectionContext);
    } catch (error) {
      console.error(`Error rendering section ${sectionType}:`, error);
      return `<!-- Section Render Error: ${sectionType} -->`;
    }
  }

  // ============================================
  // TEMPLATE RENDERING
  // ============================================

  async renderTemplate(templateName: string, templateJSON: TemplateJSON, context: RenderContext): Promise<string> {
    // Build content_for_layout by rendering all sections in order
    let contentForLayout = "";

    for (const sectionId of templateJSON.order) {
      const sectionData = templateJSON.sections[sectionId];
      if (!sectionData) continue;

      const sectionContext = {
        ...context,
        section: {
          id: sectionId,
          type: sectionData.type,
          settings: sectionData.settings || {},
          blocks: sectionData.blocks || {},
          block_order: sectionData.block_order || [],
        },
      };

      const sectionHtml = await this.renderSection(sectionData.type, sectionContext);
      contentForLayout += `<div id="shopify-section-${sectionId}" class="shopify-section">${sectionHtml}</div>\n`;
    }

    // Render layout with content_for_layout
    const layoutPath = path.join(this.themeDir, "layout", "theme.liquid");
    if (!fs.existsSync(layoutPath)) {
      return contentForLayout;
    }

    const layoutContent = fs.readFileSync(layoutPath, "utf-8");
    const fullContext = {
      ...context,
      content_for_layout: contentForLayout,
      content_for_header: this.getContentForHeader(context),
    };

    try {
      return await this.engine.parseAndRender(layoutContent, fullContext);
    } catch (error) {
      console.error(`Error rendering layout:`, error);
      return contentForLayout;
    }
  }

  // ============================================
  // FULL PAGE RENDER
  // ============================================

  async renderPage(templateType: string = "index"): Promise<string> {
    // Load template JSON
    const templateJsonPath = path.join(this.themeDir, "templates", `${templateType}.json`);
    let templateJSON: TemplateJSON;

    if (fs.existsSync(templateJsonPath)) {
      try {
        templateJSON = JSON.parse(fs.readFileSync(templateJsonPath, "utf-8"));
      } catch (e) {
        return `<!-- Template JSON parse error: ${templateType} -->`;
      }
    } else {
      // Check for .liquid template
      const templateLiquidPath = path.join(this.themeDir, "templates", `${templateType}.liquid`);
      if (fs.existsSync(templateLiquidPath)) {
        const content = fs.readFileSync(templateLiquidPath, "utf-8");
        return await this.engine.parseAndRender(content, this.getDefaultContext());
      }
      return `<!-- Template not found: ${templateType} -->`;
    }

    const context = this.getDefaultContext();
    context.template = templateType;

    return await this.renderTemplate(templateType, templateJSON, context);
  }

  // ============================================
  // HELPERS
  // ============================================

  private getDefaultContext(): RenderContext {
    return {
      shop: {
        name: "My Store",
        url: "https://mystore.myshopify.com",
        currency: "USD",
        locale: "en",
      },
      page_title: "Home",
      content_for_header: "",
      content_for_layout: "",
      template: "index",
      request: {
        path: "/",
        host: "mystore.myshopify.com",
      },
      settings: this.loadThemeSettings(),
      localization: {
        available_languages: [{ iso_code: "en", name: "English" }],
        language: { iso_code: "en", name: "English" },
      },
    };
  }

  private getContentForHeader(context: RenderContext): string {
    return `
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>${context.page_title} - ${context.shop.name}</title>
    `;
  }

  private loadThemeSettings(): Record<string, any> {
    const settingsPath = path.join(this.themeDir, "config", "settings_data.json");
    if (fs.existsSync(settingsPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
        return data.current || data.presets?.Default || {};
      } catch (e) {
        console.error("Failed to load theme settings:", e);
      }
    }
    return {};
  }

  private getDefaultSettings(schemaSettings: any[]): Record<string, any> {
    const defaults: Record<string, any> = {};
    for (const setting of schemaSettings) {
      if (setting.id && setting.default !== undefined) {
        defaults[setting.id] = setting.default;
      }
    }
    return defaults;
  }

  // Update theme directory (for switching themes)
  setThemeDir(newDir: string) {
    this.themeDir = newDir;
    this.engine = new Liquid({
      root: [
        path.join(newDir, "layout"),
        path.join(newDir, "templates"),
        path.join(newDir, "sections"),
        path.join(newDir, "snippets"),
      ],
      extname: ".liquid",
      cache: false,
      strictFilters: false,
      strictVariables: false,
    });
    this.registerShopifyTags();
    this.registerShopifyFilters();
  }
}

// Export singleton instance
export function createShopifyLiquidEngine(themeDir: string): ShopifyLiquidEngine {
  return new ShopifyLiquidEngine(themeDir);
}
