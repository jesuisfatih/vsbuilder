import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BUILD_DIR = path.join(__dirname, '../build/client/assets');
const EXTENSION_DIR = path.join(__dirname, '../extensions/theme-extension/assets');

// Ensure directories exist
if (!fs.existsSync(BUILD_DIR)) {
  console.error('Build directory not found. Run npm run build first.');
  process.exit(1);
}

if (!fs.existsSync(EXTENSION_DIR)) {
  fs.mkdirSync(EXTENSION_DIR, { recursive: true });
}

// Clean extension assets
const existingFiles = fs.readdirSync(EXTENSION_DIR);
for (const file of existingFiles) {
  fs.unlinkSync(path.join(EXTENSION_DIR, file));
}

// Copy new assets
const files = fs.readdirSync(BUILD_DIR);
let cssFile = '';
let jsFiles = [];

for (const file of files) {
  const src = path.join(BUILD_DIR, file);
  const dest = path.join(EXTENSION_DIR, file);

  // Copy file
  fs.copyFileSync(src, dest);
  console.log(`Copied ${file} to extension assets.`);

  if (file.endsWith('.css')) {
    cssFile = file;
  }
  if (file.endsWith('.js')) {
    jsFiles.push(file);
  }
}

// Generate liquid embed block
const liquidContent = `{% if request.path contains '/apps/vsbuilder/editor' %}
  <!-- Auto-generated assets from build -->
  ${cssFile ? `<link rel="stylesheet" href="{{ '${cssFile}' | asset_url }}">` : ''}
  ${jsFiles.filter(f => f.includes('entry') || f.includes('root') || f.includes('proxy')).map(f => `<script type="module" src="{{ '${f}' | asset_url }}"></script>`).join('\n  ')}

  <script>
    window.ENV = window.ENV || {};
    window.ENV.SHOPIFY_APP_URL = "https://vsbuilder.techifyboost.com";
  </script>
{% endif %}

{% schema %}
{
  "name": "VSBuilder Core",
  "target": "head",
  "settings": []
}
{% endschema %}
`;

fs.writeFileSync(path.join(__dirname, '../extensions/theme-extension/blocks/editor_embed.liquid'), liquidContent);
console.log('Generated editor_embed.liquid block.');
