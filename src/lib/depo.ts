// localStorage sarmalayıcı: gizli pencerede veya engelli depolamada sessizce varsayılana döner.
const ON_EK = 'gta6tr_';

export function oku<T>(anahtar: string, varsayilan: T): T {
	try {
		const v = localStorage.getItem(ON_EK + anahtar);
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
