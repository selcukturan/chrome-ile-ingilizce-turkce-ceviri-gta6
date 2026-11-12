// localStorage sarmalayıcı: gizli pencerede veya engelli depolamada sessizce varsayılana döner.
const ON_EK = 'altyazi_';
const ESKI_ON_EK = 'gta6' + 'tr_'; // 0.7.0 öncesi anahtarlar: ayarlar kaybolmasın diye bir kez taşınır

export function oku<T>(anahtar: string, varsayilan: T): T {
	try {
		let v = localStorage.getItem(ON_EK + anahtar);
		if (v === null) {
			v = localStorage.getItem(ESKI_ON_EK + anahtar);
			if (v !== null) {
				localStorage.setItem(ON_EK + anahtar, v);
				localStorage.removeItem(ESKI_ON_EK + anahtar);
			}
		}
		return v === null ? varsayilan : { ...varsayilan, ...JSON.parse(v) };
	} catch {
		return varsayilan;
	}
}

export function yaz(anahtar: string, deger: unknown) {
	try {
		localStorage.setItem(ON_EK + anahtar, JSON.stringify(deger));
	} catch {
		/* yoksay */
	}
}
