# 🚀 Proxy Editor Fix - Implementation Checklist

## 📋 Adım Adım Uygulama

### 1. ClientOnlyEditor Component'ini Oluştur
```bash
# Dosya: app/components/ClientOnlyEditor.tsx
```
- [x] ClientOnlyEditor.tsx dosyasını kopyala
- [x] app/components/ klasörüne yerleştir
- [x] Loading fallback tasarımını isterseniz özelleştir

### 2. proxy.editor.tsx Route'unu Güncelle
```bash
# Dosya: app/routes/proxy.editor.tsx
```
- [ ] Mevcut proxy.editor.tsx'i yedekle
- [ ] Yeni proxy.editor.tsx kodunu uygula
- [ ] `EditorCore` import path'ini kontrol et (kendi dosya yapınıza göre)
- [ ] `process.env.APP_URL` değişkeninin set olduğundan emin ol

### 3. EditorCore Component'ini Proxy Mode için Hazırla
```bash
# Dosya: app/routes/app.editor.tsx (veya EditorCore'un olduğu yer)
```
- [ ] `isProxyMode` prop'unu ekle
- [ ] API endpoint configuration'ı proxy mode'a göre ayarla
- [ ] Section click handler'ında doğru API endpoint'i kullan
- [ ] Initial theme sync'de doğru endpoint kullan

### 4. API Routes'ları Kontrol Et
```bash
# Dosyalar:
# - app/routes/proxy.api.sync.tsx
# - app/routes/proxy.api.render.tsx
```
- [ ] Bu route'lar mevcut mu?
- [ ] CORS headers doğru mu?
- [ ] Shopify proxy signature validation var mı?

---

## 🧪 Test Senaryoları

### Test 1: Editor Açılışı
```
1. Shopify Admin → App Panel → "Live Editor"
2. Yeni sekme açılıyor
3. Bekle: Loading ekranı görünmeli (mor gradient)
4. 1-2 saniye sonra editor yüklenmeli
5. ✅ Hydration error OLMAMALI
```

**Kontrol Noktaları:**
```javascript
// Browser console'da:
console.log(window.location.href); 
// Beklenen: https://dtfbank.com/apps/vsbuilder/editor?themeId=XXX

// React DevTools'da:
// ClientOnlyEditor component'i görünmeli
// EditorCore isMounted=true olmalı
```

### Test 2: Section Click
```
1. Editor açık
2. Bir section'a tıkla
3. Bekle: Section highlight olmalı
4. API isteği gitmeli
5. İframe içeriği güncellenmeli
6. ✅ 404 error OLMAMALI
```

**Network Tab Kontrolü:**
```
Request URL: https://vsbuilder.techifyboost.com/proxy/api.render?...
Status: 200 OK
Response: { "html": "..." }
```

### Test 3: Sayfa Yenileme
```
1. Editor açık
2. Browser refresh (F5)
3. Bekle: Loading ekranı
4. Editor tekrar yüklenmeli
5. ✅ 404 error OLMAMALI
6. ✅ State korunmalı (eğer URL'de parametre varsa)
```

### Test 4: Liquid Rendering
```
1. Section tıkla
2. Backend liquid engine çalışmalı
3. Rendered HTML iframe'e gelmeli
4. ✅ Section içeriği doğru görünmeli
```

**Backend Log Kontrolü:**
```bash
# Server'da:
tail -f /var/log/vsbuilder/app.log

# Beklenen log:
[Liquid Engine] Rendering section: header
[Liquid Engine] Template found: sections/header.liquid
[Liquid Engine] Render completed in 45ms
```

---

## 🐛 Sorun Giderme

### Hata: "Hydration failed #418"
**Sebep:** ClientOnlyEditor çalışmıyor
**Çözüm:**
```bash
# 1. Component doğru import edilmiş mi?
grep -r "ClientOnlyEditor" app/routes/proxy.editor.tsx

# 2. useState initial value false mu?
# ClientOnlyEditor.tsx'de kontrol et
```

### Hata: "404 on /proxy/api.render"
**Sebep:** API route eksik veya yanlış path
**Çözüm:**
```bash
# API route var mı?
ls -la app/routes/proxy.api.render.tsx

# Route export'u doğru mu?
# Dosyada action() veya loader() olmalı
```

### Hata: "CORS policy blocked"
**Sebep:** API response'unda CORS headers eksik
**Çözüm:**
```typescript
// proxy.api.render.tsx
export async function loader({ request }: LoaderFunctionArgs) {
  const html = await renderSection(...);
  
  return json({ html }, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    }
  });
}
```

### Hata: "Loading screen stuck"
**Sebep:** JavaScript error, component mount olmuyor
**Çözüm:**
```bash
# Browser console'da error var mı?
# React DevTools'da component tree'ye bak
# EditorCore component mount olmuş mu?
```

---

## 📊 Başarı Kriterleri

### ✅ Editor Açılışı
- [ ] Loading ekranı göründü
- [ ] 2 saniye içinde editor yüklendi
- [ ] Console'da Hydration error yok
- [ ] Console'da 404 error yok

### ✅ Section İşlemleri
- [ ] Section tıklanabiliyor
- [ ] API isteği doğru endpoint'e gidiyor
- [ ] Response 200 OK
- [ ] İframe güncelleniyor
- [ ] Liquid render çalışıyor

### ✅ Performans
- [ ] İlk yükleme < 3 saniye
- [ ] Section render < 1 saniye
- [ ] Memory leak yok (DevTools Memory profiler)
- [ ] CPU kullanımı normal

---

## 🎯 Son Kontrol Listesi

Deploymant öncesi:

1. **Kod Kalitesi**
   - [ ] ESLint error yok
   - [ ] TypeScript error yok
   - [ ] Console.log'lar temizlendi (production için)

2. **Environment Variables**
   - [ ] APP_URL set edilmiş
   - [ ] SHOPIFY_API_KEY set edilmiş
   - [ ] Diğer gerekli env var'lar set edilmiş

3. **Build Test**
   ```bash
   npm run build
   # Error çıkmamalı
   ```

4. **Local Test**
   ```bash
   npm run dev
   # Localhost'ta test et
   # ngrok ile shopify'a bağla
   # Tüm senaryoları test et
   ```

5. **Staging Test**
   - [ ] Staging environment'a deploy
   - [ ] Gerçek Shopify store ile test
   - [ ] Multiple theme'leri test et
   - [ ] Farklı section type'ları test et

6. **Production Deployment**
   - [ ] Backup al
   - [ ] Deploy et
   - [ ] Monitoring aktif
   - [ ] Test user ile doğrula

---

## 📞 Destek

Sorun devam ederse kontrol edilecekler:

1. Server logları: `/var/log/vsbuilder/`
2. Network tab: API isteklerini incele
3. React DevTools: Component tree ve state
4. Lighthouse: Performance metrics

---

**Son Güncelleme:** 2026-01-31
**Tahmini Uygulama Süresi:** 30-45 dakika
**Risk Seviyesi:** Düşük (sadece proxy route değişiyor)
