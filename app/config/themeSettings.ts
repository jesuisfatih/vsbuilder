/**
 * Theme Settings Configuration
 * Dynamic theme-level settings that apply globally
 * These are fetched from Shopify theme settings schema
 */

export interface ThemeSettingInput {
  type: "color" | "text" | "number" | "checkbox" | "select" | "range" | "image_picker" | "font_picker" | "url" | "richtext";
  id: string;
  label: string;
  default?: string | number | boolean;
  info?: string;
  options?: Array<{ value: string; label: string }>;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
}

export interface ThemeSettingGroup {
  name: string;
  settings: ThemeSettingInput[];
}

// Default theme settings schema (matches Shopify Dawn theme structure)
export const THEME_SETTINGS_SCHEMA: ThemeSettingGroup[] = [
  {
    name: "Colors",
    settings: [
      {
        type: "color",
        id: "colors_solid_button_labels",
        label: "Solid button label",
        default: "#FFFFFF",
      },
      {
        type: "color",
        id: "colors_accent_1",
        label: "Accent 1",
        default: "#121212",
        info: "Used for buttons, links, and accents",
      },
      {
        type: "color",
        id: "colors_accent_2",
        label: "Accent 2",
        default: "#334FB4",
      },
      {
        type: "color",
        id: "colors_text",
        label: "Text",
        default: "#121212",
      },
      {
        type: "color",
        id: "colors_background_1",
        label: "Background 1",
        default: "#FFFFFF",
      },
      {
        type: "color",
        id: "colors_background_2",
        label: "Background 2",
        default: "#F3F3F3",
      },
      {
        type: "color",
        id: "colors_outline_button_labels",
        label: "Outline button",
        default: "#121212",
      },
    ],
  },
  {
    name: "Typography",
    settings: [
      {
        type: "font_picker",
        id: "type_header_font",
        label: "Heading font",
        default: "Assistant",
      },
      {
        type: "range",
        id: "heading_scale",
        label: "Heading scale",
        min: 100,
        max: 150,
        step: 5,
        unit: "%",
        default: 100,
      },
      {
        type: "font_picker",
        id: "type_body_font",
        label: "Body font",
        default: "Assistant",
      },
      {
        type: "range",
        id: "body_scale",
        label: "Body scale",
        min: 100,
        max: 130,
        step: 5,
        unit: "%",
        default: 100,
      },
    ],
  },
  {
    name: "Layout",
    settings: [
      {
        type: "range",
        id: "page_width",
        label: "Page width",
        min: 1000,
        max: 1600,
        step: 100,
        unit: "px",
        default: 1200,
      },
      {
        type: "range",
        id: "spacing_sections",
        label: "Space between sections",
        min: 0,
        max: 100,
        step: 4,
        unit: "px",
        default: 0,
      },
      {
        type: "select",
        id: "spacing_grid_horizontal",
        label: "Horizontal space",
        options: [
          { value: "small", label: "Small" },
          { value: "medium", label: "Medium" },
          { value: "large", label: "Large" },
        ],
        default: "medium",
      },
      {
        type: "select",
        id: "spacing_grid_vertical",
        label: "Vertical space",
        options: [
          { value: "small", label: "Small" },
          { value: "medium", label: "Medium" },
          { value: "large", label: "Large" },
        ],
        default: "medium",
      },
    ],
  },
  {
    name: "Buttons",
    settings: [
      {
        type: "range",
        id: "buttons_border_thickness",
        label: "Border thickness",
        min: 0,
        max: 12,
        step: 1,
        unit: "px",
        default: 1,
      },
      {
        type: "range",
        id: "buttons_border_opacity",
        label: "Border opacity",
        min: 0,
        max: 100,
        step: 5,
        unit: "%",
        default: 100,
      },
      {
        type: "range",
        id: "buttons_radius",
        label: "Corner radius",
        min: 0,
        max: 40,
        step: 2,
        unit: "px",
        default: 0,
      },
      {
        type: "range",
        id: "buttons_shadow_opacity",
        label: "Shadow opacity",
        min: 0,
        max: 100,
        step: 5,
        unit: "%",
        default: 0,
      },
    ],
  },
  {
    name: "Inputs",
    settings: [
      {
        type: "range",
        id: "inputs_border_thickness",
        label: "Border thickness",
        min: 0,
        max: 12,
        step: 1,
        unit: "px",
        default: 1,
      },
      {
        type: "range",
        id: "inputs_border_opacity",
        label: "Border opacity",
        min: 0,
        max: 100,
        step: 5,
        unit: "%",
        default: 55,
      },
      {
        type: "range",
        id: "inputs_radius",
        label: "Corner radius",
        min: 0,
        max: 40,
        step: 2,
        unit: "px",
        default: 0,
      },
      {
        type: "range",
        id: "inputs_shadow_opacity",
        label: "Shadow opacity",
        min: 0,
        max: 100,
        step: 5,
        unit: "%",
        default: 0,
      },
    ],
  },
  {
    name: "Product Cards",
    settings: [
      {
        type: "select",
        id: "card_style",
        label: "Style",
        options: [
          { value: "standard", label: "Standard" },
          { value: "card", label: "Card" },
        ],
        default: "standard",
      },
      {
        type: "select",
        id: "card_image_padding",
        label: "Image padding",
        options: [
          { value: "none", label: "None" },
          { value: "small", label: "Small" },
          { value: "medium", label: "Medium" },
          { value: "large", label: "Large" },
        ],
        default: "medium",
      },
      {
        type: "select",
        id: "card_text_alignment",
        label: "Text alignment",
        options: [
          { value: "left", label: "Left" },
          { value: "center", label: "Center" },
          { value: "right", label: "Right" },
        ],
        default: "left",
      },
      {
        type: "select",
        id: "card_color_scheme",
        label: "Color scheme",
        options: [
          { value: "background-1", label: "Background 1" },
          { value: "background-2", label: "Background 2" },
          { value: "inverse", label: "Inverse" },
          { value: "accent-1", label: "Accent 1" },
          { value: "accent-2", label: "Accent 2" },
        ],
        default: "background-2",
      },
    ],
  },
  {
    name: "Social Media",
    settings: [
      {
        type: "text",
        id: "social_twitter_link",
        label: "Twitter",
        default: "",
      },
      {
        type: "text",
        id: "social_facebook_link",
        label: "Facebook",
        default: "",
      },
      {
        type: "text",
        id: "social_pinterest_link",
        label: "Pinterest",
        default: "",
      },
      {
        type: "text",
        id: "social_instagram_link",
        label: "Instagram",
        default: "",
      },
      {
        type: "text",
        id: "social_tiktok_link",
        label: "TikTok",
        default: "",
      },
      {
        type: "text",
        id: "social_youtube_link",
        label: "YouTube",
        default: "",
      },
    ],
  },
  {
    name: "Favicon",
    settings: [
      {
        type: "image_picker",
        id: "favicon",
        label: "Favicon image",
        info: "Will be scaled down to 32 x 32px",
      },
    ],
  },
  {
    name: "Currency Format",
    settings: [
      {
        type: "checkbox",
        id: "currency_code_enabled",
        label: "Show currency codes",
        default: true,
      },
    ],
  },
  {
    name: "Cart",
    settings: [
      {
        type: "select",
        id: "cart_type",
        label: "Cart type",
        options: [
          { value: "drawer", label: "Drawer" },
          { value: "page", label: "Page" },
          { value: "notification", label: "Popup notification" },
        ],
        default: "notification",
      },
      {
        type: "checkbox",
        id: "show_vendor",
        label: "Show vendor",
        default: false,
      },
      {
        type: "checkbox",
        id: "show_cart_note",
        label: "Enable cart note",
        default: false,
      },
    ],
  },
];

/**
 * Get default theme settings values
 */
export function getDefaultThemeSettings(): Record<string, unknown> {
  const defaults: Record<string, unknown> = {};

  THEME_SETTINGS_SCHEMA.forEach(group => {
    group.settings.forEach(setting => {
      if (setting.default !== undefined) {
        defaults[setting.id] = setting.default;
      }
    });
  });

  return defaults;
}

/**
 * Get setting by ID
 */
export function getSettingById(id: string): ThemeSettingInput | undefined {
  for (const group of THEME_SETTINGS_SCHEMA) {
    const setting = group.settings.find(s => s.id === id);
    if (setting) return setting;
  }
  return undefined;
}
