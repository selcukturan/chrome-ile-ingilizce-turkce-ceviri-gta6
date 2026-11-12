// Uygulama yalnızca masaüstü Google Chrome'da (yerleşik çevirmenle) çalışacak şekilde tasarlandı.

type UAData = {
	brands: { brand: string; version: string }[];
	mobile: boolean;
	platform: string;
};

export type TarayiciDurumu = { uygun: true; surum: number } | { uygun: false; neden: string };

export const MIN_CHROME_SURUMU = 138; // Yerleşik Translator API bu sürümle geldi

export function tarayiciKontrol(): TarayiciDurumu {
	const uad = (navigator as Navigator & { userAgentData?: UAData }).userAgentData;
	const ua = navigator.userAgent;

	// Firefox ve Safari userAgentData sağlamaz
	if (!uad) return { uygun: false, neden: 'Bu tarayıcı Google Chrome değil.' };

	if (uad.mobile || /android|ios/i.test(uad.platform) || /Android|iPhone|iPad/i.test(ua)) {
		return {
			uygun: false,
			neden: 'Mobil cihazlar ve tabletler desteklenmiyor. Lütfen bilgisayardan açın.'
		};
	}
	const chrome = uad.brands.find((b) => b.brand === 'Google Chrome');
	if (!chrome) {
		const diger = uad.brands.find((b) => !/not.?a.?brand|chromium/i.test(b.brand));
		return {
			uygun: false,
			neden: diger
				? `${diger.brand} desteklenmiyor. Lütfen Google Chrome kullanın.`
				: 'Bu tarayıcı Google Chrome değil.'
		};
	}
	const surum = parseInt(chrome.version, 10) || 0;
	if (surum < MIN_CHROME_SURUMU || !('Translator' in globalThis)) {
		return {
			uygun: false,
			neden: `Chrome ${surum} kullanıyorsunuz. Yerleşik çevirmen için Chrome ${MIN_CHROME_SURUMU} veya üstüne güncelleyin (Ayarlar → Chrome hakkında).`
		};
	}
	return { uygun: true, surum };
}
