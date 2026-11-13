// Kamera karesinden altyazı bölgesini kesip OCR için "beyaz zemin üstünde siyah yazı"ya çevirir.

export type Bolge = { x: number; y: number; w: number; h: number }; // 0..1 normalize
import { konturluYazi } from './ayikla.ts';

export type AltyaziTipi = 'white' | 'white-basit' | 'yellow' | 'dark' | 'none';

export type Kutu = { left: number; top: number; width: number; height: number };
export type Kare = { murekkep: number; imza: Imza; kutu: Kutu };

const KUTU_PAYI = 16; // yazı kutusunun kenarına bırakılan boşluk (kelime kesilmesin)

export function kareIsle(
	video: HTMLVideoElement,
	bolge: Bolge,
	esik: number,
	tip: AltyaziTipi,
	is: HTMLCanvasElement,
	onizleme?: HTMLCanvasElement
): Kare | null {
	const vw = video.videoWidth,
		vh = video.videoHeight;
	if (!vw) return null;
	const ctx = is.getContext('2d', { willReadFrequently: true })!;
	const sx = bolge.x * vw,
		sy = bolge.y * vh,
		sw = bolge.w * vw,
		sh = bolge.h * vh;
	const olcek = Math.min(3, Math.max(1, 120 / Math.max(1, sh / 2))); // satır başına ~60px+ hedefi
	is.width = Math.round(sw * olcek);
	is.height = Math.round(sh * olcek);
	ctx.imageSmoothingQuality = 'high';
	ctx.drawImage(video, sx, sy, sw, sh, 0, 0, is.width, is.height);

	const img = ctx.getImageData(0, 0, is.width, is.height),
		d = img.data;
	let murekkep = 0;
	const W = is.width;
	let minX = W,
		minY = is.height,
		maxX = -1,
		maxY = -1;
	const isaretle = (i: number) => {
		murekkep++;
		const p = i >> 2,
			x = p % W,
			y = (p - x) / W;
		if (x < minX) minX = x;
		if (x > maxX) maxX = x;
		if (y < minY) minY = y;
		if (y > maxY) maxY = y;
	};
	if (tip === 'white') {
		// Konturlu beyaz yazı: arka plandaki parlak alanlar ayıklanır (ayikla.ts)
		const maske = konturluYazi(d, W, is.height, esik);
		for (let p = 0, i = 0; p < maske.length; p++, i += 4) {
			const v = maske[p] ? 0 : 255;
			d[i] = d[i + 1] = d[i + 2] = v;
			if (maske[p]) isaretle(i);
		}
	} else
		for (let i = 0; i < d.length; i += 4) {
			const r = d[i],
				g = d[i + 1],
				b = d[i + 2];
			const lum = 0.299 * r + 0.587 * g + 0.114 * b;
			if (tip === 'none') {
				const v = 255 - lum;
				d[i] = d[i + 1] = d[i + 2] = v;
				if (v < 128) isaretle(i);
				continue;
			}
			let yazi: boolean;
			if (tip === 'white-basit') yazi = lum > esik && Math.max(r, g, b) - Math.min(r, g, b) < 60;
			else if (tip === 'yellow') yazi = r > esik && g > esik - 30 && b < r - 50;
			else yazi = lum < 255 - esik;
			const v = yazi ? 0 : 255;
			d[i] = d[i + 1] = d[i + 2] = v;
			if (yazi) isaretle(i);
		}
	ctx.putImageData(img, 0, 0);

	if (onizleme) {
		onizleme.width = is.width;
		onizleme.height = is.height;
		onizleme.getContext('2d')!.drawImage(is, 0, 0);
	}
	// OCR'a sadece yazının bulunduğu kutu gönderilir (işlenecek piksel azalır)
	const kutu: Kutu =
		maxX < 0
			? { left: 0, top: 0, width: W, height: is.height }
			: {
					left: Math.max(0, minX - KUTU_PAYI),
					top: Math.max(0, minY - KUTU_PAYI),
					width: Math.min(W, maxX + KUTU_PAYI + 1) - Math.max(0, minX - KUTU_PAYI),
					height: Math.min(is.height, maxY + KUTU_PAYI + 1) - Math.max(0, minY - KUTU_PAYI)
				};
	return { murekkep: murekkep / (d.length / 4), imza: imzaCikar(is, img.data), kutu };
}

// ---------- değişiklik tespiti ----------
// İmza: görüntüden seyrek örneklenmiş "yazı pikseli mi?" haritası (~240 sütun).
// Fark: değişen yazı pikseli / yazı pikseli sayısı. Bölge boyutundan ve yazı büyüklüğünden
// bağımsızdır. Ölçüm (sentetik altyazılar): farklı altyazılar 1,26–1,40, boş → yazı 1,00;
// aynı altyazı titreme/gürültüyle en fazla ~0,67.
// (Eski 24x6 ızgara ortalaması, arka arkaya gelen farklı altyazıları ayırt edemiyordu: 0,1–1,9 < 4)
export type Imza = { w: number; h: number; bit: Uint8Array; yazi: number };

/** Bu değerin üstü: ekrandaki yazı değişti. */
export const DEGISIM_ESIGI = 0.9;
/** Bu değerin altı: görüntü durdu (altyazı tam belirdi). */
export const DURGUNLUK_ESIGI = 0.5;

function imzaCikar(is: HTMLCanvasElement, d: Uint8ClampedArray): Imza {
	const adim = Math.max(2, Math.round(is.width / 240));
	const w = Math.ceil(is.width / adim),
		h = Math.ceil(is.height / adim);
	const bit = new Uint8Array(w * h);
	let yazi = 0;
	for (let gy = 0; gy < h; gy++)
		for (let gx = 0; gx < w; gx++) {
			// beyaz zemin üstünde siyah yazı: R kanalı < 128 → yazı
			if (d[(gy * adim * is.width + gx * adim) * 4] < 128) {
				bit[gy * w + gx] = 1;
				yazi++;
			}
		}
	return { w, h, bit, yazi };
}

export function imzaFarki(a: Imza | null, b: Imza | null): number {
	if (!a || !b || a.w !== b.w || a.h !== b.h) return 99;
	let farkli = 0;
	for (let i = 0; i < a.bit.length; i++) if (a.bit[i] !== b.bit[i]) farkli++;
	return farkli / Math.max(a.yazi, b.yazi, 1);
}

// ---------- ön kontrol: görüntü hiç değişmediyse ayıklamayı atla ----------
// Bölge griye çevrilip 256 px genişliğe küçültülür ve en son TAM İŞLENEN kareyle karşılaştırılır
// (önceki kareyle değil: yavaş beliren altyazıda küçük farklar birikip eşiği aşar).
// Parlaklık farkı ON_FARK'tan büyük piksellerin oranı ON_ORAN'ı geçerse "değişti" sayılır.
// Kamera gürültüsü ON_FARK'ın altında kalır. Oyun durdurulmuşken, menüde ya da sabit sahnede
// pahalı ayıklama (10–30 ms) hiç çalışmaz.
const ON_GENISLIK = 256;
const ON_FARK = 30;
const ON_ORAN = 0.002;
/** Görüntü değişmese de en az bu sıklıkta tam işlenir (güvenlik payı). */
const ON_EN_UZUN_MS = 1000;

export class OnKontrol {
	private tuval: HTMLCanvasElement | null = null;
	private ref: Uint8Array | null = null;
	private anahtar = '';
	private zaman = 0;

	/** Ayıklama yapılmalı mı? true dönerse kare referans olarak saklanır. */
	degisti(video: HTMLVideoElement, bolge: Bolge, anahtar: string): boolean {
		const vw = video.videoWidth,
			vh = video.videoHeight;
		if (!vw) return true;
		this.tuval ??= document.createElement('canvas');
		const sw = bolge.w * vw,
			sh = bolge.h * vh;
		const w = ON_GENISLIK,
			h = Math.max(1, Math.round((sh / sw) * w));
		if (this.tuval.width !== w || this.tuval.height !== h) {
			this.tuval.width = w;
			this.tuval.height = h;
		}
		const ctx = this.tuval.getContext('2d', { willReadFrequently: true })!;
		ctx.drawImage(video, bolge.x * vw, bolge.y * vh, sw, sh, 0, 0, w, h);
		const d = ctx.getImageData(0, 0, w, h).data;
		const gri = new Uint8Array(w * h);
		for (let p = 0, i = 0; p < gri.length; p++, i += 4)
			gri[p] = (d[i] * 77 + d[i + 1] * 150 + d[i + 2] * 29) >> 8;

		const simdi = performance.now();
		let degisti =
			!this.ref ||
			this.ref.length !== gri.length ||
			anahtar !== this.anahtar ||
			simdi - this.zaman > ON_EN_UZUN_MS;
		if (!degisti) {
			const sinir = gri.length * ON_ORAN;
			let farkli = 0;
			for (let p = 0; p < gri.length; p++)
				if (Math.abs(gri[p] - this.ref![p]) > ON_FARK && ++farkli > sinir) {
					degisti = true;
					break;
				}
		}
		if (degisti) {
			this.ref = gri;
			this.anahtar = anahtar;
			this.zaman = simdi;
		}
		return degisti;
	}

	sifirla() {
		this.ref = null;
	}
}
