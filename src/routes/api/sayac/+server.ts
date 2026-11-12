import { json } from '@sveltejs/kit';
import { bugunTarih, istatistik, ziyaretKaydet } from '#lib/server/sayac.ts';
import type { RequestHandler } from './$types';

const IKI_YIL = 60 * 60 * 24 * 365 * 2;

// POST: ziyareti say. Tekil ziyaretçi ve "bugünkü tekil" çerezlerle ayırt edilir;
// sunucuda kişisel veri (IP vb.) tutulmaz.
export const POST: RequestHandler = async ({ cookies, url }) => {
	const bugun = bugunTarih();
	const yeniZiyaretci = !cookies.get('zid');
	const bugunIlk = cookies.get('zgun') !== bugun;

	const sonuc = await ziyaretKaydet(yeniZiyaretci, bugunIlk);

	const secenek = {
		path: '/',
		maxAge: IKI_YIL,
		httpOnly: true,
		sameSite: 'lax' as const,
		secure: url.protocol === 'https:'
	};
	if (yeniZiyaretci) cookies.set('zid', crypto.randomUUID(), secenek);
	if (bugunIlk) cookies.set('zgun', bugun, secenek);

	return json(sonuc);
};

// GET: sadece istatistiği döndür (saymaz).
export const GET: RequestHandler = async () => json(await istatistik());
