// Ana sayfadaki "!" bilgi balonlarının metinleri (Bilgi.svelte)

export const BILGI = {
	sahne:
		'Kameradan gelen görüntü. Fareyle sürükleyerek altyazının çıktığı bölgeyi seçin. Bölgeyi yalnızca altyazı satırlarını kapsayacak kadar dar tutun: daha hızlı ve daha doğru okunur. Seçiminiz kaydedilir.',
	altyazi:
		'Okunan altyazının Türkçe çevirisi. Altında küçük harflerle okunan İngilizce metin görünür (kapatılabilir). Altyazı ekrandan kalkınca çeviri de yaklaşık 1 saniye sonra silinir.',
	onizleme:
		"Görüntünün yazı okuma (OCR) için temizlenmiş hali. Altyazı beyaz zemin üstünde siyah ve net görünmeli, başka siyah leke olmamalı. Kırmızı çerçeve OCR'a gönderilen alandır. Sorun varsa Parlaklık eşiğini ya da Altyazı tipini değiştirin.",
	kamera:
		'Görüntünün geleceği cihaz: web kamerası, web kamerası olarak bağlanan telefon ya da capture kart. Sonradan bağladığınız cihaz listede görünmüyorsa ⟳ ile listeyi yenileyin.',
	baslat:
		"Kamerayı başlat: seçili cihazı açar (tarayıcı izin ister). Çeviriyi başlat: altyazıları okuyup çevirmeye başlar. İlk seferde Chrome'un Türkçe dil paketi ve yazı okuma motoru (~10 MB) bir kez indirilir.",
	tip: 'Altyazının rengi. PS5 oyunlarının çoğunda koyu kenarlı beyaz yazı kullanılır; varsayılan budur. Altyazı sarıysa ya da açık zemin üstünde koyu yazıysa buradan değiştirin.',
	esik: 'Bir pikselin yazı sayılması için gereken en düşük parlaklık. Önizlemede harfler kopuk ya da silikse düşürün; arka plandan çok leke geliyorsa yükseltin. Çoğu durumda 170–210 arası iyi çalışır.',
	ingilizce:
		'Türkçe çevirinin altında okunan İngilizce metni de gösterir. Çeviriyi kontrol etmek için kullanışlıdır.',
	tamEkran:
		'Çeviriyi tüm ekranı kaplayan büyük yazıyla gösterir; bilgisayarı uzaktan okumak için. Kapatmak için ekrana tıklayın ya da Esc tuşuna basın.',
	gecmis:
		'Bu oturumda çevrilen son 50 altyazı, en yenisi üstte. Kaçırdığınız bir cümleye buradan dönebilirsiniz.',
	gelistirici:
		'Performans istatistiklerini ve ince ayarları (tarama aralığı, OCR güveni, yazım düzeltme, argo, ek altyazı tipleri) gösterir. Normal kullanım için gerekmez.',
	aralik:
		'Ekranın ne sıklıkla kontrol edileceği. Düşük değer altyazıyı daha çabuk yakalar ama işlemciyi daha çok kullanır. Görüntü değişmediğinde zaten iş yapılmaz. Varsayılan: 200 ms.',
	guven:
		'Okunan metne güven bu değerin altındaysa çevrilmez (yarım belirmiş ya da bozuk okumalar elenir). Doğru altyazılar atlanıyorsa düşürün, anlamsız çeviriler geliyorsa yükseltin. Varsayılan: %55.',
	yazim:
		"Yazı okumanın tipik hatalarını çeviriden önce düzeltir: 'rn' → 'm', '1 am' → 'I am', '1s' → 'is', bitişik kelimeler… Korunan kelimelere (karakter ve yer adları) dokunmaz.",
	argo: "Sokak argosunu çeviriden önce sade İngilizceye çevirir ('the hood' → 'the neighborhood'). Çevirmen argoyu çoğu zaman kelimesi kelimesine çevirdiği için çeviri daha anlaşılır olur.",
	istat:
		'Tarama: ekran kontrolü (değişmedi: görüntü aynı kaldığı için atlanan) · Bekleme: altyazının tam belirmesi beklendi · OCR: yazı okuma ve ortalama süresi · Tekrar: aynı altyazı yeniden okundu · Düşük güven: okunup çevrilmeyen · Gecikme: yazının değiştiği andan çevirinin ekrana gelmesine kadar geçen süre.'
};

// Kamera donanım ayarları (KameraAyarlari.svelte)
export const KAMERA_BILGI: Record<string, string> = {
	genel:
		'Kameranın kendi donanım ayarları (cihaz destekliyorsa). TV ekranına bakan kamerada parlaklığı yükseltip pozlamayı düşürmeyi deneyin: ekran kararır, beyaz altyazı öne çıkar. Doğru değerler ortam ışığına göre değişir. Ayarlar her cihaz için ayrı saklanır.',
	brightness: 'Görüntünün genel parlaklığı. Yükseltmek altyazının beyazını belirginleştirir.',
	contrast: 'Açık ve koyu tonlar arasındaki fark. Biraz yükseltmek yazıyı arka plandan ayırır.',
	saturation: 'Renk canlılığı. Beyaz altyazı için önemi azdır; sarı altyazıda düşük tutmayın.',
	sharpness: 'Kenar keskinliği. Fazlası harflerin etrafında hale oluşturabilir.',
	exposureCompensation:
		'Otomatik pozlamayı aydınlatıp karartır. Düşürmek TV ekranını karartır, parlak altyazı öne çıkar.',
	exposureTime:
		'Pozlama süresi. Düşürmek ekranı karartır, yazıyı netleştirir ve hareket bulanıklığını azaltır. Pozlama "Elle" olmalı.',
	colorTemperature:
		'Beyaz dengesi (renk sıcaklığı). Beyaz altyazının sarı/mavi görünmesini düzeltir.',
	focusDistance:
		'Odak mesafesi. Otomatik odak TV ekranında kayabiliyorsa Odak "Elle" seçip buradan sabitleyin.',
	exposureMode:
		'Otomatik: kamera pozlamayı kendisi ayarlar. Elle: pozlama süresini siz seçersiniz.',
	whiteBalanceMode:
		'Otomatik: renk dengesini kamera ayarlar. Elle: renk sıcaklığını siz seçersiniz.',
	focusMode: 'Otomatik odak bazen ekranda kayar; Elle seçip odak mesafesini sabitleyebilirsiniz.'
};
