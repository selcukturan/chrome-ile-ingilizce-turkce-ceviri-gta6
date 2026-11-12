// Kamera karesinden altyazı bölgesini kesip OCR için "beyaz zemin üstünde siyah yazı"ya çevirir.

export type Bolge = { x: number; y: number; w: number; h: number }; // 0..1 normalize
export type AltyaziTipi = 'white' | 'yellow' | 'dark' | 'none';

export type Kare = { murekkep: number; imza: number[] };

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
	for (let i = 0; i < d.length; i += 4) {
		const r = d[i],
			g = d[i + 1],
			b = d[i + 2];
		const lum = 0.299 * r + 0.587 * g + 0.114 * b;
		if (tip === 'none') {
			const v = 255 - lum;
			d[i] = d[i + 1] = d[i + 2] = v;
			if (v < 128) murekkep++;
			continue;
		}
		let yazi: boolean;
		if (tip === 'white') yazi = lum > esik && Math.max(r, g, b) - Math.min(r, g, b) < 60;
		else if (tip === 'yellow') yazi = r > esik && g > esik - 30 && b < r - 50;
		else yazi = lum < 255 - esik;
		const v = yazi ? 0 : 255;
		d[i] = d[i + 1] = d[i + 2] = v;
		if (yazi) murekkep++;
	}
	ctx.putImageData(img, 0, 0);

	if (onizleme) {
		onizleme.width = is.width;
		onizleme.height = is.height;
		onizleme.getContext('2d')!.drawImage(is, 0, 0);
	}
	return { murekkep: murekkep / (d.length / 4), imza: imzaCikar(is, img.data) };
}

// Değişiklik tespiti için küçük imza (24x6 ızgara)
function imzaCikar(is: HTMLCanvasElement, d: Uint8ClampedArray): number[] {
	const gw = 24,
		gh = 6,
		cw = is.width / gw,
		ch = is.height / gh,
		out: number[] = [];
	for (let gy = 0; gy < gh; gy++)
		for (let gx = 0; gx < gw; gx++) {
			let s = 0,
				n = 0;
			for (let y = Math.floor(gy * ch); y < (gy + 1) * ch; y += 3)
				for (let x = Math.floor(gx * cw); x < (gx + 1) * cw; x += 3) {
					s += d[(y * is.width + x) * 4];
					n++;
				}
			out.push(n ? s / n : 255);
		}
	return out;
}

export function imzaFarki(a: number[] | null, b: number[] | null): number {
	if (!a || !b) return 999;
	let s = 0;
	for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]);
	return s / a.length;
}
