// Chrome'un yerleşik (cihaz üstünde çalışan) çevirmeni: https://developer.chrome.com/docs/ai/translator-api
// Ağ gecikmesi yoktur; dil paketi bir kez indirildikten sonra çeviri birkaç on milisaniye sürer.

type Cevirmen = { translate(t: string): Promise<string>; destroy?(): void };
type TranslatorAPI = {
	availability(o: { sourceLanguage: string; targetLanguage: string }): Promise<string>;
	create(o: {
		sourceLanguage: string;
		targetLanguage: string;
		monitor?: (m: EventTarget) => void;
	}): Promise<Cevirmen>;
};

const DILLER = { sourceLanguage: 'en', targetLanguage: 'tr' };
const ONBELLEK_SINIRI = 500;

const onbellek = new Map<string, string>();
let cevirmen: Cevirmen | null = null;
let hazirlaniyor: Promise<Cevirmen> | null = null;

const api = () => (globalThis as unknown as { Translator?: TranslatorAPI }).Translator;

export const cevirmenVarMi = () => !!api();

/** Dil paketinin durumu: 'available' | 'downloadable' | 'downloading' | 'unavailable' */
export async function cevirmenDurumu(): Promise<string> {
	const T = api();
	return T ? T.availability(DILLER) : 'unavailable';
}

/** Dil paketi gerekiyorsa indirmek için bir kullanıcı tıklamasının içinden çağrılmalıdır. */
export function cevirmenHazirla(ilerleme?: (yuzde: number) => void): Promise<Cevirmen> {
	if (cevirmen) return Promise.resolve(cevirmen);
	hazirlaniyor ??= (async () => {
		const T = api();
		if (!T) throw new Error('Bu Chrome sürümünde yerleşik çevirmen yok (Chrome 138+ gerekir).');
		if ((await T.availability(DILLER)) === 'unavailable')
			throw new Error('İngilizce→Türkçe yerleşik çeviri bu cihazda desteklenmiyor.');
		cevirmen = await T.create({
			...DILLER,
			monitor(m) {
				m.addEventListener('downloadprogress', (e) =>
					ilerleme?.(Math.round((e as ProgressEvent).loaded * 100))
				);
			}
		});
		// Modeli ısıt: ilk gerçek altyazı beklemesin
		await cevirmen.translate('Hello.');
		return cevirmen;
	})().catch((e) => {
		hazirlaniyor = null;
		throw e;
	});
	return hazirlaniyor;
}

export async function cevir(metin: string): Promise<string> {
	const hazir = onbellek.get(metin);
	if (hazir !== undefined) return hazir;
	const sonuc = await (cevirmen ?? (await cevirmenHazirla())).translate(metin);
	if (onbellek.size >= ONBELLEK_SINIRI) onbellek.delete(onbellek.keys().next().value!);
	onbellek.set(metin, sonuc);
	return sonuc;
}
