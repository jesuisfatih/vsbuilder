/**
 * 🎨 VSBuilder App Proxy Editor
 * ============================
 * Full-screen editor via App Proxy - bypasses all iframe restrictions
 * Serves complete React editor with live Liquid preview
 */
import { type LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { downloadThemeForEditor, isThemeSavedLocally } from "../utils/theme.server";

// Available template types
const TEMPLATE_TYPES = [
  { value: "index", label: "Home page" },
  { value: "product", label: "Product pages" },
  { value: "collection", label: "Collection pages" },
  { value: "page", label: "Pages" },
  { value: "blog", label: "Blog" },
  { value: "article", label: "Article" },
  { value: "cart", label: "Cart" },
  { value: "search", label: "Search results" },
  { value: "404", label: "404 page" },
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const { admin, session } = await authenticate.public.appProxy(request);

    if (!session) {
      return new Response("Unauthorized: Invalid signature", { status: 401 });
    }

    const url = new URL(request.url);
    const themeId = url.searchParams.get("themeId") || "";
    const template = url.searchParams.get("template") || "index";

    // Clean themeId
    const cleanThemeId = themeId.replace('gid://shopify/OnlineStoreTheme/', '').replace('gid://shopify/Theme/', '');
    const shopHandle = session.shop.replace(".myshopify.com", "");

    // Check if theme is synced locally
    const isSynced = cleanThemeId ? isThemeSavedLocally(shopHandle, cleanThemeId) : false;

    // Get theme data if we have admin access and themeId
    let themeData = null;
    let themeName = "Unknown Theme";
    let templateSections: string[] = [];
    let headerSections: string[] = [];
    let footerSections: string[] = [];
    let sectionsJson = "{}";

    if (admin && cleanThemeId) {
      try {
        themeData = await downloadThemeForEditor(admin, cleanThemeId, template);
        if (themeData) {
          themeName = themeData.theme.name;
          templateSections = themeData.template.order || [];
          headerSections = themeData.header.order || [];
          footerSections = themeData.footer.order || [];

          // Prepare sections data for JS
          const allSections = {
            template: themeData.template,
            header: themeData.header,
            footer: themeData.footer,
          };
          sectionsJson = JSON.stringify(allSections).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
        }
      } catch (e) {
        console.error("[ProxyEditor] Theme download error:", e);
      }
    }

    // Build section list HTML
    const buildSectionItem = (id: string, sections: any, type: string) => {
      const section = sections?.sections?.[id];
      const sectionType = section?.type || id;
      const isDisabled = section?.disabled === true;
      return `
        <div class="section-item ${isDisabled ? 'disabled' : ''}"
             data-section-id="${id}"
             data-section-type="${sectionType}"
             data-group="${type}"
             onclick="selectSection('${id}', '${type}')">
          <div class="section-icon">${getSectionIcon(sectionType)}</div>
          <span class="section-name">${formatSectionName(sectionType)}</span>
          ${isDisabled ? '<span class="disabled-badge">Hidden</span>' : ''}
        </div>
      `;
    };

    const headerSectionsHtml = themeData ? headerSections.map(id =>
      buildSectionItem(id, themeData.header, 'header')
    ).join('') : '';

    const templateSectionsHtml = themeData ? templateSections.map(id =>
      buildSectionItem(id, themeData.template, 'template')
    ).join('') : '';

    const footerSectionsHtml = themeData ? footerSections.map(id =>
      buildSectionItem(id, themeData.footer, 'footer')
    ).join('') : '';

    const templateOptions = TEMPLATE_TYPES.map(t => `
      <option value="${t.value}" ${t.value === template ? 'selected' : ''}>${t.label}</option>
    `).join('');

    // Local render URL
    const localRenderUrl = `/apps/vsbuilder/render?themeId=${cleanThemeId}&template=${template}`;

    return new Response(`
{% layout none %}
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>VSBuilder Editor - ${themeName}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      height: 100%;
      overflow: hidden;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    }
    body {
      background: #0f0f1a;
      color: #e0e0e0;
    }

    /* Layout */
    .editor-layout {
      display: flex;
      height: 100vh;
    }

    /* Sidebar */
    .sidebar {
      width: 320px;
      background: linear-gradient(180deg, #1a1a2e 0%, #16213e 100%);
      display: flex;
      flex-direction: column;
      border-right: 1px solid rgba(255,255,255,0.08);
    }

    .sidebar-header {
      padding: 16px 20px;
      background: rgba(0,0,0,0.3);
      border-bottom: 1px solid rgba(255,255,255,0.08);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .logo {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .logo-icon {
      width: 32px;
      height: 32px;
      background: linear-gradient(135deg, #8b5cf6, #06b6d4);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
    }

    .logo-text {
      font-size: 18px;
      font-weight: 700;
      background: linear-gradient(135deg, #8b5cf6, #06b6d4);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .exit-btn {
      background: rgba(255,255,255,0.1);
      border: none;
      color: #aaa;
      padding: 8px 12px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      transition: all 0.2s;
    }

    .exit-btn:hover {
      background: rgba(255,255,255,0.15);
      color: #fff;
    }

    /* Theme Info Bar */
    .theme-bar {
      padding: 12px 20px;
      background: rgba(139, 92, 246, 0.1);
      border-bottom: 1px solid rgba(255,255,255,0.08);
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .theme-name {
      font-weight: 600;
      color: #8b5cf6;
      flex: 1;
    }

    .theme-role {
      font-size: 11px;
      padding: 2px 8px;
      background: #8b5cf6;
      color: white;
      border-radius: 4px;
      text-transform: uppercase;
    }

    /* Template Selector */
    .template-selector {
      padding: 12px 20px;
      border-bottom: 1px solid rgba(255,255,255,0.08);
    }

    .template-select {
      width: 100%;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      color: #e0e0e0;
      padding: 10px 12px;
      border-radius: 8px;
      font-size: 14px;
      cursor: pointer;
    }

    .template-select:focus {
      outline: none;
      border-color: #8b5cf6;
    }

    /* Search Box */
    .search-box {
      padding: 12px 20px;
      border-bottom: 1px solid rgba(255,255,255,0.08);
    }

    .search-input {
      width: 100%;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      color: #e0e0e0;
      padding: 10px 12px 10px 36px;
      border-radius: 8px;
      font-size: 14px;
    }

    .search-input::placeholder {
      color: #666;
    }

    .search-input:focus {
      outline: none;
      border-color: #8b5cf6;
    }

    /* Section Groups */
    .sections-container {
      flex: 1;
      overflow-y: auto;
      padding: 16px 12px;
    }

    .section-group {
      margin-bottom: 20px;
    }

    .group-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 12px;
      margin-bottom: 8px;
    }

    .group-title {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      color: #888;
      letter-spacing: 0.5px;
    }

    .add-section-btn {
      background: transparent;
      border: none;
      color: #8b5cf6;
      font-size: 18px;
      cursor: pointer;
      padding: 4px;
      border-radius: 4px;
      transition: all 0.2s;
    }

    .add-section-btn:hover {
      background: rgba(139, 92, 246, 0.2);
    }

    /* Section Items */
    .section-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      margin: 4px 8px;
      background: rgba(255,255,255,0.03);
      border: 1px solid transparent;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .section-item:hover {
      background: rgba(139, 92, 246, 0.1);
      border-color: rgba(139, 92, 246, 0.3);
    }

    .section-item.selected {
      background: rgba(139, 92, 246, 0.2);
      border-color: #8b5cf6;
    }

    .section-item.disabled {
      opacity: 0.5;
    }

    .section-icon {
      width: 28px;
      height: 28px;
      background: linear-gradient(135deg, #8b5cf6, #06b6d4);
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
    }

    .section-name {
      flex: 1;
      font-size: 13px;
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .disabled-badge {
      font-size: 10px;
      padding: 2px 6px;
      background: rgba(255,255,255,0.1);
      border-radius: 4px;
      color: #888;
    }

    /* Main Content */
    .main-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      background: #0a0a0f;
    }

    /* Toolbar */
    .toolbar {
      height: 56px;
      background: rgba(0,0,0,0.5);
      border-bottom: 1px solid rgba(255,255,255,0.08);
      display: flex;
      align-items: center;
      padding: 0 20px;
      gap: 16px;
    }

    .toolbar-group {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .toolbar-btn {
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      color: #aaa;
      padding: 8px 12px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: all 0.2s;
    }

    .toolbar-btn:hover {
      background: rgba(255,255,255,0.1);
      color: #fff;
    }

    .toolbar-btn.primary {
      background: linear-gradient(135deg, #8b5cf6, #7c3aed);
      border-color: transparent;
      color: white;
    }

    .toolbar-btn.primary:hover {
      background: linear-gradient(135deg, #9f7aea, #8b5cf6);
    }

    .url-bar {
      flex: 1;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 8px;
      padding: 8px 12px;
      color: #666;
      font-size: 13px;
      font-family: 'SF Mono', Monaco, monospace;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .url-bar .lock-icon {
      color: #10b981;
    }

    .device-switcher {
      display: flex;
      background: rgba(255,255,255,0.05);
      border-radius: 8px;
      padding: 4px;
    }

    .device-btn {
      background: transparent;
      border: none;
      color: #666;
      padding: 8px 12px;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .device-btn.active {
      background: #8b5cf6;
      color: white;
    }

    .device-btn:hover:not(.active) {
      color: #fff;
    }

    /* Preview Area */
    .preview-container {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      background: linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 100%);
      overflow: hidden;
    }

    .preview-frame {
      width: 100%;
      height: 100%;
      max-width: 100%;
      background: #fff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 25px 80px rgba(0,0,0,0.5);
      transition: all 0.3s ease;
    }

    .preview-frame.tablet {
      max-width: 768px;
    }

    .preview-frame.mobile {
      max-width: 375px;
    }

    .preview-iframe {
      width: 100%;
      height: 100%;
      border: none;
      background: #fff;
    }

    /* Sync Overlay */
    .sync-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }

    .sync-modal {
      background: #1a1a2e;
      border-radius: 16px;
      padding: 40px;
      text-align: center;
      max-width: 400px;
    }

    .sync-spinner {
      width: 48px;
      height: 48px;
      border: 3px solid rgba(139, 92, 246, 0.2);
      border-top-color: #8b5cf6;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 20px;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .sync-title {
      font-size: 18px;
      font-weight: 600;
      color: #fff;
      margin-bottom: 8px;
    }

    .sync-text {
      color: #888;
      font-size: 14px;
    }

    /* Settings Panel */
    .settings-panel {
      width: 350px;
      background: #16213e;
      border-left: 1px solid rgba(255,255,255,0.08);
      display: flex;
      flex-direction: column;
    }

    .settings-header {
      padding: 16px 20px;
      background: rgba(0,0,0,0.3);
      border-bottom: 1px solid rgba(255,255,255,0.08);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .settings-title {
      font-size: 14px;
      font-weight: 600;
    }

    .close-settings {
      background: transparent;
      border: none;
      color: #888;
      font-size: 20px;
      cursor: pointer;
    }

    .settings-content {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
    }

    .setting-group {
      margin-bottom: 20px;
    }

    .setting-label {
      font-size: 12px;
      color: #888;
      margin-bottom: 8px;
      text-transform: uppercase;
    }

    .setting-input {
      width: 100%;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      color: #e0e0e0;
      padding: 10px 12px;
      border-radius: 8px;
      font-size: 14px;
    }

    .setting-input:focus {
      outline: none;
      border-color: #8b5cf6;
    }

    /* Error State */
    .error-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      text-align: center;
      padding: 40px;
    }

    .error-icon {
      font-size: 64px;
      margin-bottom: 20px;
    }

    .error-title {
      font-size: 24px;
      font-weight: 600;
      color: #f43f5e;
      margin-bottom: 12px;
    }

    .error-text {
      color: #888;
      margin-bottom: 24px;
      max-width: 400px;
      line-height: 1.6;
    }

    /* Animation */
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .animate-in {
      animation: fadeIn 0.3s ease-out;
    }
  </style>
</head>
<body>
  <!-- Sync Overlay -->
  ${!isSynced && cleanThemeId ? `
  <div class="sync-overlay" id="syncOverlay">
    <div class="sync-modal">
      <div class="sync-spinner"></div>
      <div class="sync-title">Syncing Theme Files...</div>
      <div class="sync-text">This may take a minute for first-time setup</div>
    </div>
  </div>
  ` : ''}

  <div class="editor-layout">
    <!-- Sidebar -->
    <aside class="sidebar">
      <div class="sidebar-header">
        <div class="logo">
          <div class="logo-icon">✨</div>
          <span class="logo-text">VSBuilder</span>
        </div>
        <button class="exit-btn" onclick="exitEditor()">✕ Exit</button>
      </div>

      <div class="theme-bar">
        <span class="theme-name">${themeName}</span>
        <span class="theme-role">Draft</span>
      </div>

      <div class="template-selector">
        <select class="template-select" onchange="changeTemplate(this.value)">
          ${templateOptions}
        </select>
      </div>

      <div class="search-box">
        <input type="text" class="search-input" placeholder="Search sections..." oninput="filterSections(this.value)">
      </div>

      <div class="sections-container">
        <!-- Header Group -->
        <div class="section-group" data-group="header">
          <div class="group-header">
            <span class="group-title">Header</span>
            <button class="add-section-btn" onclick="addSection('header')">+</button>
          </div>
          ${headerSectionsHtml || '<div class="section-item"><span class="section-name" style="color:#666">No sections</span></div>'}
        </div>

        <!-- Template Group -->
        <div class="section-group" data-group="template">
          <div class="group-header">
            <span class="group-title">Template</span>
            <button class="add-section-btn" onclick="addSection('template')">+</button>
          </div>
          ${templateSectionsHtml || '<div class="section-item"><span class="section-name" style="color:#666">No sections</span></div>'}
        </div>

        <!-- Footer Group -->
        <div class="section-group" data-group="footer">
          <div class="group-header">
            <span class="group-title">Footer</span>
            <button class="add-section-btn" onclick="addSection('footer')">+</button>
          </div>
          ${footerSectionsHtml || '<div class="section-item"><span class="section-name" style="color:#666">No sections</span></div>'}
        </div>
      </div>
    </aside>

    <!-- Main Content -->
    <main class="main-content">
      <div class="toolbar">
        <div class="toolbar-group">
          <button class="toolbar-btn" onclick="undo()" title="Undo">↩</button>
          <button class="toolbar-btn" onclick="redo()" title="Redo">↪</button>
        </div>

        <div class="url-bar">
          <span class="lock-icon">🔒</span>
          <span>${session.shop}/?preview_theme_id=${cleanThemeId}</span>
        </div>

        <div class="device-switcher">
          <button class="device-btn active" onclick="setDevice('desktop')" data-device="desktop">💻</button>
          <button class="device-btn" onclick="setDevice('tablet')" data-device="tablet">📱</button>
          <button class="device-btn" onclick="setDevice('mobile')" data-device="mobile">📲</button>
        </div>

        <div class="toolbar-group">
          <button class="toolbar-btn" onclick="refreshPreview()">↻ Refresh</button>
          <button class="toolbar-btn" onclick="openPreviewTab()">↗ Open</button>
          <button class="toolbar-btn primary" onclick="saveTheme()">💾 Save</button>
        </div>
      </div>

      <div class="preview-container">
        <div class="preview-frame" id="previewFrame">
          ${cleanThemeId ? `
          <iframe
            id="previewIframe"
            class="preview-iframe"
            src="${localRenderUrl}"
            sandbox="allow-same-origin allow-scripts allow-forms"
          ></iframe>
          ` : `
          <div class="error-state">
            <div class="error-icon">🎨</div>
            <div class="error-title">No Theme Selected</div>
            <div class="error-text">Please select a theme from the dashboard to start editing.</div>
            <button class="toolbar-btn primary" onclick="exitEditor()">Go to Dashboard</button>
          </div>
          `}
        </div>
      </div>
    </main>

    <!-- Settings Panel (Hidden by default) -->
    <aside class="settings-panel" id="settingsPanel" style="display: none;">
      <div class="settings-header">
        <span class="settings-title" id="settingsTitle">Section Settings</span>
        <button class="close-settings" onclick="closeSettings()">×</button>
      </div>
      <div class="settings-content" id="settingsContent">
        <!-- Dynamic settings will be rendered here -->
      </div>
    </aside>
  </div>

  <script>
    // Editor State
    const editorState = {
      themeId: '${cleanThemeId}',
      shop: '${session.shop}',
      shopHandle: '${shopHandle}',
      template: '${template}',
      sections: ${sectionsJson},
      selectedSection: null,
      selectedGroup: null,
      device: 'desktop',
      isDirty: false,
    };

    // Section icons mapping
    function getSectionIcon(type) {
      const icons = {
        'header': '🔝',
        'footer': '🔲',
        'slideshow': '🖼️',
        'image-banner': '🖼️',
        'featured-collection': '✨',
        'featured-product': '💎',
        'rich-text': '📝',
        'multicolumn': '▦',
        'newsletter': '📧',
        'testimonials': '💬',
        'video': '🎬',
        'collapsible-content': '📋',
        'contact-form': '✉️',
      };
      for (const [key, icon] of Object.entries(icons)) {
        if (type.toLowerCase().includes(key)) return icon;
      }
      return '📦';
    }

    // Format section name
    function formatSectionName(type) {
      return type
        .replace(/[-_]/g, ' ')
        .replace(/dynamic\s*/i, '')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
        .substring(0, 25);
    }

    // Select Section
    function selectSection(id, group) {
      document.querySelectorAll('.section-item').forEach(el => el.classList.remove('selected'));
      const item = document.querySelector(\`[data-section-id="\${id}"]\`);
      if (item) item.classList.add('selected');

      editorState.selectedSection = id;
      editorState.selectedGroup = group;

      // Highlight in iframe
      const iframe = document.getElementById('previewIframe');
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage({
          type: 'vsbuilder:highlight',
          sectionId: id
        }, '*');
      }

      // Show settings panel
      openSettings(id, group);
    }

    // Open Settings Panel
    function openSettings(id, group) {
      const panel = document.getElementById('settingsPanel');
      const title = document.getElementById('settingsTitle');
      const content = document.getElementById('settingsContent');

      const sections = editorState.sections[group]?.sections || {};
      const section = sections[id];

      if (section) {
        title.textContent = formatSectionName(section.type || id);
        content.innerHTML = generateSettingsForm(section);
        panel.style.display = 'flex';
      }
    }

    // Generate Settings Form
    function generateSettingsForm(section) {
      const settings = section.settings || {};
      let html = '';

      for (const [key, value] of Object.entries(settings)) {
        html += \`
          <div class="setting-group">
            <label class="setting-label">\${key.replace(/_/g, ' ')}</label>
            <input
              type="text"
              class="setting-input"
              value="\${String(value).replace(/"/g, '&quot;')}"
              data-setting="\${key}"
              onchange="updateSetting('\${key}', this.value)"
            >
          </div>
        \`;
      }

      return html || '<p style="color:#666">No settings available</p>';
    }

    // Update Setting
    function updateSetting(key, value) {
      if (!editorState.selectedSection || !editorState.selectedGroup) return;

      const group = editorState.selectedGroup;
      const id = editorState.selectedSection;

      if (editorState.sections[group]?.sections?.[id]?.settings) {
        editorState.sections[group].sections[id].settings[key] = value;
        editorState.isDirty = true;
        refreshPreview();
      }
    }

    // Close Settings
    function closeSettings() {
      document.getElementById('settingsPanel').style.display = 'none';
      editorState.selectedSection = null;
      editorState.selectedGroup = null;
    }

    // Device Switching
    function setDevice(device) {
      editorState.device = device;
      const frame = document.getElementById('previewFrame');
      frame.classList.remove('tablet', 'mobile');
      if (device !== 'desktop') frame.classList.add(device);

      document.querySelectorAll('.device-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.device === device);
      });
    }

    // Refresh Preview
    function refreshPreview() {
      const iframe = document.getElementById('previewIframe');
      if (iframe) {
        const url = new URL(iframe.src);
        url.searchParams.set('_t', Date.now()); // Cache bust
        iframe.src = url.toString();
      }
    }

    // Open Preview Tab
    function openPreviewTab() {
      const url = \`https://\${editorState.shop}/?preview_theme_id=\${editorState.themeId}\`;
      window.open(url, '_blank');
    }

    // Change Template
    function changeTemplate(template) {
      const url = new URL(window.location.href);
      url.searchParams.set('template', template);
      window.location.href = url.toString();
    }

    // Filter Sections
    function filterSections(query) {
      const q = query.toLowerCase();
      document.querySelectorAll('.section-item').forEach(el => {
        const name = el.querySelector('.section-name')?.textContent?.toLowerCase() || '';
        el.style.display = name.includes(q) ? 'flex' : 'none';
      });
    }

    // Add Section (placeholder)
    function addSection(group) {
      alert('Add section to ' + group + ' - Coming soon!');
    }

    // Save Theme
    function saveTheme() {
      alert('Save functionality - Coming soon!');
      editorState.isDirty = false;
    }

    // Undo/Redo (placeholder)
    function undo() { alert('Undo - Coming soon!'); }
    function redo() { alert('Redo - Coming soon!'); }

    // Exit Editor
    function exitEditor() {
      if (editorState.isDirty) {
        if (!confirm('You have unsaved changes. Are you sure you want to exit?')) {
          return;
        }
      }
      window.location.href = '/';
    }

    // Sync Theme on Load
    document.addEventListener('DOMContentLoaded', async () => {
      const syncOverlay = document.getElementById('syncOverlay');
      if (syncOverlay && editorState.themeId) {
        try {
          const response = await fetch('/apps/vsbuilder/sync?themeId=' + editorState.themeId, {
            method: 'POST'
          });

          if (response.ok) {
            syncOverlay.style.display = 'none';
            refreshPreview();
          } else {
            syncOverlay.innerHTML = \`
              <div class="sync-modal">
                <div class="error-icon">⚠️</div>
                <div class="sync-title">Sync Failed</div>
                <div class="sync-text">Could not sync theme files. Please try again.</div>
                <button class="toolbar-btn primary" onclick="location.reload()">Retry</button>
              </div>
            \`;
          }
        } catch (err) {
          console.error('Sync error:', err);
          syncOverlay.style.display = 'none';
        }
      }

      // Listen for messages from iframe
      window.addEventListener('message', (e) => {
        if (e.data.type === 'vsbuilder:ready') {
          console.log('Preview ready');
        }
        if (e.data.type === 'vsbuilder:sectionClick') {
          selectSection(e.data.sectionId, e.data.group);
        }
      });
    });
  </script>
</body>
</html>
    `, {
      headers: {
        "Content-Type": "application/liquid"
      }
    });

  } catch (error) {
    console.error("[ProxyEditor] Error:", error);
    return new Response(`
      {% layout none %}
      <!DOCTYPE html>
      <html>
      <head><title>Error</title></head>
      <body style="font-family: system-ui; padding: 2rem; background: #1a1a2e; color: #e0e0e0;">
        <h1 style="color: #f43f5e;">Editor Error</h1>
        <p>${error instanceof Error ? error.message : "Unknown error"}</p>
        <p><a href="/" style="color: #8b5cf6;">Go Back</a></p>
      </body>
      </html>
    `, {
      status: 500,
      headers: { "Content-Type": "application/liquid" }
    });
  }
};

// Helper functions
function getSectionIcon(type: string): string {
  const icons: Record<string, string> = {
    'header': '🔝',
    'footer': '🔲',
    'slideshow': '🖼️',
    'image-banner': '🖼️',
    'featured-collection': '✨',
    'featured-product': '💎',
    'rich-text': '📝',
    'multicolumn': '▦',
    'newsletter': '📧',
    'testimonials': '💬',
    'video': '🎬',
    'collapsible-content': '📋',
    'contact-form': '✉️',
  };
  for (const [key, icon] of Object.entries(icons)) {
    if (type.toLowerCase().includes(key)) return icon;
  }
  return '📦';
}

function formatSectionName(type: string): string {
  return type
    .replace(/[-_]/g, ' ')
    .replace(/dynamic\s*/i, '')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
    .substring(0, 25);
}
