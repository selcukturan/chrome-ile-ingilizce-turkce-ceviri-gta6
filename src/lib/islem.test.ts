import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { argoUygula } from './argo.ts';
import { hazirla } from './islem.ts';
import { yazimDuzelt, yazimSozluguYukle } from './yazim.ts';

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

	it('HUD yazılarına dokunmaz', () => {
		expect(yazimDuzelt('WASTED')).toBe('WASTED');
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
