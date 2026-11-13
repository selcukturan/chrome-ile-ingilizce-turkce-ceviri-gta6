// Konturlu beyaz altyazıyı arka plandan ayırır ("hale kuralı" + bileşen süzgeci).
//
// Oyun altyazılarında beyaz harfin etrafında hep koyu bir kontur/gölge vardır. Kum, gökyüzü,
// su gibi parlak arka plan da "açık renk" olduğu için basit eşikleme onları da yazı sayar.
// Burada parlak alanlar tek tek leke (bağlı bileşen) olarak ele alınır:
//   1. Kenar piksellerinin çoğu koyu bir pikselin yakınında olan leke yazıdır (harfin konturu).
//      Arka plandaki parlak alanların kenarı ise çoğunlukla orta tonlara değer.
//   2. Harf boyuna uymayan, dolu blok olan, noktadan küçük ya da yazı satırından uzak lekeler atılır.
// Ölçüm (ekran görüntülerinden kesilmiş gerçek kareler): kelime hatası %32,5 → %2,8.

/** Bunun altındaki parlaklık "koyu" (kontur/gölge) sayılır. */
const KOYU = 120;
/** Kontur bu kadar piksel uzaklıkta aranır. */
const YARICAP = 5;
/** Lekenin kenarının en az bu oranı konturun yakınında olmalı. */
const KONTUR_ORANI = 0.5;

type Leke = {
	alan: number;
	x0: number;
	y0: number;
	x1: number;
	y1: number;
	kenar: number;
	konturlu: number;
	tut: boolean;
};

// Her karede büyük diziler ayırmamak için tamponlar saklanır
let tampon: {
	n: number;
	parlak: Uint8Array;
	koyu: Uint8Array;
	ara: Uint8Array;
	yakin: Uint8Array;
	etiket: Int32Array;
	yigin: Int32Array;
} | null = null;

function tamponlar(n: number) {
	if (!tampon || tampon.n < n)
		tampon = {
			n,
			parlak: new Uint8Array(n),
			koyu: new Uint8Array(n),
			ara: new Uint8Array(n),
			yakin: new Uint8Array(n),
			etiket: new Int32Array(n),
			yigin: new Int32Array(n)
		};
	return tampon;
}

// Kare genişletme (ayrılabilir): r yarıçapında 1 varsa 1
function genislet(
	m: Uint8Array,
	W: number,
	H: number,
	r: number,
	ara: Uint8Array,
	son: Uint8Array
) {
	for (let y = 0; y < H; y++) {
		const s = y * W;
		let say = 0;
		for (let x = 0; x < Math.min(r, W); x++) say += m[s + x];
		for (let x = 0; x < W; x++) {
			if (x + r < W) say += m[s + x + r];
			if (x - r - 1 >= 0) say -= m[s + x - r - 1];
			ara[s + x] = say > 0 ? 1 : 0;
		}
	}
	for (let x = 0; x < W; x++) {
		let say = 0;
		for (let y = 0; y < Math.min(r, H); y++) say += ara[y * W + x];
		for (let y = 0; y < H; y++) {
			if (y + r < H) say += ara[(y + r) * W + x];
			if (y - r - 1 >= 0) say -= ara[(y - r - 1) * W + x];
			son[y * W + x] = say > 0 ? 1 : 0;
		}
	}
}

/**
 * RGBA görüntüde konturlu beyaz yazının maskesini (1 = yazı) ve harf boyunu (px; yazı yoksa 0)
 * döndürür. Maske bir sonraki çağrıda yeniden kullanılır; saklanacaksa kopyalanmalı.
 */
export function konturluYazi(
	d: Uint8ClampedArray,
	W: number,
	H: number,
	esik: number
): { maske: Uint8Array; boy: number } {
	const N = W * H;
	const t = tamponlar(N);
	const { parlak, koyu, yakin, etiket, yigin } = t;

	for (let p = 0, i = 0; p < N; p++, i += 4) {
		const r = d[i],
			g = d[i + 1],
			b = d[i + 2];
		const lum = 0.299 * r + 0.587 * g + 0.114 * b;
		parlak[p] = lum > esik && Math.max(r, g, b) - Math.min(r, g, b) < 60 ? 1 : 0;
		koyu[p] = lum < KOYU ? 1 : 0;
	}
	genislet(koyu, W, H, YARICAP, t.ara, yakin);

	// 8-komşulu bağlı bileşenler; kenar pikseli = 4-komşularından biri parlak değil
	etiket.fill(-1, 0, N);
	const lekeler: Leke[] = [];
	for (let p0 = 0; p0 < N; p0++) {
		if (!parlak[p0] || etiket[p0] >= 0) continue;
		const id = lekeler.length;
		const l: Leke = { alan: 0, x0: W, y0: H, x1: 0, y1: 0, kenar: 0, konturlu: 0, tut: false };
		let n = 0;
		yigin[n++] = p0;
		etiket[p0] = id;
		while (n) {
			const p = yigin[--n];
			const x = p % W,
				y = (p - x) / W;
			l.alan++;
			if (x < l.x0) l.x0 = x;
			if (x > l.x1) l.x1 = x;
			if (y < l.y0) l.y0 = y;
			if (y > l.y1) l.y1 = y;
			let kenarda = false;
			for (let dy = -1; dy <= 1; dy++) {
				const ny = y + dy;
				if (ny < 0 || ny >= H) continue;
				for (let dx = -1; dx <= 1; dx++) {
					const nx = x + dx;
					if ((!dx && !dy) || nx < 0 || nx >= W) continue;
					const q = ny * W + nx;
					if (!parlak[q]) {
						if (!dx || !dy) kenarda = true;
					} else if (etiket[q] < 0) {
						etiket[q] = id;
						yigin[n++] = q;
					}
				}
			}
			if (kenarda) {
				l.kenar++;
				if (yakin[p]) l.konturlu++;
			}
		}
		// Bölgenin bir ucundan öbürüne uzanan leke harf olamaz (ör. altyazı kutusunun etrafındaki parlak zemin)
		const boydanBoya = l.x0 === 0 && l.x1 === W - 1;
		l.tut = !boydanBoya && l.kenar > 0 && l.konturlu / l.kenar >= KONTUR_ORANI;
		lekeler.push(l);
	}

	const boy = lekeleriSuz(lekeler);

	// Sonuç maskesi "parlak" tamponuna yazılır
	for (let p = 0; p < N; p++) parlak[p] = etiket[p] >= 0 && lekeler[etiket[p]].tut ? 1 : 0;
	return { maske: parlak.subarray(0, N), boy };
}

// Harf boyuna uymayan ve yazı satırının dışında kalan lekeleri atar; harf boyunu döndürür
function lekeleriSuz(b: Leke[]): number {
	const aday = b.filter((c) => c.tut);
	if (!aday.length) return 0;
	// Harf boyu: alan ağırlıklı boy ortancası (yüzlerce kırıntı, az sayıdaki harften az alan tutar)
	const sirali = [...aday].sort((x, y) => x.y1 - x.y0 - (y.y1 - y.y0));
	const toplam = aday.reduce((s, c) => s + c.alan, 0);
	let birikim = 0,
		boy = 0;
	for (const c of sirali) {
		birikim += c.alan;
		if (birikim >= toplam / 2) {
			boy = c.y1 - c.y0 + 1;
			break;
		}
	}
	const harfler = aday.filter((c) => {
		const h = c.y1 - c.y0 + 1;
		return h >= boy * 0.5 && h <= boy * 1.6;
	});
	const alanlar = harfler.map((c) => c.alan).sort((x, y) => x - y);
	const harfAlani = alanlar.length ? alanlar[alanlar.length >> 1] : 0;
	for (const c of aday) {
		const h = c.y1 - c.y0 + 1,
			w = c.x1 - c.x0 + 1;
		if (h > boy * 1.8)
			c.tut = false; // harften büyük leke
		else if (w > boy * 3 && c.alan > w * h * 0.6)
			c.tut = false; // dolu yatay blok
		else if (c.alan < harfAlani * 0.015) c.tut = false; // "i" noktasından küçük kırıntı
	}
	// Harf boyundaki bir lekeyle aynı satırda (dikeyde örtüşen) ve ona yakın olmalı
	const tutulan = harfler.filter((c) => c.tut);
	for (const c of aday) {
		if (!c.tut) continue;
		c.tut = tutulan.some(
			(t) =>
				t !== c && t.y0 <= c.y1 && c.y0 <= t.y1 && Math.max(t.x0 - c.x1, c.x0 - t.x1) < boy * 1.2
		);
	}
	return boy;
}
