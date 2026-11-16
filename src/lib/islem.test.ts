import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { argoUygula } from './argo.ts';
import { hazirla } from './islem.ts';
import { DEGISIM_ESIGI, DURGUNLUK_ESIGI, imzaFarki, type Imza } from './goruntu.ts';
import { yazimDuzelt, yazimSozluguYukle } from './yazim.ts';
import { metinTemizle, tekrarMi, uzantiMi } from './metin.ts';
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
		['Ask Lucia Carninos', 'Ask Lucia Caminos'], // korunan soyadı, rn → m
		['WE FLEW TO CAYO PERICO', 'We flew to Cayo Perico'], // tamamı büyük harf
		['Ill remember you', "I'll remember you"],
		['Hey,hey.Stop', 'Hey, hey. Stop'],
		['Weare going', 'We are going'],
		['Animal pelts andfother items', 'Animal pelts and other items'], // araya yapışmış çöp harf
		['all designed to be.explored on foot', 'all designed to be explored on foot'],
		['(You kitled my cousin)', '(You killed my cousin)'] // fast model hatası
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
			const p = parcalara([satir(k(w, 500, 40), k('word' + w, 560, 40))], filtre);
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

describe('RDR2 denemesinden gelen örnekler', () => {
	const k = (text: string, x: number, y = 40, confidence = 95): OcrKelime => ({
		text,
		confidence,
		bbox: { x0: x, y0: y, x1: x + text.length * 20, y1: y + 40 }
	});
	const satir = (...words: OcrKelime[]): OcrSatir => ({ words });

	it.each([
		[
			"Your actions have consequences and It's up to you to decide Just Now honorable Arthur Is.",
			"Your actions have consequences and it's up to you to decide just now honorable Arthur is."
		],
		['(Oh God, You did it.)', '(Oh God, you did it.)'],
		["(Well Ain't this a rare treat?)", "(Well ain't this a rare treat?)"],
		['(Take it easy. Do what you want.)', '(Take it easy. Do what you want.)'] // cümle başı korunur
	])('cümle ortası büyük harf: %s', (girdi, beklenen) => {
		expect(yazimDuzelt(girdi)).toBe(beklenen);
	});

	it.each([
		['this place 1s just too far for us.', 'this place is just too far for us.'],
		['Stay w1th me.', 'Stay with me.'],
		['Put it 0n the table.', 'Put it on the table.'],
		['1t was a lie.', 'It was a lie.'], // cümle başı büyük harf
		// sayılara ve saat/sıra kalıplarına dokunulmaz
		['In the 1800s at 10 o clock', 'In the 1800s at 10 o clock'],
		['Meet me at 1am, 2nd floor, room 101.', 'Meet me at 1am, 2nd floor, room 101.'],
		['The 10s and 50s were wild.', 'The 10s and 50s were wild.']
	])('harfe karışmış rakam: %s', (girdi, beklenen) => {
		expect(yazimDuzelt(girdi)).toBe(beklenen);
	});

	it.each([
		["(Well ain't this a rare treat?)", "(Well isn't this a rare treat?)"],
		['(Hold still girl)', "(Don't move girl)"],
		["I ain't got no money", "I don't have any money"]
	])('argo: %s', (girdi, beklenen) => {
		expect(argoUygula(girdi)).toBe(beklenen);
	});

	it('kapanmamış parantezli diyaloğu tek parça tutar', () => {
		const p = parcalara([
			satir(k('(Now', 500), k('Shoo', 610), k('please.', 720)),
			satir(k('I', 400, 110), k('am', 430, 110), k('waiting', 490, 110), k('up)', 660, 110))
		]);
		expect(p.parcalar).toEqual(['(Now Shoo please. I am waiting up)']);
	});

	it('kısa diyalog satırını (ayrı satırda) atmaz', () => {
		const p = parcalara([
			satir(k('(Should', 300), k('have', 460), k('killed', 560), k('you?)', 700)),
			satir(k('(Me?)', 560, 110))
		]);
		expect(p.parcalar).toEqual(['(Should have killed you?)', '(Me?)']);
	});

	it('aynı satırda büyük boşlukla ayrılmış çöp grubu atar', () => {
		const p = parcalara([
			satir(
				k('KK', 20),
				k('4', 70),
				k('HD', 100),
				k('Each', 500),
				k('time', 600),
				k('they', 700),
				k('flee', 800)
			)
		]);
		expect(p.parcalar).toEqual(['Each time they flee']);
	});

	it('karışık büyük harfli OCR çıktısını düzeltir', () => {
		expect(yazimDuzelt('(I aM HaPPY)')).toBe('(I am happy)');
	});

	it('satır satır uzayan metni uzantı sayar', () => {
		const a =
			"There is a huge world to explore set across a range of America's heartland and frontier";
		const b = a + ' did from harsh mountain trails and dense forests';
		expect(uzantiMi(b, a)).toBe(true);
		expect(uzantiMi(a, b)).toBe(false); // kısalma uzantı değil (tekrarMi yakalar)
		expect(tekrarMi(a, b)).toBe(true);
		expect(uzantiMi('Hunting helps the camp or earns you money.', a)).toBe(false);
	});
});

describe('akış simülasyonu (sayfadaki karar mantığı)', () => {
	const G = 1500; // OCR görüntü genişliği
	const k = (text: string, x: number, y: number): OcrKelime => ({
		text,
		confidence: 90,
		bbox: { x0: x, y0: y, x1: x + text.length * 22, y1: y + 40 }
	});
	// Altyazıyı ortalanmış kelimelere çevirir
	const ortala = (metin: string, y: number) => {
		const w = metin.split(' ');
		let x = G / 2 - (metin.length * 22) / 2;
		return w.map((t) => {
			const r = k(t, x, y);
			x += t.length * 22 + 14;
			return r;
		});
	};

	// +page.svelte'deki yaziOku() kararlarının aynısı
	function calistir(kareler: OcrSatir[][]) {
		const filtre = new SabitFiltre();
		let son = '';
		const gecmis: string[] = [];
		for (const satirlar of kareler) {
			const p = parcalara(satirlar, filtre, G);
			const en = p.parcalar
				.map((x) => hazirla(x, { yazim: true, argo: false }).duzeltilmis)
				.filter((x) => /[A-Za-z].*[A-Za-z]/.test(x))
				.join('\n');
			if ((en.match(/[A-Za-z]/g) || []).length < 2 || tekrarMi(en, son)) continue;
			const uzanti = uzantiMi(en, son);
			son = en;
			if (!uzanti) filtre.ogren(p.kelimeler, p.kisaSatirlar);
			if (uzanti && gecmis.length) gecmis[0] = en;
			else gecmis.unshift(en);
		}
		return gecmis.reverse();
	}

	it('her seferinde farklı okunan köşe logosunu konumundan öğrenir', () => {
		const logo = ['Gi bfg', 'her', 'grand', 'GRaND', 'her', 'dUGIOR'];
		const altyazi = [
			'Hunting helps the camp.',
			'Your saddle can store weapons.',
			'Each weapon is unique.',
			'Shooting has been improved.',
			'This is a rich world.',
			'And the modern world was born.'
		];
		const sonuc = calistir(
			altyazi.map((a, i) => [
				{ words: logo[i].split(' ').map((t, j) => k(t, 40 + j * 70 + (i % 2) * 4, 30)) },
				{ words: ortala(a, 110) }
			])
		);
		// ilk 3 altyazıda logo görünebilir, sonrasında görünmemeli
		expect(sonuc.slice(3)).toEqual(altyazi.slice(3));
	});

	it('satır satır uzayan anlatımı tek kayıtta günceller', () => {
		const s1 = "There is a huge world to explore set across America's heartland";
		const s2 = 'from harsh mountain trails and dense forests';
		const s3 = 'to rugged livestock towns and much more.';
		const sonuc = calistir([
			[{ words: ortala(s1, 40) }],
			[{ words: ortala(s1, 40) }, { words: ortala(s2, 90) }],
			[{ words: ortala(s1, 40) }, { words: ortala(s2, 90) }, { words: ortala(s3, 140) }],
			[{ words: ortala('Hunting helps the camp.', 40) }]
		]);
		expect(sonuc).toEqual([`${s1} ${s2} ${s3}`, 'Hunting helps the camp.']);
	});

	it('ortadaki art arda kısa diyalogları logo sanmaz', () => {
		const sonuc = calistir(
			['(Yes.)', '(No.)', '(What?)', '(Me?)', '(Go.)'].map((d) => [{ words: ortala(d, 110) }])
		);
		expect(sonuc).toEqual(['(Yes.)', '(No.)', '(What?)', '(Me?)', '(Go.)']);
	});

	it('aynı satırdaki küçük çöp grubunu atar ("her grand")', () => {
		const sonuc = calistir([
			[
				{
					words: [
						k('her', 20, 40),
						k('grand', 90, 40),
						...ortala('More interactive and detailed than ever', 40)
					]
				}
			]
		]);
		expect(sonuc).toEqual(['More interactive and detailed than ever']);
	});
});

describe('arka arkaya gelen altyazılar', () => {
	const imza = (desen: string): Imza => {
		const bit = Uint8Array.from(desen, (c) => (c === '#' ? 1 : 0));
		return { w: desen.length, h: 1, bit, yazi: bit.reduce((a, b) => a + b, 0) };
	};

	it('yazı pikselleri yer değiştirince değişiklik sayılır, küçük titreme sayılmaz', () => {
		const a = imza('..##.###..##.#....');
		const farkli = imza('.#..##..#.##..##..'); // aynı uzunlukta başka yazı
		const titreme = imza('..##.###..##.##...'); // 1 piksel fark
		expect(imzaFarki(a, farkli)).toBeGreaterThan(DEGISIM_ESIGI);
		expect(imzaFarki(a, titreme)).toBeLessThanOrEqual(DURGUNLUK_ESIGI);
		expect(imzaFarki(imza('..........'), imza('...##.....'))).toBeGreaterThan(DEGISIM_ESIGI); // boş → yazı
		expect(imzaFarki(a, imza('###'))).toBeGreaterThan(DEGISIM_ESIGI); // bölge boyutu değişti
	});

	it('aynı kelimeleri farklı sırayla içeren altyazıyı tekrar saymaz', () => {
		expect(tekrarMi("I don't want you.", "(Do what you want. I don't care.)")).toBe(false);
		// araya çöp karışmış aynı altyazı yine tekrar
		expect(
			tekrarMi(
				'rugged livestock towns to modernizing cities and much more.',
				'gran rugged livestock towns GN to modernizing cities and much more. auth'
			)
		).toBe(true);
	});
});
