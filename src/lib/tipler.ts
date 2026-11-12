export type GunlukSayi = { ziyaret: number; tekil: number };

export type Istatistik = {
	toplamZiyaret: number;
	tekilZiyaretci: number;
	bugun: GunlukSayi;
	baslangic: string;
};
