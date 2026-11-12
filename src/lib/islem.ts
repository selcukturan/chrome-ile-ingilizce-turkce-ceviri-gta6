// OCR metninden Türkçe çeviriye giden işlem hattı:
//   OCR metni → temizle → yazım düzelt → (ekranda gösterilen İngilizce)
//             → argo sadeleştir → (çevirmene giden İngilizce) → Chrome çevirmeni (ceviri.ts)
import { argoUygula } from './argo.ts';
import { metinTemizle } from './metin.ts';
import { yazimDuzelt } from './yazim.ts';

export type Asamalar = {
	ocr: string; // temizlenmiş ham OCR çıktısı
	duzeltilmis: string; // yazım düzeltme sonrası (ekranda gösterilir)
	cevrilecek: string; // argo uygulanmış, çevirmene giden metin
};

export function hazirla(hamOcr: string, o: { yazim: boolean; argo: boolean }): Asamalar {
	const ocr = metinTemizle(hamOcr);
	const duzeltilmis = o.yazim ? yazimDuzelt(ocr) : ocr;
	const cevrilecek = o.argo ? argoUygula(duzeltilmis) : duzeltilmis;
	return { ocr, duzeltilmis, cevrilecek };
}

// ---------- ekranlara bölünmüş cümleler ----------
// Anlatıcı uzun bir cümleyi birkaç ekrana bölebilir:
//   "Call out to a passing rider," → "talk yourself into ..." → "or out of trouble ..."
// Parçalar ayrı çevrilince anlam kaybolur. Önceki anlatım parçası cümle sonuyla bitmediyse
// ve yeni parça küçük harfle başlıyorsa ikisi birlikte çevrilir.
export const BAGLAM_SURESI_MS = 10_000;
export const BAGLAM_MAKS_UZUNLUK = 280;

const BITMIS = /[.!?…)"]$/;
const KONUSMA = /^[([\-–—"]/;

export const konusmaMi = (a: Asamalar) => KONUSMA.test(a.duzeltilmis);

export function baglamla(
	onceki: (Asamalar & { zaman: number }) | null,
	yeni: Asamalar,
	simdi: number
): Asamalar {
	if (
		!onceki ||
		simdi - onceki.zaman > BAGLAM_SURESI_MS ||
		BITMIS.test(onceki.duzeltilmis) ||
		konusmaMi(yeni) ||
		!/^[a-z]/.test(yeni.duzeltilmis) ||
		onceki.duzeltilmis.length + yeni.duzeltilmis.length > BAGLAM_MAKS_UZUNLUK
	)
		return yeni;
	return {
		ocr: onceki.ocr + ' ' + yeni.ocr,
		duzeltilmis: onceki.duzeltilmis + ' ' + yeni.duzeltilmis,
		cevrilecek: onceki.cevrilecek + ' ' + yeni.cevrilecek
	};
}
