/**
 * 📦 Asset Processor Server
 * Processes theme assets: CSS, JS, images
 * Handles Liquid in assets, optimization, and bundling
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================
// MIME TYPES
// ============================================

const MIME_TYPES: Record<string, string> = {
  // CSS
  '.css': 'text/css',
  '.scss': 'text/css',
  '.sass': 'text/css',

  // JavaScript
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.cjs': 'application/javascript',
  '.json': 'application/json',

  // Images
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.avif': 'image/avif',

  // Fonts
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.eot': 'application/vnd.ms-fontobject',

  // Other
  '.map': 'application/json',
  '.liquid': 'text/plain',
};

export function getMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

// ============================================
// LIQUID IN ASSETS
// ============================================

/**
 * Process Liquid syntax in CSS/JS files
 * Common patterns:
 * - {{ 'filename' | asset_url }}
 * - {{ settings.color_name }}
 * - {% if settings.show_feature %}...{% endif %}
 */
export function processLiquidInAsset(
  content: string,
  context: {
    settings: Record<string, any>;
    themeId: string;
    shopHandle: string;
  }
): string {
  let result = content;
  const { settings, themeId, shopHandle } = context;

  // Replace asset_url filter
  // {{ 'filename.ext' | asset_url }}
  result = result.replace(
    /\{\{\s*['"]([^'"]+)['"]\s*\|\s*asset_url\s*\}\}/g,
    (match, filename) => {
      return `/apps/vsbuilder/assets?themeId=${themeId}&shopHandle=${shopHandle}&file=${encodeURIComponent(filename)}`;
    }
  );

  // Replace settings references
  // {{ settings.variable_name }}
  result = result.replace(
    /\{\{\s*settings\.(\w+)\s*\}\}/g,
    (match, settingName) => {
      const value = settings[settingName];
      if (value === undefined || value === null) {
        return '';
      }
      // Handle color objects
      if (typeof value === 'object' && 'red' in value) {
        const alpha = value.alpha ?? 1;
        if (alpha < 1) {
          return `rgba(${value.red}, ${value.green}, ${value.blue}, ${alpha})`;
        }
        return `rgb(${value.red}, ${value.green}, ${value.blue})`;
      }
      return String(value);
    }
  );

  // Remove Liquid conditionals (simplified - just remove the tags)
  // {% if settings.something %}...{% endif %}
  result = result.replace(
    /\{%[-\s]*if\s+[^%]+%\}([\s\S]*?)\{%[-\s]*endif[-\s]*%\}/g,
    (match, content) => {
      // For now, include the content (assuming condition is true)
      return content;
    }
  );

  // Remove other Liquid tags
  result = result.replace(/\{%[^%]+%\}/g, '');

  // Remove any remaining Liquid output tags that weren't matched
  result = result.replace(/\{\{[^}]+\}\}/g, '');

  return result;
}

// ============================================
// ASSET LOADING
// ============================================

export interface LoadedAsset {
  content: string | Buffer;
  mimeType: string;
  isText: boolean;
  size: number;
  lastModified: Date;
}

/**
 * Load an asset file
 */
export function loadAsset(assetPath: string): LoadedAsset | null {
  if (!fs.existsSync(assetPath)) {
    return null;
  }

  const stats = fs.statSync(assetPath);
  const mimeType = getMimeType(assetPath);
  const isText = mimeType.startsWith('text/') ||
                 mimeType === 'application/javascript' ||
                 mimeType === 'application/json' ||
                 mimeType === 'image/svg+xml';

  const content = isText
    ? fs.readFileSync(assetPath, 'utf-8')
    : fs.readFileSync(assetPath);

  return {
    content,
    mimeType,
    isText,
    size: stats.size,
    lastModified: stats.mtime,
  };
}

// ============================================
// ASSET COLLECTION
// ============================================

export interface AssetInfo {
  filename: string;
  path: string;
  type: 'css' | 'js' | 'image' | 'font' | 'other';
  size: number;
  isLiquid: boolean;
}

/**
 * List all assets in theme
 */
export function listAssets(assetsDir: string): AssetInfo[] {
  if (!fs.existsSync(assetsDir)) {
    return [];
  }

  const assets: AssetInfo[] = [];
  const files = fs.readdirSync(assetsDir);

  for (const filename of files) {
    const filePath = path.join(assetsDir, filename);
    const stats = fs.statSync(filePath);

    if (!stats.isFile()) continue;

    const ext = path.extname(filename).toLowerCase();
    const isLiquid = filename.endsWith('.liquid');

    let type: AssetInfo['type'] = 'other';
    if (['.css', '.scss', '.sass'].includes(ext) || filename.endsWith('.css.liquid')) {
      type = 'css';
    } else if (['.js', '.mjs', '.cjs'].includes(ext) || filename.endsWith('.js.liquid')) {
      type = 'js';
    } else if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico', '.avif'].includes(ext)) {
      type = 'image';
    } else if (['.woff', '.woff2', '.ttf', '.otf', '.eot'].includes(ext)) {
      type = 'font';
    }

    assets.push({
      filename,
      path: filePath,
      type,
      size: stats.size,
      isLiquid,
    });
  }

  return assets;
}

/**
 * Get CSS assets in load order
 */
export function getCSSAssets(assetsDir: string): AssetInfo[] {
  return listAssets(assetsDir)
    .filter(a => a.type === 'css')
    .sort((a, b) => {
      // Priority: base.css first, then component-*, then section-*, then template-*, then others
      const priority: Record<string, number> = {
        'base.css': 0,
        'reset.css': 1,
        'normalize.css': 1,
      };

      const getPriority = (name: string): number => {
        if (priority[name] !== undefined) return priority[name];
        if (name.startsWith('component-')) return 2;
        if (name.startsWith('section-')) return 3;
        if (name.startsWith('template-')) return 4;
        return 5;
      };

      return getPriority(a.filename) - getPriority(b.filename);
    });
}

/**
 * Get JS assets in load order
 */
export function getJSAssets(assetsDir: string): AssetInfo[] {
  return listAssets(assetsDir)
    .filter(a => a.type === 'js')
    .filter(a => !a.filename.includes('.min.') || !listAssets(assetsDir).some(
      other => other.filename === a.filename.replace('.min.', '.')
    ));
}

// ============================================
// IMAGE PROCESSING
// ============================================

export interface ImageParams {
  width?: number;
  height?: number;
  crop?: 'top' | 'center' | 'bottom' | 'left' | 'right';
  scale?: number;
  format?: 'jpg' | 'png' | 'webp' | 'avif';
}

/**
 * Generate image URL with transformation parameters
 * Note: Actual transformation would need sharp or similar library
 */
export function generateImageUrl(
  baseUrl: string,
  params: ImageParams
): string {
  const searchParams = new URLSearchParams();

  if (params.width) searchParams.set('width', String(params.width));
  if (params.height) searchParams.set('height', String(params.height));
  if (params.crop) searchParams.set('crop', params.crop);
  if (params.scale) searchParams.set('scale', String(params.scale));
  if (params.format) searchParams.set('format', params.format);

  const queryString = searchParams.toString();
  return queryString ? `${baseUrl}?${queryString}` : baseUrl;
}

/**
 * Generate srcset string for responsive images
 */
export function generateSrcset(
  baseUrl: string,
  widths: number[] = [180, 360, 540, 720, 900, 1080, 1296, 1512, 1728, 1944, 2160]
): string {
  return widths
    .map(w => `${generateImageUrl(baseUrl, { width: w })} ${w}w`)
    .join(', ');
}

// ============================================
// PLACEHOLDER GENERATION
// ============================================

const PLACEHOLDER_COLORS = {
  product: '#e8e8e8',
  collection: '#e8e8e8',
  image: '#e8e8e8',
  lifestyle: '#d4d4d4',
};

/**
 * Generate SVG placeholder for images
 */
export function generatePlaceholderSVG(
  type: keyof typeof PLACEHOLDER_COLORS = 'image',
  width: number = 400,
  height: number = 400
): string {
  const bgColor = PLACEHOLDER_COLORS[type];
  const iconColor = '#b0b0b0';

  // Different icons for different types
  let icon = '';
  switch (type) {
    case 'product':
      icon = `<path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="${iconColor}" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round" transform="translate(${width/2 - 12}, ${height/2 - 12})"/>`;
      break;
    case 'collection':
      icon = `<rect x="${width/2 - 20}" y="${height/2 - 15}" width="15" height="20" rx="2" fill="${iconColor}" opacity="0.7"/>
              <rect x="${width/2 - 5}" y="${height/2 - 18}" width="15" height="20" rx="2" fill="${iconColor}" opacity="0.85"/>
              <rect x="${width/2 + 5}" y="${height/2 - 10}" width="15" height="20" rx="2" fill="${iconColor}"/>`;
      break;
    default:
      icon = `<circle cx="${width/2}" cy="${height/2 - 5}" r="8" fill="${iconColor}"/>
              <path d="M${width/2 - 15} ${height/2 + 20} Q ${width/2 - 10} ${height/2 + 5} ${width/2} ${height/2 + 10} Q ${width/2 + 10} ${height/2 + 5} ${width/2 + 15} ${height/2 + 20}" fill="${iconColor}"/>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
    <rect width="100%" height="100%" fill="${bgColor}"/>
    ${icon}
  </svg>`;
}

/**
 * Generate data URI for placeholder
 */
export function generatePlaceholderDataUri(
  type: keyof typeof PLACEHOLDER_COLORS = 'image',
  width: number = 400,
  height: number = 400
): string {
  const svg = generatePlaceholderSVG(type, width, height);
  const base64 = Buffer.from(svg).toString('base64');
  return `data:image/svg+xml;base64,${base64}`;
}

// ============================================
// SVG ICONS
// ============================================

const PAYMENT_ICONS: Record<string, string> = {
  visa: `<svg viewBox="0 0 38 24"><path d="M35 0H3C1.3 0 0 1.3 0 3v18c0 1.7 1.4 3 3 3h32c1.7 0 3-1.3 3-3V3c0-1.7-1.4-3-3-3z" fill="#0E4595"/><path d="M27.4 7.5l-3.3 9h-2.2l-1.7-7.1c-.1-.4-.2-.5-.5-.7-.5-.3-1.4-.6-2.1-.8l.1-.4h3.5c.5 0 .9.3 1 .9l.9 4.6 2.1-5.5h2.2zm2.2 9l1.4-9h2.1l-1.4 9h-2.1zm-13.1-4.3c0-1.9 1.7-2.6 2.9-2.6.9 0 1.7.2 2.1.4l.4-1.8c-.4-.2-1.2-.4-2.5-.4-2.6 0-4.5 1.4-4.5 3.4 0 1.5 1.3 2.3 2.3 2.8 1 .5 1.3.8 1.3 1.3 0 .7-.8 1-1.5 1-.8 0-1.5-.1-2.4-.5l-.4 1.8c.6.3 1.7.5 2.8.5 2.8 0 4.6-1.4 4.6-3.5 0-2.7-3.1-2.8-3.1-4.4z" fill="#fff"/></svg>`,
  mastercard: `<svg viewBox="0 0 38 24"><path d="M35 0H3C1.3 0 0 1.3 0 3v18c0 1.7 1.4 3 3 3h32c1.7 0 3-1.3 3-3V3c0-1.7-1.4-3-3-3z" fill="#000" opacity=".07"/><path d="M35 1c1.1 0 2 .9 2 2v18c0 1.1-.9 2-2 2H3c-1.1 0-2-.9-2-2V3c0-1.1.9-2 2-2h32" fill="#fff"/><circle cx="15" cy="12" r="7" fill="#EB001B"/><circle cx="23" cy="12" r="7" fill="#F79E1B"/><path d="M22 12c0-2.4-1.2-4.5-3-5.7-1.8 1.3-3 3.4-3 5.7s1.2 4.5 3 5.7c1.8-1.2 3-3.3 3-5.7z" fill="#FF5F00"/></svg>`,
  amex: `<svg viewBox="0 0 38 24"><path d="M35 0H3C1.3 0 0 1.3 0 3v18c0 1.7 1.4 3 3 3h32c1.7 0 3-1.3 3-3V3c0-1.7-1.4-3-3-3z" fill="#006FCF"/><path d="M8.5 7h2.6l3 7 3-7h2.5v10h-1.8V9.5l-2.9 7.5h-1.7l-2.9-7.5V17H8.5V7zm11 5l-1.5-3.5-1.5 3.5h3zm3.2 5V7h5.8v1.5h-4v2.5h4v1.5h-4v3h4V17h-5.8z" fill="#fff"/></svg>`,
  paypal: `<svg viewBox="0 0 38 24"><path d="M35 0H3C1.3 0 0 1.3 0 3v18c0 1.7 1.4 3 3 3h32c1.7 0 3-1.3 3-3V3c0-1.7-1.4-3-3-3z" fill="#000" opacity=".07"/><path d="M35 1c1.1 0 2 .9 2 2v18c0 1.1-.9 2-2 2H3c-1.1 0-2-.9-2-2V3c0-1.1.9-2 2-2h32" fill="#fff"/><path d="M23.9 8.3c.2-1 0-1.7-.6-2.3-.6-.7-1.8-1-3.2-1h-4.1c-.3 0-.5.2-.6.5L14 14.6c0 .2.1.4.3.4h2.3l.6-3.5v.2c.1-.3.3-.5.6-.5h1.3c2.5 0 4.5-1 5-4 0-.1 0-.2.1-.3-.1 0-.1 0 0 0-.2-.4-.2-.4-.3-.6z" fill="#263B80"/><path d="M23.9 8.3c-.1.5-.2.9-.4 1.3-.8 2.7-3 3.5-5.7 3.5h-1.5c-.3 0-.6.3-.6.5l-.7 4.4-.2 1.3c0 .2.1.4.3.4h2.2c.3 0 .5-.2.6-.5l.4-2.6c.1-.3.3-.5.6-.5h.3c2.4 0 4.3-1 4.9-3.7.3-1.1.1-2.1-.4-2.8-.2-.1-.4-.2-.6-.3h-.2z" fill="#139AD6"/></svg>`,
  apple_pay: `<svg viewBox="0 0 38 24"><path d="M35 0H3C1.3 0 0 1.3 0 3v18c0 1.7 1.4 3 3 3h32c1.7 0 3-1.3 3-3V3c0-1.7-1.4-3-3-3z" fill="#000"/><path d="M13.1 7.6c.3-.4.6-1 .5-1.5-.5 0-1.1.3-1.5.8-.3.4-.6 1-.5 1.5.5 0 1.1-.3 1.5-.8zm.5 1.6c-.8 0-1.6.5-2 .5-.4 0-1.1-.5-1.8-.5-1 0-1.8.6-2.3 1.4-1 1.7-.3 4.2.7 5.6.5.7 1 1.4 1.8 1.4.7 0 1-.5 1.8-.5.8 0 1 .5 1.8.5.8 0 1.2-.7 1.7-1.4.5-.8.7-1.5.7-1.5s-1.4-.5-1.4-2.1c0-1.3 1.1-2 1.2-2-.7-1-1.7-1-2.2-1v.1zm8.9-.6h-3.2v8.1h1.3V14h2c1.8 0 3.1-1.2 3.1-3.2 0-2-1.3-3.2-3.2-3.2zm-.1 5.1h-1.6V9.5h1.6c1.2 0 1.9.6 1.9 2.1 0 1.5-.7 2.1-1.9 2.1zm5.9-1.5c0-1.1 1-1.6 2.7-1.7v-.4c0-.6-.4-1-1.1-1-.6 0-1 .3-1.1.7h-1.1c.1-1 1-1.7 2.3-1.7 1.3 0 2.2.7 2.2 1.8v3.8h-1.1v-.9c-.3.6-1 1-1.8 1-1.1 0-2-.7-2-1.6zm2.7-.4v-.5c-1.1.1-1.7.4-1.7 1s.4.8 1 .8c.8 0 1.4-.5 1.7-1.3v-.3h-.1z" fill="#fff"/></svg>`,
  google_pay: `<svg viewBox="0 0 38 24"><path d="M35 0H3C1.3 0 0 1.3 0 3v18c0 1.7 1.4 3 3 3h32c1.7 0 3-1.3 3-3V3c0-1.7-1.4-3-3-3z" fill="#000" opacity=".07"/><path d="M35 1c1.1 0 2 .9 2 2v18c0 1.1-.9 2-2 2H3c-1.1 0-2-.9-2-2V3c0-1.1.9-2 2-2h32" fill="#fff"/><path d="M18.7 11.2v3.2h-1v-7.9h2.7c.7 0 1.3.2 1.7.7.5.4.7 1 .7 1.6 0 .7-.2 1.2-.7 1.6-.4.4-1 .7-1.7.7h-1.7zm0-3.8v2.9h1.8c.4 0 .8-.2 1-.5.3-.3.4-.6.4-1 0-.4-.1-.7-.4-1-.3-.3-.6-.4-1-.4h-1.8z" fill="#5F6368"/><path d="M25.2 8.5c.7 0 1.3.2 1.7.6.4.4.6 1 .6 1.7v3.6h-1v-.8c-.3.6-1 1-1.7 1-.6 0-1.1-.2-1.5-.5-.4-.4-.6-.8-.6-1.3 0-.6.2-1 .6-1.3.4-.3 1-.5 1.8-.5h1.4v-.2c0-.4-.1-.8-.4-1-.3-.3-.6-.4-1.1-.4-.3 0-.6.1-.9.2-.3.1-.5.3-.7.5l-.7-.6c.2-.3.6-.5 1-.7.4-.2.9-.3 1.5-.3zm-.2 5.6c.4 0 .8-.1 1.1-.4.3-.2.5-.5.6-.9v-.8h-1.3c-.8 0-1.3.3-1.3.9 0 .3.1.5.3.7.3.3.6.5.6.5z" fill="#5F6368"/><path d="M17.2 10.6c0-.2 0-.5-.1-.7h-3.6v1.3h2.1c-.1.5-.3.9-.7 1.2-.4.3-.9.5-1.5.5-.6 0-1.1-.2-1.5-.5-.4-.4-.6-.8-.7-1.4-.1-.3-.1-.5-.1-.8 0-.3 0-.5.1-.8.1-.5.4-1 .7-1.4.4-.4.9-.5 1.5-.5.5 0 1 .2 1.4.5l1-1c-.5-.5-1.3-.8-2.3-.8-.8 0-1.5.2-2.1.6-.6.4-1 .9-1.4 1.5-.3.6-.5 1.3-.5 2s.2 1.4.5 2c.3.6.8 1.1 1.4 1.5.6.4 1.3.6 2.1.6.8 0 1.4-.2 2-.5.5-.3 1-.8 1.2-1.4.3-.5.5-1.1.5-1.9z" fill="#4285F4"/></svg>`,
  shopify_pay: `<svg viewBox="0 0 38 24"><path d="M35 0H3C1.3 0 0 1.3 0 3v18c0 1.7 1.4 3 3 3h32c1.7 0 3-1.3 3-3V3c0-1.7-1.4-3-3-3z" fill="#5A31F4"/><path d="M21.4 7.7c-.5 0-.9.1-1.2.4-.4.3-.6.7-.7 1.2h3.6c0-.5-.2-.9-.5-1.2-.3-.3-.7-.4-1.2-.4zm2.4 2.8h-4.8c0 .6.2 1 .5 1.3.3.3.8.5 1.3.5.6 0 1.2-.3 1.6-.8l1.1.8c-.6.8-1.5 1.2-2.7 1.2-1 0-1.8-.3-2.4-.9-.6-.6-.9-1.5-.9-2.5 0-1 .3-1.9.9-2.5.6-.6 1.4-.9 2.4-.9 1 0 1.7.3 2.3.9.6.6.8 1.4.8 2.4 0 .1 0 .3-.1.5zm-9.7 2.8h1.5V7.1h-1.5v6.2zm-.8-8.2c.2.2.2.4.2.7 0 .3-.1.5-.2.7-.2.2-.4.3-.7.3-.3 0-.5-.1-.7-.3-.2-.2-.3-.4-.3-.7 0-.3.1-.5.3-.7.2-.2.4-.3.7-.3.3 0 .5.1.7.3zm-2.8 8.2h1.5V8.5h-1.5v4.8zM8 10.5c.3-.4.8-.6 1.4-.6.6 0 1.1.2 1.4.6.3.4.5 1 .5 1.8v2.3h-1.5v-2.2c0-.5-.1-.9-.3-1.1-.2-.2-.5-.4-.9-.4-.4 0-.7.2-.9.5-.2.3-.3.7-.3 1.3v1.9H6.1V7.1h1.5v3.4h.4z" fill="#fff"/></svg>`,
};

/**
 * Get payment type SVG icon
 */
export function getPaymentTypeSVG(type: string): string {
  const normalizedType = type.toLowerCase().replace(/[^a-z_]/g, '_');
  return PAYMENT_ICONS[normalizedType] || '';
}

/**
 * Generate payment type SVG tag
 */
export function paymentTypeSvgTag(type: string, className: string = ''): string {
  const svg = getPaymentTypeSVG(type);
  if (!svg) {
    return `<span class="payment-icon payment-icon--${type} ${className}">${type}</span>`;
  }

  // Add class to SVG
  return svg.replace('<svg', `<svg class="payment-icon payment-icon--${type} ${className}"`);
}

// ============================================
// ASSET BUNDLING
// ============================================

/**
 * Bundle multiple CSS files
 */
export function bundleCSS(
  assetsDir: string,
  context: { settings: Record<string, any>; themeId: string; shopHandle: string }
): string {
  const cssAssets = getCSSAssets(assetsDir);
  const bundles: string[] = [];

  for (const asset of cssAssets) {
    const loaded = loadAsset(asset.path);
    if (!loaded || !loaded.isText) continue;

    let content = loaded.content as string;

    // Process Liquid if needed
    if (asset.isLiquid) {
      content = processLiquidInAsset(content, context);
    }

    bundles.push(`/* ${asset.filename} */\n${content}`);
  }

  return bundles.join('\n\n');
}

/**
 * Bundle multiple JS files
 */
export function bundleJS(
  assetsDir: string,
  context: { settings: Record<string, any>; themeId: string; shopHandle: string }
): string {
  const jsAssets = getJSAssets(assetsDir);
  const bundles: string[] = [];

  for (const asset of jsAssets) {
    const loaded = loadAsset(asset.path);
    if (!loaded || !loaded.isText) continue;

    let content = loaded.content as string;

    // Process Liquid if needed
    if (asset.isLiquid) {
      content = processLiquidInAsset(content, context);
    }

    bundles.push(`/* ${asset.filename} */\n${content}`);
  }

  return bundles.join('\n\n');
}
