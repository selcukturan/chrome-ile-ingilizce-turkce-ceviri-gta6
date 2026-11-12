// Argo sözlüğü: çeviri modeline gitmeden ÖNCE İngilizce metindeki argo ifadeleri sadeleştirir.
// Kurallar src/lib/sozluk/argo.txt dosyasından okunur (derleme sırasında uygulamaya gömülür).
import argoMetni from './sozluk/argo.txt?raw';

type Kural = { rx: RegExp; yerine: string };

const kacir = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function ayristir(metin: string) {
	const ifadeler: Kural[] = [];
	const kaliplar: Kural[] = [];
	metin.split(/\r?\n/).forEach((satir, i) => {
		const ln = satir.trim();
		if (!ln || ln.startsWith('#')) return;

		if (ln.startsWith('re:')) {
			// re: <regex> => <yerine>  (dosyadaki sırayla, ifade kurallarından önce)
			const ayrac = ln.indexOf('=>');
			if (ayrac < 0) return;
			const kalip = ln.slice(3, ayrac).trim();
			let yerine = ln.slice(ayrac + 2).trim();
			if (yerine.length >= 2 && yerine.startsWith('"') && yerine.endsWith('"'))
				yerine = yerine.slice(1, -1);
			yerine = yerine.replace(/\\(\d)/g, '$$$1'); // Python tarzı \1 → JS $1
			try {
				kaliplar.push({ rx: new RegExp(kalip, 'gi'), yerine });
			} catch (e) {
				console.warn(`argo.txt satır ${i + 1}: geçersiz kalıp`, e);
			}
			return;
		}

		const kural = ln.split(' #')[0].trim();
		const esit = kural.indexOf('=');
		if (esit < 0) return;
		const a = kural.slice(0, esit).trim();
		const b = kural.slice(esit + 1).trim();
		if (!a) return;
		const on = /^\w/.test(a) ? "(?<![\\w'])" : '';
		const son = /\w$/.test(a) ? "(?![\\w'])" : '';
		ifadeler.push({ rx: new RegExp(on + kacir(a) + son, 'gi'), yerine: b });
	});
	// Uzun ifadeler önce ("my nigga", "nigga"dan önce)
	ifadeler.sort((x, y) => y.rx.source.length - x.rx.source.length);
	return { ifadeler, kaliplar };
}

const { ifadeler, kaliplar } = ayristir(argoMetni);

export const argoKuralSayisi = ifadeler.length + kaliplar.length;

export function argoUygula(metin: string): string {
	for (const { rx, yerine } of kaliplar) metin = metin.replace(rx, yerine);
	for (const { rx, yerine } of ifadeler) {
		metin = metin.replace(rx, (o) =>
			yerine && /^[A-Z]/.test(o) ? yerine[0].toUpperCase() + yerine.slice(1) : yerine
		);
	}
	return metin.replace(/\s+/g, ' ').trim();
}
