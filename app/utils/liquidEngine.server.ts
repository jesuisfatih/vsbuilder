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
    // Remove path traversal attempts
    return name.replace(/\.\./g, "").replace(/[\\/]/g, "").replace(/^\.*/, "");
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
            this.locales[locale] = JSON.parse(content);
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

    // {% render 'snippet-name' %}
    this.engine.registerTag("render", {
      parse(tagToken: any) {
        const args = tagToken.args.trim();
        const match = args.match(/['"]([^'"]+)['"]/);
        this.snippetName = match ? match[1] : args.split(/\s|,/)[0].replace(/['"]/g, "");

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
        try {
          // Sanitize snippet name to prevent path traversal
          const safeName = self.sanitizePath(this.snippetName);
          const snippetPath = path.join(self.themeDir, "snippets", `${safeName}.liquid`);

          if (!fs.existsSync(snippetPath)) {
            return `<!-- Snippet not found: ${safeName} -->`;
          }

          const snippetContent = fs.readFileSync(snippetPath, "utf-8");
          const parentContext = scope.getAll();

          // Resolve variable assignments
          const resolvedAssignments: Record<string, any> = {};
          for (const { key, valueExpr } of this.assignments) {
            if ((valueExpr.startsWith("'") && valueExpr.endsWith("'")) ||
                (valueExpr.startsWith('"') && valueExpr.endsWith('"'))) {
              resolvedAssignments[key] = valueExpr.slice(1, -1);
            } else {
              const parts = valueExpr.split(".");
              let value: any = parentContext;
              for (const part of parts) {
                value = value?.[part];
              }
              resolvedAssignments[key] = value !== undefined ? value : valueExpr;
            }
          }

          // Handle "for" loop syntax
          if (this.forLoop) {
            const parts = this.forLoop.arrayExpr.split(".");
            let array: any = parentContext;
            for (const part of parts) {
              array = array?.[part];
            }
            if (!Array.isArray(array)) array = [];

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

  private getDefaultContext(): RenderContext & Record<string, any> {
    const settings = this.loadThemeSettings();
    return {
      shop: {
        name: "My Store",
        url: "https://mystore.myshopify.com",
        currency: "USD",
        locale: "en",
        money_format: "${{amount}}",
        enabled_payment_types: [],
      },
      page_title: "Home",
      content_for_header: "",
      content_for_layout: "",
      template: "index",
      request: {
        path: "/",
        host: "mystore.myshopify.com",
        locale: { iso_code: "en" },
      },
      settings,
      localization: {
        available_languages: [{ iso_code: "en", name: "English" }],
        language: { iso_code: "en", name: "English" },
      },
      // Global objects (mock data)
      product: null,
      collection: null,
      collections: [],
      cart: { item_count: 0, items: [], total_price: 0 },
      customer: null,
      all_products: {},
      pages: [],
      blogs: [],
      articles: [],
      linklists: {},
      routes: { root_url: "/", cart_url: "/cart", account_url: "/account" },
      canonical_url: "/",
      page_description: "",
      handle: "",
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
