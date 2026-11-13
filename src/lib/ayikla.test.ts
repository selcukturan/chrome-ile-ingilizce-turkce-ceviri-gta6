import { describe, expect, it } from 'vitest';
import { konturluYazi } from './ayikla.ts';

const W = 400,
	H = 80;

function resim(zemin = 150) {
	const d = new Uint8ClampedArray(W * H * 4).fill(zemin);
	for (let i = 3; i < d.length; i += 4) d[i] = 255;
	return d;
}
function boya(d: Uint8ClampedArray, x0: number, y0: number, w: number, h: number, v: number) {
	for (let y = y0; y < y0 + h; y++)
		for (let x = x0; x < x0 + w; x++) {
			const i = (y * W + x) * 4;
			d[i] = d[i + 1] = d[i + 2] = v;
		}
}
// Konturlu "harf": beyaz dikdörtgen, etrafında 3 px siyah kontur
function harf(d: Uint8ClampedArray, x: number, y = 20, w = 8, h = 30) {
	boya(d, x - 3, y - 3, w + 6, h + 6, 20);
	boya(d, x, y, w, h, 250);
}
const yazi = (m: Uint8Array, x: number, y: number) => m[y * W + x] === 1;

describe('konturluYazi', () => {
	it('konturlu harfleri tutar, konturu olmayan parlak zemini atar', () => {
		const d = resim();
		for (let i = 0; i < 6; i++) harf(d, 150 + i * 18);
		boya(d, 10, 10, 80, 50, 235); // parlak gökyüzü/kum parçası (kontursuz)
		const m = konturluYazi(d, W, H, 190);
		for (let i = 0; i < 6; i++) expect(yazi(m, 154 + i * 18, 35)).toBe(true);
		expect(yazi(m, 50, 35)).toBe(false);
	});

	it('harften büyük dolu blokları ve satırdan uzak kırıntıları atar', () => {
		const d = resim();
		for (let i = 0; i < 6; i++) harf(d, 150 + i * 18);
		boya(d, 17, 17, 106, 36, 20); // konturlu ama geniş dolu blok (ör. parlak tabela)
		boya(d, 20, 20, 100, 30, 250);
		boya(d, 357, 2, 10, 8, 20); // satırın üstünde küçük konturlu leke
		boya(d, 359, 4, 6, 4, 250);
		const m = konturluYazi(d, W, H, 190);
		expect(yazi(m, 154, 35)).toBe(true);
		expect(yazi(m, 60, 35)).toBe(false);
		expect(yazi(m, 361, 5)).toBe(false);
	});

	it('koyu kutu içindeki konturuz yazıyı da tutar', () => {
		const d = resim(200); // parlak zemin
		boya(d, 130, 10, 140, 60, 40); // yarı saydam koyu altyazı kutusu
		for (let i = 0; i < 6; i++) boya(d, 150 + i * 18, 20, 8, 30, 245);
		const m = konturluYazi(d, W, H, 190);
		for (let i = 0; i < 6; i++) expect(yazi(m, 154 + i * 18, 35)).toBe(true);
		expect(yazi(m, 20, 35)).toBe(false);
	});

	it('yazı yoksa boş maske döner', () => {
		const d = resim();
		boya(d, 10, 10, 300, 60, 235);
		expect(konturluYazi(d, W, H, 190).some((v) => v)).toBe(false);
	});
});
