/**
 * 🎨 CSS Variables Server
 * Generates CSS custom properties from Shopify theme settings
 * Handles colors, fonts, spacing, and other design tokens
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================
// COLOR UTILITIES
// ============================================

interface RGBColor {
  r: number;
  g: number;
  b: number;
  a?: number;
}

/**
 * Parse a color string to RGB values
 */
export function parseColor(color: string | object): RGBColor | null {
  if (!color) return null;

  // Handle Shopify color objects
  if (typeof color === 'object' && 'red' in color) {
    const obj = color as any;
    return {
      r: obj.red || 0,
      g: obj.green || 0,
      b: obj.blue || 0,
      a: obj.alpha ?? 1,
    };
  }

  if (typeof color !== 'string') return null;

  // Handle hex colors
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    if (hex.length === 3) {
      return {
        r: parseInt(hex[0] + hex[0], 16),
        g: parseInt(hex[1] + hex[1], 16),
        b: parseInt(hex[2] + hex[2], 16),
      };
    }
    if (hex.length === 6) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
      };
    }
    if (hex.length === 8) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
        a: parseInt(hex.slice(6, 8), 16) / 255,
      };
    }
  }

  // Handle rgb/rgba
  const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (rgbMatch) {
    return {
      r: parseInt(rgbMatch[1]),
      g: parseInt(rgbMatch[2]),
      b: parseInt(rgbMatch[3]),
      a: rgbMatch[4] ? parseFloat(rgbMatch[4]) : 1,
    };
  }

  // Handle hsl/hsla - convert to rgb
  const hslMatch = color.match(/hsla?\((\d+),\s*([\d.]+)%,\s*([\d.]+)%(?:,\s*([\d.]+))?\)/);
  if (hslMatch) {
    const h = parseInt(hslMatch[1]) / 360;
    const s = parseFloat(hslMatch[2]) / 100;
    const l = parseFloat(hslMatch[3]) / 100;
    const a = hslMatch[4] ? parseFloat(hslMatch[4]) : 1;

    let r, g, b;
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

    return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255), a };
  }

  return null;
}

/**
 * Convert RGB to hex
 */
export function rgbToHex(rgb: RGBColor): string {
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
}

/**
 * Calculate brightness difference (WCAG)
 */
export function brightnessDifference(color1: RGBColor, color2: RGBColor): number {
  const brightness1 = (color1.r * 299 + color1.g * 587 + color1.b * 114) / 1000;
  const brightness2 = (color2.r * 299 + color2.g * 587 + color2.b * 114) / 1000;
  return Math.abs(brightness1 - brightness2);
}

/**
 * Calculate color difference
 */
export function colorDifference(color1: RGBColor, color2: RGBColor): number {
  return Math.abs(color1.r - color2.r) +
         Math.abs(color1.g - color2.g) +
         Math.abs(color1.b - color2.b);
}

/**
 * Mix two colors
 */
export function colorMix(color1: RGBColor, color2: RGBColor, weight: number = 0.5): RGBColor {
  const w = Math.max(0, Math.min(1, weight));
  return {
    r: Math.round(color1.r * (1 - w) + color2.r * w),
    g: Math.round(color1.g * (1 - w) + color2.g * w),
    b: Math.round(color1.b * (1 - w) + color2.b * w),
    a: (color1.a ?? 1) * (1 - w) + (color2.a ?? 1) * w,
  };
}

/**
 * Lighten a color
 */
export function lighten(color: RGBColor, amount: number): RGBColor {
  const white: RGBColor = { r: 255, g: 255, b: 255 };
  return colorMix(color, white, amount);
}

/**
 * Darken a color
 */
export function darken(color: RGBColor, amount: number): RGBColor {
  const black: RGBColor = { r: 0, g: 0, b: 0 };
  return colorMix(color, black, amount);
}

// ============================================
// FONT UTILITIES
// ============================================

interface FontInfo {
  family: string;
  weight: number;
  style: 'normal' | 'italic';
}

/**
 * Parse Shopify font picker value
 * Format: "font_family_nW" where n is weight digit
 * Example: "assistant_n4" -> Assistant, weight 400, normal
 * Example: "roboto_i7" -> Roboto, weight 700, italic
 */
export function parseShopifyFont(fontValue: string): FontInfo {
  if (!fontValue || typeof fontValue !== 'string') {
    return { family: 'system-ui', weight: 400, style: 'normal' };
  }

  // Check for format: family_nW or family_iW
  const match = fontValue.match(/^(.+)_([ni])(\d)$/);

  if (match) {
    const family = match[1]
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    const style = match[2] === 'i' ? 'italic' : 'normal';
    const weight = parseInt(match[3]) * 100;

    return { family, weight, style };
  }

  // Simple font name
  return {
    family: fontValue
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' '),
    weight: 400,
    style: 'normal',
  };
}

/**
 * Generate Google Fonts URL
 */
export function generateGoogleFontsUrl(fonts: FontInfo[]): string {
  const fontFamilies = new Map<string, Set<string>>();

  for (const font of fonts) {
    if (!fontFamilies.has(font.family)) {
      fontFamilies.set(font.family, new Set());
    }
    const weights = fontFamilies.get(font.family)!;

    // Add common weights
    weights.add('400');
    weights.add('500');
    weights.add('600');
    weights.add('700');

    // Add the specified weight
    weights.add(font.weight.toString());

    // Add italic if needed
    if (font.style === 'italic') {
      weights.add(`0,${font.weight}`);
    }
  }

  const familyStrings = Array.from(fontFamilies.entries()).map(([family, weights]) => {
    const sortedWeights = Array.from(weights).sort();
    return `family=${family.replace(/ /g, '+')}:wght@${sortedWeights.join(';')}`;
  });

  return `https://fonts.googleapis.com/css2?${familyStrings.join('&')}&display=swap`;
}

// ============================================
// CSS GENERATION
// ============================================

export interface CSSVariablesOptions {
  prefix?: string;
  includeDefaults?: boolean;
}

/**
 * Generate CSS variables from theme settings
 */
export function generateCSSVariables(
  settings: Record<string, any>,
  options: CSSVariablesOptions = {}
): string {
  const { prefix = '', includeDefaults = true } = options;
  const variables: string[] = [];

  // Default values
  const defaults: Record<string, string> = {
    'color-base-text': '#1a1a2e',
    'color-base-background-1': '#ffffff',
    'color-base-background-2': '#f5f5f5',
    'color-base-accent-1': '#5c5cf0',
    'color-base-accent-2': '#4a4ad9',
    'color-shadow': '#000000',
    'color-border': '#e0e0e0',
    'font-body-family': 'system-ui, -apple-system, sans-serif',
    'font-heading-family': 'system-ui, -apple-system, sans-serif',
    'font-body-weight': '400',
    'font-heading-weight': '700',
    'font-body-style': 'normal',
    'font-heading-style': 'normal',
    'font-body-scale': '1',
    'font-heading-scale': '1',
    'buttons-radius': '4px',
    'buttons-border-width': '1px',
    'inputs-radius': '4px',
    'inputs-border-width': '1px',
    'card-radius': '8px',
    'card-shadow': '0 2px 4px rgba(0, 0, 0, 0.1)',
    'page-width': '1200px',
    'spacing-unit': '1rem',
    'animation-duration': '200ms',
  };

  if (includeDefaults) {
    for (const [key, value] of Object.entries(defaults)) {
      variables.push(`--${prefix}${key}: ${value};`);
    }
  }

  // Process settings
  for (const [key, value] of Object.entries(settings)) {
    if (value === null || value === undefined) continue;

    const varName = `--${prefix}${key.replace(/_/g, '-')}`;

    // Colors
    if (typeof value === 'string' && (value.startsWith('#') || value.startsWith('rgb') || value.startsWith('hsl'))) {
      const rgb = parseColor(value);
      if (rgb) {
        variables.push(`${varName}: ${value};`);
        variables.push(`${varName}-rgb: ${rgb.r}, ${rgb.g}, ${rgb.b};`);
      }
    }
    // Color objects
    else if (typeof value === 'object' && value !== null && 'red' in value) {
      const alpha = value.alpha ?? 1;
      if (alpha < 1) {
        variables.push(`${varName}: rgba(${value.red}, ${value.green}, ${value.blue}, ${alpha});`);
      } else {
        variables.push(`${varName}: rgb(${value.red}, ${value.green}, ${value.blue});`);
      }
      variables.push(`${varName}-rgb: ${value.red}, ${value.green}, ${value.blue};`);
    }
    // Fonts
    else if (key.includes('font') && typeof value === 'string') {
      const fontInfo = parseShopifyFont(value);
      if (key.includes('_family') || key.endsWith('font')) {
        variables.push(`${varName}: "${fontInfo.family}", system-ui, sans-serif;`);
        variables.push(`${varName.replace('-family', '-weight')}: ${fontInfo.weight};`);
        variables.push(`${varName.replace('-family', '-style')}: ${fontInfo.style};`);
      }
    }
    // Numbers
    else if (typeof value === 'number') {
      // Determine unit based on key
      let unit = '';
      if (key.includes('width') || key.includes('height') || key.includes('size') ||
          key.includes('radius') || key.includes('spacing') || key.includes('padding') ||
          key.includes('margin') || key.includes('gap')) {
        unit = 'px';
      } else if (key.includes('opacity') || key.includes('scale')) {
        // No unit for opacity/scale
      } else if (key.includes('duration') || key.includes('delay')) {
        unit = 'ms';
      }
      variables.push(`${varName}: ${value}${unit};`);
    }
    // Booleans
    else if (typeof value === 'boolean') {
      variables.push(`${varName}: ${value ? '1' : '0'};`);
    }
    // Strings
    else if (typeof value === 'string' && value.length > 0) {
      // Don't quote URLs or colors
      if (value.startsWith('http') || value.startsWith('/') || value.startsWith('#')) {
        variables.push(`${varName}: ${value};`);
      } else {
        variables.push(`${varName}: "${value}";`);
      }
    }
  }

  return variables.join('\n  ');
}

// ============================================
// COLOR SCHEME GENERATION
// ============================================

export interface ColorScheme {
  id: string;
  background: string;
  text: string;
  accent: string;
  button: string;
  buttonText: string;
  shadow: string;
}

/**
 * Generate CSS for a color scheme
 */
export function generateColorSchemeCSS(scheme: ColorScheme): string {
  return `
.color-${scheme.id} {
  --color-background: ${scheme.background};
  --color-foreground: ${scheme.text};
  --color-accent: ${scheme.accent};
  --color-button: ${scheme.button};
  --color-button-text: ${scheme.buttonText};
  --color-shadow: ${scheme.shadow};
  background-color: var(--color-background);
  color: var(--color-foreground);
}`;
}

/**
 * Parse and generate color schemes from settings
 */
export function generateColorSchemes(settings: Record<string, any>): string {
  const schemes: string[] = [];

  // Look for color_scheme_* patterns in settings
  const schemeMap = new Map<string, Partial<ColorScheme>>();

  for (const [key, value] of Object.entries(settings)) {
    const schemeMatch = key.match(/^colors_(\w+)_(\w+)$/);
    if (schemeMatch) {
      const [, schemeId, property] = schemeMatch;
      if (!schemeMap.has(schemeId)) {
        schemeMap.set(schemeId, { id: schemeId });
      }
      const scheme = schemeMap.get(schemeId)!;

      const rgb = parseColor(value);
      if (rgb) {
        const hex = rgbToHex(rgb);
        switch (property) {
          case 'background':
            scheme.background = hex;
            break;
          case 'text':
          case 'foreground':
            scheme.text = hex;
            break;
          case 'accent':
            scheme.accent = hex;
            break;
          case 'button':
            scheme.button = hex;
            break;
          case 'button_text':
            scheme.buttonText = hex;
            break;
          case 'shadow':
            scheme.shadow = hex;
            break;
        }
      }
    }
  }

  // Generate CSS for each scheme
  for (const scheme of schemeMap.values()) {
    if (scheme.background && scheme.text) {
      schemes.push(generateColorSchemeCSS({
        id: scheme.id!,
        background: scheme.background,
        text: scheme.text,
        accent: scheme.accent || scheme.text,
        button: scheme.button || scheme.accent || '#1a1a2e',
        buttonText: scheme.buttonText || '#ffffff',
        shadow: scheme.shadow || '#000000',
      }));
    }
  }

  return schemes.join('\n');
}

// ============================================
// COMPLETE CSS GENERATION
// ============================================

/**
 * Generate complete CSS from theme settings
 */
export function generateThemeCSS(
  themeDir: string,
  settings: Record<string, any>
): { css: string; fonts: string } {
  // Collect fonts
  const fonts: FontInfo[] = [];
  for (const [key, value] of Object.entries(settings)) {
    if (key.includes('font') && typeof value === 'string') {
      fonts.push(parseShopifyFont(value));
    }
  }

  // Generate fonts link
  const fontsUrl = fonts.length > 0 ? generateGoogleFontsUrl(fonts) : '';
  const fontsLink = fontsUrl ? `<link rel="stylesheet" href="${fontsUrl}">` : '';

  // Generate CSS variables
  const cssVariables = generateCSSVariables(settings);

  // Generate color schemes
  const colorSchemes = generateColorSchemes(settings);

  // Generate complete CSS
  const css = `
/* VSBuilder Theme CSS - Auto-Generated */
:root {
  ${cssVariables}
}

/* Color Schemes */
${colorSchemes}

/* Base Styles */
*, *::before, *::after {
  box-sizing: border-box;
}

html {
  font-size: calc(var(--font-body-scale, 1) * 100%);
  scroll-behavior: smooth;
}

body {
  font-family: var(--font-body-family);
  font-weight: var(--font-body-weight, 400);
  font-style: var(--font-heading-style, normal);
  line-height: 1.6;
  color: var(--color-base-text);
  background-color: var(--color-base-background-1);
  margin: 0;
  padding: 0;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

h1, h2, h3, h4, h5, h6 {
  font-family: var(--font-heading-family);
  font-weight: var(--font-heading-weight, 700);
  font-style: var(--font-heading-style, normal);
  line-height: 1.2;
  margin-top: 0;
  color: var(--color-base-text);
}

h1 { font-size: calc(var(--font-heading-scale, 1) * 2.5rem); }
h2 { font-size: calc(var(--font-heading-scale, 1) * 2rem); }
h3 { font-size: calc(var(--font-heading-scale, 1) * 1.5rem); }
h4 { font-size: calc(var(--font-heading-scale, 1) * 1.25rem); }
h5 { font-size: calc(var(--font-heading-scale, 1) * 1rem); }
h6 { font-size: calc(var(--font-heading-scale, 1) * 0.875rem); }

a {
  color: var(--color-base-accent-1);
  text-decoration: none;
  transition: color var(--animation-duration, 200ms) ease;
}

a:hover {
  color: var(--color-base-accent-2);
}

img, video, svg {
  max-width: 100%;
  height: auto;
  display: block;
}

button {
  font-family: inherit;
  cursor: pointer;
}

/* Layout */
.page-width {
  max-width: var(--page-width);
  margin: 0 auto;
  padding: 0 var(--spacing-unit);
}

/* Grid System */
.grid {
  display: grid;
  gap: var(--spacing-unit);
}

.grid--1-col { grid-template-columns: 1fr; }
.grid--2-col { grid-template-columns: repeat(2, 1fr); }
.grid--3-col { grid-template-columns: repeat(3, 1fr); }
.grid--4-col { grid-template-columns: repeat(4, 1fr); }
.grid--5-col { grid-template-columns: repeat(5, 1fr); }
.grid--6-col { grid-template-columns: repeat(6, 1fr); }

@media (max-width: 989px) {
  .grid--2-col, .grid--3-col, .grid--4-col, .grid--5-col, .grid--6-col {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 749px) {
  .grid--2-col, .grid--3-col, .grid--4-col, .grid--5-col, .grid--6-col {
    grid-template-columns: 1fr;
  }
}

/* Buttons */
.button, .btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  font-size: 0.875rem;
  font-weight: 600;
  text-align: center;
  text-decoration: none;
  border: var(--buttons-border-width, 1px) solid transparent;
  border-radius: var(--buttons-radius, 4px);
  background-color: var(--color-base-accent-1);
  color: #ffffff;
  cursor: pointer;
  transition: all var(--animation-duration, 200ms) ease;
}

.button:hover, .btn:hover {
  background-color: var(--color-base-accent-2);
  color: #ffffff;
}

.button--secondary {
  background-color: transparent;
  border-color: var(--color-base-accent-1);
  color: var(--color-base-accent-1);
}

.button--secondary:hover {
  background-color: var(--color-base-accent-1);
  color: #ffffff;
}

/* Cards */
.card {
  border-radius: var(--card-radius, 8px);
  box-shadow: var(--card-shadow);
  background-color: var(--color-base-background-1);
  overflow: hidden;
}

/* Inputs */
input, textarea, select {
  font-family: inherit;
  font-size: 1rem;
  padding: 0.75rem 1rem;
  border: var(--inputs-border-width, 1px) solid var(--color-border);
  border-radius: var(--inputs-radius, 4px);
  background-color: var(--color-base-background-1);
  color: var(--color-base-text);
  transition: border-color var(--animation-duration, 200ms) ease;
}

input:focus, textarea:focus, select:focus {
  outline: none;
  border-color: var(--color-base-accent-1);
}

/* Sections */
.shopify-section {
  position: relative;
}

/* Section hover for editor */
.shopify-section[data-editor-selectable]:hover {
  outline: 2px dashed var(--color-base-accent-1);
  outline-offset: -2px;
}

/* Visually Hidden */
.visually-hidden {
  position: absolute !important;
  width: 1px !important;
  height: 1px !important;
  padding: 0 !important;
  margin: -1px !important;
  overflow: hidden !important;
  clip: rect(0, 0, 0, 0) !important;
  white-space: nowrap !important;
  border: 0 !important;
}

/* Skip Link */
.skip-to-content-link {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%) translateY(-100%);
  padding: 0.5rem 1rem;
  background: var(--color-base-accent-1);
  color: #fff;
  z-index: 9999;
  transition: transform 0.2s;
}

.skip-to-content-link:focus {
  transform: translateX(-50%) translateY(0);
}

/* Animation Classes */
@media (prefers-reduced-motion: no-preference) {
  .animate-fade-in {
    animation: fadeIn var(--animation-duration, 200ms) ease forwards;
  }

  .animate-slide-up {
    animation: slideUp var(--animation-duration, 200ms) ease forwards;
  }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Utility Classes */
.full-width { width: 100%; }
.text-center { text-align: center; }
.text-left { text-align: left; }
.text-right { text-align: right; }
.flex { display: flex; }
.flex-wrap { flex-wrap: wrap; }
.items-center { align-items: center; }
.justify-center { justify-content: center; }
.justify-between { justify-content: space-between; }
.gap-1 { gap: 0.25rem; }
.gap-2 { gap: 0.5rem; }
.gap-4 { gap: 1rem; }
.gap-6 { gap: 1.5rem; }
.gap-8 { gap: 2rem; }
`;

  return { css, fonts: fontsLink };
}

/**
 * Load settings from theme and generate CSS
 */
export function generateThemeCSSFromDir(themeDir: string): { css: string; fonts: string } {
  const settingsPath = path.join(themeDir, 'config', 'settings_data.json');

  let settings: Record<string, any> = {};

  if (fs.existsSync(settingsPath)) {
    try {
      const content = fs.readFileSync(settingsPath, 'utf-8');
      // Strip comments
      const cleanContent = content.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(?<!:)\/\/[^\n]*/g, '');
      const data = JSON.parse(cleanContent);
      settings = data.current || data.presets?.Default || {};
    } catch (error) {
      console.error('[CSSVariables] Failed to load settings:', error);
    }
  }

  return generateThemeCSS(themeDir, settings);
}
