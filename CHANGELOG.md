# Değişiklik geçmişi

Sürüm numarası `package.json` içindeki `version` alanıdır; sayfanın altında ve
`/api/surum` adresinde görünür. Yeni sürüm çıkarırken:

1. `npm version <yeni-sürüm> --no-git-tag-version` (ör. `0.6.1`, `0.7.0`)
2. Bu dosyanın en üstüne yeni bir başlık ekleyin.
3. Commit + push. Coolify yeniden dağıttıktan sonra `/api/surum` ile kontrol edin.

Numaralandırma: hata düzeltmesi → son hane (0.6.**1**), yeni özellik → orta hane (0.**7**.0).

## 0.11.0 — 2026-11-13

- **OCR ~5 kat hızlı:** Ayıklama büyütülmüş görüntüde yapılmaya devam ediyor, ama OCR'a giden
  temiz görüntü harf boyu ~34 px olacak şekilde küçültülüyor (asla büyütülmez). Ölçüm (gerçek
  oyun kareleri): OCR 1264 → 237 ms, kelime hatası aynı (%0). Şimdilik "Beyaz yazı" tipinde.
- İstatistiğe gecikme satırı: yazının değiştiği algılandıktan çevirinin ekrana gelmesine kadar
  geçen sürenin ortancası ve en kötüsü (son 100 altyazı).

## 0.10.1 — 2026-11-13

- **Ön kontrol (performans):** Bölge 256 px'e küçültülüp en son tam işlenen kareyle
  karşılaştırılır. Görüntü değişmediyse (oyun durdurulmuş, menü, sabit sahne) yazı ayıklama
  atlanır. Yine de en az saniyede bir tam işlenir. İstatistikte "değişmedi" sayısı görünür.
- **Boş bölge:** OCR bölgede yazı bulamıyorsa (2 harften az) ve bu 1,2 sn sürerse ekrandaki
  çeviri silinir. Önceden sadece yazı pikseli kalmadığında siliniyordu.

## 0.10.0 — 2026-11-13

- **Beyaz yazı ayıklama yenilendi** ("hale kuralı"): parlak kum, gökyüzü, su gibi arka plan artık
  yazı sayılmıyor. Parlak her leke ayrı incelenir; kenarı koyu konturla çevrili olanlar yazıdır.
  Harf boyuna uymayan lekeler, dolu bloklar ve satır dışındaki kırıntılar atılır.
  - "ATT", "lao)", "ATN" gibi uydurma satırlar ve "time:on" gibi araya giren işaretler kalktı.
  - Kırmızı çerçeve (OCR'a giden alan) sadece yazıyı kapsar.
  - Ölçüm (gerçek oyun kareleri): kelime hatası %32,5 → %0. Koyu kutulu altyazılar da çalışır.
- Eski davranış "Beyaz yazı, basit" seçeneği olarak duruyor (konturu olmayan yazılar için).

## 0.9.0 — 2026-11-13

- tesseract.js 5.1.1 → 7.0.0:
  - Uzun kullanımda belleğin sürekli artıp çökmeye yol açtığı sızıntı giderildi (v6).
  - OCR ~%29 hızlandı (ölçüm: 140 → 100 ms, aynı best_int modeli, doğruluk aynı) (v7).
- v6+ `data.lines` döndürmediği için satırlar blok hiyerarşisinden toplanıyor (`satirlariTopla`).

## 0.8.1 — 2026-11-13

- **Düzeltme:** Arada boşluk olmadan arka arkaya gelen altyazılar algılanmıyordu (değişiklik
  tespiti 24×6 ızgara ortalamasıydı, benzer uzunluktaki cümleleri ayırt edemiyordu). Artık yazı
  pikselleri karşılaştırılıyor; bölge ve yazı boyutundan bağımsız.
- Düşük güvenle reddedilen altyazı (ör. tam belirmeden okunmuş) 0,5 sn sonra bir kez daha okunur.
- Titreyen görüntüde durulma beklemesi en fazla 3 kez yapılır, sonra yine de okunur.
- Tekrar tespiti kelime sırasına bakar ("I don't want you." ≠ "Do what you want. I don't care.").

## 0.8.0 — 2026-11-13

- "OCR'a giden görüntü" sol tarafa, altyazının altına taşındı; panel genişliğinde büyük gösterilir.
- Göster/gizle düğmesi (tercih saklanır). Gizliyken önizleme çizilmez.
- Önizleme, kamera açıkken çeviri başlatılmadan da yenilenir (eşiği önceden ayarlamak için).
- OCR'a gönderilen yazı kutusu önizlemede kırmızı çerçeveyle gösterilir.

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
