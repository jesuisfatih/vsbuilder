/**
 * Section Templates Configuration
 * Centralized configuration for available section templates
 * These can be extended to load from API or theme-specific configs
 */

export interface SectionTemplate {
  type: string;
  name: string;
  category: string;
  icon?: string;
  description?: string;
  previewImage?: string;
  defaultSettings?: Record<string, unknown>;
  maxBlocks?: number;
  availableBlocks?: string[];
}

export interface SectionCategory {
  id: string;
  name: string;
  order: number;
}

// Categories with display order
export const SECTION_CATEGORIES: SectionCategory[] = [
  { id: "featured", name: "Featured", order: 1 },
  { id: "text", name: "Text", order: 2 },
  { id: "image", name: "Image", order: 3 },
  { id: "collection", name: "Collection", order: 4 },
  { id: "interactive", name: "Interactive", order: 5 },
  { id: "media", name: "Media", order: 6 },
  { id: "advanced", name: "Advanced", order: 7 },
];

// Section templates with default settings
export const SECTION_TEMPLATES: SectionTemplate[] = [
  // Featured
  {
    type: "hero-banner",
    name: "Hero Banner",
    category: "featured",
    description: "Large banner with heading, text, and call-to-action",
    defaultSettings: {
      heading: "Welcome to our store",
      subheading: "Discover our latest collection",
      button_text: "Shop now",
      button_link: "/collections/all",
      background_color: "#1a1a1a",
      text_color: "#ffffff",
      overlay_opacity: 30,
    },
  },
  {
    type: "featured-collection",
    name: "Featured Collection",
    category: "featured",
    description: "Showcase products from a specific collection",
    defaultSettings: {
      title: "Featured Collection",
      collection: "",
      products_to_show: 4,
      columns: 4,
      show_view_all: true,
    },
  },
  {
    type: "featured-product",
    name: "Featured Product",
    category: "featured",
    description: "Highlight a single product with details",
    defaultSettings: {
      product: "",
      show_vendor: true,
      show_description: true,
      show_quantity: true,
    },
  },
  {
    type: "slideshow",
    name: "Slideshow",
    category: "featured",
    description: "Full-width image slider with auto-play",
    defaultSettings: {
      autoplay: true,
      autoplay_speed: 5,
      show_arrows: true,
      show_dots: true,
    },
    availableBlocks: ["slide"],
    maxBlocks: 10,
  },

  // Text
  {
    type: "rich-text",
    name: "Rich Text",
    category: "text",
    description: "Customizable text content with formatting",
    defaultSettings: {
      heading: "",
      text: "<p>Add your content here</p>",
      alignment: "center",
      narrow_width: false,
    },
  },
  {
    type: "text-columns",
    name: "Text Columns with Images",
    category: "text",
    description: "Multiple columns with images and text",
    defaultSettings: {
      title: "",
      columns: 3,
      heading_size: "medium",
    },
    availableBlocks: ["column"],
    maxBlocks: 6,
  },
  {
    type: "newsletter",
    name: "Newsletter",
    category: "text",
    description: "Email signup form with customizable text",
    defaultSettings: {
      heading: "Subscribe to our newsletter",
      subheading: "Get the latest updates and offers",
      button_text: "Subscribe",
      show_name_field: false,
    },
  },

  // Image
  {
    type: "image-with-text",
    name: "Image with Text",
    category: "image",
    description: "Side-by-side image and text content",
    defaultSettings: {
      image: "",
      heading: "Image with text",
      text: "Pair text with an image to focus on your chosen product, collection, or blog post.",
      button_text: "Learn more",
      button_link: "",
      image_position: "left",
      content_alignment: "middle",
    },
  },
  {
    type: "image-banner",
    name: "Image Banner",
    category: "image",
    description: "Full-width image with optional overlay text",
    defaultSettings: {
      image: "",
      heading: "",
      subheading: "",
      text_position: "center",
      show_overlay: true,
      overlay_opacity: 40,
    },
  },
  {
    type: "gallery",
    name: "Gallery",
    category: "image",
    description: "Grid or masonry image gallery",
    defaultSettings: {
      title: "Gallery",
      layout: "grid",
      columns: 3,
      gap: "medium",
    },
    availableBlocks: ["image"],
    maxBlocks: 16,
  },
  {
    type: "logo-list",
    name: "Logo List",
    category: "image",
    description: "Display brand or partner logos",
    defaultSettings: {
      title: "As seen in",
      logo_size: "medium",
    },
    availableBlocks: ["logo"],
    maxBlocks: 12,
  },

  // Collection
  {
    type: "collection-list",
    name: "Collection List",
    category: "collection",
    description: "Display multiple collections as cards",
    defaultSettings: {
      title: "Collections",
      collections_to_show: 4,
      columns: 4,
      show_description: false,
    },
  },
  {
    type: "products-grid",
    name: "Products Grid",
    category: "collection",
    description: "Grid of products with filtering options",
    defaultSettings: {
      collection: "",
      products_per_row: 4,
      rows: 2,
      show_vendor: false,
      show_secondary_image: true,
    },
  },

  // Interactive
  {
    type: "collapsible-content",
    name: "Collapsible Content",
    category: "interactive",
    description: "Accordion-style expandable content",
    defaultSettings: {
      heading: "Frequently Asked Questions",
      open_first: true,
      icon_style: "arrow",
    },
    availableBlocks: ["collapsible-item"],
    maxBlocks: 20,
  },
  {
    type: "contact-form",
    name: "Contact Form",
    category: "interactive",
    description: "Customer contact form with customizable fields",
    defaultSettings: {
      heading: "Contact Us",
      subheading: "Have a question? We'd love to hear from you.",
      show_phone: false,
      show_subject: true,
    },
  },

  // Media
  {
    type: "video",
    name: "Video",
    category: "media",
    description: "Embedded video with optional cover image",
    defaultSettings: {
      video_url: "",
      cover_image: "",
      full_width: true,
      autoplay: false,
      loop: false,
      muted: true,
    },
  },

  // Advanced
  {
    type: "custom-liquid",
    name: "Custom Liquid",
    category: "advanced",
    description: "Add custom Liquid code",
    defaultSettings: {
      liquid_code: "<!-- Add your Liquid code here -->",
    },
  },
  {
    type: "custom-html",
    name: "Custom HTML",
    category: "advanced",
    description: "Add custom HTML content",
    defaultSettings: {
      html_code: "<!-- Add your HTML code here -->",
    },
  },
];

/**
 * Get section templates by category
 */
export function getSectionsByCategory(categoryId: string): SectionTemplate[] {
  return SECTION_TEMPLATES.filter(
    (section) => section.category.toLowerCase() === categoryId.toLowerCase()
  );
}

/**
 * Get all categories with their sections
 */
export function getCategoriesWithSections(): Array<{
  category: SectionCategory;
  sections: SectionTemplate[];
}> {
  return SECTION_CATEGORIES.map((category) => ({
    category,
    sections: getSectionsByCategory(category.id),
  })).sort((a, b) => a.category.order - b.category.order);
}

/**
 * Get a single section template by type
 */
export function getSectionTemplate(type: string): SectionTemplate | undefined {
  return SECTION_TEMPLATES.find((section) => section.type === type);
}

/**
 * Get default settings for a section type
 */
export function getDefaultSettings(type: string): Record<string, unknown> {
  const template = getSectionTemplate(type);
  return template?.defaultSettings || {};
}

/**
 * Create a new section instance with generated ID and default settings
 */
export function createSectionInstance(type: string) {
  const template = getSectionTemplate(type);
  const id = `${type}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

  return {
    id,
    type,
    settings: template?.defaultSettings || {},
    blocks: {},
    blocks_order: [],
    visible: true,
    disabled: false,
  };
}
