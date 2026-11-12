// OCR sonrası İngilizce yazım düzeltme (tamamen tarayıcıda çalışır).
//
// Kamera + OCR'da tipik karışmalar: r↔t, n↔h, rn→m, c→t, i→f, l→I ...
// 1) Önce bu hedefli değişimler denenir,
// 2) olmazsa SymSpell mantığıyla 1 harflik düzeltme yapılır,
// 3) bitişik yazılmış kelimeler ayrılır ("getdown" → "get down").
// Büyük harfle başlayan (cümle başı olmayan) kelimeler isim kabul edilip dokunulmaz.
// Korunan kelimeler (karakter/yer adları vb.): src/lib/sozluk/korunan.txt
import korunanMetni from './sozluk/korunan.txt?raw';

const SOZLUK_ADRESI = '/sozluk/en-frekans.txt'; // SymSpell frequency_dictionary_en_82_765 (MIT)
const TOPLAM_KELIME = 1024908267229; // SymSpell'deki korpus büyüklüğü (olasılık hesabı için)

// OCR'ın sık karıştırdığı harf grupları (yanlış → doğru)
const KARISMALAR: [string, string][] = [
	['rn', 'm'], ['r', 't'], ['n', 'h'], ['c', 't'], ['i', 'f'], ['l', 'i'],
	['t', 'r'], ['h', 'n'], ['m', 'rn'], ['ii', 'u'], ['vv', 'w'], ['0', 'o'],
	['1', 'l'], ['5', 's'], ['l', 't'], ['t', 'l'], ['g', 'c'], ['rm', 'm']
]; // prettier-ignore

// Kesme işareti düşmüş kısaltmalar
const KISALTMALAR: Record<string, string> = {
	dont: "don't", cant: "can't", wont: "won't", didnt: "didn't", doesnt: "doesn't",
	isnt: "isn't", wasnt: "wasn't", arent: "aren't", werent: "weren't", havent: "haven't",
	hasnt: "hasn't", couldnt: "couldn't", shouldnt: "shouldn't", wouldnt: "wouldn't",
	aint: "ain't", im: "I'm", ive: "I've", youre: "you're", theyre: "they're",
	thats: "that's", whats: "what's", theres: "there's", heres: "here's", wheres: "where's",
	hes: "he's", shes: "she's", itll: "it'll", youll: "you'll", theyll: "they'll",
	youve: "you've", weve: "we've", theyve: "they've", yall: "y'all", cmon: "c'mon",
	therell: "there'll", thatll: "that'll", whatll: "what'll", wholl: "who'll", itd: "it'd"
}; // prettier-ignore

// Sözlükte olmayan ama doğru kabul edilen konuşma dili kelimeleri
const EK_KELIMELER = new Set(
	`ain't y'all c'mon 'em 'bout 'cause 'til 'n' gonna gotta wanna lemme gimme kinda sorta outta
dunno yeah yep nope nah huh uh hmm mm whoa woah aw ah oh ow ugh shh hey yo sup bro homie homeboy
nigga niggas dawg cuz bruh fam ok okay alright moms mom cops feds`.split(/\s+/)
);

// Bitişik kısa öbekler
const BITISIK: Record<string, string> = {
	ofa: 'of a',
	sonofa: 'son of a',
	kindof: 'kind of',
	alot: 'a lot'
};
const KISALTMA_YAPISIK = /^([a-z]+'(?:t|s|re|ll|ve|d|m))([a-z]{3,})$/;
const EKLER = ["'s", "'t", "'re", "'ll", "'ve", "'d", "'m", "in'"];
const KELIME_RX = /[A-Za-z0-9][A-Za-z0-9']*/g;
const HARFLER = 'abcdefghijklmnopqrstuvwxyz';

// Korunan kelimeler (küçük harfle)
export const korunan = new Set(
	korunanMetni
		.split(/\r?\n/)
		.map((s) => s.trim())
		.filter((s) => s && !s.startsWith('#'))
		.map((s) => s.toLowerCase())
);

let frekans: Map<string, number> | null = null;
let yukleniyor: Promise<void> | null = null;
const onbellek = new Map<string, string | null>();

export const yazimHazirMi = () => frekans !== null;

export function yazimSozluguYukle(): Promise<void> {
	yukleniyor ??= (async () => {
		const r = await fetch(SOZLUK_ADRESI);
		if (!r.ok) throw new Error('Yazım sözlüğü indirilemedi (HTTP ' + r.status + ')');
		const m = new Map<string, number>();
		for (const satir of (await r.text()).split('\n')) {
			const b = satir.indexOf(' ');
			if (b > 0) m.set(satir.slice(0, b), parseInt(satir.slice(b + 1), 10));
		}
		frekans = m;
	})().catch((e) => {
		yukleniyor = null;
		throw e;
	});
	return yukleniyor;
}

// ---------- sözlük yardımcıları ----------
const f = (w: string) => frekans!.get(w) ?? 0;

function bilinen(w: string): boolean {
	w = w.toLowerCase();
	if (frekans!.has(w) || EK_KELIMELER.has(w) || korunan.has(w)) return true;
	const oz = w.replace(/^'+|'+$/g, '');
	if (frekans!.has(oz) || EK_KELIMELER.has(oz) || korunan.has(oz)) return true;
	for (const ek of EKLER) {
		if (w.endsWith(ek) && w.length > ek.length) {
			const kok = w.slice(0, -ek.length);
			if (frekans!.has(kok) || korunan.has(kok) || ek === "in'") return true;
		}
	}
	return false;
}

function puan(w: string): number {
	w = w.toLowerCase();
	if (korunan.has(w) || EK_KELIMELER.has(w)) return 1e12;
	return frekans!.get(w) ?? frekans!.get(w.replace(/^'+|'+$/g, '')) ?? 1;
}

// Hedefli harf karışması varyantları (en fazla `adim` değişim)
function varyantlar(w: string, adim = 2): Set<string> {
	const sonuc = new Set<string>();
	let sinir = new Set([w]);
	for (let s = 0; s < adim; s++) {
		const sonraki = new Set<string>();
		for (const cur of sinir) {
			for (const [a, b] of KARISMALAR) {
				let i = cur.indexOf(a);
				while (i !== -1) {
					const v = cur.slice(0, i) + b + cur.slice(i + a.length);
					if (!sonuc.has(v)) sonraki.add(v);
					i = cur.indexOf(a, i + 1);
				}
			}
		}
		sonraki.forEach((v) => sonuc.add(v));
		sinir = sonraki;
	}
	return sonuc;
}

// 1 düzenleme mesafesindeki tüm adaylar (silme, yer değiştirme, değiştirme, ekleme)
function birMesafe(w: string): Set<string> {
	const out = new Set<string>();
	for (let i = 0; i <= w.length; i++) {
		const a = w.slice(0, i),
			b = w.slice(i);
		if (b) out.add(a + b.slice(1));
		if (b.length > 1) out.add(a + b[1] + b[0] + b.slice(2));
		for (const h of HARFLER) {
			if (b) out.add(a + h + b.slice(1));
			out.add(a + h + b);
		}
	}
	out.delete(w);
	return out;
}

// Bitişik yazılmış metni en olası kelimelere böler (SymSpell word_segmentation, mesafe 0)
function bol(w: string): string[] {
	const n = w.length;
	const enIyi: { p: number; parca: string[] }[] = [{ p: 0, parca: [] }];
	for (let i = 1; i <= n; i++) {
		let aday: { p: number; parca: string[] } | null = null;
		for (let j = Math.max(0, i - 24); j < i; j++) {
			const k = w.slice(j, i);
			const c = f(k);
			const lp = c
				? Math.log10(c / TOPLAM_KELIME)
				: Math.log10(10 / (TOPLAM_KELIME * 10 ** k.length));
			const p = enIyi[j].p + lp;
			if (!aday || p > aday.p) aday = { p, parca: [...enIyi[j].parca, k] };
		}
		enIyi[i] = aday!;
	}
	return enIyi[n].parca;
}

function harfUydur(yeni: string, eski: string): string {
	if (eski.length > 1 && eski === eski.toUpperCase()) return yeni.toUpperCase();
	if (/^[A-Z]/.test(eski)) return yeni[0].toUpperCase() + yeni.slice(1);
	return yeni;
}

const buyukMu = (s: string) => /[A-Z]/.test(s) && s === s.toUpperCase();

// ---------- tek kelime ----------
function kelimeDuzelt(w: string, cumleBasi: boolean): string {
	if (w === 'Ill') return "I'll"; // "Ill remember you" → "I'll"
	const kucuk = w.toLowerCase();
	if (kucuk in KISALTMALAR && !(kucuk === 'im' && w === 'IM')) {
		const k = KISALTMALAR[kucuk];
		return k.startsWith("I'") ? k : harfUydur(k, w);
	}
	if (bilinen(w) || /\d/.test(w) || w.length <= 1) return w;
	if (buyukMu(w) && w.length > 2) return w; // HUD/tabela yazısı: dokunma
	if (kucuk in BITISIK) return harfUydur(BITISIK[kucuk], w);

	// "Irobbed" / "lmissed" / "Icannot" → "I robbed" / "I missed" / "I cannot"
	if ('IlT'.includes(w[0]) && w.length > 3 && (/[a-z]/.test(w[1]) || w[1] === "'")) {
		const kalan = w.slice(1);
		if (
			bilinen(kalan) &&
			(kalan.length > 3 || ['am', 'can', 'was', 'had', 'did', 'got', 'ran'].includes(kalan)) &&
			(w[0] !== 'T' || kalan.length >= 5)
		)
			return 'I ' + kalan;
	}
	// "ain'tboosting" → "ain't boosting"
	const m = KISALTMA_YAPISIK.exec(kucuk);
	if (m && bilinen(m[1]) && bilinen(m[2])) return harfUydur(m[1], w) + ' ' + m[2];

	if (/^[A-Z]/.test(w) && !cumleBasi) {
		// Büyük harfli = muhtemelen isim. Sadece korunan isimlere karşı dene: Larnar → Lamar
		for (const v of varyantlar(kucuk)) if (korunan.has(v)) return harfUydur(v, w);
		// "Davisproduction" → "Davis production"
		if (kucuk.length >= 10) {
			const p = bol(kucuk);
			if (p.length > 1 && p.length <= 3 && p.every((x) => f(x) >= 3_000_000))
				return harfUydur(p.join(' '), w);
		}
		return w;
	}

	if (onbellek.has(kucuk)) {
		const c = onbellek.get(kucuk);
		return c ? harfUydur(c, w) : w;
	}

	let enIyi: string | null = null;
	const kisa = kucuk.length <= 3;
	// 1) hedefli karışmalar (kısa kelimede tek değişim)
	let enIyiPuan = 0;
	for (const v of varyantlar(kucuk, kisa ? 1 : 2)) {
		if (bilinen(v) && puan(v) > enIyiPuan) {
			enIyi = v;
			enIyiPuan = puan(v);
		}
	}
	if (!enIyi && !kisa) {
		// 2) tek harf mesafe, ilk harf aynı, yaygın kelime
		let sym: string | null = null,
			symSayi = 0;
		if (kucuk.length >= 4) {
			for (const a of birMesafe(kucuk)) {
				const c = f(a);
				if (a[0] === kucuk[0] && c > 5000 && c > symSayi) {
					sym = a;
					symSayi = c;
				}
			}
		}
		// 3) bitişik yazılmış yaygın kelimeler ("getdown" → "get down", "weare" → "we are")
		let bolunmus: string | null = null,
			bolMin = 0;
		if (!kucuk.includes("'") && kucuk.length >= 5) {
			// Araya yapışmış tek çöp harf atılır: "andfother" → "and" "f" "other" → "and other"
			const p = bol(kucuk).filter(
				(x, i, d) => x.length > 1 || x === 'a' || x === 'i' || d.length === 1
			);
			if (p.length > 1 && p.length <= 4) {
				const enAz = Math.min(...p.map(f));
				if (enAz >= 3_000_000) {
					bolunmus = p.join(' ');
					bolMin = enAz;
				}
			}
		}
		enIyi = bolunmus && bolMin > symSayi ? bolunmus : sym;
	}
	onbellek.set(kucuk, enIyi);
	return enIyi ? harfUydur(enIyi, w) : w;
}

// ---------- metin ----------
// ---------- büyük/küçük harf düzeni ----------
// "(1 AM HAPPY)" ve "In The Late 1800s America Was Evolving." gibi metinler hem yazım
// düzeltmeyi (büyük harfli kelime = isim sayılır) hem de çevirmeni şaşırtır.
// Bunlar normal cümle düzenine çevrilir; korunan kelimeler büyük harfle başlar.
function cumleDuzeni(metin: string): string {
	return metin
		.replace(/(^|[.!?]\s+|^[("'\-–—]\s*)([a-z])/g, (_, on, h) => on + h.toUpperCase())
		.replace(/\bi(?=\b|')/g, 'I');
}

function harfDuzeni(metin: string): string {
	const kelimeler = metin.match(/[A-Za-z][A-Za-z']*/g) ?? [];
	const harfler = kelimeler.join('');
	if (harfler.length < 4) return metin;

	const korunanBuyuk = (w: string) =>
		korunan.has(w.toLowerCase()) ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w;

	// TAMAMI (ya da OCR hatasıyla neredeyse tamamı) BÜYÜK HARF: "I aM HaPPY"
	const buyukOrani = (harfler.match(/[A-Z]/g) || []).length / harfler.length;
	if (buyukOrani >= 0.7) {
		return cumleDuzeni(metin.toLowerCase()).replace(/[A-Za-z][A-Za-z']*/g, korunanBuyuk);
	}
	// Her Kelimenin Baş Harfi Büyük (en az 3 kelimenin %70'i)
	const uzun = kelimeler.filter((w) => w.length >= 2);
	const buyuk = uzun.filter((w) => /^[A-Z]/.test(w));
	if (uzun.length >= 3 && buyuk.length / uzun.length >= 0.7) {
		const kucult = metin.replace(/[A-Za-z][A-Za-z']*/g, (w) => {
			const k = w.toLowerCase();
			return frekans!.has(k) && !korunan.has(k) ? k : w;
		});
		return cumleDuzeni(kucult);
	}
	return ortaBuyukDuzelt(metin);
}

// Cümle ortasında büyük harfle okunan, isim olamayacak kelimeler (OCR font hatası):
// "decide Just how honorable Arthur Is" → "decide just how honorable Arthur is"
const ISIM_OLMAYAN = new Set(
	`a an the and or but nor so yet if then than as at by for from in into of on onto to with
without about after before over under up down out off is are was were be been being am do does
did done have has had will would shall should can could might must it it's its you you're you've
you'll your yours he he's him his she she's her we we're we've us our they they're they've them
their me my mine this that that's these those there there's here what what's who whom which when
where why how not no just now all some any every each very too also only ain't don't didn't
doesn't isn't wasn't aren't weren't can't won't couldn't wouldn't shouldn't let's get got go going
gonna wanna`.split(/\s+/)
);

function ortaBuyukDuzelt(metin: string): string {
	return metin.replace(/[A-Z][a-z']*/g, (w, i: number) => {
		const k = w.toLowerCase();
		if (!ISIM_OLMAYAN.has(k)) return w;
		const once = metin.slice(0, i).trimEnd();
		// cümle başı (metin başı, . ! ? sonrası, parantez/tırnak/tire açılışı) korunur
		if (!once || /[.!?(\-–—"']$/.test(once)) return w;
		return k;
	});
}

// OCR "I" harfini sık sık "1" okur: "1 am", "1'm", "(1 think"
const BIR_I =
	/(^|[\s("'\-])1(?=\s+(?:am|was|will|have|had|think|know|can|can't|don't|didn't|did|do|need|want|got|just|never|swear|love|mean|guess|said|told|thought|wanna|gotta|ain't|would|could|should|must|really|hope|see|saw|told|feel|got)\b)/gi;
const BIR_I_KISALTMA = /(^|[\s("'\-])1'(m|ll|ve|d)\b/gi;

export function yazimDuzelt(metin: string): string {
	if (!frekans) return metin;
	metin = metin.replace(/！/g, '!').replace(/？/g, '?').replace(/，/g, ',');
	metin = harfDuzeni(metin)
		.replace(BIR_I, '$1I')
		.replace(BIR_I_KISALTMA, "$1I'$2")
		// İki küçük harf arasına karışmış nokta: "be.explored" → "be explored"
		.replace(/(?<=[a-z]{2})\.(?=[a-z]{2})/g, ' ');
	let out = '',
		pos = 0,
		cumleBasi = true;
	for (const m of metin.matchAll(KELIME_RX)) {
		out += metin.slice(pos, m.index);
		let w = m[0],
			kuyruk = '';
		while (w.endsWith("'") && w.length > 1 && !w.endsWith("in'")) {
			w = w.slice(0, -1);
			kuyruk = "'" + kuyruk;
		}
		out += kelimeDuzelt(w, cumleBasi) + kuyruk;
		pos = m.index + m[0].length;
		cumleBasi = /^\s*[.!?]/.test(metin.slice(pos, pos + 2));
	}
	out += metin.slice(pos);
	// noktalama sonrası boşluk: "Hey,hey" → "Hey, hey"
	out = out.replace(/([,!?])(?=[A-Za-z])/g, '$1 ').replace(/(?<=[a-z])\.(?=[A-Z])/g, '. ');
	return out.replace(/\s+/g, ' ').trim();
}
