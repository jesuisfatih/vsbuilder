# 🔴 App Proxy 404 Hatası - Analiz ve Çözüm Raporu

## 📋 Problem Özeti

**Durum:** Shopify Theme Editor iframe'i içinde App Proxy üzerinden editor açıldığında:
1. Section'lar yüklenmiyor
2. Sayfayı yenileyince 404 hatası alınıyor
3. React Hydration Error #418 oluşuyor

**URL Akışı:**
```
Kullanıcı Browser URL: https://dtfbank.com/apps/vsbuilder/editor?themeId=XXX
                              ↓
              Shopify App Proxy (Shopify tarafında)
                              ↓
      Backend URL: https://vsbuilder.techifyboost.com/proxy/editor?themeId=XXX
```

---

## 🔍 Temel Sorun

### Hydration Mismatch Nedir?

React SSR (Server-Side Rendering) şöyle çalışır:
1. **Server:** HTML render eder ve client'a gönderir
2. **Client:** Aynı component'i render eder ve server HTML'i ile karşılaştırır (hydration)
3. **Eşleşmezse:** Error #418 - "Hydration failed because initial UI does not match"

### Neden Eşleşmiyor?

App Proxy ortamında:
- **Server (SSR):** `https://vsbuilder.techifyboost.com/proxy/editor` URL'i görür
- **Client (Browser):** `https://dtfbank.com/apps/vsbuilder/editor` URL'i görür

Bu iki ortam farklı olduğu için:
- `window.location` değerleri farklı
- `document.origin` değerleri farklı
- Asset URL'leri farklı

---

## 📁 Mevcut Mimari

### shopify.app.toml Konfigürasyonu
```toml
[app_proxy]
url = "https://vsbuilder.techifyboost.com/proxy"
subpath = "vsbuilder"
prefix = "apps"
```

**Bu demek ki:**
- Shopify URL: `https://{shop}/apps/vsbuilder/*`
- Backend URL: `https://vsbuilder.techifyboost.com/proxy/*`

### Mevcut Route'lar
```
/proxy/editor      → proxy.editor.tsx (Editor UI)
/proxy/api.sync    → proxy.api.sync.tsx (Theme sync API)
/proxy/api.render  → proxy.api.render.tsx (Section render API)
```

---

## 🧪 Denenen Çözümler

### 1. Entry.client URL Normalizasyonu ❌
```typescript
// Deneme: Browser URL'ini normalize et
if (pathname.includes('/apps/vsbuilder/')) {
  const newPath = pathname.replace('/apps/vsbuilder/', '/proxy/');
  window.history.replaceState(null, '', newPath);
}
```
**Sonuç:** `SecurityError: Cannot create history state with different origin`

### 2. AppProxyProvider Kullanımı ❌
```typescript
import { AppProxyProvider } from "@shopify/shopify-app-remix/react";

<AppProxyProvider appUrl={appUrl}>
  <EditorCore />
</AppProxyProvider>
```
**Sonuç:** Hala Hydration Error #418. `<base href>` tag'i bile yeterli değil.

### 3. Global Flag ile API Path Belirleme ❌
```typescript
// entry.client.tsx
window.__VSBUILDER_PROXY_MODE__ = true;

// Editor component
const isProxyMode = window.__VSBUILDER_PROXY_MODE__;
```
**Sonuç:** Flag SSR'da mevcut değil, hydration mismatch devam ediyor.

### 4. Loader'dan apiConfig Döndürme ⚠️
```typescript
// proxy.editor.tsx loader
return json({
  apiConfig: {
    syncCheck: `${appUrl}/proxy/api.sync`,
    syncAction: `${appUrl}/proxy/api.sync`,
  }
});
```
**Sonuç:** Kısmen çalışıyor ama hydration problemi çözülmüyor.

---

## 🎯 Potansiyel Çözümler

### Çözüm A: Client-Only Rendering

SSR'ı proxy editor için devre dışı bırak. Sadece client-side render yap.

```typescript
// proxy.editor.tsx
function ClientOnly({ children, fallback }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? children : fallback;
}

export default function ProxyEditor() {
  return (
    <ClientOnly fallback={<div>Loading editor...</div>}>
      <EditorCore />
    </ClientOnly>
  );
}
```

**Avantaj:** Hydration mismatch olmaz
**Dezavantaj:** İlk yükleme biraz daha yavaş

### Çözüm B: SuppressHydrationWarning

Belirli container'lara `suppressHydrationWarning` ekle.

```typescript
<div suppressHydrationWarning>
  <EditorCore />
</div>
```

**Avantaj:** Basit
**Dezavantaj:** Sadece warning'leri susturur, problemi çözmez

### Çözüm C: Ayrı Entry Point

App Proxy için tamamen ayrı bir entry point oluştur.

```typescript
// app/entry.client.proxy.tsx
// React'i hydration yerine createRoot ile mount et
createRoot(document.getElementById('app')).render(<App />);
```

**Avantaj:** Tam kontrol
**Dezavantaj:** Karmaşık setup

### Çözüm D: Resource Route + iframe

Proxy editor'ü resource route yap, HTML döndür, bu HTML'de tam uygulama iframe içinde göster.

**Avantaj:** Tamamen izole ortam
**Dezavantaj:** Çok karmaşık, UX sorunları

### Çözüm E: Remix-Utils ClientOnly

`remix-utils` paketinin `ClientOnly` component'ini kullan.

```bash
npm install remix-utils
```

```typescript
import { ClientOnly } from "remix-utils/client-only";

<ClientOnly fallback={<Loading />}>
  {() => <EditorCore />}
</ClientOnly>
```

---

## 📊 Durum Matrisi

| Yaklaşım | SSR | Hydration | Complexity | Önerilen |
|----------|-----|-----------|------------|----------|
| Client-Only Rendering | ❌ | ✅ | Orta | ⭐ En iyi |
| SuppressHydrationWarning | ✅ | ⚠️ | Düşük | Sadece kozmetik |
| Ayrı Entry Point | ❌ | ✅ | Yüksek | Overkill |
| Resource Route + iframe | N/A | N/A | Çok Yüksek | Son çare |
| Remix-Utils ClientOnly | ❌ | ✅ | Düşük | ⭐ İyi alternatif |

---

## 🔧 Önerilen Uygulama

### Adım 1: ClientOnly Helper Oluştur

`app/components/ClientOnly.tsx`:
```typescript
import { useState, useEffect, type ReactNode } from "react";

interface ClientOnlyProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export function ClientOnly({ children, fallback = null }: ClientOnlyProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return mounted ? <>{children}</> : <>{fallback}</>;
}
```

### Adım 2: Proxy Editor'ü Güncelle

`app/routes/proxy.editor.tsx`:
```typescript
import { ClientOnly } from "../components/ClientOnly";
import { EditorCore } from "./app.editor";

export default function ProxyEditor() {
  const data = useLoaderData<typeof loader>();

  return (
    <AppProxyProvider appUrl={data.appUrl}>
      <ClientOnly
        fallback={
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            background: '#1a1a2e',
            color: 'white',
            fontFamily: 'system-ui'
          }}>
            <div>Loading Visual Editor...</div>
          </div>
        }
      >
        <EditorCore loaderData={data} isProxyMode={true} />
      </ClientOnly>
    </AppProxyProvider>
  );
}
```

### Adım 3: Entry.client Basit Tut

`app/entry.client.tsx`:
```typescript
import { RemixBrowser } from "@remix-run/react";
import { startTransition, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <RemixBrowser />
    </StrictMode>
  );
});
```

---

## 🐛 404 Hatası Hakkında

### Neden 404?
Sayfa yenilendiğinde browser direkt olarak:
`https://dtfbank.com/apps/vsbuilder/editor?themeId=XXX`

URL'sine istek yapar. Shopify bu isteği proxy'ler:
`https://vsbuilder.techifyboost.com/proxy/editor?themeId=XXX`

**Eğer 404 alıyorsak:**
1. Route doğru tanımlı mı? (`/proxy/editor`)
2. Sunucu çalışıyor mu?
3. Remix build doğru mu?

### Debug Adımları:
```bash
# 1. Sunucuya SSH
ssh root@5.78.77.154

# 2. Container loglarına bak
docker logs vsbuilder-app --tail 100

# 3. Route'ları kontrol et
cd /root/vsbuilder
cat build/server/index.js | grep "proxy/editor"
```

---

## 📝 Sonuç

**En güvenilir çözüm: Client-Only Rendering**

Bu yaklaşımla:
1. SSR minimal HTML döndürür (fallback)
2. Client mount olduktan sonra full editor render edilir
3. Server ve client HTML'i aynı olur = Hydration başarılı
4. Sonra client-side'da EditorCore mount olur

**Gerekli Dosya Değişiklikleri:**
1. `app/components/ClientOnly.tsx` oluştur
2. `app/routes/proxy.editor.tsx` güncelle
3. `app/entry.client.tsx` basit tut
4. Build ve deploy

---

*Son güncelleme: 2026-01-31*
