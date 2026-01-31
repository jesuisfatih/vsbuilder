/**
 * 🏪 Shopify Liquid Type Definitions
 * Complete TypeScript types for Shopify Liquid objects
 */

// ============================================
// MONEY & PRICING
// ============================================

export interface ShopifyMoney {
  amount: number;
  currency_code: string;
}

export interface ShopifyPrice {
  price: number;
  price_min: number;
  price_max: number;
  compare_at_price: number | null;
  compare_at_price_min: number | null;
  compare_at_price_max: number | null;
  price_varies: boolean;
  compare_at_price_varies: boolean;
}

// ============================================
// IMAGES & MEDIA
// ============================================

export interface ShopifyImage {
  id?: number;
  src: string;
  alt: string;
  width?: number;
  height?: number;
  aspect_ratio?: number;
  position?: number;
  product_id?: number;
  variant_ids?: number[];
}

export interface ShopifyMediaImage extends ShopifyImage {
  media_type: 'image';
}

export interface ShopifyVideo {
  id: number;
  media_type: 'video' | 'external_video';
  alt: string;
  sources: {
    format: string;
    height: number;
    width: number;
    url: string;
    mime_type: string;
  }[];
  preview_image?: ShopifyImage;
}

export interface ShopifyModel3d {
  id: number;
  media_type: 'model';
  alt: string;
  sources: {
    format: string;
    url: string;
    mime_type: string;
  }[];
  preview_image?: ShopifyImage;
}

export type ShopifyMedia = ShopifyMediaImage | ShopifyVideo | ShopifyModel3d;

// ============================================
// PRODUCT
// ============================================

export interface ShopifyProductOption {
  name: string;
  position: number;
  values: string[];
}

export interface ShopifyVariant {
  id: number;
  title: string;
  price: number;
  compare_at_price: number | null;
  sku: string;
  barcode: string | null;
  available: boolean;
  inventory_quantity: number;
  inventory_policy: 'deny' | 'continue';
  inventory_management: string | null;
  requires_shipping: boolean;
  taxable: boolean;
  weight: number;
  weight_unit: string;
  option1: string | null;
  option2: string | null;
  option3: string | null;
  image: ShopifyImage | null;
  featured_image: ShopifyImage | null;
  url: string;
  selected: boolean;
}

export interface ShopifyProduct {
  id: number;
  title: string;
  handle: string;
  url: string;
  type: string;
  vendor: string;
  description: string;
  content: string;
  price: number;
  price_min: number;
  price_max: number;
  price_varies: boolean;
  compare_at_price: number | null;
  compare_at_price_min: number | null;
  compare_at_price_max: number | null;
  compare_at_price_varies: boolean;
  available: boolean;
  featured_image: ShopifyImage | null;
  images: ShopifyImage[];
  image: ShopifyImage | null;
  media: ShopifyMedia[];
  options: ShopifyProductOption[];
  options_with_values: {
    name: string;
    position: number;
    values: string[];
    selected_value: string;
  }[];
  variants: ShopifyVariant[];
  first_available_variant: ShopifyVariant | null;
  selected_variant: ShopifyVariant | null;
  selected_or_first_available_variant: ShopifyVariant | null;
  has_only_default_variant: boolean;
  tags: string[];
  template_suffix: string | null;
  collections: ShopifyCollection[];
  metafields: Record<string, Record<string, ShopifyMetafield>>;
  requires_selling_plan: boolean;
  selling_plan_groups: any[];
  gift_card: boolean;
  created_at: string;
  updated_at: string;
  published_at: string;
}

// ============================================
// COLLECTION
// ============================================

export interface ShopifyCollection {
  id: number;
  title: string;
  handle: string;
  url: string;
  description: string;
  image: ShopifyImage | null;
  featured_image: ShopifyImage | null;
  products: ShopifyProduct[];
  products_count: number;
  all_products_count: number;
  all_types: string[];
  all_vendors: string[];
  all_tags: string[];
  default_sort_by: string;
  sort_by: string;
  sort_options: { name: string; value: string }[];
  filters: ShopifyFilter[];
  template_suffix: string | null;
  metafields: Record<string, Record<string, ShopifyMetafield>>;
  current_type: string | null;
  current_vendor: string | null;
}

export interface ShopifyFilter {
  label: string;
  param_name: string;
  type: 'list' | 'price_range' | 'boolean';
  active_values: ShopifyFilterValue[];
  inactive_values: ShopifyFilterValue[];
  values: ShopifyFilterValue[];
  min_value?: { value: number };
  max_value?: { value: number };
  range_max?: number;
}

export interface ShopifyFilterValue {
  label: string;
  value: string;
  param_name: string;
  count: number;
  active: boolean;
  url_to_add: string;
  url_to_remove: string;
}

// ============================================
// CART
// ============================================

export interface ShopifyCartItem {
  id: number;
  key: string;
  product: ShopifyProduct;
  product_id: number;
  variant: ShopifyVariant;
  variant_id: number;
  sku: string;
  title: string;
  quantity: number;
  price: number;
  line_price: number;
  original_price: number;
  original_line_price: number;
  total_discount: number;
  discounts: any[];
  url: string;
  image: ShopifyImage | null;
  handle: string;
  requires_shipping: boolean;
  product_title: string;
  variant_title: string;
  properties: Record<string, string>;
  gift_card: boolean;
  selling_plan_allocation: any | null;
}

export interface ShopifyCart {
  token: string;
  note: string | null;
  attributes: Record<string, string>;
  item_count: number;
  items: ShopifyCartItem[];
  items_subtotal_price: number;
  total_price: number;
  total_discount: number;
  total_weight: number;
  original_total_price: number;
  cart_level_discount_applications: any[];
  currency: { iso_code: string };
  requires_shipping: boolean;
  taxes_included: boolean;
}

// ============================================
// CUSTOMER
// ============================================

export interface ShopifyAddress {
  id: number;
  first_name: string;
  last_name: string;
  name: string;
  company: string | null;
  address1: string;
  address2: string | null;
  city: string;
  province: string;
  province_code: string;
  country: string;
  country_code: string;
  zip: string;
  phone: string | null;
  default: boolean;
}

export interface ShopifyCustomer {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  name: string;
  phone: string | null;
  accepts_marketing: boolean;
  orders_count: number;
  total_spent: number;
  tags: string[];
  addresses: ShopifyAddress[];
  default_address: ShopifyAddress | null;
  has_account: boolean;
  tax_exempt: boolean;
  last_order: any | null;
}

// ============================================
// SHOP
// ============================================

export interface ShopifyShop {
  name: string;
  description: string;
  url: string;
  domain: string;
  permanent_domain: string;
  email: string;
  phone: string | null;
  address: ShopifyAddress | null;
  currency: string;
  money_format: string;
  money_with_currency_format: string;
  locale: string;
  enabled_currencies: string[];
  enabled_locales: { iso_code: string; name: string; primary: boolean }[];
  enabled_payment_types: string[];
  customer_accounts_enabled: boolean;
  customer_accounts_optional: boolean;
  accepts_gift_cards: boolean;
  collections_count: number;
  products_count: number;
  policies: ShopifyPolicy[];
  privacy_policy: ShopifyPolicy | null;
  refund_policy: ShopifyPolicy | null;
  shipping_policy: ShopifyPolicy | null;
  terms_of_service: ShopifyPolicy | null;
  subscription_policy: ShopifyPolicy | null;
  metafields: Record<string, Record<string, ShopifyMetafield>>;
  brand: {
    logo: ShopifyImage | null;
    short_description: string;
    slogan: string;
    colors: {
      primary: { background: string; foreground: string }[];
      secondary: { background: string; foreground: string }[];
    };
  } | null;
  secure_url: string;
  vendors: string[];
  types: string[];
  password_message: string;
}

export interface ShopifyPolicy {
  title: string;
  body: string;
  url: string;
  handle: string;
}

// ============================================
// NAVIGATION
// ============================================

export interface ShopifyLink {
  title: string;
  url: string;
  handle: string;
  active: boolean;
  child_active: boolean;
  current: boolean;
  child_current: boolean;
  type: 'http' | 'collection' | 'product' | 'page' | 'blog' | 'article' | 'search' | 'catalog' | 'frontpage';
  object?: ShopifyProduct | ShopifyCollection | ShopifyPage | ShopifyBlog | ShopifyArticle;
  links: ShopifyLink[];
  levels: number;
}

export interface ShopifyLinklist {
  title: string;
  handle: string;
  links: ShopifyLink[];
  levels: number;
}

// ============================================
// CONTENT
// ============================================

export interface ShopifyPage {
  id: number;
  title: string;
  handle: string;
  url: string;
  content: string;
  author: string;
  template_suffix: string | null;
  published_at: string;
  metafields: Record<string, Record<string, ShopifyMetafield>>;
}

export interface ShopifyBlog {
  id: number;
  title: string;
  handle: string;
  url: string;
  articles: ShopifyArticle[];
  articles_count: number;
  all_tags: string[];
  comments_enabled: boolean;
  moderated: boolean;
  metafields: Record<string, Record<string, ShopifyMetafield>>;
}

export interface ShopifyArticle {
  id: number;
  title: string;
  handle: string;
  url: string;
  author: string;
  content: string;
  excerpt: string;
  excerpt_or_content: string;
  image: ShopifyImage | null;
  published_at: string;
  created_at: string;
  updated_at: string;
  tags: string[];
  comments: ShopifyComment[];
  comments_count: number;
  comments_enabled: boolean;
  moderated: boolean;
  user: { first_name: string; last_name: string; bio: string | null };
  metafields: Record<string, Record<string, ShopifyMetafield>>;
}

export interface ShopifyComment {
  id: number;
  author: string;
  email: string;
  content: string;
  created_at: string;
  updated_at: string;
  url: string;
  status: 'pending' | 'published' | 'removed' | 'spam' | 'unapproved';
}

// ============================================
// METAFIELDS
// ============================================

export interface ShopifyMetafield {
  value: any;
  type: string;
  namespace: string;
  key: string;
}

// ============================================
// SEARCH
// ============================================

export interface ShopifySearch {
  performed: boolean;
  terms: string;
  results: (ShopifyProduct | ShopifyCollection | ShopifyPage | ShopifyArticle)[];
  results_count: number;
  types: string[];
  filters: ShopifyFilter[];
  sort_by: string;
  sort_options: { name: string; value: string }[];
}

// ============================================
// PREDICTIVE SEARCH
// ============================================

export interface ShopifyPredictiveSearch {
  resources: {
    products: ShopifyProduct[];
    collections: ShopifyCollection[];
    pages: ShopifyPage[];
    articles: ShopifyArticle[];
    queries: { text: string; url: string }[];
  };
  terms: string;
}

// ============================================
// RECOMMENDATIONS
// ============================================

export interface ShopifyRecommendations {
  products: ShopifyProduct[];
  performed: boolean;
  products_count: number;
  intent: 'related' | 'complementary';
}

// ============================================
// FORM
// ============================================

export interface ShopifyForm {
  id: string;
  posted_successfully: boolean | null;
  errors: string[] | null;
  author: string | null;
  body: string | null;
  email: string | null;
  password: string | null;
  password_needed: boolean;
}

// ============================================
// PAGINATION
// ============================================

export interface ShopifyPagination {
  current_offset: number;
  current_page: number;
  items: any[];
  page_size: number;
  pages: number;
  parts: { is_link: boolean; title: string; url?: string }[];
  previous?: { url: string; title: string; is_link: boolean };
  next?: { url: string; title: string; is_link: boolean };
}

// ============================================
// REQUEST & LOCALIZATION
// ============================================

export interface ShopifyRequest {
  design_mode: boolean;
  visual_preview_mode: boolean;
  host: string;
  path: string;
  page_type: string;
  origin: string;
  locale: ShopifyLocale;
}

export interface ShopifyLocale {
  iso_code: string;
  name: string;
  endonym_name: string;
  primary: boolean;
  root_url: string;
}

export interface ShopifyLocalization {
  available_countries: { iso_code: string; name: string; currency: { iso_code: string } }[];
  available_languages: ShopifyLocale[];
  country: { iso_code: string; name: string; currency: { iso_code: string } };
  language: ShopifyLocale;
  market: { id: string; handle: string };
}

// ============================================
// ROUTES
// ============================================

export interface ShopifyRoutes {
  root_url: string;
  account_url: string;
  account_login_url: string;
  account_logout_url: string;
  account_register_url: string;
  account_addresses_url: string;
  account_recover_url: string;
  cart_url: string;
  cart_add_url: string;
  cart_change_url: string;
  cart_clear_url: string;
  cart_update_url: string;
  collections_url: string;
  all_products_collection_url: string;
  search_url: string;
  predictive_search_url: string;
  gift_card_url: string;
  product_recommendations_url: string;
}

// ============================================
// TEMPLATE CONTEXT
// ============================================

export interface ShopifyTemplateContext {
  // Core objects
  shop: ShopifyShop;
  request: ShopifyRequest;
  routes: ShopifyRoutes;
  localization: ShopifyLocalization;
  settings: Record<string, any>;

  // Page context
  template: { name: string; suffix: string | null; directory: string | null };
  page_title: string;
  page_description: string;
  page_image: string | null;
  canonical_url: string;
  handle: string;

  // Content
  content_for_header: string;
  content_for_layout: string;

  // Resources (may be null depending on template)
  product?: ShopifyProduct | null;
  collection?: ShopifyCollection | null;
  cart: ShopifyCart;
  customer: ShopifyCustomer | null;
  page?: ShopifyPage | null;
  blog?: ShopifyBlog | null;
  article?: ShopifyArticle | null;
  search?: ShopifySearch | null;

  // Global collections
  all_products: Record<string, ShopifyProduct>;
  collections: ShopifyCollection[];
  pages: Record<string, ShopifyPage>;
  blogs: Record<string, ShopifyBlog>;
  linklists: Record<string, ShopifyLinklist>;

  // Recommendations
  recommendations?: ShopifyRecommendations;
  predictive_search?: ShopifyPredictiveSearch;

  // Forms
  form?: ShopifyForm;

  // Pagination
  paginate?: ShopifyPagination;

  // Gift cards
  gift_card?: any;

  // Additional properties
  additional_checkout_buttons: boolean;
  checkout: any | null;
  current_page: number;
  current_tags: string[];
  images: Record<string, ShopifyImage>;
  scripts: any;
  theme: { id: number; name: string; role: string };
  powered_by_link: string;

  // Dynamic section data
  section?: {
    id: string;
    type: string;
    settings: Record<string, any>;
    blocks: ShopifySectionBlock[];
    block_order: string[];
    index: number;
    index0: number;
  };

  block?: ShopifySectionBlock;
}

export interface ShopifySectionBlock {
  id: string;
  type: string;
  settings: Record<string, any>;
  shopify_attributes: string;
}
