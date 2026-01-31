/**
 * 🎭 Mock Data Server
 * Comprehensive mock data for Shopify Liquid rendering
 * Provides realistic preview data for products, collections, cart, etc.
 */

import type {
    ShopifyArticle,
    ShopifyBlog,
    ShopifyCart,
    ShopifyCollection,
    ShopifyCustomer,
    ShopifyImage,
    ShopifyLinklist,
    ShopifyLocalization,
    ShopifyPage,
    ShopifyProduct,
    ShopifyRecommendations,
    ShopifyRequest,
    ShopifyRoutes,
    ShopifySearch,
    ShopifyShop,
    ShopifyVariant,
} from '../types/shopify-liquid';

// ============================================
// PLACEHOLDER IMAGES
// ============================================

const PLACEHOLDER_IMAGES = {
  product: 'https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-product-1_large.png',
  collection: 'https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-collection-1_large.png',
  image: 'https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_large.png',
  lifestyle: 'https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-lifestyle-1_large.png',
  logo: 'https://via.placeholder.com/200x60/1a1a2e/ffffff?text=LOGO',
};

function createPlaceholderImage(type: keyof typeof PLACEHOLDER_IMAGES = 'product', alt: string = 'Placeholder'): ShopifyImage {
  return {
    id: Math.floor(Math.random() * 1000000),
    src: PLACEHOLDER_IMAGES[type],
    alt,
    width: 800,
    height: 800,
    aspect_ratio: 1,
  };
}

// ============================================
// MOCK PRODUCTS
// ============================================

export function getMockProducts(count: number = 8): ShopifyProduct[] {
  const products: ShopifyProduct[] = [];

  const productData = [
    { title: 'Classic White T-Shirt', price: 2999, compareAt: 3999, vendor: 'StyleCo', type: 'T-Shirts' },
    { title: 'Vintage Denim Jacket', price: 8999, compareAt: 12999, vendor: 'DenimWorks', type: 'Jackets' },
    { title: 'Premium Leather Belt', price: 4999, compareAt: null, vendor: 'LeatherCraft', type: 'Accessories' },
    { title: 'Organic Cotton Hoodie', price: 5999, compareAt: 7499, vendor: 'EcoWear', type: 'Hoodies' },
    { title: 'Slim Fit Chinos', price: 6999, compareAt: null, vendor: 'StyleCo', type: 'Pants' },
    { title: 'Wool Blend Sweater', price: 7999, compareAt: 9999, vendor: 'WinterWear', type: 'Sweaters' },
    { title: 'Canvas Sneakers', price: 5499, compareAt: 6999, vendor: 'FootWear', type: 'Shoes' },
    { title: 'Polarized Sunglasses', price: 12999, compareAt: 15999, vendor: 'SunStyle', type: 'Accessories' },
  ];

  for (let i = 0; i < Math.min(count, productData.length); i++) {
    const data = productData[i];
    const handle = data.title.toLowerCase().replace(/\s+/g, '-');
    const image = createPlaceholderImage('product', data.title);

    const variants: ShopifyVariant[] = [
      {
        id: 40000 + i * 10,
        title: 'Small',
        price: data.price,
        compare_at_price: data.compareAt,
        sku: `SKU-${handle}-s`,
        barcode: null,
        available: true,
        inventory_quantity: 15,
        inventory_policy: 'deny',
        inventory_management: 'shopify',
        requires_shipping: true,
        taxable: true,
        weight: 200,
        weight_unit: 'g',
        option1: 'Small',
        option2: null,
        option3: null,
        image: null,
        featured_image: null,
        url: `/products/${handle}?variant=${40000 + i * 10}`,
        selected: false,
      },
      {
        id: 40001 + i * 10,
        title: 'Medium',
        price: data.price,
        compare_at_price: data.compareAt,
        sku: `SKU-${handle}-m`,
        barcode: null,
        available: true,
        inventory_quantity: 20,
        inventory_policy: 'deny',
        inventory_management: 'shopify',
        requires_shipping: true,
        taxable: true,
        weight: 220,
        weight_unit: 'g',
        option1: 'Medium',
        option2: null,
        option3: null,
        image: null,
        featured_image: null,
        url: `/products/${handle}?variant=${40001 + i * 10}`,
        selected: true,
      },
      {
        id: 40002 + i * 10,
        title: 'Large',
        price: data.price,
        compare_at_price: data.compareAt,
        sku: `SKU-${handle}-l`,
        barcode: null,
        available: i !== 3, // One size out of stock for demo
        inventory_quantity: i === 3 ? 0 : 10,
        inventory_policy: 'deny',
        inventory_management: 'shopify',
        requires_shipping: true,
        taxable: true,
        weight: 240,
        weight_unit: 'g',
        option1: 'Large',
        option2: null,
        option3: null,
        image: null,
        featured_image: null,
        url: `/products/${handle}?variant=${40002 + i * 10}`,
        selected: false,
      },
    ];

    const product: ShopifyProduct = {
      id: 1000 + i,
      title: data.title,
      handle,
      url: `/products/${handle}`,
      type: data.type,
      vendor: data.vendor,
      description: `<p>This is a high-quality ${data.title.toLowerCase()} made with premium materials. Perfect for any occasion.</p><p>Features:</p><ul><li>Premium quality</li><li>Comfortable fit</li><li>Durable construction</li></ul>`,
      content: `This is a high-quality ${data.title.toLowerCase()} made with premium materials.`,
      price: data.price,
      price_min: data.price,
      price_max: data.price,
      price_varies: false,
      compare_at_price: data.compareAt,
      compare_at_price_min: data.compareAt,
      compare_at_price_max: data.compareAt,
      compare_at_price_varies: false,
      available: true,
      featured_image: image,
      images: [image, createPlaceholderImage('product', `${data.title} - View 2`)],
      image: image,
      media: [{ ...image, media_type: 'image' }],
      options: [{ name: 'Size', position: 1, values: ['Small', 'Medium', 'Large'] }],
      options_with_values: [{ name: 'Size', position: 1, values: ['Small', 'Medium', 'Large'], selected_value: 'Medium' }],
      variants,
      first_available_variant: variants[0],
      selected_variant: variants[1],
      selected_or_first_available_variant: variants[1],
      has_only_default_variant: false,
      tags: ['featured', data.type.toLowerCase(), 'preview'],
      template_suffix: null,
      collections: [],
      metafields: {},
      requires_selling_plan: false,
      selling_plan_groups: [],
      gift_card: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      published_at: new Date().toISOString(),
    };

    products.push(product);
  }

  return products;
}

// ============================================
// MOCK COLLECTIONS
// ============================================

export function getMockCollections(count: number = 4): ShopifyCollection[] {
  const products = getMockProducts(8);

  const collectionData = [
    { title: 'All Products', handle: 'all', description: 'Browse our complete catalog' },
    { title: 'New Arrivals', handle: 'new-arrivals', description: 'Check out our latest products' },
    { title: 'Best Sellers', handle: 'best-sellers', description: 'Our most popular items' },
    { title: 'Sale', handle: 'sale', description: 'Great deals on selected items' },
  ];

  return collectionData.slice(0, count).map((data, i) => ({
    id: 2000 + i,
    title: data.title,
    handle: data.handle,
    url: `/collections/${data.handle}`,
    description: data.description,
    image: createPlaceholderImage('collection', data.title),
    featured_image: createPlaceholderImage('collection', data.title),
    products: i === 0 ? products : products.slice(i, i + 4),
    products_count: i === 0 ? products.length : 4,
    all_products_count: i === 0 ? products.length : 4,
    all_types: ['T-Shirts', 'Jackets', 'Accessories', 'Hoodies'],
    all_vendors: ['StyleCo', 'DenimWorks', 'LeatherCraft', 'EcoWear'],
    all_tags: ['featured', 'new', 'sale'],
    default_sort_by: 'best-selling',
    sort_by: 'best-selling',
    sort_options: [
      { name: 'Best Selling', value: 'best-selling' },
      { name: 'Alphabetically, A-Z', value: 'title-ascending' },
      { name: 'Alphabetically, Z-A', value: 'title-descending' },
      { name: 'Price, low to high', value: 'price-ascending' },
      { name: 'Price, high to low', value: 'price-descending' },
      { name: 'Date, old to new', value: 'created-ascending' },
      { name: 'Date, new to old', value: 'created-descending' },
    ],
    filters: [],
    template_suffix: null,
    metafields: {},
    current_type: null,
    current_vendor: null,
  }));
}

// ============================================
// MOCK CART
// ============================================

export function getMockCart(itemCount: number = 2): ShopifyCart {
  const products = getMockProducts(4);

  const items = products.slice(0, itemCount).map((product, i) => ({
    id: 30000 + i,
    key: `${product.variants[0].id}:key${i}`,
    product,
    product_id: product.id,
    variant: product.variants[0],
    variant_id: product.variants[0].id,
    sku: product.variants[0].sku,
    title: product.title,
    quantity: i + 1,
    price: product.price,
    line_price: product.price * (i + 1),
    original_price: product.price,
    original_line_price: product.price * (i + 1),
    total_discount: 0,
    discounts: [],
    url: product.url,
    image: product.featured_image,
    handle: product.handle,
    requires_shipping: true,
    product_title: product.title,
    variant_title: product.variants[0].title,
    properties: {},
    gift_card: false,
    selling_plan_allocation: null,
  }));

  const total = items.reduce((sum, item) => sum + item.line_price, 0);

  return {
    token: 'mock-cart-token-12345',
    note: null,
    attributes: {},
    item_count: items.reduce((sum, item) => sum + item.quantity, 0),
    items,
    items_subtotal_price: total,
    total_price: total,
    total_discount: 0,
    total_weight: 500,
    original_total_price: total,
    cart_level_discount_applications: [],
    currency: { iso_code: 'USD' },
    requires_shipping: true,
    taxes_included: false,
  };
}

// ============================================
// MOCK CUSTOMER
// ============================================

export function getMockCustomer(loggedIn: boolean = false): ShopifyCustomer | null {
  if (!loggedIn) return null;

  return {
    id: 5000,
    email: 'customer@example.com',
    first_name: 'John',
    last_name: 'Doe',
    name: 'John Doe',
    phone: '+1 555-123-4567',
    accepts_marketing: true,
    orders_count: 5,
    total_spent: 45000, // $450.00
    tags: ['vip', 'returning'],
    addresses: [
      {
        id: 6000,
        first_name: 'John',
        last_name: 'Doe',
        name: 'John Doe',
        company: null,
        address1: '123 Main Street',
        address2: 'Apt 4B',
        city: 'New York',
        province: 'New York',
        province_code: 'NY',
        country: 'United States',
        country_code: 'US',
        zip: '10001',
        phone: '+1 555-123-4567',
        default: true,
      },
    ],
    default_address: {
      id: 6000,
      first_name: 'John',
      last_name: 'Doe',
      name: 'John Doe',
      company: null,
      address1: '123 Main Street',
      address2: 'Apt 4B',
      city: 'New York',
      province: 'New York',
      province_code: 'NY',
      country: 'United States',
      country_code: 'US',
      zip: '10001',
      phone: '+1 555-123-4567',
      default: true,
    },
    has_account: true,
    tax_exempt: false,
    last_order: null,
  };
}

// ============================================
// MOCK SHOP
// ============================================

export function getMockShop(shopDomain: string = 'my-store.myshopify.com'): ShopifyShop {
  const name = shopDomain.split('.')[0].replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

  return {
    name,
    description: `Welcome to ${name}! We offer premium quality products for every occasion.`,
    url: `https://${shopDomain}`,
    domain: shopDomain.replace('.myshopify.com', '.com'),
    permanent_domain: shopDomain,
    email: `support@${shopDomain.replace('.myshopify.com', '.com')}`,
    phone: '+1 555-STORE-01',
    address: {
      id: 1,
      first_name: '',
      last_name: '',
      name: name,
      company: name,
      address1: '123 Commerce Street',
      address2: null,
      city: 'San Francisco',
      province: 'California',
      province_code: 'CA',
      country: 'United States',
      country_code: 'US',
      zip: '94102',
      phone: '+1 555-STORE-01',
      default: true,
    },
    currency: 'USD',
    money_format: '${{amount}}',
    money_with_currency_format: '${{amount}} USD',
    locale: 'en',
    enabled_currencies: ['USD', 'EUR', 'GBP'],
    enabled_locales: [
      { iso_code: 'en', name: 'English', primary: true },
      { iso_code: 'es', name: 'Spanish', primary: false },
    ],
    enabled_payment_types: ['visa', 'mastercard', 'amex', 'discover', 'paypal', 'apple_pay', 'google_pay', 'shopify_pay'],
    customer_accounts_enabled: true,
    customer_accounts_optional: true,
    accepts_gift_cards: true,
    collections_count: 4,
    products_count: 25,
    policies: [],
    privacy_policy: { title: 'Privacy Policy', body: 'Privacy policy content...', url: '/policies/privacy-policy', handle: 'privacy-policy' },
    refund_policy: { title: 'Refund Policy', body: 'Refund policy content...', url: '/policies/refund-policy', handle: 'refund-policy' },
    shipping_policy: { title: 'Shipping Policy', body: 'Shipping policy content...', url: '/policies/shipping-policy', handle: 'shipping-policy' },
    terms_of_service: { title: 'Terms of Service', body: 'Terms of service content...', url: '/policies/terms-of-service', handle: 'terms-of-service' },
    subscription_policy: null,
    metafields: {},
    brand: {
      logo: createPlaceholderImage('logo', `${name} Logo`),
      short_description: `Premium products from ${name}`,
      slogan: 'Quality you can trust',
      colors: {
        primary: [{ background: '#1a1a2e', foreground: '#ffffff' }],
        secondary: [{ background: '#5c5cf0', foreground: '#ffffff' }],
      },
    },
    secure_url: `https://${shopDomain}`,
    vendors: ['StyleCo', 'DenimWorks', 'LeatherCraft', 'EcoWear', 'WinterWear', 'FootWear', 'SunStyle'],
    types: ['T-Shirts', 'Jackets', 'Accessories', 'Hoodies', 'Pants', 'Sweaters', 'Shoes'],
    password_message: '',
  };
}

// ============================================
// MOCK LINKLISTS (MENUS)
// ============================================

export function getMockLinklists(): Record<string, ShopifyLinklist> {
  return {
    'main-menu': {
      title: 'Main Menu',
      handle: 'main-menu',
      links: [
        { title: 'Home', url: '/', handle: '', active: true, child_active: false, current: true, child_current: false, type: 'frontpage', links: [], levels: 0 },
        {
          title: 'Shop',
          url: '/collections/all',
          handle: 'all',
          active: false,
          child_active: false,
          current: false,
          child_current: false,
          type: 'collection',
          links: [
            { title: 'All Products', url: '/collections/all', handle: 'all', active: false, child_active: false, current: false, child_current: false, type: 'collection', links: [], levels: 0 },
            { title: 'New Arrivals', url: '/collections/new-arrivals', handle: 'new-arrivals', active: false, child_active: false, current: false, child_current: false, type: 'collection', links: [], levels: 0 },
            { title: 'Best Sellers', url: '/collections/best-sellers', handle: 'best-sellers', active: false, child_active: false, current: false, child_current: false, type: 'collection', links: [], levels: 0 },
            { title: 'Sale', url: '/collections/sale', handle: 'sale', active: false, child_active: false, current: false, child_current: false, type: 'collection', links: [], levels: 0 },
          ],
          levels: 1,
        },
        { title: 'About', url: '/pages/about', handle: 'about', active: false, child_active: false, current: false, child_current: false, type: 'page', links: [], levels: 0 },
        { title: 'Contact', url: '/pages/contact', handle: 'contact', active: false, child_active: false, current: false, child_current: false, type: 'page', links: [], levels: 0 },
      ],
      levels: 2,
    },
    'footer': {
      title: 'Footer Menu',
      handle: 'footer',
      links: [
        { title: 'Search', url: '/search', handle: '', active: false, child_active: false, current: false, child_current: false, type: 'search', links: [], levels: 0 },
        { title: 'About Us', url: '/pages/about', handle: 'about', active: false, child_active: false, current: false, child_current: false, type: 'page', links: [], levels: 0 },
        { title: 'Privacy Policy', url: '/policies/privacy-policy', handle: 'privacy-policy', active: false, child_active: false, current: false, child_current: false, type: 'http', links: [], levels: 0 },
        { title: 'Refund Policy', url: '/policies/refund-policy', handle: 'refund-policy', active: false, child_active: false, current: false, child_current: false, type: 'http', links: [], levels: 0 },
        { title: 'Terms of Service', url: '/policies/terms-of-service', handle: 'terms-of-service', active: false, child_active: false, current: false, child_current: false, type: 'http', links: [], levels: 0 },
      ],
      levels: 1,
    },
  };
}

// ============================================
// MOCK PAGES
// ============================================

export function getMockPages(): Record<string, ShopifyPage> {
  return {
    'about': {
      id: 7000,
      title: 'About Us',
      handle: 'about',
      url: '/pages/about',
      content: '<h2>Our Story</h2><p>We are a passionate team dedicated to bringing you the best products at reasonable prices. Founded in 2020, we have grown to serve customers worldwide.</p><h2>Our Mission</h2><p>To provide quality products that make a difference in your daily life.</p>',
      author: 'Store Admin',
      template_suffix: null,
      published_at: new Date().toISOString(),
      metafields: {},
    },
    'contact': {
      id: 7001,
      title: 'Contact Us',
      handle: 'contact',
      url: '/pages/contact',
      content: '<h2>Get in Touch</h2><p>We would love to hear from you! Contact us using the form below or reach out directly.</p><p><strong>Email:</strong> support@example.com</p><p><strong>Phone:</strong> +1 555-STORE-01</p>',
      author: 'Store Admin',
      template_suffix: null,
      published_at: new Date().toISOString(),
      metafields: {},
    },
    'faq': {
      id: 7002,
      title: 'FAQ',
      handle: 'faq',
      url: '/pages/faq',
      content: '<h2>Frequently Asked Questions</h2><h3>How long does shipping take?</h3><p>Standard shipping takes 5-7 business days. Express shipping is available for 2-3 day delivery.</p><h3>What is your return policy?</h3><p>We accept returns within 30 days of purchase.</p>',
      author: 'Store Admin',
      template_suffix: null,
      published_at: new Date().toISOString(),
      metafields: {},
    },
  };
}

// ============================================
// MOCK BLOGS & ARTICLES
// ============================================

export function getMockBlogs(): Record<string, ShopifyBlog> {
  const articles = getMockArticles();

  return {
    'news': {
      id: 8000,
      title: 'News',
      handle: 'news',
      url: '/blogs/news',
      articles: Object.values(articles),
      articles_count: Object.keys(articles).length,
      all_tags: ['announcement', 'tips', 'product-spotlight'],
      comments_enabled: true,
      moderated: true,
      metafields: {},
    },
  };
}

export function getMockArticles(): Record<string, ShopifyArticle> {
  return {
    'welcome-to-our-store': {
      id: 9000,
      title: 'Welcome to Our Store',
      handle: 'welcome-to-our-store',
      url: '/blogs/news/welcome-to-our-store',
      author: 'Store Team',
      content: '<p>We are excited to welcome you to our new online store! Browse our collection and find the perfect products for you.</p>',
      excerpt: 'We are excited to welcome you to our new online store!',
      excerpt_or_content: 'We are excited to welcome you to our new online store!',
      image: createPlaceholderImage('lifestyle', 'Welcome to Our Store'),
      published_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      tags: ['announcement'],
      comments: [],
      comments_count: 0,
      comments_enabled: true,
      moderated: true,
      user: { first_name: 'Store', last_name: 'Team', bio: null },
      metafields: {},
    },
    'styling-tips': {
      id: 9001,
      title: '5 Styling Tips for This Season',
      handle: 'styling-tips',
      url: '/blogs/news/styling-tips',
      author: 'Fashion Expert',
      content: '<p>Looking for inspiration? Here are our top 5 styling tips to elevate your wardrobe this season.</p><ol><li>Layer with confidence</li><li>Mix textures</li><li>Accessorize wisely</li><li>Embrace color</li><li>Comfort is key</li></ol>',
      excerpt: 'Looking for inspiration? Here are our top 5 styling tips.',
      excerpt_or_content: 'Looking for inspiration? Here are our top 5 styling tips.',
      image: createPlaceholderImage('lifestyle', 'Styling Tips'),
      published_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      tags: ['tips'],
      comments: [],
      comments_count: 0,
      comments_enabled: true,
      moderated: true,
      user: { first_name: 'Fashion', last_name: 'Expert', bio: null },
      metafields: {},
    },
  };
}

// ============================================
// MOCK SEARCH
// ============================================

export function getMockSearch(query: string = ''): ShopifySearch {
  const products = getMockProducts(4);
  const collections = getMockCollections(2);
  const pages = Object.values(getMockPages());

  return {
    performed: query.length > 0,
    terms: query,
    results: query ? [...products.slice(0, 2), ...collections.slice(0, 1)] : [],
    results_count: query ? 3 : 0,
    types: ['product', 'collection', 'page', 'article'],
    filters: [],
    sort_by: 'relevance',
    sort_options: [
      { name: 'Relevance', value: 'relevance' },
      { name: 'Price, low to high', value: 'price-ascending' },
      { name: 'Price, high to low', value: 'price-descending' },
    ],
  };
}

// ============================================
// MOCK RECOMMENDATIONS
// ============================================

export function getMockRecommendations(productId?: number): ShopifyRecommendations {
  const products = getMockProducts(4);

  return {
    products: products.filter(p => p.id !== productId).slice(0, 4),
    performed: true,
    products_count: 4,
    intent: 'related',
  };
}

// ============================================
// MOCK ROUTES
// ============================================

export function getMockRoutes(): ShopifyRoutes {
  return {
    root_url: '/',
    account_url: '/account',
    account_login_url: '/account/login',
    account_logout_url: '/account/logout',
    account_register_url: '/account/register',
    account_addresses_url: '/account/addresses',
    account_recover_url: '/account/recover',
    cart_url: '/cart',
    cart_add_url: '/cart/add',
    cart_change_url: '/cart/change',
    cart_clear_url: '/cart/clear',
    cart_update_url: '/cart/update',
    collections_url: '/collections',
    all_products_collection_url: '/collections/all',
    search_url: '/search',
    predictive_search_url: '/search/suggest',
    gift_card_url: '/gift_cards',
    product_recommendations_url: '/recommendations/products',
  };
}

// ============================================
// MOCK LOCALIZATION
// ============================================

export function getMockLocalization(): ShopifyLocalization {
  return {
    available_countries: [
      { iso_code: 'US', name: 'United States', currency: { iso_code: 'USD' } },
      { iso_code: 'CA', name: 'Canada', currency: { iso_code: 'CAD' } },
      { iso_code: 'GB', name: 'United Kingdom', currency: { iso_code: 'GBP' } },
    ],
    available_languages: [
      { iso_code: 'en', name: 'English', endonym_name: 'English', primary: true, root_url: '/' },
      { iso_code: 'es', name: 'Spanish', endonym_name: 'Español', primary: false, root_url: '/es' },
    ],
    country: { iso_code: 'US', name: 'United States', currency: { iso_code: 'USD' } },
    language: { iso_code: 'en', name: 'English', endonym_name: 'English', primary: true, root_url: '/' },
    market: { id: 'gid://shopify/Market/1', handle: 'us' },
  };
}

// ============================================
// MOCK REQUEST
// ============================================

export function getMockRequest(path: string = '/', designMode: boolean = true): ShopifyRequest {
  return {
    design_mode: designMode,
    visual_preview_mode: designMode,
    host: 'my-store.myshopify.com',
    path,
    page_type: path === '/' ? 'index' : 'page',
    origin: 'https://my-store.myshopify.com',
    locale: {
      iso_code: 'en',
      name: 'English',
      endonym_name: 'English',
      primary: true,
      root_url: '/',
    },
  };
}

// ============================================
// COMPLETE CONTEXT BUILDER
// ============================================

export interface MockContextOptions {
  shopDomain?: string;
  path?: string;
  template?: string;
  customerLoggedIn?: boolean;
  cartItemCount?: number;
  designMode?: boolean;
}

export function buildMockContext(options: MockContextOptions = {}): Record<string, any> {
  const {
    shopDomain = 'my-store.myshopify.com',
    path = '/',
    template = 'index',
    customerLoggedIn = false,
    cartItemCount = 2,
    designMode = true,
  } = options;

  const products = getMockProducts(8);
  const collections = getMockCollections(4);
  const cart = getMockCart(cartItemCount);
  const shop = getMockShop(shopDomain);
  const customer = getMockCustomer(customerLoggedIn);
  const linklists = getMockLinklists();
  const pages = getMockPages();
  const blogs = getMockBlogs();
  const routes = getMockRoutes();
  const localization = getMockLocalization();
  const request = getMockRequest(path, designMode);

  // Convert arrays to handle-indexed objects where needed
  const allProducts: Record<string, ShopifyProduct> = {};
  products.forEach(p => { allProducts[p.handle] = p; });

  return {
    // Core objects
    shop,
    request,
    routes,
    localization,

    // Page context
    template: { name: template, suffix: null, directory: null },
    page_title: shop.name,
    page_description: shop.description,
    page_image: null,
    canonical_url: `https://${shopDomain}${path}`,
    handle: template,

    // Content placeholders
    content_for_header: '',
    content_for_layout: '',

    // Resources
    product: products[0],
    products,
    collection: collections[0],
    collections,
    cart,
    customer,

    // Global collections
    all_products: allProducts,
    pages,
    blogs,
    linklists,
    menus: linklists, // Alias

    // Additional
    recommendations: getMockRecommendations(),
    search: getMockSearch(),

    // Utilities
    additional_checkout_buttons: true,
    checkout: null,
    current_page: 1,
    current_tags: [],
    images: {
      logo: createPlaceholderImage('logo', 'Logo'),
      placeholder: createPlaceholderImage('image', 'Placeholder'),
    },
    scripts: {},
    theme: { id: 123456789, name: 'VSBuilder Theme', role: 'main' },
    powered_by_link: '<a href="https://www.shopify.com" target="_blank" rel="nofollow">Powered by Shopify</a>',

    // Settings will be loaded separately
    settings: {},
  };
}
