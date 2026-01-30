// app/routes/app.editor.tsx içinde yapılması gereken değişiklikler

/**
 * ÖNCE: EditorCore component'inin props tipini güncelle
 */
interface EditorCoreProps {
  loaderData: any; // veya daha spesifik tip
  isProxyMode?: boolean; // Yeni prop
}

export function EditorCore({ loaderData, isProxyMode = false }: EditorCoreProps) {
  // API endpoint'lerini belirle
  const apiEndpoints = isProxyMode 
    ? loaderData.apiConfig // Proxy mode: /proxy/api.* kullan
    : {
        // Normal mode: /app/api.* kullan
        syncCheck: "/app/api/sync",
        syncAction: "/app/api/sync", 
        renderSection: "/app/api/render",
      };

  // Store'u initialize et
  useEffect(() => {
    store.apiConfig = apiEndpoints;
  }, [apiEndpoints]);

  // ... rest of the component
}

/**
 * SECTION CLICK HANDLER'I GÜNCELLE
 */
const handleSectionClick = async (sectionId: string) => {
  try {
    // State güncelle
    store.selectedPath = sectionId;

    // API'den section HTML'ini al
    const response = await fetch(
      `${store.apiConfig.renderSection}?` + new URLSearchParams({
        themeId: loaderData.themeId,
        sectionId: sectionId,
        shop: loaderData.shop,
      })
    );

    if (!response.ok) {
      throw new Error(`Failed to render section: ${response.statusText}`);
    }

    const { html } = await response.json();

    // İframe'e inject et
    const iframe = document.querySelector('iframe#preview');
    if (iframe?.contentDocument) {
      const targetElement = iframe.contentDocument.querySelector(
        `[data-section-id="${sectionId}"]`
      );
      if (targetElement) {
        targetElement.innerHTML = html;
      }
    }
  } catch (error) {
    console.error('Section click error:', error);
    // Hata handling...
  }
};

/**
 * INITIAL THEME SYNC'İ GÜNCELLE
 */
useEffect(() => {
  const syncTheme = async () => {
    try {
      const response = await fetch(
        `${store.apiConfig.syncCheck}?` + new URLSearchParams({
          themeId: loaderData.themeId,
          shop: loaderData.shop,
        })
      );

      const data = await response.json();
      
      if (data.needsSync) {
        // Sync action'ını tetikle
        await fetch(store.apiConfig.syncAction, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            themeId: loaderData.themeId,
            shop: loaderData.shop,
          }),
        });
      }

      // Theme data'yı store'a kaydet
      store.themeData = data.theme;
    } catch (error) {
      console.error('Theme sync error:', error);
    }
  };

  syncTheme();
}, [loaderData.themeId, loaderData.shop]);
