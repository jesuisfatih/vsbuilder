---
description: VSBuilder Development & Deployment Workflow
---

# VSBuilder Workflow

Bu döküman, **VSBuilder** (Shopify Page Builder) projesinin geliştirme ve dağıtım süreçlerini standartlaştırır.

## 0. ⚠️ KESİN KURALLAR - İHLAL EDİLEMEZ

### A. Kod Yazma Kuralları
1. **EMİR DIŞI İŞLEM YAPILMAZ**: Kullanıcı ne isterse o yapılır, ek "iyileştirme" veya "optimizasyon" yapılmaz.
2. **KOD KISALTMA YASAK**: Mevcut kod satır sayısı azaltılamaz, fonksiyonlar basitleştirilemez.
3. **ONAYSIZ KOD YAZILMAZ**: Her kod değişikliği öncesi kullanıcıdan onay alınmalı.
4. **STATİK/HARDCODED VERİ YASAK**: Veriler dinamik olmalı, mock/placeholder kullanılmamalı.

### B. Mimari Kurallar
1. **Mevcut yapı korunmalı**: Dosya yapısı, class isimleri, CSS'ler değiştirilmemeli.
2. **Yeni dosya oluşturma sınırlı**: Sadece gerekli olduğunda ve onay alarak.
3. **Silme öncesi onay**: Hiçbir dosya onaysız silinmez.

### C. Preview/Render Kuralları
1. **Kendi Liquid Render Motorumuz kullanılacak**: `/api/render-local` endpoint'i
2. **Shopify'a bağımlılık yok**: Preview için Shopify CDN veya remote API kullanılmaz.

## 1. Proje Kuralları & Mimari
- **Teknoloji Stack**:
  - **Framework**: Remix (Shopify Native App)
  - **API**: Shopify Admin API 2026-04 (GraphQL)
  - **UI**: Shopify Polaris + Tailwind CSS (Custom Styling için)
  - **Veritabanı**: Prisma + PostgreSQL (Sunucuda Dockerize edilecek)
  - **Render Engine**: Kendi Liquid motorumuz (liquidEngine.server.ts)
- **Repo**: `git@github.com:jesuisfatih/vsbuilder.git` (Public)
- **Sunucu**: `5.78.77.154` (User: `root`)
- **Domain**: `vsbuilder.techifyboost.com`

## 2. App Proxy Ayarları
- **URL**: `https://vsbuilder.techifyboost.com/proxy`
- **Subpath**: `vsbuilder`
- **Prefix**: `apps`

Mağaza domain'inde açılacak URL'ler:
- Editor: `https://STORE.myshopify.com/apps/vsbuilder/editor?themeId=XXX`
- Render: `https://STORE.myshopify.com/apps/vsbuilder/render?themeId=XXX`
- Assets: `https://STORE.myshopify.com/apps/vsbuilder/assets?...`
- Sync: `https://STORE.myshopify.com/apps/vsbuilder/sync?...`

## 3. Geliştirme Süreci (Local)
Tüm kodlama işlemi **Local** makinede yapılacaktır. Sunucuda doğrudan kod düzenlemesi **YASAKTIR**.

1.  **Kodlama**: Özellikler geliştirilir (Localhost testleri).
2.  **Commit & Push**:
    ```powershell
    git add .
    git commit -m "feat: yeni ozellik eklendi"
    git push origin main
    ```

## 4. Dağıtım Süreci (Deployment)
Kodlar GitHub'a yüklendikten sonra sunucuya çekilir.

// turbo-all

### A. Sunucu Bağlantısı
```powershell
ssh -i $env:USERPROFILE\.ssh\vsbuilder root@5.78.77.154
```

### B. Kodun Çekilmesi (Sunucu İçi)
Sunucuda proje klasörüne gidip güncel kod çekilir:
```bash
cd /root/vsbuilder
git pull origin main
```

### C. Build & Restart
```bash
docker compose up -d --build
```

### D. Tek Komutla Deploy (Local'den)
```powershell
git add . && git commit -m "deploy" && git push origin main && ssh -i $env:USERPROFILE\.ssh\vsbuilder root@5.78.77.154 "cd /root/vsbuilder && git pull origin main && docker compose up -d --build"
```

## 5. Özellik Gereksinimleri
1.  **Tam Ekran Editör**: App Proxy üzerinden mağaza domain'inde açılır.
2.  **Native Hissiyat**: Editör tasarımı Shopify Admin arayüzünü birebir taklit etmeli.
3.  **Kendi Render Motorumuz**: Liquid şablonları kendi sunucumuzda render edilir.
4.  **Template Sistemi**:
    - Hazır HTML şablonları import edilebilmeli (Full Page).
    - Şablonlar parçalanarak Section bazlı kullanılabilmeli.
5.  **Shopify 2.0 Uyumu**: Theme App Extension ve Section Rendering API kullanılacak.

## 6. Dosya Yapısı (Değiştirilmez)
```
app/
├── routes/
│   ├── app.editor.tsx       # Ana editör component'i
│   ├── proxy.editor.tsx     # App Proxy -> app.editor wrapper
│   ├── proxy.render.ts      # Liquid render endpoint
│   ├── proxy.sync.ts        # Theme sync endpoint
│   ├── proxy.assets.ts      # Asset serving endpoint
│   ├── api.render-local.tsx # Local render API
│   └── api.theme-sync.tsx   # Theme sync API
├── utils/
│   ├── liquidEngine.server.ts  # Liquid render motoru
│   └── theme.server.ts         # Theme utilities
└── styles/
    └── editor.css           # Editör stilleri (DEĞİŞTİRİLMEZ)
```

## 7. Otomasyon Notları
- Terminal komutları (Build, Git, SSH) bu akışa göre otomatik çalıştırılabilir (`// turbo-all` geçerli).
