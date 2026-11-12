// Basit ziyaretçi sayacı: veriler tek bir JSON dosyasında tutulur.
// Veritabanı gerektirmez; adapter-node ile çalışan tek bir sunucu süreci için tasarlanmıştır.
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { GunlukSayi as Gun, Istatistik } from '#lib/tipler.ts';

type Veri = {
	baslangic: string;
	toplamZiyaret: number;
	tekilZiyaretci: number;
	gunler: Record<string, Gun>;
};

const DOSYA = resolve(process.env.SAYAC_DOSYASI ?? 'data/sayac.json');
const SAKLANACAK_GUN = 400;

let veri: Veri | null = null;
// Yazma işlemlerini sıraya koyar, eşzamanlı isteklerde dosya bozulmaz.
let kuyruk: Promise<unknown> = Promise.resolve();

export function bugunTarih(): string {
	return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date());
}

async function yukle(): Promise<Veri> {
	if (veri) return veri;
	try {
		veri = JSON.parse(await readFile(DOSYA, 'utf8')) as Veri;
	} catch {
		veri = { baslangic: bugunTarih(), toplamZiyaret: 0, tekilZiyaretci: 0, gunler: {} };
	}
	return veri;
}

async function kaydet(v: Veri) {
	await mkdir(dirname(DOSYA), { recursive: true });
	const gecici = DOSYA + '.tmp';
	await writeFile(gecici, JSON.stringify(v, null, 2));
	await rename(gecici, DOSYA);
}

function ozet(v: Veri, gun: string): Istatistik {
	return {
		toplamZiyaret: v.toplamZiyaret,
		tekilZiyaretci: v.tekilZiyaretci,
		bugun: v.gunler[gun] ?? { ziyaret: 0, tekil: 0 },
		baslangic: v.baslangic
	};
}

export function ziyaretKaydet(yeniZiyaretci: boolean, bugunIlk: boolean): Promise<Istatistik> {
	const is = kuyruk.then(async () => {
		const v = await yukle();
		const gun = bugunTarih();
		const g = (v.gunler[gun] ??= { ziyaret: 0, tekil: 0 });
		v.toplamZiyaret++;
		g.ziyaret++;
		if (yeniZiyaretci) v.tekilZiyaretci++;
		if (bugunIlk) g.tekil++;

		const gunler = Object.keys(v.gunler).sort();
		for (const eski of gunler.slice(0, Math.max(0, gunler.length - SAKLANACAK_GUN))) {
			delete v.gunler[eski];
		}
		await kaydet(v);
		return ozet(v, gun);
	});
	kuyruk = is.catch(() => {});
	return is;
}

export async function istatistik(): Promise<Istatistik> {
	return ozet(await yukle(), bugunTarih());
}
