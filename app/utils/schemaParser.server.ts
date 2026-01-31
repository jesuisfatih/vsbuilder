/**
 * 🔍 Schema Parser Server
 * Parses Shopify section schemas from {% schema %} blocks
 * Validates settings, extracts defaults, and handles presets
 */

import * as fs from 'fs';
import * as path from 'path';
import type {
    BlockSchema,
    ParsedBlock,
    ParsedSection,
    SectionGroupJson,
    SectionSchema,
    SectionSetting,
    TemplateJson,
} from '../types/theme-schema';

// ============================================
// SCHEMA EXTRACTION
// ============================================

/**
 * Extract schema JSON from section liquid content
 */
export function extractSchemaFromLiquid(liquidContent: string): SectionSchema | null {
  // Match {% schema %}...{% endschema %}
  const schemaRegex = /{%[-\s]*schema[-\s]*%}([\s\S]*?){%[-\s]*endschema[-\s]*%}/i;
  const match = liquidContent.match(schemaRegex);

  if (!match || !match[1]) {
    return null;
  }

  try {
    // Strip any comments that might be in the JSON
    const jsonContent = stripJsonComments(match[1].trim());
    return JSON.parse(jsonContent) as SectionSchema;
  } catch (error) {
    console.error('[SchemaParser] Failed to parse schema JSON:', error);
    return null;
  }
}

/**
 * Strip JavaScript-style comments from JSON
 */
function stripJsonComments(json: string): string {
  // Remove block comments /* ... */
  let result = json.replace(/\/\*[\s\S]*?\*\//g, '');
  // Remove single-line comments // ... (but not URLs)
  result = result.replace(/(?<!:)\/\/[^\n]*/g, '');
  return result;
}

// ============================================
// SETTINGS EXTRACTION
// ============================================

/**
 * Get default values from schema settings
 */
export function getDefaultsFromSettings(settings: SectionSetting[]): Record<string, any> {
  const defaults: Record<string, any> = {};

  for (const setting of settings) {
    if ('id' in setting && setting.id) {
      if ('default' in setting && setting.default !== undefined) {
        defaults[setting.id] = setting.default;
      } else {
        // Set type-specific defaults
        defaults[setting.id] = getTypeDefault(setting.type);
      }
    }
  }

  return defaults;
}

/**
 * Get default value for a setting type
 */
function getTypeDefault(type: string): any {
  switch (type) {
    case 'checkbox':
      return false;
    case 'number':
    case 'range':
      return 0;
    case 'text':
    case 'textarea':
    case 'html':
    case 'richtext':
    case 'inline_richtext':
    case 'liquid':
      return '';
    case 'select':
    case 'radio':
      return '';
    case 'color':
    case 'color_background':
      return '#000000';
    case 'url':
      return '';
    case 'image_picker':
    case 'video':
    case 'product':
    case 'collection':
    case 'page':
    case 'blog':
    case 'article':
      return null;
    case 'product_list':
    case 'collection_list':
      return [];
    case 'font_picker':
      return 'assistant_n4';
    default:
      return null;
  }
}

// ============================================
// BLOCK HANDLING
// ============================================

/**
 * Get default values for a block type
 */
export function getBlockDefaults(blockSchema: BlockSchema): Record<string, any> {
  const defaults: Record<string, any> = {};

  if (blockSchema.settings) {
    Object.assign(defaults, getDefaultsFromSettings(blockSchema.settings));
  }

  return defaults;
}

/**
 * Find block schema by type
 */
export function findBlockSchema(schema: SectionSchema, blockType: string): BlockSchema | null {
  if (!schema.blocks) return null;
  return schema.blocks.find(b => b.type === blockType) || null;
}

// ============================================
// SECTION PARSING
// ============================================

/**
 * Parse a section file and return structured data
 */
export function parseSection(
  sectionPath: string,
  sectionId: string,
  templateData: { settings?: Record<string, any>; blocks?: Record<string, any>; block_order?: string[]; disabled?: boolean } = {}
): ParsedSection | null {
  if (!fs.existsSync(sectionPath)) {
    console.error(`[SchemaParser] Section not found: ${sectionPath}`);
    return null;
  }

  const liquidContent = fs.readFileSync(sectionPath, 'utf-8');
  const schema = extractSchemaFromLiquid(liquidContent);
  const sectionType = path.basename(sectionPath, '.liquid');

  // Get default settings from schema
  const schemaDefaults = schema?.settings ? getDefaultsFromSettings(schema.settings) : {};

  // Merge with template settings (template overrides schema defaults)
  const settings = { ...schemaDefaults, ...templateData.settings };

  // Parse blocks
  const blocks: ParsedBlock[] = [];
  const blockOrder = templateData.block_order || [];

  if (templateData.blocks && schema?.blocks) {
    for (const blockId of blockOrder) {
      const blockData = templateData.blocks[blockId];
      if (!blockData) continue;

      const blockSchema = findBlockSchema(schema, blockData.type);
      const blockDefaults = blockSchema ? getBlockDefaults(blockSchema) : {};

      blocks.push({
        id: blockId,
        type: blockData.type,
        settings: { ...blockDefaults, ...blockData.settings },
        disabled: blockData.disabled || false,
      });
    }
  }

  return {
    id: sectionId,
    type: sectionType,
    schema,
    settings,
    blocks,
    block_order: blockOrder,
    disabled: templateData.disabled || false,
    index: 0, // Will be set by caller
    liquid_content: liquidContent,
  };
}

// ============================================
// TEMPLATE PARSING
// ============================================

/**
 * Parse a template JSON file
 */
export function parseTemplateJson(templatePath: string): TemplateJson | null {
  if (!fs.existsSync(templatePath)) {
    console.error(`[SchemaParser] Template not found: ${templatePath}`);
    return null;
  }

  try {
    const content = fs.readFileSync(templatePath, 'utf-8');
    const cleanContent = stripJsonComments(content);
    return JSON.parse(cleanContent) as TemplateJson;
  } catch (error) {
    console.error(`[SchemaParser] Failed to parse template: ${templatePath}`, error);
    return null;
  }
}

/**
 * Parse a section group JSON file (header-group, footer-group, etc.)
 */
export function parseSectionGroupJson(groupPath: string): SectionGroupJson | null {
  if (!fs.existsSync(groupPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(groupPath, 'utf-8');
    const cleanContent = stripJsonComments(content);
    return JSON.parse(cleanContent) as SectionGroupJson;
  } catch (error) {
    console.error(`[SchemaParser] Failed to parse section group: ${groupPath}`, error);
    return null;
  }
}

// ============================================
// FULL PAGE PARSING
// ============================================

export interface ParsedPage {
  layout: string;
  sections: ParsedSection[];
  headerSections: ParsedSection[];
  footerSections: ParsedSection[];
}

/**
 * Parse all sections for a page/template
 */
export function parseFullPage(
  themeDir: string,
  templateName: string = 'index'
): ParsedPage | null {
  const sectionsDir = path.join(themeDir, 'sections');
  const templatesDir = path.join(themeDir, 'templates');

  // Parse main template
  let templateJson = parseTemplateJson(path.join(templatesDir, `${templateName}.json`));

  // Try alternate template names
  if (!templateJson) {
    const altPaths = [
      path.join(templatesDir, `${templateName}.json`),
      path.join(templatesDir, 'index.json'),
    ];
    for (const altPath of altPaths) {
      templateJson = parseTemplateJson(altPath);
      if (templateJson) break;
    }
  }

  if (!templateJson) {
    console.error(`[SchemaParser] No template found for: ${templateName}`);
    return null;
  }

  // Parse header group
  const headerGroup = parseSectionGroupJson(path.join(sectionsDir, 'header-group.json'));
  const footerGroup = parseSectionGroupJson(path.join(sectionsDir, 'footer-group.json'));

  // Helper to parse sections from a template/group
  const parseSections = (
    sectionMap: Record<string, any>,
    order: string[],
    startIndex: number
  ): ParsedSection[] => {
    const sections: ParsedSection[] = [];

    for (let i = 0; i < order.length; i++) {
      const sectionId = order[i];
      const sectionData = sectionMap[sectionId];
      if (!sectionData) continue;

      const sectionType = sectionData.type;
      const sectionPath = path.join(sectionsDir, `${sectionType}.liquid`);

      const parsed = parseSection(sectionPath, sectionId, sectionData);
      if (parsed) {
        parsed.index = startIndex + i;
        sections.push(parsed);
      }
    }

    return sections;
  };

  // Parse all sections
  const headerSections = headerGroup
    ? parseSections(headerGroup.sections, headerGroup.order, 0)
    : [];

  const mainSections = parseSections(
    templateJson.sections,
    templateJson.order,
    headerSections.length
  );

  const footerSections = footerGroup
    ? parseSections(footerGroup.sections, footerGroup.order, headerSections.length + mainSections.length)
    : [];

  return {
    layout: templateJson.layout === false ? 'none' : (templateJson.layout || 'theme'),
    sections: mainSections,
    headerSections,
    footerSections,
  };
}

// ============================================
// SETTINGS VALIDATION
// ============================================

export interface ValidationError {
  settingId: string;
  message: string;
  type: 'error' | 'warning';
}

/**
 * Validate settings against schema
 */
export function validateSettings(
  settings: Record<string, any>,
  schemaSettings: SectionSetting[]
): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const schemaSetting of schemaSettings) {
    if (!('id' in schemaSetting)) continue;

    const { id, type } = schemaSetting;
    const value = settings[id];

    // Check required (only for non-null types)
    if (value === undefined || value === null) {
      if (['text', 'richtext', 'url'].includes(type)) {
        // These are optional
        continue;
      }
    }

    // Type-specific validation
    switch (type) {
      case 'range':
        const rangeSetting = schemaSetting as any;
        if (typeof value === 'number') {
          if (value < rangeSetting.min || value > rangeSetting.max) {
            errors.push({
              settingId: id,
              message: `Value ${value} is outside range [${rangeSetting.min}, ${rangeSetting.max}]`,
              type: 'warning',
            });
          }
        }
        break;

      case 'select':
      case 'radio':
        const selectSetting = schemaSetting as any;
        if (value && selectSetting.options) {
          const validValues = selectSetting.options.map((o: any) => o.value);
          if (!validValues.includes(value)) {
            errors.push({
              settingId: id,
              message: `Value "${value}" is not a valid option`,
              type: 'warning',
            });
          }
        }
        break;

      case 'color':
        if (value && typeof value === 'string') {
          if (!/^#[0-9A-Fa-f]{6}$|^#[0-9A-Fa-f]{3}$|^rgba?\(/.test(value)) {
            errors.push({
              settingId: id,
              message: `Invalid color format: ${value}`,
              type: 'warning',
            });
          }
        }
        break;
    }
  }

  return errors;
}

// ============================================
// SCHEMA UTILITIES
// ============================================

/**
 * Get all setting IDs from a schema
 */
export function getAllSettingIds(schema: SectionSchema): string[] {
  const ids: string[] = [];

  if (schema.settings) {
    for (const setting of schema.settings) {
      if ('id' in setting && setting.id) {
        ids.push(setting.id);
      }
    }
  }

  return ids;
}

/**
 * Get all block types from a schema
 */
export function getAllBlockTypes(schema: SectionSchema): string[] {
  if (!schema.blocks) return [];
  return schema.blocks.map(b => b.type);
}

/**
 * Check if a section can be used in a template
 */
export function canUseInTemplate(schema: SectionSchema, templateName: string): boolean {
  // If no restrictions, can use everywhere
  if (!schema.enabled_on && !schema.disabled_on) {
    return true;
  }

  // Check disabled_on first
  if (schema.disabled_on?.templates?.includes(templateName)) {
    return false;
  }

  // Check enabled_on
  if (schema.enabled_on?.templates) {
    return schema.enabled_on.templates.includes(templateName) ||
           schema.enabled_on.templates.includes('*');
  }

  return true;
}

/**
 * Get section presets
 */
export function getSectionPresets(schema: SectionSchema): { name: string; settings: Record<string, any>; blocks: any[] }[] {
  if (!schema.presets) return [];

  return schema.presets.map(preset => ({
    name: preset.name,
    settings: preset.settings || {},
    blocks: preset.blocks || [],
  }));
}

// ============================================
// LOAD ALL SECTIONS
// ============================================

export interface SectionInfo {
  type: string;
  name: string;
  schema: SectionSchema | null;
  presets: { name: string; settings: Record<string, any>; blocks: any[] }[];
  hasBlocks: boolean;
  maxBlocks: number | null;
  blockTypes: string[];
}

/**
 * Load information about all sections in a theme
 */
export function loadAllSections(themeDir: string): SectionInfo[] {
  const sectionsDir = path.join(themeDir, 'sections');
  if (!fs.existsSync(sectionsDir)) {
    return [];
  }

  const sections: SectionInfo[] = [];
  const files = fs.readdirSync(sectionsDir);

  for (const file of files) {
    if (!file.endsWith('.liquid')) continue;

    const sectionType = file.replace('.liquid', '');
    const sectionPath = path.join(sectionsDir, file);
    const content = fs.readFileSync(sectionPath, 'utf-8');
    const schema = extractSchemaFromLiquid(content);

    sections.push({
      type: sectionType,
      name: schema?.name || sectionType,
      schema,
      presets: schema ? getSectionPresets(schema) : [],
      hasBlocks: !!schema?.blocks && schema.blocks.length > 0,
      maxBlocks: schema?.max_blocks || null,
      blockTypes: schema ? getAllBlockTypes(schema) : [],
    });
  }

  return sections;
}
