// Baş ve sondaki OCR çöpleri: sadece sembolden oluşan ya da tek harf/rakam olan parçalar
// ("a" ve "I" gerçek kelime olabildiği için korunur).
const COP = /^(?:[^A-Za-z0-9]+|[b-zB-HJ-Z0-9])$/;

export function metinTemizle(t: string): string {
	const parca = t
		.replace(/[|_~=<>{}[\]\\@#*^/•«»]/g, ' ')
		.replace(/\s*\n\s*/g, ' ')
		.replace(/\s+/g, ' ')
		.trim()
		.split(' ');
	while (parca.length && COP.test(parca[0])) parca.shift();
	while (parca.length && COP.test(parca[parca.length - 1])) {
		const cop = parca.pop()!;
		// Sondaki noktalama çöp değildir: önceki kelimeye eklenir ("open ! - 4" → "open!")
		if (/^[.!?…]+$/.test(cop) && parca.length) {
			parca[parca.length - 1] += cop;
			break;
		}
	}
	return parca
		.join(' ')
		.replace(/^[^A-Za-z0-9"'(¿¡]+/, '')
		.trim();
}

const sadelestir = (s: string) =>
	s
		.toLowerCase()
		.replace(/[^a-z0-9 ]+/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();

// Yeni okunan metin bir öncekinin tekrarı mı? (OCR farkları ve kısmi okumalar dahil)
export function tekrarMi(yeni: string, eski: string): boolean {
	const a = sadelestir(yeni),
		b = sadelestir(eski);
	if (!a || !b) return false;
	// Yeni metin eskinin bir parçası (kısa cevaplar hariç: "No." gibi yeni bir altyazı olabilir)
	if (a.length >= 12 && b.includes(a)) return true;
	// Kelimelerin neredeyse tamamı eski metinde varsa (araya çöp karışmış okuma)
	const ak = a.split(' '),
		bk = new Set(b.split(' '));
	if (ak.length >= 4 && ak.filter((w) => bk.has(w)).length / ak.length >= 0.9) return true;
	return benzerlik(a, b) >= 0.85;
}

// Levenshtein tabanlı benzerlik (0..1)
export function benzerlik(a: string, b: string): number {
	a = a.toLowerCase();
	b = b.toLowerCase();
	if (a === b) return 1;
	if (!a || !b) return 0;
	const m = a.length,
		n = b.length;
	let prev = Array.from({ length: n + 1 }, (_, j) => j);
	for (let i = 1; i <= m; i++) {
		const cur = [i];
		for (let j = 1; j <= n; j++)
			cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
		prev = cur;
	}
	return 1 - prev[n] / Math.max(m, n);
}
