import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { argoUygula } from './argo.ts';
import { hazirla } from './islem.ts';
import { yazimDuzelt, yazimSozluguYukle } from './yazim.ts';
import { metinTemizle, tekrarMi } from './metin.ts';
import { parcalara, SabitFiltre, type OcrKelime, type OcrSatir } from './ocr.ts';

beforeAll(async () => {
	const sozluk = readFileSync('static/sozluk/en-frekans.txt', 'utf8');
	vi.stubGlobal('fetch', async () => new Response(sozluk));
	await yazimSozluguYukle();
});

describe('yazım düzeltme', () => {
	it.each([
		['I dont know what youre talking about', "I don't know what you're talking about"],
		['Where is the rnoney?', 'Where is the money?'], // rn → m
		['Lets get the hell out of hete', 'Lets get the hell out of here'], // t → r
		['Irobbed the bank', 'I robbed the bank'],
		['Larnar, get in the car', 'Lamar, get in the car'], // korunan isim
		['Ill remember you', "I'll remember you"],
		['Hey,hey.Stop', 'Hey, hey. Stop'],
		['Weare going', 'We are going']
	])('%s', (girdi, beklenen) => {
		expect(yazimDuzelt(girdi)).toBe(beklenen);
	});

	it('korunan kelimelere ve büyük harfli isimlere dokunmaz', () => {
		expect(yazimDuzelt('Franklin and Lucia went to Vinewood')).toBe(
			'Franklin and Lucia went to Vinewood'
		);
		expect(yazimDuzelt("Tell Dre'Quan to meet Boobie")).toBe("Tell Dre'Quan to meet Boobie");
	});

	it('tek büyük harfli kelimeye (kısaltma) dokunmaz', () => {
		expect(yazimDuzelt('Call the FIB now')).toBe('Call the FIB now');
	});

	it.each([
		['(1 AM HAPPY)', '(I am happy)'],
		['WE NEED TO GO, FRANKLIN!', 'We need to go, Franklin!'],
		['In The Late 1800s America Was Evolving.', 'In the late 1800s america was evolving.'],
		['1 think we should go', 'I think we should go'],
		["1'm here", "I'm here"],
		['I have 1 car', 'I have 1 car'] // gerçek rakama dokunmaz
	])('harf düzeni: %s', (girdi, beklenen) => {
		expect(yazimDuzelt(girdi)).toBe(beklenen);
	});
});

describe('kenar temizleme ve tekrar', () => {
	it.each([
		["that's not simply open ! - 4", "that's not simply open!"],
		['vo Wound an animal / f', 'vo Wound an animal'],
		['- , Your actions have consequences', 'Your actions have consequences'],
		['Animal pelts and @rhet items #', 'Animal pelts and rhet items'],
		['looking for a', 'looking for a'] // "a" gerçek kelime
	])('%s', (girdi, beklenen) => {
		expect(metinTemizle(girdi)).toBe(beklenen);
	});

	it('kısmi ve küçük farklı okumaları tekrar sayar', () => {
		const eski = 'gran rugged livestock towns GN to modernizing cities and much more. auth';
		expect(tekrarMi('rugged livestock towns to modernizing cities and much more.', eski)).toBe(
			true
		);
		expect(
			tekrarMi(
				'Rugged livestock towns to modernising cities.',
				'rugged livestock towns to modernizing cities.'
			)
		).toBe(true);
		expect(tekrarMi('Hunting helps the camp.', 'Your saddle can store extra weapons.')).toBe(false);
		expect(tekrarMi('No.', 'No, I said no.')).toBe(false); // kısa yeni altyazı
	});
});

describe('OCR parçaları', () => {
	const k = (text: string, x: number, y: number, confidence = 95): OcrKelime => ({
		text,
		confidence,
		bbox: { x0: x, y0: y, x1: x + 50, y1: y + 40 }
	});
	const satir = (...words: OcrKelime[]): OcrSatir => ({ words });

	it('düşük güvenli kelimeleri atar, cümle sonunda satırları ayırır', () => {
		const p = parcalara([
			satir(k('1e', 300, 48, 2), k('breeds', 364, 40), k('suited.', 500, 40)),
			satir(
				k('(Or', 300, 110),
				k('a', 361, 118),
				k('feller)', 400, 110),
				k('author', 1381, 144, 13)
			)
		]);
		expect(p.parcalar).toEqual(['breeds suited.', '(Or a feller)']);
	});

	it('cümle bitmeden alt satıra geçen metni birleştirir', () => {
		const p = parcalara([
			satir(k('from', 300, 40), k('harsh', 400, 40)),
			satir(k('mountain', 300, 110), k('trails.', 450, 110))
		]);
		expect(p.parcalar).toEqual(['from harsh mountain trails.']);
	});

	it('farklı altyazılarda aynı yerde duran logoyu öğrenip atar', () => {
		const filtre = new SabitFiltre();
		const altyazilar = [
			['Hunting', 'helps'],
			['Your', 'saddle'],
			['Each', 'weapon'],
			['Shooting', 'improved']
		];
		const sonuclar = altyazilar.map(([a, b], i) => {
			// logo hep aynı yerde (küçük titreme ile), altyazı kelimeleri farklı yerlerde
			const p = parcalara(
				[satir(k('GRAND', 20 + (i % 2) * 3, 60), k(a, 400 + i * 37, 40), k(b, 600 + i * 41, 40))],
				filtre
			);
			filtre.ogren(p.kelimeler);
			return p.parcalar[0];
		});
		expect(sonuclar[0]).toBe('GRAND Hunting helps');
		expect(sonuclar[3]).toBe('Shooting improved'); // 3 altyazı sonra logo öğrenildi
	});

	it('ortak kelimenin tesadüfen aynı yere düşmesini logo sanmaz', () => {
		const filtre = new SabitFiltre();
		const sira = ['the', 'x', 'the', 'y', 'the', 'z', 'the'];
		let son = '';
		for (const w of sira) {
			const p = parcalara([satir(k(w, 500, 40), k('word' + w, 700, 40))], filtre);
			filtre.ogren(p.kelimeler);
			son = p.parcalar[0];
		}
		expect(son).toBe('the wordthe');
	});
});

describe('argo', () => {
	it.each([
		['We grew up in the hood', 'We grew up in the neighborhood'],
		['Stop jerking off and help me', 'Stop masturbating and help me'],
		['My nigga, we finna hit a lick', 'My brother, we going to rob someone'],
		["Nothin' happenin' here", 'Nothing happening here'],
		['I got ten grand', 'I got ten thousand dollars'],
		['The hood is quiet', 'The neighborhood is quiet'] // büyük harf korunur
	])('%s', (girdi, beklenen) => {
		expect(argoUygula(girdi)).toBe(beklenen);
	});

	it('kelime içinde eşleşmez', () => {
		expect(argoUygula('childhood memories')).toBe('childhood memories');
	});
});

describe('işlem hattı', () => {
	it('önce yazım, sonra argo', () => {
		const a = hazirla('We grew up in the hood, dont forget it', { yazim: true, argo: true });
		expect(a.duzeltilmis).toBe("We grew up in the hood, don't forget it");
		expect(a.cevrilecek).toBe("We grew up in the neighborhood, don't forget it");
	});
});
