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

/**
 * tesseract.js v6+ sadece blok hiyerarşisini döndürür (data.lines kaldırıldı):
 * blocks → paragraphs → lines → words. Satırları sırasıyla düz bir listeye toplar.
 */
export function satirlariTopla(
	bloklar: { paragraphs: { lines: OcrSatir[] }[] }[] | null | undefined,
	olcek = 1 // OCR'a küçültülmüş görüntü verildiyse: konumlar işleme tuvalinin ölçeğine geri çevrilir
): OcrSatir[] {
	const satirlar = (bloklar ?? []).flatMap((b) => b.paragraphs.flatMap((p) => p.lines));
	if (olcek === 1) return satirlar;
	return satirlar.map((s) => ({
		...s,
		words: s.words.map((k) => ({
			...k,
			bbox: {
				x0: k.bbox.x0 / olcek,
				y0: k.bbox.y0 / olcek,
				x1: k.bbox.x1 / olcek,
				y1: k.bbox.y1 / olcek
			}
		}))
	}));
}
type Kutu = OcrKelime['bbox'];

export const KELIME_MIN_GUVEN = 40;

/**
 * Farklı altyazılarda aynı konumda tekrar eden yazıları öğrenir:
 *  - kelimeler: metin + konum ("author" filigranı),
 *  - kısa kenar satırları: sadece konum (logo her seferinde farklı okunsa da: "Gi bfg", "her", "grand").
 */
export class SabitFiltre {
	private kayit = new Map<string, { kez: number; son: number }>();
	private bolgeler = new Map<string, { kez: number; son: number }>();
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

	private bolgeAnahtar(b: Kutu, dx = 0, dy = 0) {
		const g = this.izgara * 2;
		return `${Math.round((b.x0 + b.x1) / 2 / g) + dx},${Math.round((b.y0 + b.y1) / 2 / g) + dy}`;
	}

	private bolgeBul(b: Kutu) {
		for (const dx of [0, -1, 1])
			for (const dy of [0, -1, 1]) {
				const a = this.bolgeAnahtar(b, dx, dy);
				const v = this.bolgeler.get(a);
				if (v) return { a, v };
			}
		return null;
	}

	sabitBolgeMi(b: Kutu): boolean {
		const r = this.bolgeBul(b);
		return !!r && r.v.kez >= this.esik;
	}

	/** Yeni bir altyazı kabul edildiğinde, içindeki tüm kelimeler ve kısa kenar satırlarıyla çağrılır. */
	ogren(kelimeler: OcrKelime[], kisaSatirlar: Kutu[] = []) {
		this.tur++;
		for (const b of kisaSatirlar) {
			const r = this.bolgeBul(b);
			if (r) {
				r.v.kez++;
				r.v.son = this.tur;
			} else this.bolgeler.set(this.bolgeAnahtar(b), { kez: 1, son: this.tur });
		}
		for (const [a, v] of this.bolgeler) {
			if (v.son < this.tur && v.kez < this.esik) this.bolgeler.delete(a);
			else if (this.tur - v.son > this.unutma) this.bolgeler.delete(a);
		}
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
		this.bolgeler.clear();
		this.tur = 0;
	}
}

export type Parcalar = {
	parcalar: string[]; // ayrı ayrı çevrilecek metin parçaları
	guven: number; // kalan kelimelerin ortalama güveni
	kelimeler: OcrKelime[]; // filtreden önceki tüm kelimeler (SabitFiltre.ogren için)
	kisaSatirlar: Kutu[]; // kenardaki kısa satırların kutuları (SabitFiltre.ogren için)
};

const KISA_SATIR_HARF = 10; // bu kadar harf ve en fazla 3 kelimeden oluşan satır "kısa" sayılır
const KENAR_ORANI = 0.2; // satır merkezi görüntü merkezinden genişliğin bu oranı kadar uzaksa kenardadır

const CUMLE_SONU = /[.!?…)"]$/;
const YENI_KONUSMA = /^[([\-–—"]/;
const BOSLUK_KAT = 2.5; // satır yüksekliğinin kaç katı boşluk ayrı bir yazı grubu sayılsın

const harfSayisi = (s: string) => (s.match(/[A-Za-z]/g) || []).length;
const parantezAcik = (s: string) => (s.match(/\(/g) || []).length > (s.match(/\)/g) || []).length;

/** Aynı satırda büyük boşlukla ayrılmış küçük grupları (köşedeki logo, "KK 4 HD") atar. */
function gruplariSuz(kelimeler: OcrKelime[]): OcrKelime[] {
	if (kelimeler.length < 2) return kelimeler;
	const yukseklikler = kelimeler.map((k) => k.bbox.y1 - k.bbox.y0).sort((a, b) => a - b);
	const esik = yukseklikler[yukseklikler.length >> 1] * BOSLUK_KAT;
	const gruplar: OcrKelime[][] = [[kelimeler[0]]];
	for (let i = 1; i < kelimeler.length; i++) {
		if (kelimeler[i].bbox.x0 - kelimeler[i - 1].bbox.x1 > esik) gruplar.push([]);
		gruplar[gruplar.length - 1].push(kelimeler[i]);
	}
	if (gruplar.length === 1) return kelimeler;
	const harf = gruplar.map((g) => harfSayisi(g.map((k) => k.text).join('')));
	const enBuyuk = Math.max(...harf);
	// Altyazı satırı tek bir bloktur; ondan belirgin şekilde küçük gruplar çöptür
	return gruplar.filter((_, i) => harf[i] >= enBuyuk * 0.5).flat();
}

function birlesik(kelimeler: OcrKelime[]): Kutu {
	return {
		x0: Math.min(...kelimeler.map((k) => k.bbox.x0)),
		y0: Math.min(...kelimeler.map((k) => k.bbox.y0)),
		x1: Math.max(...kelimeler.map((k) => k.bbox.x1)),
		y1: Math.max(...kelimeler.map((k) => k.bbox.y1))
	};
}

/**
 * @param genislik OCR'a verilen görüntünün genişliği; kenardaki kısa satırları (logo) ayırt etmek için.
 */
export function parcalara(satirlar: OcrSatir[], filtre?: SabitFiltre, genislik = 0): Parcalar {
	const kelimeler: OcrKelime[] = [];
	const kisaSatirlar: Kutu[] = [];
	const temizSatirlar: string[] = [];
	let toplam = 0,
		sayi = 0;

	for (const s of satirlar) {
		const kalan: OcrKelime[] = [];
		for (const k of s.words) {
			kelimeler.push(k);
			if (k.confidence < KELIME_MIN_GUVEN || filtre?.sabitMi(k)) continue;
			kalan.push(k);
		}
		const suzulmus = gruplariSuz(kalan);

		// Kenarda duran kısa satır: konumu öğrenilir, sabitse atılır
		if (genislik && s.words.length) {
			const kutu = birlesik(s.words);
			const metin = suzulmus.map((k) => k.text).join('');
			const kenarda = Math.abs((kutu.x0 + kutu.x1) / 2 - genislik / 2) > genislik * KENAR_ORANI;
			if (kenarda && suzulmus.length <= 3 && harfSayisi(metin) <= KISA_SATIR_HARF) {
				kisaSatirlar.push(kutu);
				if (filtre?.sabitBolgeMi(kutu)) continue;
			}
		}

		for (const k of suzulmus) {
			toplam += k.confidence;
			sayi++;
		}
		const metin = suzulmus
			.map((k) => k.text)
			.join(' ')
			.trim();
		if (metin) temizSatirlar.push(metin);
	}

	// Satırları birleştir:
	//  - açık parantez kapanmadıysa aynı konuşmanın devamıdır,
	//  - önceki satır cümle sonuyla bitmiyorsa ve yeni satır yeni bir konuşma
	//    ("(", "-", tırnak) başlatmıyorsa aynı cümlenin devamıdır.
	const parcalar: string[] = [];
	for (const satir of temizSatirlar) {
		const son = parcalar.length - 1;
		const onceki = parcalar[son];
		if (
			son >= 0 &&
			(parantezAcik(onceki) || (!CUMLE_SONU.test(onceki) && !YENI_KONUSMA.test(satir)))
		)
			parcalar[son] += ' ' + satir;
		else parcalar.push(satir);
	}

	return { parcalar, guven: sayi ? toplam / sayi : 0, kelimeler, kisaSatirlar };
}
