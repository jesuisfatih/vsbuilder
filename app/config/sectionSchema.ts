/**
 * Section Schema Builder
 * Defines the schema structure for custom sections and blocks
 */

// Available setting types for sections and blocks
export type SettingType =
  | "text"
  | "textarea"
  | "richtext"
  | "number"
  | "range"
  | "checkbox"
  | "select"
  | "radio"
  | "color"
  | "color_background"
  | "color_scheme"
  | "image_picker"
  | "video"
  | "video_url"
  | "url"
  | "link_list"
  | "product"
  | "product_list"
  | "collection"
  | "collection_list"
  | "page"
  | "blog"
  | "article"
  | "font_picker"
  | "html"
  | "liquid";

export interface SettingSchema {
  type: SettingType;
  id: string;
  label: string;
  default?: unknown;
  info?: string;
  placeholder?: string;

  // For range
  min?: number;
  max?: number;
  step?: number;
  unit?: string;

  // For select/radio
  options?: Array<{
    value: string;
    label: string;
    group?: string;
  }>;

  // For product_list/collection_list
  limit?: number;
}

export interface BlockSchema {
  type: string;
  name: string;
  limit?: number;
  settings: SettingSchema[];
}

export interface SectionSchema {
  name: string;
  tag?: string;
  class?: string;
  limit?: number;
  settings: SettingSchema[];
  blocks?: BlockSchema[];
  max_blocks?: number;
  presets?: Array<{
    name: string;
    settings?: Record<string, unknown>;
    blocks?: Array<{
      type: string;
      settings?: Record<string, unknown>;
    }>;
  }>;
  default?: {
    settings?: Record<string, unknown>;
    blocks?: Array<{
      type: string;
      settings?: Record<string, unknown>;
    }>;
  };
  templates?: string[];
  enabled_on?: {
    templates?: string[];
    groups?: string[];
  };
  disabled_on?: {
    templates?: string[];
    groups?: string[];
  };
}

// Setting type metadata for the builder UI
export interface SettingTypeInfo {
  type: SettingType;
  name: string;
  description: string;
  category: "basic" | "content" | "media" | "resource" | "advanced";
  icon: string;
  defaultValue: unknown;
  hasOptions?: boolean;
  hasRange?: boolean;
}

export const SETTING_TYPES: SettingTypeInfo[] = [
  // Basic
  {
    type: "text",
    name: "Text",
    description: "Single line text input",
    category: "basic",
    icon: "TextIcon",
    defaultValue: "",
  },
  {
    type: "textarea",
    name: "Textarea",
    description: "Multi-line text input",
    category: "basic",
    icon: "DocumentTextIcon",
    defaultValue: "",
  },
  {
    type: "number",
    name: "Number",
    description: "Numeric input",
    category: "basic",
    icon: "CalculatorIcon",
    defaultValue: 0,
  },
  {
    type: "checkbox",
    name: "Checkbox",
    description: "True/false toggle",
    category: "basic",
    icon: "CheckIcon",
    defaultValue: false,
  },
  {
    type: "range",
    name: "Range",
    description: "Slider with min/max",
    category: "basic",
    icon: "AdjustmentsHorizontalIcon",
    defaultValue: 50,
    hasRange: true,
  },
  {
    type: "select",
    name: "Select",
    description: "Dropdown selection",
    category: "basic",
    icon: "ChevronDownIcon",
    defaultValue: "",
    hasOptions: true,
  },
  {
    type: "radio",
    name: "Radio",
    description: "Radio button group",
    category: "basic",
    icon: "StopCircleIcon",
    defaultValue: "",
    hasOptions: true,
  },

  // Content
  {
    type: "richtext",
    name: "Rich Text",
    description: "Formatted text editor",
    category: "content",
    icon: "BoldIcon",
    defaultValue: "",
  },
  {
    type: "url",
    name: "URL",
    description: "Link URL input",
    category: "content",
    icon: "LinkIcon",
    defaultValue: "",
  },
  {
    type: "html",
    name: "HTML",
    description: "Raw HTML content",
    category: "content",
    icon: "CodeBracketIcon",
    defaultValue: "",
  },
  {
    type: "liquid",
    name: "Liquid",
    description: "Liquid template code",
    category: "content",
    icon: "BeakerIcon",
    defaultValue: "",
  },

  // Media
  {
    type: "image_picker",
    name: "Image",
    description: "Image selector",
    category: "media",
    icon: "PhotoIcon",
    defaultValue: null,
  },
  {
    type: "video",
    name: "Video",
    description: "Shopify hosted video",
    category: "media",
    icon: "VideoCameraIcon",
    defaultValue: null,
  },
  {
    type: "video_url",
    name: "Video URL",
    description: "YouTube or Vimeo URL",
    category: "media",
    icon: "PlayIcon",
    defaultValue: "",
  },

  // Colors
  {
    type: "color",
    name: "Color",
    description: "Color picker",
    category: "basic",
    icon: "SwatchIcon",
    defaultValue: "#000000",
  },
  {
    type: "color_background",
    name: "Background Color",
    description: "Background color or gradient",
    category: "basic",
    icon: "PaintBrushIcon",
    defaultValue: "",
  },
  {
    type: "color_scheme",
    name: "Color Scheme",
    description: "Theme color scheme",
    category: "basic",
    icon: "SwatchIcon",
    defaultValue: "background-1",
    hasOptions: true,
  },

  // Resources
  {
    type: "product",
    name: "Product",
    description: "Single product picker",
    category: "resource",
    icon: "ShoppingBagIcon",
    defaultValue: null,
  },
  {
    type: "product_list",
    name: "Product List",
    description: "Multiple products",
    category: "resource",
    icon: "QueueListIcon",
    defaultValue: [],
  },
  {
    type: "collection",
    name: "Collection",
    description: "Single collection picker",
    category: "resource",
    icon: "FolderIcon",
    defaultValue: null,
  },
  {
    type: "collection_list",
    name: "Collection List",
    description: "Multiple collections",
    category: "resource",
    icon: "FolderOpenIcon",
    defaultValue: [],
  },
  {
    type: "page",
    name: "Page",
    description: "Single page picker",
    category: "resource",
    icon: "DocumentIcon",
    defaultValue: null,
  },
  {
    type: "blog",
    name: "Blog",
    description: "Blog picker",
    category: "resource",
    icon: "NewspaperIcon",
    defaultValue: null,
  },
  {
    type: "article",
    name: "Article",
    description: "Blog article picker",
    category: "resource",
    icon: "DocumentTextIcon",
    defaultValue: null,
  },
  {
    type: "link_list",
    name: "Menu",
    description: "Navigation menu picker",
    category: "resource",
    icon: "Bars3Icon",
    defaultValue: null,
  },

  // Advanced
  {
    type: "font_picker",
    name: "Font",
    description: "Font family selector",
    category: "advanced",
    icon: "LanguageIcon",
    defaultValue: "body",
  },
];

// Helper functions
export function getSettingTypeInfo(type: SettingType): SettingTypeInfo | undefined {
  return SETTING_TYPES.find(t => t.type === type);
}

export function getSettingsByCategory(category: SettingTypeInfo["category"]): SettingTypeInfo[] {
  return SETTING_TYPES.filter(t => t.category === category);
}

export function getDefaultValueForType(type: SettingType): unknown {
  const info = getSettingTypeInfo(type);
  return info?.defaultValue ?? null;
}

export function createSettingSchema(type: SettingType, id: string, label: string): SettingSchema {
  const info = getSettingTypeInfo(type);
  return {
    type,
    id,
    label,
    default: info?.defaultValue,
  };
}

export function createBlockSchema(type: string, name: string): BlockSchema {
  return {
    type,
    name,
    settings: [],
  };
}

export function createSectionSchema(name: string): SectionSchema {
  return {
    name,
    settings: [],
    blocks: [],
  };
}

// Validate section schema
export function validateSectionSchema(schema: SectionSchema): string[] {
  const errors: string[] = [];

  if (!schema.name?.trim()) {
    errors.push("Section name is required");
  }

  const settingIds = new Set<string>();
  schema.settings.forEach((setting, index) => {
    if (!setting.id?.trim()) {
      errors.push(`Setting ${index + 1}: ID is required`);
    } else if (settingIds.has(setting.id)) {
      errors.push(`Setting ${index + 1}: Duplicate ID "${setting.id}"`);
    } else {
      settingIds.add(setting.id);
    }

    if (!setting.label?.trim()) {
      errors.push(`Setting ${index + 1}: Label is required`);
    }
  });

  const blockTypes = new Set<string>();
  schema.blocks?.forEach((block, index) => {
    if (!block.type?.trim()) {
      errors.push(`Block ${index + 1}: Type is required`);
    } else if (blockTypes.has(block.type)) {
      errors.push(`Block ${index + 1}: Duplicate type "${block.type}"`);
    } else {
      blockTypes.add(block.type);
    }

    if (!block.name?.trim()) {
      errors.push(`Block ${index + 1}: Name is required`);
    }
  });

  return errors;
}

// Convert schema to Shopify JSON format
export function schemaToShopifyJson(schema: SectionSchema): string {
  const output = {
    name: schema.name,
    tag: schema.tag || "section",
    class: schema.class,
    limit: schema.limit,
    settings: schema.settings,
    blocks: schema.blocks,
    max_blocks: schema.max_blocks,
    presets: schema.presets,
    enabled_on: schema.enabled_on,
    disabled_on: schema.disabled_on,
  };

  // Remove undefined values
  Object.keys(output).forEach(key => {
    if (output[key as keyof typeof output] === undefined) {
      delete output[key as keyof typeof output];
    }
  });

  return JSON.stringify(output, null, 2);
}

// Parse Shopify JSON to schema
export function shopifyJsonToSchema(json: string): SectionSchema | null {
  try {
    const parsed = JSON.parse(json);
    return {
      name: parsed.name || "Untitled Section",
      tag: parsed.tag,
      class: parsed.class,
      limit: parsed.limit,
      settings: parsed.settings || [],
      blocks: parsed.blocks || [],
      max_blocks: parsed.max_blocks,
      presets: parsed.presets,
      enabled_on: parsed.enabled_on,
      disabled_on: parsed.disabled_on,
    };
  } catch {
    return null;
  }
}
