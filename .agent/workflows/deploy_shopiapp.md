---
description: VSBuilder Development & Deployment Workflow
---

# VSBuilder Workflow

Bu döküman, **VSBuilder** (Shopify Page Builder) projesinin geliştirme ve dağıtım süreçlerini standartlaştırır.

## 1. Proje Kuralları & Mimari
- **Teknoloji Stack**:
  - **Framework**: Remix (Shopify Native App)
  - **API**: Shopify Admin API 2026-04 (GraphQL)
  - **UI**: Shopify Polaris + Tailwind CSS (Custom Styling için)
  - **Veritabanı**: Prisma + PostgreSQL (Sunucuda Dockerize edilecek)
- **Repo**: `git@github.com:jesuisfatih/vsbuilder.git` (Public)
- **Sunucu**: `5.78.77.154` (User: `root`)
- **Domain**: `vsbuilder.techifyboost.com`

## 2. Geliştirme Süreci (Local)
Tüm kodlama işlemi **Local** makinede yapılacaktır. Sunucuda doğrudan kod düzenlemesi **YASAKTIR**.

1.  **Kodlama**: Özellikler geliştirilir (Localhost testleri).
2.  **Commit & Push**:
    ```powershell
    git add .
    git commit -m "feat: yeni ozellik eklendi"
    git push origin main
    ```

## 3. Dağıtım Süreci (Deployment)
Kodlar GitHub'a yüklendikten sonra sunucuya çekilir.

### A. Sunucu Bağlantısı
```powershell
ssh -i $env:USERPROFILE\.ssh\vsbuilder root@5.78.77.154
```

### B. Kodun Çekilmesi (Sunucu İçi)
Sunucuda proje klasörüne gidip güncel kod çekilir:
```bash
cd /path/to/project
git pull origin main
```

### C. Environment Dosyaları (.env)
`.env` dosyasındaki hassas veriler (API Key, Secret vb.) GitHub'a **GÖNDERİLMEZ**.
Localden sunucuya güvenli kopya (SCP) ile atılır:
```powershell
scp -i $env:USERPROFILE\.ssh\vsbuilder .env root@5.78.77.154:/path/to/project/.env
```

### D. Build & Restart
```bash
npm install
npm run build
npm run start # Veya PM2/Docker restart komutu
```

## 4. Özellik Gereksinimleri
1.  **Tam Ekran Editör**: App Bridge Fullscreen action kullanılacak.
2.  **Native Hissiyat**: Editör tasarımı Shopify Admin arayüzünü birebir taklit etmeli.
3.  **Template Sistemi**:
    - Hazır HTML şablonları import edilebilmeli (Full Page).
    - Şablonlar parçalanarak Section bazlı kullanılabilmeli.
4.  **Shopify 2.0 Uyumu**: Theme App Extension ve Section Rendering API kullanılacak.

## 5. Otomasyon Notları
- Terminal komutları (Build, Git, SSH) bu akışa göre otomatik çalıştırılabilir (`// turbo-all` geçerli).
