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
