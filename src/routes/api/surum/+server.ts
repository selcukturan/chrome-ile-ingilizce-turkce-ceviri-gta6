import { json } from '@sveltejs/kit';
import { COMMIT, DERLEME, SURUM } from '#lib/surum.ts';

// Canlıdaki sürümü kontrol etmek için: https://altyaziceviri.tr/api/surum
export const GET = () => json({ surum: SURUM, commit: COMMIT, derleme: DERLEME });
