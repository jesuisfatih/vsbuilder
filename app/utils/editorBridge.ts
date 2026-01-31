/**
 * 🌉 Editor Bridge Script
 * Injected into preview iframe for communication with editor
 * Handles section/block selection, highlighting, and real-time updates
 */

// This script is injected into the preview iframe

export const editorBridgeScript = `
<script>
(function() {
  'use strict';

  // ============================================
  // CONFIGURATION
  // ============================================

  const CONFIG = {
    highlightColor: '#5c5cf0',
    highlightWidth: 2,
    selectColor: '#5c5cf0',
    selectWidth: 3,
    hoverTransition: '150ms',
    zIndex: 9999,
  };

  // ============================================
  // STATE
  // ============================================

  window.VSBuilderBridge = {
    ready: false,
    selectedSection: null,
    selectedBlock: null,
    hoveredSection: null,
    hoveredBlock: null,
  };

  // ============================================
  // UTILITIES
  // ============================================

  function log(...args) {
    console.log('[VSBuilder Bridge]', ...args);
  }

  function postToEditor(type, data) {
    try {
      if (window.parent !== window) {
        window.parent.postMessage({ source: 'vsbuilder-preview', type, ...data }, '*');
      }
    } catch (e) {
      console.error('[VSBuilder Bridge] Failed to post message:', e);
    }
  }

  function getSectionElement(sectionId) {
    return document.querySelector('[data-section-id="' + sectionId + '"]') ||
           document.querySelector('#shopify-section-' + sectionId) ||
           document.querySelector('.shopify-section[id*="' + sectionId + '"]');
  }

  function getBlockElement(blockId) {
    return document.querySelector('[data-block-id="' + blockId + '"]') ||
           document.querySelector('[id*="block-' + blockId + '"]');
  }

  function getAllSections() {
    return Array.from(document.querySelectorAll('.shopify-section, [data-section-id], [id^="shopify-section-"]'));
  }

  function getAllBlocks() {
    return Array.from(document.querySelectorAll('[data-block-id], [data-shopify-editor-block]'));
  }

  // ============================================
  // HIGHLIGHTING
  // ============================================

  let highlightOverlay = null;
  let selectOverlay = null;

  function createOverlay(id) {
    const overlay = document.createElement('div');
    overlay.id = id;
    overlay.style.cssText = \`
      position: absolute;
      pointer-events: none;
      z-index: \${CONFIG.zIndex};
      transition: all \${CONFIG.hoverTransition} ease;
      box-sizing: border-box;
      opacity: 0;
    \`;
    document.body.appendChild(overlay);
    return overlay;
  }

  function updateOverlay(overlay, element, color, width) {
    if (!element) {
      overlay.style.opacity = '0';
      return;
    }

    const rect = element.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

    overlay.style.cssText = \`
      position: absolute;
      pointer-events: none;
      z-index: \${CONFIG.zIndex};
      transition: all \${CONFIG.hoverTransition} ease;
      box-sizing: border-box;
      top: \${rect.top + scrollTop}px;
      left: \${rect.left + scrollLeft}px;
      width: \${rect.width}px;
      height: \${rect.height}px;
      border: \${width}px dashed \${color};
      opacity: 1;
    \`;
  }

  function showHoverHighlight(element) {
    if (!highlightOverlay) return;
    updateOverlay(highlightOverlay, element, CONFIG.highlightColor, CONFIG.highlightWidth);
  }

  function hideHoverHighlight() {
    if (!highlightOverlay) return;
    highlightOverlay.style.opacity = '0';
  }

  function showSelectHighlight(element) {
    if (!selectOverlay) return;
    updateOverlay(selectOverlay, element, CONFIG.selectColor, CONFIG.selectWidth);
    selectOverlay.style.borderStyle = 'solid';
  }

  function hideSelectHighlight() {
    if (!selectOverlay) return;
    selectOverlay.style.opacity = '0';
  }

  // ============================================
  // SECTION DETECTION
  // ============================================

  function extractSectionInfo(element) {
    let sectionId = element.getAttribute('data-section-id');
    let sectionType = element.getAttribute('data-section-type');

    // Try ID-based extraction
    if (!sectionId && element.id) {
      const match = element.id.match(/shopify-section-(.+)/);
      if (match) {
        sectionId = match[1];
      }
    }

    // Try class-based type extraction
    if (!sectionType) {
      for (const cls of element.classList) {
        if (cls.startsWith('section-') && cls !== 'section') {
          sectionType = cls.replace('section-', '');
          break;
        }
      }
    }

    return { sectionId, sectionType };
  }

  function findParentSection(element) {
    let current = element;
    while (current && current !== document.body) {
      if (current.classList.contains('shopify-section') ||
          current.hasAttribute('data-section-id') ||
          (current.id && current.id.startsWith('shopify-section-'))) {
        return current;
      }
      current = current.parentElement;
    }
    return null;
  }

  function extractBlockInfo(element) {
    let blockId = element.getAttribute('data-block-id');
    let blockType = element.getAttribute('data-block-type');

    if (!blockId) {
      const shopifyAttr = element.getAttribute('data-shopify-editor-block');
      if (shopifyAttr) {
        try {
          const data = JSON.parse(shopifyAttr);
          blockId = data.id;
          blockType = data.type;
        } catch (e) {}
      }
    }

    return { blockId, blockType };
  }

  function findParentBlock(element) {
    let current = element;
    while (current && current !== document.body) {
      if (current.hasAttribute('data-block-id') ||
          current.hasAttribute('data-shopify-editor-block')) {
        return current;
      }
      current = current.parentElement;
    }
    return null;
  }

  // ============================================
  // EVENT HANDLERS
  // ============================================

  function handleMouseOver(e) {
    const block = findParentBlock(e.target);
    const section = findParentSection(e.target);

    if (block) {
      const { blockId, blockType } = extractBlockInfo(block);
      if (blockId !== window.VSBuilderBridge.hoveredBlock) {
        window.VSBuilderBridge.hoveredBlock = blockId;
        showHoverHighlight(block);
        postToEditor('block-hover', { blockId, blockType });
      }
    } else if (section) {
      const { sectionId, sectionType } = extractSectionInfo(section);
      if (sectionId !== window.VSBuilderBridge.hoveredSection) {
        window.VSBuilderBridge.hoveredSection = sectionId;
        window.VSBuilderBridge.hoveredBlock = null;
        showHoverHighlight(section);
        postToEditor('section-hover', { sectionId, sectionType });
      }
    }
  }

  function handleMouseOut(e) {
    // Check if we're leaving the document
    if (!e.relatedTarget || e.relatedTarget === document.documentElement) {
      window.VSBuilderBridge.hoveredSection = null;
      window.VSBuilderBridge.hoveredBlock = null;
      hideHoverHighlight();
      postToEditor('hover-end', {});
    }
  }

  function handleClick(e) {
    // Check for block first (more specific)
    const block = findParentBlock(e.target);
    if (block) {
      const { blockId, blockType } = extractBlockInfo(block);
      const section = findParentSection(block);
      const { sectionId, sectionType } = section ? extractSectionInfo(section) : { sectionId: null, sectionType: null };

      window.VSBuilderBridge.selectedSection = sectionId;
      window.VSBuilderBridge.selectedBlock = blockId;
      showSelectHighlight(block);

      postToEditor('block-select', { blockId, blockType, sectionId, sectionType });
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    // Check for section
    const section = findParentSection(e.target);
    if (section) {
      const { sectionId, sectionType } = extractSectionInfo(section);

      window.VSBuilderBridge.selectedSection = sectionId;
      window.VSBuilderBridge.selectedBlock = null;
      showSelectHighlight(section);

      postToEditor('section-select', { sectionId, sectionType });
      e.preventDefault();
      e.stopPropagation();
    }
  }

  // ============================================
  // MESSAGE HANDLING
  // ============================================

  function handleMessage(event) {
    if (!event.data || event.data.source !== 'vsbuilder-editor') return;

    const { type, ...data } = event.data;
    log('Received:', type, data);

    switch (type) {
      case 'select-section':
        selectSection(data.sectionId);
        break;

      case 'select-block':
        selectBlock(data.blockId);
        break;

      case 'deselect':
        deselectAll();
        break;

      case 'scroll-to-section':
        scrollToSection(data.sectionId);
        break;

      case 'scroll-to-block':
        scrollToBlock(data.blockId);
        break;

      case 'update-section':
        updateSectionHTML(data.sectionId, data.html);
        break;

      case 'refresh':
        window.location.reload();
        break;

      case 'get-sections':
        sendSectionsList();
        break;

      case 'ping':
        postToEditor('pong', { timestamp: Date.now() });
        break;
    }
  }

  function selectSection(sectionId) {
    const element = getSectionElement(sectionId);
    if (element) {
      window.VSBuilderBridge.selectedSection = sectionId;
      window.VSBuilderBridge.selectedBlock = null;
      showSelectHighlight(element);
    }
  }

  function selectBlock(blockId) {
    const element = getBlockElement(blockId);
    if (element) {
      window.VSBuilderBridge.selectedBlock = blockId;
      showSelectHighlight(element);
    }
  }

  function deselectAll() {
    window.VSBuilderBridge.selectedSection = null;
    window.VSBuilderBridge.selectedBlock = null;
    hideSelectHighlight();
  }

  function scrollToSection(sectionId) {
    const element = getSectionElement(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  function scrollToBlock(blockId) {
    const element = getBlockElement(blockId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  function updateSectionHTML(sectionId, html) {
    const element = getSectionElement(sectionId);
    if (element) {
      element.innerHTML = html;
      postToEditor('section-updated', { sectionId });
    }
  }

  function sendSectionsList() {
    const sections = getAllSections().map(el => {
      const { sectionId, sectionType } = extractSectionInfo(el);
      const rect = el.getBoundingClientRect();
      return {
        id: sectionId,
        type: sectionType,
        bounds: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
      };
    });
    postToEditor('sections-list', { sections });
  }

  // ============================================
  // INITIALIZATION
  // ============================================

  function init() {
    log('Initializing...');

    // Create overlays
    highlightOverlay = createOverlay('vsbuilder-highlight-overlay');
    selectOverlay = createOverlay('vsbuilder-select-overlay');

    // Add event listeners
    document.addEventListener('mouseover', handleMouseOver, true);
    document.addEventListener('mouseout', handleMouseOut, true);
    document.addEventListener('click', handleClick, true);
    window.addEventListener('message', handleMessage, false);

    // Update overlays on scroll/resize
    window.addEventListener('scroll', function() {
      if (window.VSBuilderBridge.selectedSection) {
        const el = getSectionElement(window.VSBuilderBridge.selectedSection);
        if (el) showSelectHighlight(el);
      }
    }, { passive: true });

    window.addEventListener('resize', function() {
      if (window.VSBuilderBridge.selectedSection) {
        const el = getSectionElement(window.VSBuilderBridge.selectedSection);
        if (el) showSelectHighlight(el);
      }
    }, { passive: true });

    // Add section attributes for better detection
    getAllSections().forEach(section => {
      if (!section.hasAttribute('data-editor-selectable')) {
        section.setAttribute('data-editor-selectable', 'true');
      }
    });

    // Mark as ready
    window.VSBuilderBridge.ready = true;
    postToEditor('ready', {
      timestamp: Date.now(),
      sections: getAllSections().length,
      blocks: getAllBlocks().length
    });

    log('Initialized successfully');
  }

  // Wait for DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
</script>
`;

/**
 * Get the editor bridge script for injection
 */
export function getEditorBridgeScript(): string {
  return editorBridgeScript;
}

/**
 * Get minimal editor communication script (for basic preview)
 */
export function getMinimalEditorScript(): string {
  return `
<script>
  window.VSBuilderPreview = {
    ready: true,
    postMessage: function(type, data) {
      if (window.parent !== window) {
        window.parent.postMessage({ source: 'vsbuilder-preview', type, ...data }, '*');
      }
    },
    init: function() {
      this.postMessage('ready', { timestamp: Date.now() });

      // Listen for messages from editor
      window.addEventListener('message', function(event) {
        if (event.data && event.data.source === 'vsbuilder-editor') {
          if (event.data.type === 'refresh') {
            window.location.reload();
          }
        }
      });
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      window.VSBuilderPreview.init();
    });
  } else {
    window.VSBuilderPreview.init();
  }
</script>`;
}
