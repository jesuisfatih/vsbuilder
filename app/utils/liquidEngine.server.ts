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
import { generateCSSVariables as generateCSSVars, generateGoogleFontsUrl, parseShopifyFont } from "./cssVariables.server";
import { buildMockContext } from "./mockData.server";

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
      lenientIf: true, // Be lenient with if/unless conditions
      jsTruthy: true, // Use JavaScript truthiness
      // NOTE: outputEscape removed - we need raw HTML output for theme templates
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
        const groupName = this.groupName;

        // Handle special content placeholders
        if (groupName === 'content_for_layout') {
          return context.content_for_layout || "";
        }

        // Check for pre-rendered group content (header-group, footer-group, etc.)
        const groupContentKey = `content_for_${groupName}`;
        if (context[groupContentKey]) {
          return context[groupContentKey];
        }

        // Try header and footer shortcuts
        if (groupName === 'header-group' && context.content_for_header_group) {
          return context.content_for_header_group;
        }
        if (groupName === 'footer-group' && context.content_for_footer_group) {
          return context.content_for_footer_group;
        }

        // Fallback to content_for_layout for unrecognized groups
        return context.content_for_layout || "";
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

          // ✅ CRITICAL: Global objects that snippets need access to
          const globalObjects = {
            shop: parentContext.shop,
            settings: parentContext.settings,
            routes: parentContext.routes,
            request: parentContext.request,
            localization: parentContext.localization,
            cart: parentContext.cart,
            customer: parentContext.customer,
            linklists: parentContext.linklists,
            collections: parentContext.collections,
            all_products: parentContext.all_products,
            blogs: parentContext.blogs,
            pages: parentContext.pages,
            template: parentContext.template,
            page_title: parentContext.page_title,
            canonical_url: parentContext.canonical_url,
          };

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
            return await self.engine.parseAndRender(snippetContent, {
              ...globalObjects,
              ...resolvedAssignments,
            });
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
                ...globalObjects,
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

          // Normal render - include global objects
          return await self.engine.parseAndRender(snippetContent, {
            ...globalObjects,
            ...resolvedAssignments,
          });
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

    // Stylesheet and script tag filters
    this.engine.registerFilter("stylesheet_tag", (url: string) => {
      if (!url) return "";
      return `<link rel="stylesheet" href="${url}" type="text/css">`;
    });

    this.engine.registerFilter("script_tag", (url: string) => {
      if (!url) return "";
      return `<script src="${url}" type="text/javascript"></script>`;
    });

    this.engine.registerFilter("preload_tag", (url: string, asType?: string) => {
      if (!url) return "";
      const as = asType || (url.endsWith('.css') ? 'style' : url.endsWith('.js') ? 'script' : 'fetch');
      return `<link rel="preload" href="${url}" as="${as}">`;
    });

    // Font filters
    this.engine.registerFilter("font_url", (font: any, format?: string) => {
      if (!font) return "";
      if (typeof font === 'string') return font;
      // Handle Shopify font objects
      return font.url || font.src || `/theme-assets/fonts/${font.family || 'default'}.woff2`;
    });

    this.engine.registerFilter("font_face", (font: any, options?: any) => {
      if (!font) return "";
      const fontFamily = typeof font === 'string' ? font : (font.family || 'sans-serif');
      return `@font-face { font-family: '${fontFamily}'; src: url('/theme-assets/fonts/${fontFamily}.woff2') format('woff2'); }`;
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

    // ============================================
    // ADVANCED IMAGE FILTERS
    // ============================================

    // image_url with width, height, crop, format parameters
    this.engine.registerFilter("image_url", (image: any, ...args: any[]) => {
      if (!image) return "";

      // Get source URL
      let src = "";
      if (typeof image === "string") {
        src = image;
      } else if (image.src) {
        src = image.src;
      } else if (image.url) {
        src = image.url;
      }

      if (!src) return "";

      // Parse arguments (can be named or positional)
      const params: Record<string, any> = {};
      for (const arg of args) {
        if (typeof arg === "object" && arg !== null) {
          Object.assign(params, arg);
        } else if (typeof arg === "number") {
          if (!params.width) params.width = arg;
          else if (!params.height) params.height = arg;
        }
      }

      // Build URL parameters
      const searchParams = new URLSearchParams();
      if (params.width) searchParams.set("width", String(params.width));
      if (params.height) searchParams.set("height", String(params.height));
      if (params.crop) searchParams.set("crop", params.crop);
      if (params.format) searchParams.set("format", params.format);
      if (params.scale) searchParams.set("scale", String(params.scale));

      const queryString = searchParams.toString();
      return queryString ? `${src}?${queryString}` : src;
    });

    // Generate srcset for responsive images
    this.engine.registerFilter("image_srcset", (image: any, widths?: number[]) => {
      if (!image) return "";

      const src = typeof image === "string" ? image : (image.src || image.url || "");
      if (!src) return "";

      const defaultWidths = [180, 360, 540, 720, 900, 1080, 1296, 1512, 1728, 2048];
      const widthList = widths || defaultWidths;

      return widthList
        .map(w => `${src}${src.includes("?") ? "&" : "?"}width=${w} ${w}w`)
        .join(", ");
    });

    // img_tag - create full img element
    this.engine.registerFilter("img_tag", (image: any, alt?: string, className?: string) => {
      if (!image) return "";

      const src = typeof image === "string" ? image : (image.src || image.url || "");
      const altText = alt || (typeof image === "object" ? image.alt : "") || "";
      const classAttr = className ? ` class="${className}"` : "";

      return `<img src="${src}" alt="${altText}"${classAttr} loading="lazy">`;
    });

    // image_tag (Shopify version with srcset)
    this.engine.registerFilter("image_tag", (image: any, options?: any) => {
      if (!image) return "";

      const src = typeof image === "string" ? image : (image.src || image.url || "");
      const alt = options?.alt || (typeof image === "object" ? image.alt : "") || "";
      const width = options?.width || (typeof image === "object" ? image.width : "");
      const height = options?.height || (typeof image === "object" ? image.height : "");
      const className = options?.class || "";
      const loading = options?.loading || "lazy";
      const preload = options?.preload;

      let attrs = `src="${src}" alt="${alt}"`;
      if (width) attrs += ` width="${width}"`;
      if (height) attrs += ` height="${height}"`;
      if (className) attrs += ` class="${className}"`;
      attrs += ` loading="${loading}"`;

      // Add srcset if widths provided
      if (options?.widths) {
        const srcset = options.widths
          .map((w: number) => `${src}${src.includes("?") ? "&" : "?"}width=${w} ${w}w`)
          .join(", ");
        attrs += ` srcset="${srcset}"`;
        if (options.sizes) {
          attrs += ` sizes="${options.sizes}"`;
        }
      }

      let tag = `<img ${attrs}>`;

      // Add preload link if requested
      if (preload) {
        tag = `<link rel="preload" as="image" href="${src}">\n${tag}`;
      }

      return tag;
    });

    // ============================================
    // FONT FILTERS
    // ============================================

    // font_face - generate @font-face CSS
    this.engine.registerFilter("font_face", (font: any, options?: any) => {
      if (!font) return "";

      let fontFamily = "system-ui";
      let fontWeight = 400;
      let fontStyle = "normal";

      if (typeof font === "string") {
        // Parse Shopify font format: family_nW
        const match = font.match(/^(.+)_([ni])(\d)$/);
        if (match) {
          fontFamily = match[1].split("_").map((w: string) =>
            w.charAt(0).toUpperCase() + w.slice(1)
          ).join(" ");
          fontStyle = match[2] === "i" ? "italic" : "normal";
          fontWeight = parseInt(match[3]) * 100;
        } else {
          fontFamily = font;
        }
      }

      return `@font-face {
  font-family: '${fontFamily}';
  font-weight: ${fontWeight};
  font-style: ${fontStyle};
  font-display: swap;
}`;
    });

    // font_url - get URL for font file
    this.engine.registerFilter("font_url", (font: any) => {
      if (!font) return "";

      let fontFamily = "Arial";
      if (typeof font === "string") {
        const match = font.match(/^(.+)_([ni])(\d)$/);
        fontFamily = match ? match[1] : font;
      }

      const familyParam = fontFamily.split("_").map((w: string) =>
        w.charAt(0).toUpperCase() + w.slice(1)
      ).join("+");

      return `https://fonts.googleapis.com/css2?family=${familyParam}:wght@400;500;600;700&display=swap`;
    });

    // font_modify - modify font weight/style
    this.engine.registerFilter("font_modify", (font: any, property: string, value: any) => {
      if (!font) return font;
      return font; // Return as-is for now
    });

    // ============================================
    // PAYMENT & ICON FILTERS
    // ============================================

    // payment_type_svg_tag - generate SVG for payment type
    this.engine.registerFilter("payment_type_svg_tag", (type: string, options?: any) => {
      const paymentIcons: Record<string, string> = {
        visa: '<svg viewBox="0 0 38 24" class="payment-icon"><path d="M35 0H3C1.3 0 0 1.3 0 3v18c0 1.7 1.4 3 3 3h32c1.7 0 3-1.3 3-3V3c0-1.7-1.4-3-3-3z" fill="#0E4595"/><path d="M27.4 7.5l-3.3 9h-2.2l-1.7-7.1c-.1-.4-.2-.5-.5-.7-.5-.3-1.4-.6-2.1-.8l.1-.4h3.5c.5 0 .9.3 1 .9l.9 4.6 2.1-5.5h2.2z" fill="#fff"/></svg>',
        mastercard: '<svg viewBox="0 0 38 24" class="payment-icon"><circle cx="15" cy="12" r="7" fill="#EB001B"/><circle cx="23" cy="12" r="7" fill="#F79E1B"/><path d="M22 12c0-2.4-1.2-4.5-3-5.7-1.8 1.3-3 3.4-3 5.7s1.2 4.5 3 5.7c1.8-1.2 3-3.3 3-5.7z" fill="#FF5F00"/></svg>',
        amex: '<svg viewBox="0 0 38 24" class="payment-icon"><path d="M35 0H3C1.3 0 0 1.3 0 3v18c0 1.7 1.4 3 3 3h32c1.7 0 3-1.3 3-3V3c0-1.7-1.4-3-3-3z" fill="#006FCF"/><path d="M8 8h22v8H8z" fill="#fff"/></svg>',
        paypal: '<svg viewBox="0 0 38 24" class="payment-icon"><path d="M35 0H3C1.3 0 0 1.3 0 3v18c0 1.7 1.4 3 3 3h32c1.7 0 3-1.3 3-3V3c0-1.7-1.4-3-3-3z" fill="#003087"/><path d="M23.9 8.3c.2-1 0-1.7-.6-2.3-.6-.7-1.8-1-3.2-1h-4.1c-.3 0-.5.2-.6.5L14 14.6c0 .2.1.4.3.4h2.3l.6-3.5v.2c.1-.3.3-.5.6-.5h1.3c2.5 0 4.5-1 5-4z" fill="#fff"/></svg>',
        apple_pay: '<svg viewBox="0 0 38 24" class="payment-icon"><path d="M35 0H3C1.3 0 0 1.3 0 3v18c0 1.7 1.4 3 3 3h32c1.7 0 3-1.3 3-3V3c0-1.7-1.4-3-3-3z" fill="#000"/><path d="M13 9c.3-.4.5-.9.5-1.4-.5 0-1.1.3-1.5.7-.3.4-.6.9-.5 1.4.5 0 1.1-.3 1.5-.7zm.5 1c-.8 0-1.5.5-1.9.5-.4 0-1-.5-1.7-.5-.9 0-1.7.5-2.2 1.3-.9 1.6-.2 4 .7 5.3.5.6 1 1.3 1.7 1.3.7 0 .9-.4 1.7-.4s1 .4 1.7.4c.7 0 1.1-.6 1.6-1.3.5-.7.7-1.4.7-1.5-1.5-.6-1.5-2.8-.1-3.6-.5-.6-1.3-1-2.2-1v-.1z" fill="#fff"/></svg>',
        google_pay: '<svg viewBox="0 0 38 24" class="payment-icon"><path d="M35 0H3C1.3 0 0 1.3 0 3v18c0 1.7 1.4 3 3 3h32c1.7 0 3-1.3 3-3V3c0-1.7-1.4-3-3-3z" fill="#fff" stroke="#ddd"/><path d="M17.2 12c0-.2 0-.4-.1-.6h-3.6v1.2h2.1c-.1.5-.3.9-.7 1.2-.4.3-.9.5-1.5.5-.6 0-1.1-.2-1.5-.5-.4-.4-.7-.9-.7-1.5 0-.6.3-1.1.7-1.5.4-.3.9-.5 1.5-.5.5 0 1 .2 1.4.5l.9-.9c-.6-.5-1.3-.8-2.3-.8-1.5 0-2.8.8-3.4 2-.3.6-.4 1.2-.4 1.8s.1 1.2.4 1.8c.6 1.2 1.9 2 3.4 2 1.5 0 2.8-.6 3.4-1.8.3-.5.4-1.1.4-1.8l-.1-.1z" fill="#4285F4"/></svg>',
        shopify_pay: '<svg viewBox="0 0 38 24" class="payment-icon"><path d="M35 0H3C1.3 0 0 1.3 0 3v18c0 1.7 1.4 3 3 3h32c1.7 0 3-1.3 3-3V3c0-1.7-1.4-3-3-3z" fill="#5A31F4"/><path d="M21.4 8c-.5 0-.9.1-1.2.4-.4.3-.6.7-.7 1.2h3.6c0-.5-.2-.9-.5-1.2-.3-.3-.7-.4-1.2-.4zm2.4 2.8h-4.8c0 .6.2 1 .5 1.3.3.3.8.5 1.3.5.6 0 1.2-.3 1.6-.8l1.1.8c-.6.8-1.5 1.2-2.7 1.2-1 0-1.8-.3-2.4-.9-.6-.6-.9-1.5-.9-2.5 0-1 .3-1.9.9-2.5.6-.6 1.4-.9 2.4-.9 1 0 1.7.3 2.3.9.6.6.8 1.4.8 2.4 0 .1 0 .3-.1.5z" fill="#fff"/></svg>',
      };

      const normalizedType = (type || "").toLowerCase().replace(/[^a-z_]/g, "_");
      const className = options?.class || "";

      let svg = paymentIcons[normalizedType];
      if (!svg) {
        return `<span class="payment-icon payment-icon--unknown ${className}">${type}</span>`;
      }

      if (className) {
        svg = svg.replace('class="payment-icon"', `class="payment-icon ${className}"`);
      }

      return svg;
    });

    // payment_button - generate payment button HTML
    this.engine.registerFilter("payment_button", (checkout_url: string, options?: any) => {
      return `<a href="${checkout_url}" class="shopify-payment-button">${options?.label || "Buy now"}</a>`;
    });

    // ============================================
    // PLACEHOLDER FILTERS
    // ============================================

    // placeholder_svg_tag - generate placeholder SVG
    this.engine.registerFilter("placeholder_svg_tag", (type?: string, options?: any) => {
      const placeholderType = type || "image";
      const className = options?.class || "";

      const colors: Record<string, string> = {
        product: "#e8e8e8",
        collection: "#e8e8e8",
        image: "#f0f0f0",
        lifestyle: "#d4d4d4",
      };

      const bgColor = colors[placeholderType] || colors.image;

      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 525 525" class="placeholder-svg ${className}">
        <rect width="100%" height="100%" fill="${bgColor}"/>
        <path d="M262.5 120c-78.8 0-142.5 63.7-142.5 142.5S183.7 405 262.5 405 405 341.3 405 262.5 341.3 120 262.5 120zm0 236.3c-51.8 0-93.8-42-93.8-93.8s42-93.8 93.8-93.8 93.8 42 93.8 93.8-42 93.8-93.8 93.8z" fill="#b0b0b0" opacity="0.5"/>
      </svg>`;
    });

    // ============================================
    // EXTERNAL VIDEO FILTERS
    // ============================================

    // external_video_url - get embed URL for YouTube/Vimeo
    this.engine.registerFilter("external_video_url", (url: string, options?: any) => {
      if (!url) return "";

      // YouTube
      const youtubeMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
      if (youtubeMatch) {
        let embedUrl = `https://www.youtube.com/embed/${youtubeMatch[1]}`;
        const params = new URLSearchParams();
        if (options?.autoplay) params.set("autoplay", "1");
        if (options?.loop) params.set("loop", "1");
        if (options?.mute) params.set("mute", "1");
        if (options?.controls === false) params.set("controls", "0");
        const queryString = params.toString();
        return queryString ? `${embedUrl}?${queryString}` : embedUrl;
      }

      // Vimeo
      const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
      if (vimeoMatch) {
        let embedUrl = `https://player.vimeo.com/video/${vimeoMatch[1]}`;
        const params = new URLSearchParams();
        if (options?.autoplay) params.set("autoplay", "1");
        if (options?.loop) params.set("loop", "1");
        if (options?.muted) params.set("muted", "1");
        const queryString = params.toString();
        return queryString ? `${embedUrl}?${queryString}` : embedUrl;
      }

      return url;
    });

    // Helper function for video URL conversion
    const getExternalVideoUrl = (url: string, options?: any): string => {
      if (!url) return "";

      // YouTube
      const youtubeMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
      if (youtubeMatch) {
        let embedUrl = `https://www.youtube.com/embed/${youtubeMatch[1]}`;
        const params = new URLSearchParams();
        if (options?.autoplay) params.set("autoplay", "1");
        if (options?.loop) params.set("loop", "1");
        if (options?.mute) params.set("mute", "1");
        if (options?.controls === false) params.set("controls", "0");
        const queryString = params.toString();
        return queryString ? `${embedUrl}?${queryString}` : embedUrl;
      }

      // Vimeo
      const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
      if (vimeoMatch) {
        let embedUrl = `https://player.vimeo.com/video/${vimeoMatch[1]}`;
        const params = new URLSearchParams();
        if (options?.autoplay) params.set("autoplay", "1");
        if (options?.loop) params.set("loop", "1");
        if (options?.muted) params.set("muted", "1");
        const queryString = params.toString();
        return queryString ? `${embedUrl}?${queryString}` : embedUrl;
      }

      return url;
    };

    // external_video_tag - generate iframe for video
    this.engine.registerFilter("external_video_tag", (url: string, options?: any) => {
      const embedUrl = getExternalVideoUrl(url, options);
      const title = options?.title || "Video";
      const className = options?.class || "";

      return `<iframe src="${embedUrl}" title="${title}" class="${className}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
    });

    // ============================================
    // METAFIELD FILTERS
    // ============================================

    // metafield_tag - render metafield value appropriately
    this.engine.registerFilter("metafield_tag", (metafield: any, options?: any) => {
      if (!metafield) return "";

      const value = metafield.value;
      const type = metafield.type;

      switch (type) {
        case "single_line_text_field":
        case "multi_line_text_field":
          return value || "";
        case "rich_text_field":
          return value || "";
        case "number_integer":
        case "number_decimal":
          return String(value);
        case "boolean":
          return value ? "Yes" : "No";
        case "color":
          return `<span style="background-color: ${value}; display: inline-block; width: 1em; height: 1em;"></span>`;
        case "url":
          return `<a href="${value}">${value}</a>`;
        case "date":
        case "date_time":
          return new Date(value).toLocaleDateString();
        case "file_reference":
          if (value?.url) {
            const isImage = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(value.url);
            if (isImage) {
              return `<img src="${value.url}" alt="${value.alt || ""}" loading="lazy">`;
            }
            return `<a href="${value.url}">Download</a>`;
          }
          return "";
        case "product_reference":
        case "collection_reference":
        case "page_reference":
          return value?.title || "";
        case "list.single_line_text_field":
          return Array.isArray(value) ? value.join(", ") : String(value);
        default:
          return String(value || "");
      }
    });

    // metafield_text - get text value from metafield
    this.engine.registerFilter("metafield_text", (metafield: any) => {
      if (!metafield) return "";
      return String(metafield.value || "");
    });

    // ============================================
    // COLOR FILTERS
    // ============================================

    // brightness_difference - calculate WCAG brightness difference
    this.engine.registerFilter("brightness_difference", (color1: string, color2: string) => {
      const parseHex = (hex: string) => {
        const match = hex.match(/^#?([0-9A-Fa-f]{6})$/);
        if (!match) return { r: 0, g: 0, b: 0 };
        const h = match[1];
        return {
          r: parseInt(h.slice(0, 2), 16),
          g: parseInt(h.slice(2, 4), 16),
          b: parseInt(h.slice(4, 6), 16),
        };
      };

      const c1 = parseHex(color1 || "#000000");
      const c2 = parseHex(color2 || "#ffffff");

      const brightness1 = (c1.r * 299 + c1.g * 587 + c1.b * 114) / 1000;
      const brightness2 = (c2.r * 299 + c2.g * 587 + c2.b * 114) / 1000;

      return Math.abs(brightness1 - brightness2);
    });

    // color_difference - calculate color difference
    this.engine.registerFilter("color_difference", (color1: string, color2: string) => {
      const parseHex = (hex: string) => {
        const match = hex.match(/^#?([0-9A-Fa-f]{6})$/);
        if (!match) return { r: 0, g: 0, b: 0 };
        const h = match[1];
        return {
          r: parseInt(h.slice(0, 2), 16),
          g: parseInt(h.slice(2, 4), 16),
          b: parseInt(h.slice(4, 6), 16),
        };
      };

      const c1 = parseHex(color1 || "#000000");
      const c2 = parseHex(color2 || "#ffffff");

      return Math.abs(c1.r - c2.r) + Math.abs(c1.g - c2.g) + Math.abs(c1.b - c2.b);
    });

    // color_mix - mix two colors
    this.engine.registerFilter("color_mix", (color1: string, color2: string, weight?: number) => {
      const w = weight ?? 50;
      const parseHex = (hex: string) => {
        const match = hex.match(/^#?([0-9A-Fa-f]{6})$/);
        if (!match) return { r: 0, g: 0, b: 0 };
        const h = match[1];
        return {
          r: parseInt(h.slice(0, 2), 16),
          g: parseInt(h.slice(2, 4), 16),
          b: parseInt(h.slice(4, 6), 16),
        };
      };

      const c1 = parseHex(color1 || "#000000");
      const c2 = parseHex(color2 || "#ffffff");
      const ratio = w / 100;

      const r = Math.round(c1.r * (1 - ratio) + c2.r * ratio);
      const g = Math.round(c1.g * (1 - ratio) + c2.g * ratio);
      const b = Math.round(c1.b * (1 - ratio) + c2.b * ratio);

      return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
    });

    // Helper function for color mixing
    const mixColors = (color1: string, color2: string, weight: number): string => {
      const w = weight ?? 50;
      const parseHex = (hex: string) => {
        const match = hex.match(/^#?([0-9A-Fa-f]{6})$/);
        if (!match) return { r: 0, g: 0, b: 0 };
        const h = match[1];
        return {
          r: parseInt(h.slice(0, 2), 16),
          g: parseInt(h.slice(2, 4), 16),
          b: parseInt(h.slice(4, 6), 16),
        };
      };
      const c1 = parseHex(color1 || "#000000");
      const c2 = parseHex(color2 || "#ffffff");
      const ratio = w / 100;
      const r = Math.round(c1.r * (1 - ratio) + c2.r * ratio);
      const g = Math.round(c1.g * (1 - ratio) + c2.g * ratio);
      const b = Math.round(c1.b * (1 - ratio) + c2.b * ratio);
      return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
    };

    // color_lighten - lighten a color
    this.engine.registerFilter("color_lighten", (color: string, amount?: number) => {
      return mixColors(color, "#ffffff", amount || 20);
    });

    // color_darken - darken a color
    this.engine.registerFilter("color_darken", (color: string, amount?: number) => {
      return mixColors(color, "#000000", amount || 20);
    });

    // color_saturate - adjust saturation
    this.engine.registerFilter("color_saturate", (color: string, amount?: number) => {
      return color; // Simplified - just return original
    });

    // color_desaturate - reduce saturation
    this.engine.registerFilter("color_desaturate", (color: string, amount?: number) => {
      return color; // Simplified - just return original
    });

    // color_to_rgb - convert to rgb format
    this.engine.registerFilter("color_to_rgb", (color: string) => {
      const match = color?.match(/^#?([0-9A-Fa-f]{6})$/);
      if (!match) return color;
      const h = match[1];
      const r = parseInt(h.slice(0, 2), 16);
      const g = parseInt(h.slice(2, 4), 16);
      const b = parseInt(h.slice(4, 6), 16);
      return `rgb(${r}, ${g}, ${b})`;
    });

    // color_to_hex - convert to hex format
    this.engine.registerFilter("color_to_hex", (color: string) => {
      const match = color?.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      if (!match) return color;
      const r = parseInt(match[1]).toString(16).padStart(2, "0");
      const g = parseInt(match[2]).toString(16).padStart(2, "0");
      const b = parseInt(match[3]).toString(16).padStart(2, "0");
      return `#${r}${g}${b}`;
    });

    // color_to_hsl - convert to hsl format
    this.engine.registerFilter("color_to_hsl", (color: string) => {
      const match = color?.match(/^#?([0-9A-Fa-f]{6})$/);
      if (!match) return color;
      const h = match[1];
      let r = parseInt(h.slice(0, 2), 16) / 255;
      let g = parseInt(h.slice(2, 4), 16) / 255;
      let b = parseInt(h.slice(4, 6), 16) / 255;

      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      let hue = 0, sat = 0;
      const lum = (max + min) / 2;

      if (max !== min) {
        const d = max - min;
        sat = lum > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
          case r: hue = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
          case g: hue = ((b - r) / d + 2) / 6; break;
          case b: hue = ((r - g) / d + 4) / 6; break;
        }
      }

      return `hsl(${Math.round(hue * 360)}, ${Math.round(sat * 100)}%, ${Math.round(lum * 100)}%)`;
    });

    // ============================================
    // UTILITY FILTERS
    // ============================================

    // class_list - build class string from conditions
    this.engine.registerFilter("class_list", (...args: any[]) => {
      const classes: string[] = [];
      for (const arg of args) {
        if (typeof arg === "string" && arg) {
          classes.push(arg);
        } else if (Array.isArray(arg)) {
          classes.push(...arg.filter(Boolean));
        } else if (typeof arg === "object" && arg !== null) {
          for (const [cls, condition] of Object.entries(arg)) {
            if (condition) classes.push(cls);
          }
        }
      }
      return classes.join(" ");
    });

    // handle - convert string to handle format
    this.engine.registerFilter("handle", (str: string) => {
      if (typeof str !== "string") return str;
      return str
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    });

    // handleize - alias for handle
    this.engine.registerFilter("handleize", (str: string) => {
      if (typeof str !== "string") return str;
      return str
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    });

    // pluralize - simple pluralization
    this.engine.registerFilter("pluralize", (count: number, singular: string, plural?: string) => {
      const n = typeof count === "number" ? count : 0;
      if (n === 1) return singular;
      return plural || (singular + "s");
    });

    // article_img_url - get article image URL
    this.engine.registerFilter("article_img_url", (article: any, size?: string) => {
      if (!article) return "";
      const image = article.image || article.featured_image;
      if (!image) return "";
      return typeof image === "string" ? image : (image.src || image.url || "");
    });

    // collection_img_url - get collection image URL
    this.engine.registerFilter("collection_img_url", (collection: any, size?: string) => {
      if (!collection) return "";
      const image = collection.image || collection.featured_image;
      if (!image) return "";
      return typeof image === "string" ? image : (image.src || image.url || "");
    });

    // product_img_url - get product image URL
    this.engine.registerFilter("product_img_url", (product: any, size?: string) => {
      if (!product) return "";
      const image = product.featured_image || product.image || (product.images && product.images[0]);
      if (!image) return "";
      return typeof image === "string" ? image : (image.src || image.url || "");
    });

    // global_asset_url - Shopify global assets
    this.engine.registerFilter("global_asset_url", (asset: string) => {
      return `https://cdn.shopify.com/s/global/${asset}`;
    });

    // file_url - uploaded files URL
    this.engine.registerFilter("file_url", (file: string) => {
      return `/files/${file}`;
    });

    // file_img_url - file image URL
    this.engine.registerFilter("file_img_url", (file: string, size?: string) => {
      return `/files/${file}`;
    });

    // link_to_vendor - link to vendor page
    this.engine.registerFilter("link_to_vendor", (vendor: string) => {
      if (!vendor) return "";
      const handle = vendor.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      return `<a href="/collections/vendors?q=${encodeURIComponent(vendor)}" title="${vendor}">${vendor}</a>`;
    });

    // link_to_type - link to product type
    this.engine.registerFilter("link_to_type", (type: string) => {
      if (!type) return "";
      const handle = type.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      return `<a href="/collections/types?q=${encodeURIComponent(type)}" title="${type}">${type}</a>`;
    });

    // link_to_tag - link to tag
    this.engine.registerFilter("link_to_tag", (tag: string) => {
      if (!tag) return "";
      const handle = tag.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      return `<a href="/collections/all/${handle}" title="${tag}">${tag}</a>`;
    });

    // within - scope URL within collection
    this.engine.registerFilter("within", (url: string, collection: any) => {
      if (!url || !collection) return url;
      const collectionHandle = collection.handle || collection;
      return `/collections/${collectionHandle}${url}`;
    });

    // highlight - highlight search terms
    this.engine.registerFilter("highlight", (text: string, terms: string) => {
      if (!text || !terms) return text;
      const escaped = terms.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`(${escaped})`, "gi");
      return text.replace(regex, "<mark>$1</mark>");
    });

    // highlight_active_tag - highlight active tag
    this.engine.registerFilter("highlight_active_tag", (tag: string, cssClass?: string) => {
      const className = cssClass || "active";
      return `<span class="${className}">${tag}</span>`;
    });

    // login_button - OAuth login button
    this.engine.registerFilter("login_button", (provider: string, options?: any) => {
      const label = options?.label || `Sign in with ${provider}`;
      return `<button class="social-login-button social-login-button--${provider.toLowerCase()}">${label}</button>`;
    });

    // customer_login_link - link to customer login
    this.engine.registerFilter("customer_login_link", (text: string) => {
      return `<a href="/account/login">${text || "Log in"}</a>`;
    });

    // customer_logout_link - link to customer logout
    this.engine.registerFilter("customer_logout_link", (text: string) => {
      return `<a href="/account/logout">${text || "Log out"}</a>`;
    });

    // customer_register_link - link to customer registration
    this.engine.registerFilter("customer_register_link", (text: string) => {
      return `<a href="/account/register">${text || "Create account"}</a>`;
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
      let html = await this.engine.parseAndRender(sectionContent, sectionContext);
      return this.cleanupUnrenderedLiquid(html);
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
      let html = await this.engine.parseAndRender(layoutContent, fullContext);
      // Clean up any unrendered Liquid variables that might cause URL errors
      html = this.cleanupUnrenderedLiquid(html);
      return html;
    } catch (error) {
      console.error(`Error rendering layout:`, error);
      return this.cleanupUnrenderedLiquid(contentForLayout);
    }
  }

  /**
   * Clean up unrendered Liquid variables that might cause 404 errors
   * These occur when section settings don't have values set
   */
  private cleanupUnrenderedLiquid(html: string): string {
    // Remove src/href attributes that still contain Liquid syntax
    // e.g., src="{{ fallback_image_url }}" -> src=""
    html = html.replace(/(src|href|poster)=["']\s*\{\{[^}]+\}\}\s*["']/gi, '$1=""');

    // Replace any remaining {{ ... }} with placeholder text (not in attributes)
    // This prevents broken URLs but keeps structure intact
    html = html.replace(/\{\{\s*[^}]*\s*\}\}/g, (match) => {
      // Keep translation keys visible for debugging
      if (match.includes("'t:") || match.includes("| t")) {
        return ""; // Empty for translation failures
      }
      return ""; // Empty string for other unrendered variables
    });

    // Remove {% ... %} tags that weren't processed
    html = html.replace(/\{%[^%]*%\}/g, "");

    // NOTE: Don't remove empty src images - some themes use lazy loading
    // html = html.replace(/<img[^>]*src=["']\s*["'][^>]*>/gi, '');

    return html;
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

    // Use comprehensive mock context from centralized mockData server
    const mockContext = buildMockContext({
      shopDomain: 'my-store.myshopify.com',
      path: '/',
      template: 'index',
      customerLoggedIn: false,
      cartItemCount: 2,
      designMode: true,
    });

    return {
      ...mockContext,
      settings,
      content_for_header: '',
      content_for_layout: '',
    } as RenderContext & Record<string, any>;
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
    // Use the comprehensive CSS variable generator from cssVariables.server.ts
    return generateCSSVars(settings, { includeDefaults: true });
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
    // Use cssVariables.server.ts utilities for font parsing
    const fonts = [];

    for (const [key, value] of Object.entries(settings)) {
      if (key.includes('font') && typeof value === 'string') {
        fonts.push(parseShopifyFont(value));
      }
    }

    if (fonts.length === 0) {
      // Default font
      fonts.push({ family: 'Inter', weight: 400, style: 'normal' as const });
    }

    const fontsUrl = generateGoogleFontsUrl(fonts);

    return `<link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="${fontsUrl}" rel="stylesheet">`;
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

  /**
   * Get default values from schema settings
   */
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
    this.loadLocales();
  }
}

// Export singleton instance
export function createShopifyLiquidEngine(themeDir: string): ShopifyLiquidEngine {
  return new ShopifyLiquidEngine(themeDir);
}
