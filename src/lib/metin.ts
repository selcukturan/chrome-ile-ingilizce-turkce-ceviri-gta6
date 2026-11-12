export function metinTemizle(t: string): string {
	return t
		.replace(/[|_~=<>{}[\]\\]/g, ' ')
		.replace(/\s*\n\s*/g, ' ')
		.replace(/\s+/g, ' ')
		.replace(/^[^A-Za-z0-9"'(¿¡-]+/, '')
		.trim();
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
