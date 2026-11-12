// Tesseract'ın kelime/satır çıktısını çeviriye uygun parçalara dönüştürür:
//  - düşük güvenli kelimeleri atar ("1e", satıra karışmış filigran gibi),
//  - ekranda hep aynı yerde duran yazıları (logo, kanal adı, filigran) öğrenip atar,
//  - satırları cümle/konuşma parçalarına ayırır (anlatıcı + diyalog ayrı çevrilsin).

export type OcrKelime = {
	text: string;
	confidence: number;
	bbox: { x0: number; y0: number; x1: number; y1: number };
};
export type OcrSatir = { words: OcrKelime[] };

export const KELIME_MIN_GUVEN = 40;

/** Farklı altyazılarda aynı konumda tekrar eden kelimeleri öğrenir. */
export class SabitFiltre {
	private kayit = new Map<string, { kez: number; son: number }>();
	private tur = 0;

	constructor(
		private esik = 3, // art arda kaç farklı altyazıda görülünce sabit sayılsın
		private izgara = 24, // konum toleransı (piksel)
		private unutma = 40 // kaç altyazı boyunca görülmezse unutulsun
	) {}

	private anahtar(k: OcrKelime, dx = 0, dy = 0) {
		const ad = k.text.toLowerCase().replace(/[^a-z0-9]/g, '');
		return `${ad}@${Math.round(k.bbox.x0 / this.izgara) + dx},${Math.round(k.bbox.y0 / this.izgara) + dy}`;
	}

	private bul(k: OcrKelime) {
		for (const dx of [0, -1, 1])
			for (const dy of [0, -1, 1]) {
				const a = this.anahtar(k, dx, dy);
				const v = this.kayit.get(a);
				if (v) return { a, v };
			}
		return null;
	}

	sabitMi(k: OcrKelime): boolean {
		const b = this.bul(k);
		return !!b && b.v.kez >= this.esik;
	}

	/** Yeni bir altyazı kabul edildiğinde, içindeki tüm kelimelerle çağrılır. */
	ogren(kelimeler: OcrKelime[]) {
		this.tur++;
		for (const k of kelimeler) {
			if (!/[a-z0-9]/i.test(k.text)) continue;
			const b = this.bul(k);
			if (b) {
				b.v.kez++;
				b.v.son = this.tur;
			} else this.kayit.set(this.anahtar(k), { kez: 1, son: this.tur });
		}
		for (const [a, v] of this.kayit) {
			// Henüz sabit sayılmayan bir kelime bir altyazıda bile görünmezse seri bozulur:
			// logo her altyazıda vardır, ortak kelimelerin aynı yere art arda düşmesi ise nadirdir.
			if (v.son < this.tur && v.kez < this.esik) this.kayit.delete(a);
			else if (this.tur - v.son > this.unutma) this.kayit.delete(a);
		}
	}

	sifirla() {
		this.kayit.clear();
		this.tur = 0;
	}
}

export type Parcalar = {
	parcalar: string[]; // ayrı ayrı çevrilecek metin parçaları
	guven: number; // kalan kelimelerin ortalama güveni
	kelimeler: OcrKelime[]; // filtreden önceki tüm kelimeler (SabitFiltre.ogren için)
};

const CUMLE_SONU = /[.!?…)"]$/;
const YENI_KONUSMA = /^[([\-–—"]/;

export function parcalara(satirlar: OcrSatir[], filtre?: SabitFiltre): Parcalar {
	const kelimeler: OcrKelime[] = [];
	const temizSatirlar: string[] = [];
	let toplam = 0,
		sayi = 0;

	for (const s of satirlar) {
		const kalan: string[] = [];
		for (const k of s.words) {
			kelimeler.push(k);
			if (k.confidence < KELIME_MIN_GUVEN || filtre?.sabitMi(k)) continue;
			kalan.push(k.text);
			toplam += k.confidence;
			sayi++;
		}
		const metin = kalan.join(' ').trim();
		if (metin) temizSatirlar.push(metin);
	}

	// Satırları birleştir: önceki satır cümle sonuyla bitmiyorsa ve yeni satır yeni bir
	// konuşma ("(", "-", tırnak) başlatmıyorsa aynı cümlenin devamıdır.
	const parcalar: string[] = [];
	for (const satir of temizSatirlar) {
		const son = parcalar.length - 1;
		if (son >= 0 && !CUMLE_SONU.test(parcalar[son]) && !YENI_KONUSMA.test(satir))
			parcalar[son] += ' ' + satir;
		else parcalar.push(satir);
	}

	return { parcalar, guven: sayi ? toplam / sayi : 0, kelimeler };
}
