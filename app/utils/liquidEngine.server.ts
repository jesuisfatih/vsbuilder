/**
 * 🧪 Shopify Liquid Render Engine
 * ================================
 * Kendi sunucumuzda Shopify temalarını render eder.
 * LiquidJS kullanarak Liquid şablonlarını işler.
 */

import { createHash, createHmac } from "crypto";
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
    money_format?: string;
    enabled_payment_types?: string[];
  };
  page_title: string;
  content_for_header: string;
  content_for_layout: string;
  template: string;
  request: {
    path: string;
    host: string;
    locale?: { iso_code: string };
    design_mode?: boolean;
  };
  settings: Record<string, any>;
  localization: {
    available_languages: { iso_code: string; name: string }[];
    language: { iso_code: string; name: string };
  };
  [key: string]: any; // Allow additional properties
}

// ============================================
// SHOPIFY LIQUID ENGINE
// ============================================

export class ShopifyLiquidEngine {
  private engine: Liquid;
  private themeDir: string;
  private themeFiles: ThemeFiles | null = null;
  private sectionSchemas: Map<string, any[]> = new Map();
  private locales: Record<string, any> = {};
  private renderDepth: number = 0;
  private maxRenderDepth: number = 50;

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
    this.loadLocales();
  }

  // Sanitize path to prevent directory traversal
  private sanitizePath(name: string): string {
    if (!name || typeof name !== "string") return "";
    // Remove any path traversal attempts and dangerous characters
    let safe = name
      .replace(/\.\.\.+/g, "")  // Remove multiple dots
      .replace(/\.\./g, "")     // Remove ..
      .replace(/[\\\/]/g, "")  // Remove slashes
      .replace(/^\.*/, "")      // Remove leading dots
      .replace(/[<>:"|?*]/g, ""); // Remove Windows invalid chars

    // Validate final path doesn't escape theme directory
    const testPath = path.resolve(this.themeDir, "test", safe + ".liquid");
    if (!testPath.startsWith(path.resolve(this.themeDir))) {
      console.error(`[Security] Path traversal attempt blocked: ${name}`);
      return "";
    }
    return safe;
  }

  // Load locale files for translations
  private loadLocales() {
    const localesDir = path.join(this.themeDir, "locales");
    if (fs.existsSync(localesDir)) {
      try {
        const files = fs.readdirSync(localesDir);
        for (const file of files) {
          if (file.endsWith(".json")) {
            const locale = file.replace(".default.json", "").replace(".json", "");
            const content = fs.readFileSync(path.join(localesDir, file), "utf-8");
            this.locales[locale] = JSON.parse(this.stripJsonComments(content));
          }
        }
      } catch (e) {
        console.error("Failed to load locales:", e);
      }
    }
  }

  // Get translation by key path
  private getTranslation(key: string, locale: string = "en"): string {
    const localeData = this.locales[locale] || this.locales["en"] || Object.values(this.locales)[0] || {};
    const parts = key.split(".");
    let value: any = localeData;
    for (const part of parts) {
      value = value?.[part];
      if (value === undefined) break;
    }
    return typeof value === "string" ? value : key.split(".").pop() || key;
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

    // {% render 'snippet-name' %} or {% render 'snippet' with product %} or {% render 'snippet' for array as item %}
    this.engine.registerTag("render", {
      parse(tagToken: any) {
        const args = tagToken.args.trim();
        const match = args.match(/['"]([^'"]+)['"]/);
        this.snippetName = match ? match[1] : args.split(/\s|,/)[0].replace(/['"]/g, "");

        // Check for "with" syntax: {% render 'snippet' with product %}
        this.withVar = null;
        const withMatch = args.match(/with\s+([\w.]+)(?:\s+as\s+(\w+))?/);
        if (withMatch) {
          this.withVar = { expr: withMatch[1], alias: withMatch[2] || this.snippetName.replace(/-/g, "_") };
        }

        // Check for "for" syntax: {% render 'snippet' for array as item %}
        this.forLoop = null;
        const forMatch = args.match(/for\s+([\w.]+)\s+as\s+(\w+)/);
        if (forMatch) {
          this.forLoop = { arrayExpr: forMatch[1], itemVar: forMatch[2] };
        }

        // Parse variable assignments (key: value pairs)
        this.assignments = [];
        const assignRegex = /(\w+)\s*:\s*([^,]+)/g;
        let m;
        while ((m = assignRegex.exec(args)) !== null) {
          this.assignments.push({ key: m[1].trim(), valueExpr: m[2].trim().replace(/['"]$/g, "").replace(/^['"]/g, "") });
        }
      },
      async render(scope: any) {
        // Check render depth to prevent infinite recursion
        if (self.renderDepth >= self.maxRenderDepth) {
          console.error(`[Render] Max render depth (${self.maxRenderDepth}) exceeded for: ${this.snippetName}`);
          return `<!-- Max render depth exceeded: ${this.snippetName} -->`;
        }

        try {
          self.renderDepth++;

          // Sanitize snippet name to prevent path traversal
          const safeName = self.sanitizePath(this.snippetName);
          if (!safeName) {
            return `<!-- Invalid snippet name: ${this.snippetName} -->`;
          }

          const snippetPath = path.join(self.themeDir, "snippets", `${safeName}.liquid`);

          if (!fs.existsSync(snippetPath)) {
            return `<!-- Snippet not found: ${safeName} -->`;
          }

          const snippetContent = fs.readFileSync(snippetPath, "utf-8");
          const parentContext = scope.getAll();

          // Helper to resolve variable from context
          const resolveVar = (expr: string): any => {
            const parts = expr.split(".");
            let value: any = parentContext;
            for (const part of parts) {
              value = value?.[part];
            }
            return value;
          };

          // Resolve variable assignments
          const resolvedAssignments: Record<string, any> = {};
          for (const { key, valueExpr } of this.assignments) {
            if ((valueExpr.startsWith("'") && valueExpr.endsWith("'")) ||
                (valueExpr.startsWith('"') && valueExpr.endsWith('"'))) {
              resolvedAssignments[key] = valueExpr.slice(1, -1);
            } else {
              const value = resolveVar(valueExpr);
              resolvedAssignments[key] = value !== undefined ? value : valueExpr;
            }
          }

          // Handle "with" syntax: passes single variable
          if (this.withVar) {
            const value = resolveVar(this.withVar.expr);
            resolvedAssignments[this.withVar.alias] = value;
            return await self.engine.parseAndRender(snippetContent, resolvedAssignments);
          }

          // Handle "for" loop syntax
          if (this.forLoop) {
            const array = resolveVar(this.forLoop.arrayExpr);
            if (!Array.isArray(array) || array.length === 0) return "";

            // Get parent forloop if exists
            const parentForloop = parentContext.forloop || null;

            let result = "";
            for (let i = 0; i < array.length; i++) {
              const itemContext = {
                ...resolvedAssignments,
                [this.forLoop.itemVar]: array[i],
                forloop: {
                  index: i + 1,
                  index0: i,
                  first: i === 0,
                  last: i === array.length - 1,
                  length: array.length,
                  rindex: array.length - i,
                  rindex0: array.length - i - 1,
                  parentloop: parentForloop,
                },
              };
              result += await self.engine.parseAndRender(snippetContent, itemContext);
            }
            return result;
          }

          // Shopify render creates isolated scope - only explicit variables passed
          return await self.engine.parseAndRender(snippetContent, resolvedAssignments);
        } catch (error) {
          console.error(`Error rendering snippet ${this.snippetName}:`, error);
          return `<!-- Snippet Error: ${this.snippetName} -->`;
        } finally {
          self.renderDepth--;
        }
      },
    });

    // {% form 'form-type' %}
    this.engine.registerTag("form", {
      parse(tagToken: any, remainTokens: any[]) {
        this.formType = tagToken.args.replace(/['"]/g, "").trim();
        this.formContent = "";
        let level = 1;
        let token;
        while ((token = remainTokens.shift())) {
          if (token.name === "form") level++;
          if (token.name === "endform") {
            level--;
            if (level === 0) break;
          }
          this.formContent += token.raw || token.getText?.() || "";
        }
      },
      async render(scope: any) {
        // Render the inner content as Liquid
        const inner = await self.engine.parseAndRender(this.formContent, scope.getAll());
        return `<form action="/form/${this.formType}" method="post">${inner}</form>`;
      },
    });

    // {% paginate %} ... {% endpaginate %}
    this.engine.registerTag("paginate", {
      parse(tagToken: any, remainTokens: any[]) {
        this.paginateArgs = tagToken.args; // e.g., "collection.products by 12"
        this.paginateContent = "";
        let level = 1;
        let token;
        while ((token = remainTokens.shift())) {
          if (token.name === "paginate") level++;
          if (token.name === "endpaginate") {
            level--;
            if (level === 0) break;
          }
          this.paginateContent += token.raw || token.getText?.() || "";
        }
      },
      async render(scope: any) {
        // Create paginate object for context
        const paginateContext = {
          ...scope.getAll(),
          paginate: {
            current_page: 1,
            current_offset: 0,
            items: 12,
            parts: [],
            next: null,
            previous: null,
            page_size: 12,
            pages: 1,
          },
        };
        return await self.engine.parseAndRender(this.paginateContent, paginateContext);
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
        // Build complete liquid template from all lines
        const lines = this.liquidContent.split(/\r?\n/);
        const template = lines
          .map((line: string) => line.trim())
          .filter((line: string) => line)
          .map((line: string) => `{% ${line} %}`)
          .join("\n");

        // Render all at once to preserve state between lines
        if (!template) return "";
        return await self.engine.parseAndRender(template, scope.getAll());
      },
    });

    // {% comment %} ... {% endcomment %}
    this.engine.registerTag("comment", {
      parse(tagToken: any, remainTokens: any[]) {
        let token;
        while ((token = remainTokens.shift())) {
          if (token.name === "endcomment") break;
        }
      },
      render() {
        return ""; // Comments produce no output
      },
    });

    // {% raw %} ... {% endraw %}
    this.engine.registerTag("raw", {
      parse(tagToken: any, remainTokens: any[]) {
        this.rawContent = "";
        let token;
        while ((token = remainTokens.shift())) {
          if (token.name === "endraw") break;
          this.rawContent += token.raw || token.getText?.() || "";
        }
      },
      render() {
        return this.rawContent; // Output as-is without processing
      },
    });

    // {% capture variable_name %} ... {% endcapture %}
    this.engine.registerTag("capture", {
      parse(tagToken: any, remainTokens: any[]) {
        this.varName = tagToken.args.trim();
        this.captureContent = "";
        let level = 1;
        let token;
        while ((token = remainTokens.shift())) {
          if (token.name === "capture") level++;
          if (token.name === "endcapture") {
            level--;
            if (level === 0) break;
          }
          this.captureContent += token.raw || token.getText?.() || "";
        }
      },
      async render(scope: any) {
        const ctx = scope.getAll();
        const rendered = await self.engine.parseAndRender(this.captureContent, ctx);
        // Set in scope bottom (global context)
        const bottom = scope.bottom?.() || scope.environments || ctx;
        bottom[this.varName] = rendered;
        return "";
      },
    });

    // {% increment variable_name %}
    this.engine.registerTag("increment", {
      parse(tagToken: any) {
        this.varName = tagToken.args.trim();
      },
      render(scope: any) {
        const ctx = scope.getAll();
        const bottom = scope.bottom?.() || scope.environments || ctx;
        if (bottom[this.varName] === undefined) {
          bottom[this.varName] = 0;
        }
        const value = bottom[this.varName];
        bottom[this.varName]++;
        return String(value);
      },
    });

    // {% decrement variable_name %}
    this.engine.registerTag("decrement", {
      parse(tagToken: any) {
        this.varName = tagToken.args.trim();
      },
      render(scope: any) {
        const ctx = scope.getAll();
        const bottom = scope.bottom?.() || scope.environments || ctx;
        if (bottom[this.varName] === undefined) {
          bottom[this.varName] = 0;
        }
        bottom[this.varName]--;
        return String(bottom[this.varName]);
      },
    });

    // {% echo expression %} - Similar to {{ expression }}
    this.engine.registerTag("echo", {
      parse(tagToken: any) {
        this.expression = tagToken.args.trim();
      },
      async render(scope: any) {
        return await self.engine.parseAndRender(`{{ ${this.expression} }}`, scope.getAll());
      },
    });

    // {% tablerow item in array cols:2 %} ... {% endtablerow %}
    this.engine.registerTag("tablerow", {
      parse(tagToken: any, remainTokens: any[]) {
        // Parse: item in array cols:N limit:N offset:N
        const args = tagToken.args.trim();
        const match = args.match(/(\w+)\s+in\s+([\w.]+)/);
        this.itemVar = match ? match[1] : "item";
        this.arrayExpr = match ? match[2] : "";
        this.cols = 0;
        this.limit = 0;
        this.offset = 0;

        const colsMatch = args.match(/cols:\s*(\d+)/);
        if (colsMatch) this.cols = parseInt(colsMatch[1], 10);

        const limitMatch = args.match(/limit:\s*(\d+)/);
        if (limitMatch) this.limit = parseInt(limitMatch[1], 10);

        const offsetMatch = args.match(/offset:\s*(\d+)/);
        if (offsetMatch) this.offset = parseInt(offsetMatch[1], 10);

        this.rowContent = "";
        let level = 1;
        let token;
        while ((token = remainTokens.shift())) {
          if (token.name === "tablerow") level++;
          if (token.name === "endtablerow") {
            level--;
            if (level === 0) break;
          }
          this.rowContent += token.raw || token.getText?.() || "";
        }
      },
      async render(scope: any) {
        const ctx = scope.getAll();
        const parts = this.arrayExpr.split(".");
        let array: any = ctx;
        for (const part of parts) {
          array = array?.[part];
        }
        if (!Array.isArray(array)) return "";

        // Apply offset and limit
        let items = array.slice(this.offset || 0);
        if (this.limit > 0) items = items.slice(0, this.limit);

        const cols = this.cols || items.length;
        let result = "";

        for (let i = 0; i < items.length; i++) {
          const col = (i % cols) + 1;
          const row = Math.floor(i / cols) + 1;

          if (col === 1) {
            result += `<tr class="row${row}">`;
          }

          result += `<td class="col${col}">`;

          const itemCtx = {
            ...ctx,
            [this.itemVar]: items[i],
            tablerowloop: {
              length: items.length,
              index: i + 1,
              index0: i,
              rindex: items.length - i,
              rindex0: items.length - i - 1,
              first: i === 0,
              last: i === items.length - 1,
              col: col,
              col0: col - 1,
              col_first: col === 1,
              col_last: col === cols || i === items.length - 1,
              row: row,
            },
          };

          result += await self.engine.parseAndRender(this.rowContent, itemCtx);
          result += "</td>";

          if (col === cols || i === items.length - 1) {
            result += "</tr>";
          }
        }

        return result;
      },
    });

    // {% cycle 'a', 'b', 'c' %} or {% cycle 'group': 'a', 'b' %}
    this.engine.registerTag("cycle", {
      parse(tagToken: any) {
        const args = tagToken.args.trim();
        // Check for named group: 'group': 'a', 'b'
        const namedMatch = args.match(/^['"]([^'"]+)['"]:\s*(.+)$/);
        if (namedMatch) {
          this.groupName = namedMatch[1];
          this.values = namedMatch[2].split(",").map((v: string) => v.trim().replace(/^['"]|['"]$/g, ""));
        } else {
          this.groupName = args;
          this.values = args.split(",").map((v: string) => v.trim().replace(/^['"]|['"]$/g, ""));
        }
      },
      render(scope: any) {
        const ctx = scope.getAll();
        const bottom = scope.bottom?.() || scope.environments || ctx;

        // Track cycle position per group
        if (!bottom.__cycles__) bottom.__cycles__ = {};
        if (bottom.__cycles__[this.groupName] === undefined) {
          bottom.__cycles__[this.groupName] = 0;
        }

        const idx = bottom.__cycles__[this.groupName] % this.values.length;
        bottom.__cycles__[this.groupName]++;

        return this.values[idx];
      },
    });

    // {% include 'snippet' %} - deprecated but still used in legacy themes
    this.engine.registerTag("include", {
      parse(tagToken: any) {
        const args = tagToken.args.trim();
        const match = args.match(/['"]([^'"]+)['"]/);
        this.snippetName = match ? match[1] : args.split(/\s|,/)[0].replace(/['"]/g, "");
      },
      async render(scope: any) {
        try {
          const safeName = self.sanitizePath(this.snippetName);
          const snippetPath = path.join(self.themeDir, "snippets", `${safeName}.liquid`);

          if (!fs.existsSync(snippetPath)) {
            return `<!-- Include not found: ${safeName} -->`;
          }

          const snippetContent = fs.readFileSync(snippetPath, "utf-8");
          // Include passes parent scope (unlike render which isolates)
          return await self.engine.parseAndRender(snippetContent, scope.getAll());
        } catch (error) {
          console.error(`Error including snippet ${this.snippetName}:`, error);
          return `<!-- Include Error: ${this.snippetName} -->`;
        }
      },
    });

    // {% break %} - Exit for loop early
    this.engine.registerTag("break", {
      parse() {},
      render() {
        // LiquidJS handles break natively, this is a fallback
        return "";
      },
    });

    // {% continue %} - Skip to next iteration
    this.engine.registerTag("continue", {
      parse() {},
      render() {
        // LiquidJS handles continue natively, this is a fallback
        return "";
      },
    });

    // {% content_for 'header' %} or {% content_for 'blocks' %}
    this.engine.registerTag("content_for", {
      parse(tagToken: any) {
        const args = tagToken.args.trim();
        const match = args.match(/['"]([^'"]+)['"]/);
        this.contentName = match ? match[1] : args;
      },
      render(scope: any) {
        const ctx = scope.getAll();
        // Return the content_for_* variable from context
        const varName = `content_for_${this.contentName}`;
        return ctx[varName] || "";
      },
    });

    // {% layout 'theme' %} or {% layout none %}
    this.engine.registerTag("layout", {
      parse(tagToken: any) {
        const args = tagToken.args.trim();
        this.layoutName = args.replace(/['"]/g, "");
      },
      render() {
        // Layout is handled at the template level, not here
        return "";
      },
    });

    // {% paginate collection.products by 12 %}...{% endpaginate %}
    this.engine.registerTag("paginate", {
      parse(tagToken: any, remainTokens: any[]) {
        const args = tagToken.args.trim();
        // Parse: collection.products by 12
        const match = args.match(/([^\s]+)\s+by\s+(\d+)/);
        this.collectionExpr = match ? match[1] : "";
        this.perPage = match ? parseInt(match[2], 10) : 16;

        this.paginateContent = "";
        let level = 1;
        let token;
        while ((token = remainTokens.shift())) {
          if (token.name === "paginate") level++;
          if (token.name === "endpaginate") {
            level--;
            if (level === 0) break;
          }
          this.paginateContent += token.raw || token.getText?.() || "";
        }
      },
      async render(scope: any) {
        const ctx = scope.getAll();

        // Get the array from expression (e.g., collection.products)
        const parts = this.collectionExpr.split(".");
        let items = ctx;
        for (const part of parts) {
          items = items?.[part];
        }

        if (!Array.isArray(items)) {
          items = [];
        }

        const total = items.length;
        const pages = Math.ceil(total / this.perPage);
        const currentPage = 1; // Default to first page

        // Create paginate object
        const paginate = {
          current_offset: 0,
          current_page: currentPage,
          items: items.slice(0, this.perPage),
          page_size: this.perPage,
          pages,
          parts: Array.from({ length: pages }, (_, i) => ({
            is_link: i + 1 !== currentPage,
            title: String(i + 1),
            url: `?page=${i + 1}`,
          })),
          previous: null,
          next: pages > 1 ? { title: "Next", url: "?page=2" } : null,
        };

        const paginatedCtx = { ...ctx, paginate };

        // Also update the original collection to be paginated
        const lastPart = parts[parts.length - 1];
        if (parts.length > 1) {
          const parentParts = parts.slice(0, -1);
          let parent = paginatedCtx;
          for (const p of parentParts) {
            parent = parent[p];
          }
          if (parent) {
            parent[lastPart] = items.slice(0, this.perPage);
          }
        } else {
          paginatedCtx[lastPart] = items.slice(0, this.perPage);
        }

        return await self.engine.parseAndRender(this.paginateContent, paginatedCtx);
      },
    });

    // {% comment %}...{% endcomment %} - Already built into liquidjs but register for compatibility
    this.engine.registerTag("comment", {
      parse(tagToken: any, remainTokens: any[]) {
        let level = 1;
        let token;
        while ((token = remainTokens.shift())) {
          if (token.name === "comment") level++;
          if (token.name === "endcomment") {
            level--;
            if (level === 0) break;
          }
        }
      },
      render() {
        return ""; // Comments produce no output
      },
    });

    // {% liquid %}...{% endliquid %} - Multi-line liquid tag
    this.engine.registerTag("liquid", {
      parse(tagToken: any, remainTokens: any[]) {
        this.liquidContent = "";
        let token;
        while ((token = remainTokens.shift())) {
          if (token.name === "endliquid") break;
          this.liquidContent += token.raw || token.getText?.() || "";
        }
      },
      async render(scope: any) {
        // Convert liquid tag syntax to normal Liquid
        const lines = this.liquidContent.split("\n");
        let converted = "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          // Check if it's a tag (starts with keyword) or an echo
          if (trimmed.startsWith("echo ")) {
            converted += `{{ ${trimmed.slice(5)} }}`;
          } else if (trimmed.startsWith("assign ") || trimmed.startsWith("if ") ||
                     trimmed.startsWith("elsif ") || trimmed.startsWith("else") ||
                     trimmed.startsWith("endif") || trimmed.startsWith("for ") ||
                     trimmed.startsWith("endfor") || trimmed.startsWith("unless ") ||
                     trimmed.startsWith("endunless") || trimmed.startsWith("case ") ||
                     trimmed.startsWith("when ") || trimmed.startsWith("endcase")) {
            converted += `{% ${trimmed} %}`;
          } else {
            converted += `{% ${trimmed} %}`;
          }
        }

        return await self.engine.parseAndRender(converted, scope.getAll());
      },
    });
  }

  // ============================================
  // SHOPIFY FILTERS
  // ============================================

  private registerShopifyFilters() {
    const self = this;

    // Asset URL filter
    this.engine.registerFilter("asset_url", (asset: string) => {
      return `/theme-assets/${asset}`;
    });

    this.engine.registerFilter("asset_img_url", (asset: string, size?: string) => {
      return `/theme-assets/${asset}`;
    });

    // String filters
    this.engine.registerFilter("append", (str: string, suffix: string) => {
      if (typeof str !== "string") str = String(str ?? "");
      return str + (suffix ?? "");
    });

    this.engine.registerFilter("prepend", (str: string, prefix: string) => {
      if (typeof str !== "string") str = String(str ?? "");
      return (prefix ?? "") + str;
    });

    this.engine.registerFilter("remove", (str: string, substr: string) => {
      if (typeof str !== "string") return str;
      return str.split(substr).join("");
    });

    this.engine.registerFilter("remove_first", (str: string, substr: string) => {
      if (typeof str !== "string") return str;
      return str.replace(substr, "");
    });

    this.engine.registerFilter("remove_last", (str: string, substr: string) => {
      if (typeof str !== "string") return str;
      const idx = str.lastIndexOf(substr);
      return idx === -1 ? str : str.slice(0, idx) + str.slice(idx + substr.length);
    });

    this.engine.registerFilter("replace", (str: string, substr: string, newVal: string) => {
      if (typeof str !== "string") return str;
      return str.split(substr).join(newVal ?? "");
    });

    this.engine.registerFilter("replace_first", (str: string, substr: string, newVal: string) => {
      if (typeof str !== "string") return str;
      return str.replace(substr, newVal ?? "");
    });

    this.engine.registerFilter("strip", (str: string) => {
      if (typeof str !== "string") return str;
      return str.trim();
    });

    this.engine.registerFilter("lstrip", (str: string) => {
      if (typeof str !== "string") return str;
      return str.trimStart();
    });

    this.engine.registerFilter("rstrip", (str: string) => {
      if (typeof str !== "string") return str;
      return str.trimEnd();
    });

    this.engine.registerFilter("strip_html", (str: string) => {
      if (typeof str !== "string") return str;
      return str.replace(/<[^>]*>/g, "");
    });

    this.engine.registerFilter("strip_newlines", (str: string) => {
      if (typeof str !== "string") return str;
      return str.replace(/\r?\n/g, "");
    });

    this.engine.registerFilter("newline_to_br", (str: string) => {
      if (typeof str !== "string") return str;
      return str.replace(/\r?\n/g, "<br>");
    });

    this.engine.registerFilter("escape", (str: string) => {
      if (typeof str !== "string") return str;
      return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    });

    this.engine.registerFilter("escape_once", (str: string) => {
      if (typeof str !== "string") return str;
      // Unescape then escape to avoid double-escaping
      return str
        .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&#39;/g, "'")
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    });

    this.engine.registerFilter("truncate", (str: string, length?: number, ellipsis?: string) => {
      if (typeof str !== "string") return str;
      const len = length ?? 50;
      const end = ellipsis ?? "...";
      return str.length > len ? str.slice(0, len - end.length) + end : str;
    });

    this.engine.registerFilter("truncatewords", (str: string, count?: number, ellipsis?: string) => {
      if (typeof str !== "string") return str;
      const words = str.split(/\s+/);
      const num = count ?? 15;
      const end = ellipsis ?? "...";
      return words.length > num ? words.slice(0, num).join(" ") + end : str;
    });

    this.engine.registerFilter("url_encode", (str: string) => {
      if (typeof str !== "string") return str;
      return encodeURIComponent(str);
    });

    this.engine.registerFilter("url_decode", (str: string) => {
      if (typeof str !== "string") return str;
      return decodeURIComponent(str);
    });

    this.engine.registerFilter("base64_encode", (str: string) => {
      if (typeof str !== "string") return str;
      return Buffer.from(str).toString("base64");
    });

    this.engine.registerFilter("base64_decode", (str: string) => {
      if (typeof str !== "string") return str;
      return Buffer.from(str, "base64").toString("utf-8");
    });

    this.engine.registerFilter("split", (str: string, delimiter: string) => {
      if (typeof str !== "string") return [];
      return str.split(delimiter ?? " ");
    });

    this.engine.registerFilter("slice", (str: string, start: number, length?: number) => {
      if (typeof str !== "string" && !Array.isArray(str)) return str;
      return length !== undefined ? str.slice(start, start + length) : str.slice(start);
    });

    this.engine.registerFilter("upcase", (str: string) => {
      if (typeof str !== "string") return str;
      return str.toUpperCase();
    });

    this.engine.registerFilter("downcase", (str: string) => {
      if (typeof str !== "string") return str;
      return str.toLowerCase();
    });

    this.engine.registerFilter("capitalize", (str: string) => {
      if (typeof str !== "string") return str;
      return str.charAt(0).toUpperCase() + str.slice(1);
    });

    // Math filters
    this.engine.registerFilter("abs", (num: number) => Math.abs(Number(num) || 0));
    this.engine.registerFilter("ceil", (num: number) => Math.ceil(Number(num) || 0));
    this.engine.registerFilter("floor", (num: number) => Math.floor(Number(num) || 0));
    this.engine.registerFilter("round", (num: number, decimals?: number) => {
      const n = Number(num) || 0;
      const d = decimals ?? 0;
      return Math.round(n * Math.pow(10, d)) / Math.pow(10, d);
    });
    this.engine.registerFilter("plus", (num: number, add: number) => (Number(num) || 0) + (Number(add) || 0));
    this.engine.registerFilter("minus", (num: number, sub: number) => (Number(num) || 0) - (Number(sub) || 0));
    this.engine.registerFilter("times", (num: number, mult: number) => (Number(num) || 0) * (Number(mult) || 0));
    this.engine.registerFilter("divided_by", (num: number, div: number) => {
      const d = Number(div) || 1;
      return Math.floor((Number(num) || 0) / d);
    });
    this.engine.registerFilter("modulo", (num: number, mod: number) => (Number(num) || 0) % (Number(mod) || 1));
    this.engine.registerFilter("at_least", (num: number, min: number) => Math.max(Number(num) || 0, Number(min) || 0));
    this.engine.registerFilter("at_most", (num: number, max: number) => Math.min(Number(num) || 0, Number(max) || 0));

    // Array basic filters
    this.engine.registerFilter("first", (arr: any[]) => Array.isArray(arr) ? arr[0] : arr);
    this.engine.registerFilter("last", (arr: any[]) => Array.isArray(arr) ? arr[arr.length - 1] : arr);
    this.engine.registerFilter("size", (val: any) => {
      if (Array.isArray(val)) return val.length;
      if (typeof val === "string") return val.length;
      if (val && typeof val === "object") return Object.keys(val).length;
      return 0;
    });
    this.engine.registerFilter("join", (arr: any[], separator?: string) => {
      if (!Array.isArray(arr)) return arr;
      return arr.join(separator ?? " ");
    });
    this.engine.registerFilter("reverse", (arr: any[]) => {
      if (!Array.isArray(arr)) return arr;
      return [...arr].reverse();
    });
    this.engine.registerFilter("concat", (arr: any[], other: any[]) => {
      if (!Array.isArray(arr)) return arr;
      return arr.concat(other || []);
    });

    // Date filter (basic implementation)
    this.engine.registerFilter("date", (dateVal: any, format?: string) => {
      const date = dateVal === "now" ? new Date() : new Date(dateVal);
      if (isNaN(date.getTime())) return dateVal;
      const fmt = format || "%Y-%m-%d";
      return fmt
        .replace("%Y", String(date.getFullYear()))
        .replace("%m", String(date.getMonth() + 1).padStart(2, "0"))
        .replace("%d", String(date.getDate()).padStart(2, "0"))
        .replace("%H", String(date.getHours()).padStart(2, "0"))
        .replace("%M", String(date.getMinutes()).padStart(2, "0"))
        .replace("%S", String(date.getSeconds()).padStart(2, "0"))
        .replace("%B", date.toLocaleString("en", { month: "long" }))
        .replace("%b", date.toLocaleString("en", { month: "short" }))
        .replace("%A", date.toLocaleString("en", { weekday: "long" }))
        .replace("%a", date.toLocaleString("en", { weekday: "short" }));
    });

    // Default filter
    this.engine.registerFilter("default", (val: any, defaultVal: any) => {
      if (val === null || val === undefined || val === false || val === "" || (Array.isArray(val) && val.length === 0)) {
        return defaultVal;
      }
      return val;
    });

    // Image filters with size support
    // Shopify sizes: master, grande, large, medium, compact, small, thumb, icon, pico, or NxM
    const sizeMap: Record<string, string> = {
      pico: "16x16",
      icon: "32x32",
      thumb: "50x50",
      small: "100x100",
      compact: "160x160",
      medium: "240x240",
      large: "480x480",
      grande: "600x600",
      original: "",
      master: "",
    };

    this.engine.registerFilter("img_url", (image: any, size?: string) => {
      let src = "";
      if (typeof image === "string") {
        src = image;
      } else if (image?.src) {
        src = image.src;
      } else if (image?.url) {
        src = image.url;
      } else {
        return "/placeholder.jpg";
      }

      // If no size or master/original, return as-is
      if (!size || size === "master" || size === "original") {
        return src;
      }

      // Convert named size to dimensions
      const dimensions = sizeMap[size] || size;

      // For Shopify CDN URLs, append size suffix
      if (src.includes("cdn.shopify.com") || src.includes("shopifycdn.com")) {
        // Insert size before file extension
        const extMatch = src.match(/(\.[a-z]+)(\?.*)?$/i);
        if (extMatch) {
          return src.replace(extMatch[0], `_${dimensions}${extMatch[1]}${extMatch[2] || ""}`);
        }
      }

      // For local/other URLs, add query param
      const separator = src.includes("?") ? "&" : "?";
      return `${src}${separator}size=${dimensions}`;
    });

    this.engine.registerFilter("image_url", (image: any, options?: any) => {
      let src = "";
      if (typeof image === "string") {
        src = image;
      } else if (image?.src) {
        src = image.src;
      } else if (image?.url) {
        src = image.url;
      } else {
        return "/placeholder.jpg";
      }

      // Handle width/height options
      if (options && typeof options === "object") {
        const params: string[] = [];
        if (options.width) params.push(`width=${options.width}`);
        if (options.height) params.push(`height=${options.height}`);
        if (options.crop) params.push(`crop=${options.crop}`);
        if (options.format) params.push(`format=${options.format}`);

        if (params.length > 0) {
          const separator = src.includes("?") ? "&" : "?";
          return `${src}${separator}${params.join("&")}`;
        }
      }

      return src;
    });

    this.engine.registerFilter("img_tag", (url: string, alt?: string, cls?: string) => {
      const altText = alt || "";
      const className = cls || "";
      return `<img src="${url}" alt="${altText}" class="${className}" loading="lazy">`;
    });

    this.engine.registerFilter("image_tag", (url: string, options?: any) => {
      const alt = options?.alt || "";
      const cls = options?.class || "";
      const width = options?.width ? `width="${options.width}"` : "";
      const height = options?.height ? `height="${options.height}"` : "";
      const loading = options?.loading || "lazy";
      const sizes = options?.sizes ? `sizes="${options.sizes}"` : "";
      const srcset = options?.srcset ? `srcset="${options.srcset}"` : "";

      return `<img src="${url}" alt="${alt}" class="${cls}" ${width} ${height} ${sizes} ${srcset} loading="${loading}">`.replace(/\s+/g, " ").trim();
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
      // Translation filter - use loaded locales
      let translation = self.getTranslation(key);
      // Replace placeholders like {{ count }}
      if (options && typeof options === "object") {
        for (const [k, v] of Object.entries(options)) {
          translation = translation.replace(new RegExp(`{{\\s*${k}\\s*}}`, "g"), String(v));
        }
      }
      return translation;
    });

    // JSON filter
    this.engine.registerFilter("json", (value: any) => {
      return JSON.stringify(value);
    });

    // Collection/Array filters
    this.engine.registerFilter("where", (array: any[], key: string, value: any) => {
      if (!Array.isArray(array)) return [];
      return array.filter((item) => item?.[key] === value);
    });

    this.engine.registerFilter("map", (array: any[], key: string) => {
      if (!Array.isArray(array)) return [];
      return array.map((item) => item?.[key]);
    });

    this.engine.registerFilter("sort", (array: any[], key?: string) => {
      if (!Array.isArray(array)) return [];
      const sorted = [...array];
      if (key) {
        sorted.sort((a, b) => {
          const aVal = a?.[key];
          const bVal = b?.[key];
          if (aVal < bVal) return -1;
          if (aVal > bVal) return 1;
          return 0;
        });
      } else {
        sorted.sort();
      }
      return sorted;
    });

    this.engine.registerFilter("sort_natural", (array: any[], key?: string) => {
      if (!Array.isArray(array)) return [];
      const sorted = [...array];
      if (key) {
        sorted.sort((a, b) => String(a?.[key] || "").localeCompare(String(b?.[key] || ""), undefined, { numeric: true }));
      } else {
        sorted.sort((a, b) => String(a || "").localeCompare(String(b || ""), undefined, { numeric: true }));
      }
      return sorted;
    });

    this.engine.registerFilter("uniq", (array: any[]) => {
      if (!Array.isArray(array)) return [];
      return [...new Set(array)];
    });

    this.engine.registerFilter("compact", (array: any[]) => {
      if (!Array.isArray(array)) return [];
      return array.filter((item) => item != null);
    });

    // Stylesheet/Script tags
    this.engine.registerFilter("stylesheet_tag", (url: string) => {
      return `<link rel="stylesheet" href="${url}" type="text/css">`;
    });

    this.engine.registerFilter("script_tag", (url: string) => {
      return `<script src="${url}"></script>`;
    });

    // Color parsing helper
    const parseColor = (color: string): { r: number; g: number; b: number } | null => {
      if (!color) return null;
      color = color.trim();

      // Hex format
      const hexMatch = color.match(/^#?([a-f0-9]{2})([a-f0-9]{2})([a-f0-9]{2})$/i);
      if (hexMatch) {
        return {
          r: parseInt(hexMatch[1], 16),
          g: parseInt(hexMatch[2], 16),
          b: parseInt(hexMatch[3], 16),
        };
      }

      // Short hex format
      const shortHexMatch = color.match(/^#?([a-f0-9])([a-f0-9])([a-f0-9])$/i);
      if (shortHexMatch) {
        return {
          r: parseInt(shortHexMatch[1] + shortHexMatch[1], 16),
          g: parseInt(shortHexMatch[2] + shortHexMatch[2], 16),
          b: parseInt(shortHexMatch[3] + shortHexMatch[3], 16),
        };
      }

      // rgb/rgba format
      const rgbMatch = color.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
      if (rgbMatch) {
        return {
          r: parseInt(rgbMatch[1], 10),
          g: parseInt(rgbMatch[2], 10),
          b: parseInt(rgbMatch[3], 10),
        };
      }

      return null;
    };

    // RGB to HSL conversion
    const rgbToHsl = (r: number, g: number, b: number): { h: number; s: number; l: number } => {
      r /= 255; g /= 255; b /= 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      let h = 0, s: number;
      const l = (max + min) / 2;
      if (max === min) {
        h = s = 0;
      } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
          case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
          case g: h = ((b - r) / d + 2) / 6; break;
          case b: h = ((r - g) / d + 4) / 6; break;
        }
      }
      return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
    };

    // HSL to RGB conversion
    const hslToRgb = (h: number, s: number, l: number): { r: number; g: number; b: number } => {
      h /= 360; s /= 100; l /= 100;
      let r: number, g: number, b: number;
      if (s === 0) {
        r = g = b = l;
      } else {
        const hue2rgb = (p: number, q: number, t: number) => {
          if (t < 0) t += 1;
          if (t > 1) t -= 1;
          if (t < 1/6) return p + (q - p) * 6 * t;
          if (t < 1/2) return q;
          if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
          return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
      }
      return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
    };

    this.engine.registerFilter("color_to_rgb", (color: string) => {
      const rgb = parseColor(color);
      if (!rgb) return color;
      return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
    });

    this.engine.registerFilter("color_to_hex", (color: string) => {
      const rgb = parseColor(color);
      if (!rgb) return color;
      return `#${rgb.r.toString(16).padStart(2, "0")}${rgb.g.toString(16).padStart(2, "0")}${rgb.b.toString(16).padStart(2, "0")}`;
    });

    this.engine.registerFilter("color_to_hsl", (color: string) => {
      const rgb = parseColor(color);
      if (!rgb) return color;
      const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
      return `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;
    });

    this.engine.registerFilter("color_extract", (color: string, component: string) => {
      const rgb = parseColor(color);
      if (!rgb) return 0;
      switch (component) {
        case "red": return rgb.r;
        case "green": return rgb.g;
        case "blue": return rgb.b;
        case "hue": return rgbToHsl(rgb.r, rgb.g, rgb.b).h;
        case "saturation": return rgbToHsl(rgb.r, rgb.g, rgb.b).s;
        case "lightness": return rgbToHsl(rgb.r, rgb.g, rgb.b).l;
        default: return 0;
      }
    });

    this.engine.registerFilter("color_brightness", (color: string) => {
      const rgb = parseColor(color);
      if (!rgb) return 0;
      // Using perceived brightness formula
      return Math.round((rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000);
    });

    this.engine.registerFilter("color_lighten", (color: string, amount: number) => {
      const rgb = parseColor(color);
      if (!rgb) return color;
      const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
      hsl.l = Math.min(100, hsl.l + (amount || 0));
      const newRgb = hslToRgb(hsl.h, hsl.s, hsl.l);
      return `#${newRgb.r.toString(16).padStart(2, "0")}${newRgb.g.toString(16).padStart(2, "0")}${newRgb.b.toString(16).padStart(2, "0")}`;
    });

    this.engine.registerFilter("color_darken", (color: string, amount: number) => {
      const rgb = parseColor(color);
      if (!rgb) return color;
      const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
      hsl.l = Math.max(0, hsl.l - (amount || 0));
      const newRgb = hslToRgb(hsl.h, hsl.s, hsl.l);
      return `#${newRgb.r.toString(16).padStart(2, "0")}${newRgb.g.toString(16).padStart(2, "0")}${newRgb.b.toString(16).padStart(2, "0")}`;
    });

    this.engine.registerFilter("color_saturate", (color: string, amount: number) => {
      const rgb = parseColor(color);
      if (!rgb) return color;
      const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
      hsl.s = Math.min(100, hsl.s + (amount || 0));
      const newRgb = hslToRgb(hsl.h, hsl.s, hsl.l);
      return `#${newRgb.r.toString(16).padStart(2, "0")}${newRgb.g.toString(16).padStart(2, "0")}${newRgb.b.toString(16).padStart(2, "0")}`;
    });

    this.engine.registerFilter("color_desaturate", (color: string, amount: number) => {
      const rgb = parseColor(color);
      if (!rgb) return color;
      const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
      hsl.s = Math.max(0, hsl.s - (amount || 0));
      const newRgb = hslToRgb(hsl.h, hsl.s, hsl.l);
      return `#${newRgb.r.toString(16).padStart(2, "0")}${newRgb.g.toString(16).padStart(2, "0")}${newRgb.b.toString(16).padStart(2, "0")}`;
    });

    this.engine.registerFilter("color_modify", (color: string, attr: string, value: number) => {
      const rgb = parseColor(color);
      if (!rgb) return color;
      const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
      switch (attr) {
        case "hue": hsl.h = value % 360; break;
        case "saturation": hsl.s = Math.max(0, Math.min(100, value)); break;
        case "lightness": hsl.l = Math.max(0, Math.min(100, value)); break;
        case "red": rgb.r = Math.max(0, Math.min(255, value));
          return `#${rgb.r.toString(16).padStart(2, "0")}${rgb.g.toString(16).padStart(2, "0")}${rgb.b.toString(16).padStart(2, "0")}`;
        case "green": rgb.g = Math.max(0, Math.min(255, value));
          return `#${rgb.r.toString(16).padStart(2, "0")}${rgb.g.toString(16).padStart(2, "0")}${rgb.b.toString(16).padStart(2, "0")}`;
        case "blue": rgb.b = Math.max(0, Math.min(255, value));
          return `#${rgb.r.toString(16).padStart(2, "0")}${rgb.g.toString(16).padStart(2, "0")}${rgb.b.toString(16).padStart(2, "0")}`;
      }
      const newRgb = hslToRgb(hsl.h, hsl.s, hsl.l);
      return `#${newRgb.r.toString(16).padStart(2, "0")}${newRgb.g.toString(16).padStart(2, "0")}${newRgb.b.toString(16).padStart(2, "0")}`;
    });

    this.engine.registerFilter("color_contrast", (color: string) => {
      const rgb = parseColor(color);
      if (!rgb) return "#000000";
      // Calculate relative luminance and return contrasting color
      const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
      return brightness > 128 ? "#000000" : "#ffffff";
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

    // Hash filters
    this.engine.registerFilter("md5", (str: string) => {
      if (typeof str !== "string") str = String(str ?? "");
      return createHash("md5").update(str).digest("hex");
    });

    this.engine.registerFilter("sha1", (str: string) => {
      if (typeof str !== "string") str = String(str ?? "");
      return createHash("sha1").update(str).digest("hex");
    });

    this.engine.registerFilter("sha256", (str: string) => {
      if (typeof str !== "string") str = String(str ?? "");
      return createHash("sha256").update(str).digest("hex");
    });

    this.engine.registerFilter("hmac_sha1", (str: string, secret: string) => {
      if (typeof str !== "string") str = String(str ?? "");
      return createHmac("sha1", secret || "").update(str).digest("hex");
    });

    this.engine.registerFilter("hmac_sha256", (str: string, secret: string) => {
      if (typeof str !== "string") str = String(str ?? "");
      return createHmac("sha256", secret || "").update(str).digest("hex");
    });

    // Base64 filters
    this.engine.registerFilter("base64_encode", (str: string) => {
      if (typeof str !== "string") str = String(str ?? "");
      return Buffer.from(str).toString("base64");
    });

    this.engine.registerFilter("base64_decode", (str: string) => {
      if (typeof str !== "string") str = String(str ?? "");
      try {
        return Buffer.from(str, "base64").toString("utf-8");
      } catch {
        return str;
      }
    });

    // Base64 URL safe variants
    this.engine.registerFilter("base64_url_safe_encode", (str: string) => {
      if (typeof str !== "string") str = String(str ?? "");
      return Buffer.from(str).toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
    });

    this.engine.registerFilter("base64_url_safe_decode", (str: string) => {
      if (typeof str !== "string") str = String(str ?? "");
      // Add padding back
      const pad = str.length % 4;
      if (pad) str += "=".repeat(4 - pad);
      str = str.replace(/-/g, "+").replace(/_/g, "/");
      try {
        return Buffer.from(str, "base64").toString("utf-8");
      } catch {
        return str;
      }
    });

    // JSON filters
    this.engine.registerFilter("json", (obj: any) => {
      try {
        return JSON.stringify(obj);
      } catch {
        return "null";
      }
    });

    // URL encode/decode
    this.engine.registerFilter("url_encode", (str: string) => {
      if (typeof str !== "string") return str;
      return encodeURIComponent(str);
    });

    this.engine.registerFilter("url_decode", (str: string) => {
      if (typeof str !== "string") return str;
      try {
        return decodeURIComponent(str);
      } catch {
        return str;
      }
    });

    // URL escape (for use in HTML attributes)
    this.engine.registerFilter("url_escape", (str: string) => {
      if (typeof str !== "string") return str;
      return encodeURI(str);
    });

    this.engine.registerFilter("url_param_escape", (str: string) => {
      if (typeof str !== "string") return str;
      return encodeURIComponent(str);
    });
  }

  // ============================================
  // SECTION RENDERING
  // ============================================

  async renderSection(sectionType: string, context: Record<string, any>): Promise<string> {
    // Sanitize section type to prevent path traversal
    const safeType = this.sanitizePath(sectionType);
    const sectionPath = path.join(this.themeDir, "sections", `${safeType}.liquid`);

    // Check if section is disabled
    if (context.section?.disabled === true) {
      return "";
    }

    if (!fs.existsSync(sectionPath)) {
      return `<!-- Section not found: ${safeType} -->`;
    }

    // Read section file content
    const sectionContent = fs.readFileSync(sectionPath, "utf-8");

    // Extract schema from section file
    const schemaMatch = sectionContent.match(/{%[\s\S]*?schema[\s\S]*?%}([\s\S]*?){%[\s\S]*?endschema[\s\S]*?%}/);

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

    // Build blocks array in correct order for iteration
    const blocksArray = blockOrder.map((blockId: string) => {
      const block = sectionBlocks[blockId];
      if (!block) return null;
      return {
        id: blockId,
        type: block.type,
        settings: block.settings || {},
      };
    }).filter(Boolean);

    const sectionContext = {
      ...context,
      section: {
        id: context.section?.id || `section-${sectionType}`,
        type: sectionType,
        settings: sectionSettings,
        blocks: blocksArray,
        block_order: blockOrder,
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
        let jsonContent = fs.readFileSync(templateJsonPath, "utf-8");
        // Strip JavaScript-style comments from JSON (Shopify adds auto-generated comments)
        jsonContent = this.stripJsonComments(jsonContent);
        templateJSON = JSON.parse(jsonContent);
      } catch (e) {
        console.error(`[renderPage] JSON parse error for ${templateType}:`, e);
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

  /**
   * Strip JavaScript-style comments from JSON content
   * Shopify theme JSON files include auto-generated block comments
   */
  private stripJsonComments(jsonString: string): string {
    // Remove block comments /* ... */
    let result = jsonString.replace(/\/\*[\s\S]*?\*\//g, '');
    // Remove single line comments // ... (but be careful not to remove URLs)
    result = result.replace(/(?<!:)\/\/[^\n]*/g, '');
    return result;
  }

  private getDefaultContext(): RenderContext & Record<string, any> {
    const settings = this.loadThemeSettings();
    const mockProducts = this.getMockProducts();
    const mockCollections = this.getMockCollections();
    const mockMenus = this.getMockMenus();

    return {
      shop: {
        name: "My Store",
        url: "https://mystore.myshopify.com",
        currency: "USD",
        locale: "en",
        money_format: "${{amount}}",
        enabled_payment_types: ["visa", "mastercard", "amex", "paypal"],
      },
      page_title: "Home",
      content_for_header: "",
      content_for_layout: "",
      template: "index",
      request: {
        path: "/",
        host: "mystore.myshopify.com",
        locale: { iso_code: "en" },
        design_mode: true, // Indicates we're in the editor
      },
      settings,
      localization: {
        available_languages: [{ iso_code: "en", name: "English" }],
        language: { iso_code: "en", name: "English" },
      },
      // Global objects with mock data
      product: mockProducts[0],
      products: mockProducts,
      collection: mockCollections[0],
      collections: mockCollections,
      all_products: this.arrayToHandle(mockProducts),
      cart: {
        item_count: 2,
        items: [
          { product: mockProducts[0], quantity: 1, line_price: 1999 },
          { product: mockProducts[1], quantity: 1, line_price: 2499 }
        ],
        total_price: 4498,
        currency: { iso_code: "USD" }
      },
      customer: null,
      pages: [
        { title: "About Us", handle: "about-us", url: "/pages/about-us" },
        { title: "Contact", handle: "contact", url: "/pages/contact" },
      ],
      blogs: [
        { title: "News", handle: "news", url: "/blogs/news" },
      ],
      articles: [],
      linklists: mockMenus,
      menus: mockMenus,
      routes: {
        root_url: "/",
        cart_url: "/cart",
        account_url: "/account",
        account_login_url: "/account/login",
        account_register_url: "/account/register",
        search_url: "/search",
        collections_url: "/collections",
        all_products_collection_url: "/collections/all",
      },
      canonical_url: "/",
      page_description: "Welcome to our store",
      handle: "index",
      // Images global
      images: {
        logo: { src: "https://via.placeholder.com/200x60?text=Logo" },
        placeholder: { src: "https://via.placeholder.com/400x400?text=Image" },
      },
      // Powered by URL
      powered_by_link: '<a href="https://www.shopify.com" target="_blank">Powered by Shopify</a>',
    };
  }

  private getMockProducts(): any[] {
    const placeholderImg = "https://via.placeholder.com/400x400?text=Product";
    return [
      {
        id: 1001,
        title: "Sample Product 1",
        handle: "sample-product-1",
        url: "/products/sample-product-1",
        price: 1999,
        price_min: 1999,
        price_max: 2499,
        compare_at_price: 2499,
        compare_at_price_min: 2499,
        compare_at_price_max: 2499,
        available: true,
        featured_image: { src: placeholderImg, alt: "Sample Product 1" },
        images: [{ src: placeholderImg, alt: "Sample Product 1" }],
        image: { src: placeholderImg, alt: "Sample Product 1" },
        variants: [
          { id: 1, title: "Default", price: 1999, available: true, inventory_quantity: 10 }
        ],
        selected_or_first_available_variant: { id: 1, title: "Default", price: 1999, available: true },
        description: "This is a sample product for preview purposes.",
        vendor: "Sample Vendor",
        type: "Sample Type",
        tags: ["sample", "preview"],
        options: [],
        has_only_default_variant: true,
      },
      {
        id: 1002,
        title: "Sample Product 2",
        handle: "sample-product-2",
        url: "/products/sample-product-2",
        price: 2499,
        price_min: 2499,
        price_max: 2499,
        compare_at_price: 3499,
        compare_at_price_min: 3499,
        available: true,
        featured_image: { src: placeholderImg, alt: "Sample Product 2" },
        images: [{ src: placeholderImg, alt: "Sample Product 2" }],
        image: { src: placeholderImg, alt: "Sample Product 2" },
        variants: [
          { id: 2, title: "Default", price: 2499, available: true, inventory_quantity: 5 }
        ],
        selected_or_first_available_variant: { id: 2, title: "Default", price: 2499, available: true },
        description: "Another sample product.",
        vendor: "Sample Vendor",
        type: "Sample Type",
        tags: ["sample"],
        options: [],
        has_only_default_variant: true,
      },
      {
        id: 1003,
        title: "Sample Product 3",
        handle: "sample-product-3",
        url: "/products/sample-product-3",
        price: 3999,
        price_min: 3999,
        price_max: 3999,
        compare_at_price: null,
        available: true,
        featured_image: { src: placeholderImg, alt: "Sample Product 3" },
        images: [{ src: placeholderImg, alt: "Sample Product 3" }],
        image: { src: placeholderImg, alt: "Sample Product 3" },
        variants: [
          { id: 3, title: "Default", price: 3999, available: true, inventory_quantity: 15 }
        ],
        selected_or_first_available_variant: { id: 3, title: "Default", price: 3999, available: true },
        description: "Premium sample product.",
        vendor: "Premium Vendor",
        type: "Premium Type",
        tags: ["premium"],
        options: [],
        has_only_default_variant: true,
      },
      {
        id: 1004,
        title: "Sample Product 4",
        handle: "sample-product-4",
        url: "/products/sample-product-4",
        price: 4999,
        price_min: 4999,
        price_max: 4999,
        compare_at_price: 5999,
        available: false,
        featured_image: { src: placeholderImg, alt: "Sample Product 4" },
        images: [{ src: placeholderImg, alt: "Sample Product 4" }],
        image: { src: placeholderImg, alt: "Sample Product 4" },
        variants: [
          { id: 4, title: "Default", price: 4999, available: false, inventory_quantity: 0 }
        ],
        selected_or_first_available_variant: { id: 4, title: "Default", price: 4999, available: false },
        description: "Out of stock sample.",
        vendor: "Sample Vendor",
        type: "Sample Type",
        tags: ["sold-out"],
        options: [],
        has_only_default_variant: true,
      },
    ];
  }

  private getMockCollections(): any[] {
    const placeholderImg = "https://via.placeholder.com/600x400?text=Collection";
    const products = this.getMockProducts();

    return [
      {
        id: 2001,
        title: "All Products",
        handle: "all",
        url: "/collections/all",
        description: "Browse all our products",
        image: { src: placeholderImg, alt: "All Products" },
        featured_image: { src: placeholderImg, alt: "All Products" },
        products: products,
        products_count: products.length,
        all_products_count: products.length,
      },
      {
        id: 2002,
        title: "Featured",
        handle: "featured",
        url: "/collections/featured",
        description: "Our featured products",
        image: { src: placeholderImg, alt: "Featured" },
        featured_image: { src: placeholderImg, alt: "Featured" },
        products: products.slice(0, 2),
        products_count: 2,
        all_products_count: 2,
      },
      {
        id: 2003,
        title: "New Arrivals",
        handle: "new-arrivals",
        url: "/collections/new-arrivals",
        description: "Check out our latest products",
        image: { src: placeholderImg, alt: "New Arrivals" },
        featured_image: { src: placeholderImg, alt: "New Arrivals" },
        products: products.slice(1, 3),
        products_count: 2,
        all_products_count: 2,
      },
    ];
  }

  private getMockMenus(): Record<string, any> {
    return {
      "main-menu": {
        title: "Main Menu",
        handle: "main-menu",
        links: [
          { title: "Home", url: "/", active: true },
          { title: "Catalog", url: "/collections/all", active: false },
          { title: "About Us", url: "/pages/about-us", active: false },
          { title: "Contact", url: "/pages/contact", active: false },
        ],
      },
      "footer-menu": {
        title: "Footer Menu",
        handle: "footer-menu",
        links: [
          { title: "Search", url: "/search", active: false },
          { title: "Privacy Policy", url: "/policies/privacy-policy", active: false },
          { title: "Refund Policy", url: "/policies/refund-policy", active: false },
        ],
      },
    };
  }

  private arrayToHandle(items: any[]): Record<string, any> {
    const result: Record<string, any> = {};
    for (const item of items) {
      if (item.handle) {
        result[item.handle] = item;
      }
    }
    return result;
  }

  private getContentForHeader(context: RenderContext): string {
    // Generate CSS variables from theme settings
    const cssVariables = this.generateCSSVariables(context.settings || {});

    // Get CSS files from assets directory
    const cssLinks = this.getAssetCSSLinks();

    // Common Google Fonts (can be extended based on theme settings)
    const googleFonts = this.getGoogleFontsLink(context.settings || {});

    return `
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>${context.page_title} - ${context.shop.name}</title>
      ${googleFonts}
      <style>
        :root {
          ${cssVariables}
          /* Fallback colors */
          --color-base-text: #1a1a2e;
          --color-base-background-1: #ffffff;
          --color-base-background-2: #f5f5f5;
          --color-base-accent-1: #5c5cf0;
          --color-base-accent-2: #4a4ad9;
          --gradient-base-background-1: #ffffff;
          --font-body-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          --font-heading-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          --font-body-scale: 1;
          --font-heading-scale: 1;
          --buttons-radius: 4px;
          --inputs-radius: 4px;
          --page-width: 1200px;
          --media-padding: 16px;
        }
        /* Base reset */
        *, *::before, *::after { box-sizing: border-box; }
        body {
          font-family: var(--font-body-family);
          font-size: calc(var(--font-body-scale) * 1rem);
          line-height: 1.6;
          color: var(--color-base-text);
          background: var(--color-base-background-1);
          margin: 0;
        }
        img, svg { max-width: 100%; height: auto; display: block; }
        a { color: var(--color-base-accent-1); }
        .page-width { max-width: var(--page-width); margin: 0 auto; padding: 0 var(--media-padding); }
        .button, .shopify-challenge__button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 12px 28px;
          background: var(--color-base-accent-1);
          color: white;
          text-decoration: none;
          border-radius: var(--buttons-radius);
          border: none;
          cursor: pointer;
          font-weight: 600;
        }
        .button:hover { background: var(--color-base-accent-2); }
        h1, h2, h3, h4, h5, h6 {
          font-family: var(--font-heading-family);
          margin-top: 0;
          line-height: 1.2;
        }
        .grid { display: grid; gap: 1rem; }
        .grid--2-col-desktop { grid-template-columns: repeat(2, 1fr); }
        .grid--3-col-desktop { grid-template-columns: repeat(3, 1fr); }
        .grid--4-col-desktop { grid-template-columns: repeat(4, 1fr); }
        @media (max-width: 749px) {
          .grid--2-col-desktop, .grid--3-col-desktop, .grid--4-col-desktop {
            grid-template-columns: 1fr;
          }
        }
        /* Section hover effect for editor */
        .shopify-section { transition: outline 0.2s; }
        .shopify-section:hover { outline: 2px dashed var(--color-base-accent-1); outline-offset: -2px; }
        /* Hide schema tags */
        script[type="application/json"] { display: none; }
      </style>
      ${cssLinks}
    `;
  }

  private generateCSSVariables(settings: Record<string, any>): string {
    const vars: string[] = [];

    for (const [key, value] of Object.entries(settings)) {
      if (value === null || value === undefined) continue;

      // Color settings
      if (typeof value === 'string') {
        if (value.startsWith('#') || value.startsWith('rgb') || value.startsWith('hsl')) {
          vars.push(`--color-${key.replace(/_/g, '-')}: ${value};`);
        }
      }

      // Color objects from Shopify (e.g., {red: 255, green: 0, blue: 0, alpha: 1})
      if (typeof value === 'object' && value.red !== undefined) {
        const rgba = `rgba(${value.red}, ${value.green}, ${value.blue}, ${value.alpha ?? 1})`;
        vars.push(`--color-${key.replace(/_/g, '-')}: ${rgba};`);
      }

      // Font settings
      if (key.includes('font') && typeof value === 'string') {
        vars.push(`--font-${key.replace(/_/g, '-')}: ${value};`);
      }

      // Numeric settings (spacing, etc)
      if (typeof value === 'number') {
        vars.push(`--${key.replace(/_/g, '-')}: ${value}px;`);
      }
    }

    return vars.join('\n          ');
  }

  private getAssetCSSLinks(): string {
    const assetsDir = path.join(this.themeDir, "assets");
    if (!fs.existsSync(assetsDir)) return '';

    try {
      const files = fs.readdirSync(assetsDir);
      const cssFiles = files.filter(f => f.endsWith('.css') && !f.includes('.liquid'));

      // Prioritize base/component CSS files
      const priority = ['base.css', 'component-', 'section-', 'template-'];
      cssFiles.sort((a, b) => {
        const aPriority = priority.findIndex(p => a.includes(p));
        const bPriority = priority.findIndex(p => b.includes(p));
        return (aPriority === -1 ? 999 : aPriority) - (bPriority === -1 ? 999 : bPriority);
      });

      // Only load main CSS files (not minified duplicates)
      const mainCssFiles = cssFiles.filter(f => !f.includes('.aio.min.'));

      return mainCssFiles.map(f =>
        `<link rel="stylesheet" href="/theme-assets/${f}">`
      ).join('\n      ');
    } catch (e) {
      console.error("Failed to read assets directory:", e);
      return '';
    }
  }

  private getGoogleFontsLink(settings: Record<string, any>): string {
    // Extract font families from settings
    const fonts: Set<string> = new Set();

    for (const [key, value] of Object.entries(settings)) {
      if (key.includes('font') && typeof value === 'string') {
        // Parse Shopify font format (e.g., "roboto_n4" or "Roboto")
        const fontName = value.split('_')[0].replace(/([A-Z])/g, ' $1').trim();
        if (fontName && fontName.length > 0) {
          fonts.add(fontName);
        }
      }
    }

    // Default fonts if none specified
    if (fonts.size === 0) {
      fonts.add('Inter');
    }

    const fontFamilies = Array.from(fonts)
      .map(f => f.replace(/ /g, '+'))
      .join('|');

    return `<link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=${fontFamilies}:wght@400;500;600;700&display=swap" rel="stylesheet">`;
  }

  private loadThemeSettings(): Record<string, any> {
    const settingsPath = path.join(this.themeDir, "config", "settings_data.json");
    if (fs.existsSync(settingsPath)) {
      try {
        const content = fs.readFileSync(settingsPath, "utf-8");
        const data = JSON.parse(this.stripJsonComments(content));
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
