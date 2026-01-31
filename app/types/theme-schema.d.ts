/**
 * 🎨 Theme Schema Type Definitions
 * Types for Shopify theme section/block schemas
 */

// ============================================
// SETTING TYPES
// ============================================

export type SettingType =
  | 'checkbox'
  | 'number'
  | 'radio'
  | 'range'
  | 'select'
  | 'text'
  | 'textarea'
  | 'article'
  | 'blog'
  | 'collection'
  | 'collection_list'
  | 'color'
  | 'color_background'
  | 'color_scheme'
  | 'color_scheme_group'
  | 'font_picker'
  | 'html'
  | 'image_picker'
  | 'inline_richtext'
  | 'link_list'
  | 'liquid'
  | 'page'
  | 'product'
  | 'product_list'
  | 'richtext'
  | 'url'
  | 'video'
  | 'video_url'
  | 'header'
  | 'paragraph';

// ============================================
// BASE SETTING
// ============================================

export interface BaseSetting {
  type: SettingType;
  id: string;
  label: string;
  info?: string;
  default?: any;
}

// ============================================
// INPUT SETTINGS
// ============================================

export interface CheckboxSetting extends BaseSetting {
  type: 'checkbox';
  default?: boolean;
}

export interface NumberSetting extends BaseSetting {
  type: 'number';
  default?: number;
  placeholder?: number;
}

export interface RadioSetting extends BaseSetting {
  type: 'radio';
  options: { value: string; label: string }[];
  default?: string;
}

export interface RangeSetting extends BaseSetting {
  type: 'range';
  min: number;
  max: number;
  step: number;
  unit?: string;
  default?: number;
}

export interface SelectSetting extends BaseSetting {
  type: 'select';
  options: { value: string; label: string; group?: string }[];
  default?: string;
}

export interface TextSetting extends BaseSetting {
  type: 'text';
  default?: string;
  placeholder?: string;
}

export interface TextareaSetting extends BaseSetting {
  type: 'textarea';
  default?: string;
  placeholder?: string;
}

// ============================================
// SPECIALIZED SETTINGS
// ============================================

export interface ArticleSetting extends BaseSetting {
  type: 'article';
}

export interface BlogSetting extends BaseSetting {
  type: 'blog';
}

export interface CollectionSetting extends BaseSetting {
  type: 'collection';
}

export interface CollectionListSetting extends BaseSetting {
  type: 'collection_list';
  limit?: number;
}

export interface ColorSetting extends BaseSetting {
  type: 'color';
  default?: string;
}

export interface ColorBackgroundSetting extends BaseSetting {
  type: 'color_background';
  default?: string;
}

export interface ColorSchemeSetting extends BaseSetting {
  type: 'color_scheme';
  default?: string;
}

export interface FontPickerSetting extends BaseSetting {
  type: 'font_picker';
  default?: string;
}

export interface HtmlSetting extends BaseSetting {
  type: 'html';
  default?: string;
  placeholder?: string;
}

export interface ImagePickerSetting extends BaseSetting {
  type: 'image_picker';
}

export interface InlineRichtextSetting extends BaseSetting {
  type: 'inline_richtext';
  default?: string;
}

export interface LinkListSetting extends BaseSetting {
  type: 'link_list';
  default?: string;
}

export interface LiquidSetting extends BaseSetting {
  type: 'liquid';
  default?: string;
}

export interface PageSetting extends BaseSetting {
  type: 'page';
}

export interface ProductSetting extends BaseSetting {
  type: 'product';
}

export interface ProductListSetting extends BaseSetting {
  type: 'product_list';
  limit?: number;
}

export interface RichtextSetting extends BaseSetting {
  type: 'richtext';
  default?: string;
}

export interface UrlSetting extends BaseSetting {
  type: 'url';
  default?: string;
}

export interface VideoSetting extends BaseSetting {
  type: 'video';
}

export interface VideoUrlSetting extends BaseSetting {
  type: 'video_url';
  accept?: ('youtube' | 'vimeo')[];
  placeholder?: string;
}

// ============================================
// SIDEBAR SETTINGS (Display Only)
// ============================================

export interface HeaderSetting {
  type: 'header';
  content: string;
  info?: string;
}

export interface ParagraphSetting {
  type: 'paragraph';
  content: string;
}

export type SidebarSetting = HeaderSetting | ParagraphSetting;

// ============================================
// ALL SETTINGS UNION
// ============================================

export type SectionSetting =
  | CheckboxSetting
  | NumberSetting
  | RadioSetting
  | RangeSetting
  | SelectSetting
  | TextSetting
  | TextareaSetting
  | ArticleSetting
  | BlogSetting
  | CollectionSetting
  | CollectionListSetting
  | ColorSetting
  | ColorBackgroundSetting
  | ColorSchemeSetting
  | FontPickerSetting
  | HtmlSetting
  | ImagePickerSetting
  | InlineRichtextSetting
  | LinkListSetting
  | LiquidSetting
  | PageSetting
  | ProductSetting
  | ProductListSetting
  | RichtextSetting
  | UrlSetting
  | VideoSetting
  | VideoUrlSetting
  | SidebarSetting;

// ============================================
// BLOCK SCHEMA
// ============================================

export interface BlockSchema {
  type: string;
  name: string;
  limit?: number;
  settings?: SectionSetting[];
}

// ============================================
// SECTION SCHEMA
// ============================================

export interface SectionPreset {
  name: string;
  settings?: Record<string, any>;
  blocks?: {
    type: string;
    settings?: Record<string, any>;
  }[];
}

export interface SectionSchema {
  name: string;
  tag?: string;
  class?: string;
  limit?: number;
  max_blocks?: number;
  settings?: SectionSetting[];
  blocks?: BlockSchema[];
  presets?: SectionPreset[];
  default?: {
    settings?: Record<string, any>;
    blocks?: {
      type: string;
      settings?: Record<string, any>;
    }[];
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
  locales?: Record<string, Record<string, string>>;
}

// ============================================
// SETTINGS SCHEMA (settings_schema.json)
// ============================================

export interface SettingsSchemaThemeInfo {
  name: string;
  theme_name: string;
  theme_version: string;
  theme_author: string;
  theme_documentation_url?: string;
  theme_support_url?: string;
}

export interface SettingsSchemaCategory {
  name: string;
  settings: SectionSetting[];
}

export type SettingsSchemaItem =
  | { name: 'theme_info'; theme_info: SettingsSchemaThemeInfo }
  | SettingsSchemaCategory;

// ============================================
// SETTINGS DATA (settings_data.json)
// ============================================

export interface SettingsData {
  current: Record<string, any>;
  presets?: Record<string, Record<string, any>>;
}

// ============================================
// TEMPLATE JSON
// ============================================

export interface TemplateSection {
  type: string;
  disabled?: boolean;
  settings?: Record<string, any>;
  blocks?: Record<string, {
    type: string;
    disabled?: boolean;
    settings?: Record<string, any>;
  }>;
  block_order?: string[];
}

export interface TemplateJson {
  layout?: string | false;
  wrapper?: string;
  sections: Record<string, TemplateSection>;
  order: string[];
}

// ============================================
// SECTION GROUP JSON
// ============================================

export interface SectionGroupJson {
  type: 'header' | 'footer' | 'aside';
  name: string;
  sections: Record<string, TemplateSection>;
  order: string[];
}

// ============================================
// PARSED SECTION
// ============================================

export interface ParsedSection {
  id: string;
  type: string;
  schema: SectionSchema | null;
  settings: Record<string, any>;
  blocks: ParsedBlock[];
  block_order: string[];
  disabled: boolean;
  index: number;
  liquid_content: string;
}

export interface ParsedBlock {
  id: string;
  type: string;
  settings: Record<string, any>;
  disabled: boolean;
}

// ============================================
// SECTION RENDER CONTEXT
// ============================================

export interface SectionRenderContext {
  section: {
    id: string;
    type: string;
    settings: Record<string, any>;
    blocks: {
      id: string;
      type: string;
      settings: Record<string, any>;
      shopify_attributes: string;
    }[];
    block_order: string[];
    index: number;
    index0: number;
  };
  block?: {
    id: string;
    type: string;
    settings: Record<string, any>;
    shopify_attributes: string;
  };
}
