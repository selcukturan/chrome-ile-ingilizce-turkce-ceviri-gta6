# Değişiklik geçmişi

Sürüm numarası `package.json` içindeki `version` alanıdır; sayfanın altında ve
`/api/surum` adresinde görünür. Yeni sürüm çıkarırken:

1. `npm version <yeni-sürüm> --no-git-tag-version` (ör. `0.6.1`, `0.7.0`)
2. Bu dosyanın en üstüne yeni bir başlık ekleyin.
3. Commit + push. Coolify yeniden dağıttıktan sonra `/api/surum` ile kontrol edin.

Numaralandırma: hata düzeltmesi → son hane (0.6.**1**), yeni özellik → orta hane (0.**7**.0).

## 0.7.0 — 2026-11-13

- "GTA" ifadeleri siteden tamamen kaldırıldı (sayfa başlığı, açıklama, paylaşım etiketleri,
  yapılandırılmış veri dahil). Site adı: "Altyazı Çeviri".
- Ziyaretçi sayacı sayfanın en altına, sürüm bilgisinin yanına taşındı.
- Sağ üste projenin GitHub bağlantısı eklendi.
- Tarayıcıda saklanan ayarların anahtar öneki `altyazi_` oldu (eski ayarlar otomatik taşınır).

## 0.6.0 — 2026-11-13

- Sürüm takibi: sayfanın altında sürüm ve commit, `/api/surum` uç noktası.
- Görünen yerlerden "GTA" ifadeleri ve marka uyarısı kaldırıldı (başlık: "Altyazı Çeviri").
  Sayfa başlığı, açıklama ve yapılandırılmış veri SEO için aynen duruyor.
- Kamera ayarları paneli: cihaz destekliyorsa parlaklık, kontrast, doygunluk, keskinlik,
  pozlama, beyaz dengesi ve odak. Ayarlar her cihaz için saklanır.
- Kamera listesine yenile butonu; cihaz takılıp çıkarılınca liste kendiliğinden yenilenir.
- Paylaşım görseli (og.png) yenilendi.

## 0.5.1 — 2026-11-13

- OCR modeli tekrar `best_int` (doğruluk hızdan önemli). Model kendi sunucumuzdan sunulur.

## 0.5.0 — 2026-11-12

- OCR "fast" modeli denendi (~%40 hızlı).
- Yapışık çöp harf ("andfother" → "and other") ve kelime arası nokta ("be.explored") düzeltmeleri.

## 0.4.0 — 2026-11-12

- Ekranlar arası cümle birleştirme kaldırıldı (aynı çeviriyi tekrar tekrar ekliyordu).
- Satır satır uzayan altyazı geçmişte tek kayıtta güncellenir.
- Kenardaki logo konumundan öğrenilir; 2 harfli kısa diyaloglar çevrilir.

## 0.3.0 — 2026-11-12

- Cümle ortası büyük harf hataları, kapanmamış parantezli diyaloglar, satırdaki çöp grupları.
- Tarama aralığı varsayılanı 200 ms.

## 0.2.0 — 2026-11-12

- Düşük güvenli ve sabit (logo/filigran) kelimeler ayıklanır; satırlar ayrı çevrilir.
- BÜYÜK HARF metin düzeltme, "1 am" → "I am", tekrar okuma tespiti.
- OCR'a sadece yazı kutusu gönderilir, görüntü durulunca okunur, istatistik paneli.

## 0.1.0 — 2026-11-12

- İlk sürüm: kamera/capture kart + Tesseract OCR + Chrome yerleşik çevirmeni.
- Yazım düzeltme, korunan kelimeler, argo sözlüğü, ziyaretçi sayacı, Coolify için Dockerfile.
