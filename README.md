# chrome-ile-ingilizce-turkce-ceviri-gta6

PS5 görüntüsünü bilgisayara bağlı kamera / capture kart üzerinden okuyup (Tesseract OCR),
altyazıları **Chrome'un yerleşik çevirmeniyle** İngilizceden Türkçeye çeviren tek sayfalık SvelteKit uygulaması.

> Yalnızca **masaüstü Google Chrome 138+** için tasarlandı. Diğer tarayıcılarda ve mobil cihazlarda
> uygulama yerine bilgilendirme ekranı gösterilir.

## İşlem hattı

```
kamera karesi → bölge kesme + eşikleme → Tesseract OCR
  → temizleme → yazım düzeltme (korunan kelimelere dokunmaz)   ← ekranda gösterilen İngilizce
  → argo sadeleştirme                                          ← çevirmene giden İngilizce
  → Chrome yerleşik çevirmeni (cihaz üstünde) → Türkçe
```

## Sözlükler

| Dosya                          | Ne işe yarar                                                          |
| ------------------------------ | --------------------------------------------------------------------- |
| `src/lib/sozluk/korunan.txt`   | Yazım düzeltmenin **dokunmayacağı** kelimeler (karakter, yer adları). |
| `src/lib/sozluk/argo.txt`      | Çeviriden **önce** İngilizce metne uygulanan değişiklikler.           |
| `static/sozluk/en-frekans.txt` | Yazım düzeltme için İngilizce kelime frekansları (SymSpell, MIT).     |

`argo.txt` biçimi:

```
the hood = the neighborhood          # tam ifade, büyük/küçük harf fark etmez
re: \b(\w+)in'(?=\W|$) => \1ing      # düzenli ifade (önce uygulanır)
```

Listeleri değiştirdikten sonra `npm test` ile kontrol edin; canlıya almak için commit + push yeterli
(Coolify otomatik yeniden dağıtır).

## Geliştirme

```sh
npm install
npm run dev -- --open   # kamera için http://localhost üzerinden açın
npm test                # yazım düzeltme + argo testleri
npm run check           # tip denetimi
```

Alan adı `src/lib/site.ts` içindeki `SITE_URL`'dedir (`altyaziceviri.tr`) (canonical, sitemap, robots.txt ve paylaşım
etiketleri bunu kullanır).

## Ziyaretçi sayacı

`POST /api/sayac` her yeni sekme oturumunda bir ziyaret sayar, `GET /api/sayac` sadece istatistiği döndürür.

- **Toplam ziyaret**: her yeni sekme oturumu (aynı sekmede yenileme sayılmaz)
- **Tekil ziyaretçi**: `zid` çerezi ile (2 yıl geçerli)
- **Bugünkü tekil**: `zgun` çerezi ile (Türkiye saatine göre)

Veriler `data/sayac.json` dosyasında tutulur (`SAYAC_DOSYASI` ortam değişkeniyle değiştirilebilir).
IP veya kişisel veri saklanmaz.

## Dağıtım (Coolify + Cloudflare Tunnel)

Uygulama konteyner içinde **4446** portunda çalışır. `PORT` ve `ORIGIN=https://altyaziceviri.tr`
`Dockerfile` içinde tanımlıdır; Coolify'da ayrıca girmeye gerek yoktur (girilirse onlar geçerli olur).

### 1. Coolify

1. **+ New Resource → Public/Private Repository** → bu GitHub reposu, dal `main`.
2. **Build Pack: Dockerfile**. **Ports Exposes: `4446`**.
3. Tünel doğrudan porta bağlanacaksa **Ports Mappings: `4446:4446`** (sunucuda 4446 başka uygulamada
   kullanılmıyor olmalı). Tünel Coolify'ın proxy'sine (Traefik) bağlanıyorsa bunun yerine
   **Domains: `https://altyaziceviri.tr`** girin.
4. **Persistent Storage → + Add Volume:** Destination Path `/app/data` (sayaç verisi yeniden
   dağıtımlarda kaybolmasın).
5. **Deploy**. **Automatic Deployment** açıksa her `git push` sonrası kendiliğinden yeniden dağıtır.

### 2. Cloudflare Tunnel

**Zero Trust → Networks → Tunnels →** mevcut tüneliniz **→ Public Hostname → Add:**

| Alan      | Değer                                                              |
| --------- | ------------------------------------------------------------------ |
| Subdomain | _(boş)_ — ayrıca `www` için ikinci bir kayıt                       |
| Domain    | `altyaziceviri.tr`                                                 |
| Service   | `http://localhost:4446` (veya Traefik kullanıyorsanız onun adresi) |

Tünel DNS kaydını kendisi oluşturur ve HTTPS'i Cloudflare sağlar; sunucuda sertifika gerekmez.
Ardından **SSL/TLS → Edge Certificates → Always Use HTTPS** açın ve `www` → kök alan adı için
**Rules → Redirect Rules** ile 301 yönlendirmesi ekleyin.

### 3. Google Search Console

Alan adını **Domain property** olarak ekleyin (doğrulama TXT kaydını Cloudflare DNS'e girin) ve
`https://altyaziceviri.tr/sitemap.xml` adresini gönderin.

## Yapı

| Dosya                             | Görev                                                  |
| --------------------------------- | ------------------------------------------------------ |
| `src/routes/+page.svelte`         | Arayüz, kamera, bölge seçimi, OCR döngüsü, SEO içeriği |
| `src/lib/tarayici.ts`             | Masaüstü Chrome 138+ kontrolü                          |
| `src/lib/goruntu.ts`              | Kare ön işleme (eşikleme) ve değişiklik tespiti        |
| `src/lib/islem.ts`                | OCR metni → yazım → argo işlem hattı                   |
| `src/lib/yazim.ts`                | OCR yazım düzeltme                                     |
| `src/lib/argo.ts`                 | Argo sözlüğü motoru                                    |
| `src/lib/ceviri.ts`               | Chrome yerleşik çevirmeni (Translator API)             |
| `src/lib/site.ts`                 | Alan adı, başlık ve açıklama (SEO)                     |
| `src/lib/server/sayac.ts`         | JSON dosyalı ziyaretçi sayacı                          |
| `src/routes/api/sayac/+server.ts` | Sayaç API'si                                           |
| `Dockerfile`                      | Coolify için üretim imajı                              |
