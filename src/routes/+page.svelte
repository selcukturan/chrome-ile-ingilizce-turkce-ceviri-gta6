<script lang="ts">
	import { onMount, tick } from 'svelte';
	import type { Worker } from 'tesseract.js';
	import Sayac from '#lib/components/Sayac.svelte';
	import KameraAyarlari from '#lib/components/KameraAyarlari.svelte';
	import { COMMIT, DERLEME, SURUM } from '#lib/surum.ts';
	import { MIN_CHROME_SURUMU, tarayiciKontrol, type TarayiciDurumu } from '#lib/tarayici.ts';
	import { cevir, cevirmenHazirla } from '#lib/ceviri.ts';
	import { imzaFarki, kareIsle, type AltyaziTipi, type Bolge, type Kutu } from '#lib/goruntu.ts';
	import { tekrarMi, uzantiMi } from '#lib/metin.ts';
	import { hazirla } from '#lib/islem.ts';
	import { parcalara, SabitFiltre, type OcrSatir } from '#lib/ocr.ts';
	import { yazimSozluguYukle } from '#lib/yazim.ts';
	import { argoKuralSayisi } from '#lib/argo.ts';
	import { oku, yaz } from '#lib/depo.ts';
	import { ACIKLAMA, BASLIK, SITE_ADI, SITE_URL } from '#lib/site.ts';

	// Tarayıcı kontrolü yalnızca tarayıcıda yapılabilir (sayfa sunucuda önceden üretiliyor)
	let tarayici = $state<TarayiciDurumu | null>(null);

	// ---------- Ayarlar (localStorage'da saklanır) ----------
	const varsayilan = {
		tip: 'white' as AltyaziTipi,
		esik: 190,
		aralik: 200,
		minGuven: 55,
		yazim: true,
		argo: true,
		ingilizceGoster: true,
		kamera: ''
	};
	let ayar = $state(oku('ayar', varsayilan));
	let bolge = $state<Bolge>(oku('bolge', { x: 0.1, y: 0.78, w: 0.8, h: 0.17 }));
	$effect(() => yaz('ayar', ayar));

	// ---------- Arayüz durumu ----------
	let durum = $state({ mesaj: 'Hazır değil — kamerayı başlatın.', sinif: '' });
	let kameralar = $state<MediaDeviceInfo[]>([]);
	let kameraAcik = $state(false);
	let calisiyor = $state(false);
	let mesgul = $state(false);
	let tr = $state('');
	let en = $state('');
	let sure = $state({ ocr: 0, ceviri: 0 });
	// Tarama istatistikleri: optimizasyonların etkisini görmek için
	const bosIstatistik = () => ({
		tur: 0,
		bekleme: 0,
		ocr: 0,
		tekrar: 0,
		dusuk: 0,
		ceviri: 0,
		ocrMs: 0
	});
	let istat = $state(bosIstatistik());
	type Kayit = { tr: string; en: string; giden: string };
	let gecmis = $state<Kayit[]>([]);
	let buyukGorunum = $state(false);

	let video = $state() as HTMLVideoElement;
	let bolgeTuval = $state() as HTMLCanvasElement;
	let onizleme = $state() as HTMLCanvasElement;
	let isTuvali: HTMLCanvasElement | null = null;

	const bildir = (mesaj: string, sinif = '') => (durum = { mesaj, sinif });

	// ---------- Kamera ----------
	let akis: MediaStream | null = null;
	let iz = $state.raw<MediaStreamTrack | null>(null); // kamera ayarları için aktif görüntü kaynağı
	let yenileniyor = $state(false);

	async function kameralariListele() {
		try {
			kameralar = (await navigator.mediaDevices.enumerateDevices()).filter(
				(d) => d.kind === 'videoinput'
			);
		} catch (e) {
			console.warn(e);
		}
	}

	// Sonradan bağlanan cihazlar (OBS sanal kamera, capture kart) için listeyi yeniler.
	// Kamera izni henüz verilmediyse Chrome cihaz adlarını göstermez; bu durumda izin istenir.
	async function kameralariYenile() {
		yenileniyor = true;
		try {
			await kameralariListele();
			if (!akis && kameralar.every((k) => !k.label)) {
				const gecici = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
				gecici.getTracks().forEach((t) => t.stop());
				await kameralariListele();
			}
			bildir(`${kameralar.length} kamera bulundu.`, 'ok');
		} catch (e) {
			bildir('Kameralar listelenemedi: ' + (e as Error).message, 'warn');
		}
		yenileniyor = false;
	}

	async function kameraBaslat() {
		if (!navigator.mediaDevices?.getUserMedia) {
			bildir('Kameraya erişilemiyor. Sayfayı http://localhost veya https üzerinden açın.', 'warn');
			return;
		}
		akis?.getTracks().forEach((t) => t.stop());
		try {
			iz = null;
			akis = await navigator.mediaDevices.getUserMedia({
				video: {
					deviceId: ayar.kamera ? { exact: ayar.kamera } : undefined,
					width: { ideal: 1920 },
					height: { ideal: 1080 }
				},
				audio: false
			});
			video.srcObject = akis;
			await video.play();
			await kameralariListele();
			iz = akis.getVideoTracks()[0];
			const s = iz.getSettings();
			if (s.deviceId) ayar.kamera = s.deviceId;
			kameraAcik = true;
			bildir(
				`Kamera açık (${s.width}×${s.height}). Altyazı bölgesini seçip "Çeviriyi başlat"a basın.`,
				'ok'
			);
		} catch (e) {
			bildir('Kamera açılamadı: ' + (e as Error).message, 'warn');
		}
	}

	// ---------- Bölge seçimi ----------
	function bolgeCiz() {
		if (!bolgeTuval) return;
		const r = bolgeTuval.getBoundingClientRect();
		bolgeTuval.width = r.width * devicePixelRatio;
		bolgeTuval.height = r.height * devicePixelRatio;
		const W = bolgeTuval.width,
			H = bolgeTuval.height,
			c = bolgeTuval.getContext('2d')!;
		c.clearRect(0, 0, W, H);
		c.fillStyle = 'rgba(0,0,0,0.45)';
		c.fillRect(0, 0, W, H);
		c.clearRect(bolge.x * W, bolge.y * H, bolge.w * W, bolge.h * H);
		c.strokeStyle = '#4f8cff';
		c.lineWidth = 2 * devicePixelRatio;
		c.strokeRect(bolge.x * W, bolge.y * H, bolge.w * W, bolge.h * H);
	}

	let surukle: { x: number; y: number } | null = null;
	const konum = (e: PointerEvent) => {
		const r = bolgeTuval.getBoundingClientRect();
		return {
			x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
			y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))
		};
	};
	function basildi(e: PointerEvent) {
		surukle = konum(e);
		bolgeTuval.setPointerCapture(e.pointerId);
	}
	function hareket(e: PointerEvent) {
		if (!surukle) return;
		const p = konum(e);
		bolge = {
			x: Math.min(surukle.x, p.x),
			y: Math.min(surukle.y, p.y),
			w: Math.abs(p.x - surukle.x),
			h: Math.abs(p.y - surukle.y)
		};
		bolgeCiz();
	}
	function birakildi() {
		surukle = null;
		if (bolge.w < 0.02 || bolge.h < 0.02) bolge = oku('bolge', bolge);
		yaz('bolge', bolge);
		bolgeCiz();
		sonImza = null;
		sabit.sifirla();
	}

	// ---------- Gösterim ----------
	function goster(ing: string, tur: string, giden = '', guncelle = false) {
		tr = tur;
		en = ing;
		if (!tur) return;
		const kayit = { tr: tur, en: ing, giden };
		gecmis =
			guncelle && gecmis.length ? [kayit, ...gecmis.slice(1)] : [kayit, ...gecmis].slice(0, 50);
	}

	async function buyukAc() {
		buyukGorunum = true;
		try {
			await document.documentElement.requestFullscreen();
		} catch {
			/* yoksay */
		}
	}
	async function buyukKapat() {
		buyukGorunum = false;
		try {
			if (document.fullscreenElement) await document.exitFullscreen();
		} catch {
			/* yoksay */
		}
	}

	// ---------- OCR + ana döngü ----------
	let isci: Worker | null = null;
	let sonImza: number[] | null = null,
		bekleyenImza: number[] | null = null,
		sonMetin = '',
		bosBaslangic = 0,
		zamanlayici: ReturnType<typeof setTimeout> | undefined;
	const sabit = new SabitFiltre();

	// Sadece kullandığımız çıktılar (hOCR/TSV üretimi kapatılır)
	const CIKTI = { text: false, blocks: true, hocr: false, tsv: false };
	// Görüntü değişince tekrar bakma süresi: altyazı tam belirene (fade-in) kadar bekler
	const DURULMA_MS = 80;

	async function isciHazirla() {
		if (isci) return isci;
		bildir('OCR motoru yükleniyor (ilk seferde ~10 MB indirir)…');
		const { createWorker } = await import('tesseract.js');
		isci = await createWorker('eng', 1, {
			// Kendi sunucumuzdaki best_int modeli (static/ocr/eng.traineddata, Apache-2.0).
			// "fast" modelden ~%40 yavaş ama daha doğru; doğru OCR, doğru çeviri için daha önemli.
			// Model değişirse cachePath da değişmeli: tarayıcı önbelleğindeki eski model kullanılmasın.
			langPath: location.origin + '/ocr', // worker blob adresinden çalıştığı için tam adres
			gzip: false,
			cachePath: 'tessdata-best-int',
			logger: (m) => {
				if (m.status && m.progress < 1) bildir(`OCR: ${m.status} %${Math.round(m.progress * 100)}`);
			}
		});
		await isci.setParameters({
			tessedit_pageseg_mode: '6' as never,
			preserve_interword_spaces: '1'
		});
		return isci;
	}

	async function tarama() {
		if (!calisiyor || !isci || !isTuvali) return;
		const t0 = performance.now();
		let hizli = false;
		try {
			const kare = kareIsle(video, bolge, ayar.esik, ayar.tip, isTuvali, onizleme);
			if (kare) {
				istat.tur++;
				if (kare.murekkep < 0.003) {
					// Bölge boş: altyazı kaybolmuş
					if (sonMetin && !bosBaslangic) bosBaslangic = Date.now();
					if (bosBaslangic && Date.now() - bosBaslangic > 1200) {
						sonMetin = '';
						goster('', '');
						bosBaslangic = 0;
					}
					sonImza = kare.imza;
					bekleyenImza = null;
				} else if (imzaFarki(kare.imza, sonImza) > 4) {
					bosBaslangic = 0;
					if (!bekleyenImza || imzaFarki(kare.imza, bekleyenImza) > 3) {
						// Görüntü hâlâ değişiyor (altyazı beliriyor/kayboluyor): biraz sonra tekrar bak
						bekleyenImza = kare.imza;
						istat.bekleme++;
						hizli = true;
					} else {
						bekleyenImza = null;
						sonImza = kare.imza;
						await yaziOku(kare.kutu, t0);
					}
				}
			}
		} catch (e) {
			bildir('Hata: ' + (e as Error).message, 'warn');
			console.error(e);
		}
		if (calisiyor) {
			const bekle = hizli ? DURULMA_MS : ayar.aralik - (performance.now() - t0);
			zamanlayici = setTimeout(tarama, Math.max(30, bekle));
		}
	}

	async function yaziOku(kutu: Kutu, t0: number) {
		const { data } = await isci!.recognize(isTuvali!, { rectangle: kutu }, CIKTI);
		const t1 = performance.now();
		istat.ocr++;
		istat.ocrMs += t1 - t0;

		const p = parcalara(data.lines as unknown as OcrSatir[], sabit, isTuvali!.width);
		const asamalar = p.parcalar
			.map((x) => hazirla(x, ayar))
			.filter((a) => /[A-Za-z].*[A-Za-z]/.test(a.duzeltilmis));
		const ingilizce = asamalar.map((a) => a.duzeltilmis).join('\n');
		const harf = (ingilizce.match(/[A-Za-z]/g) || []).length;

		if (harf < 2 || p.guven < ayar.minGuven) {
			istat.dusuk++;
			return;
		}
		if (tekrarMi(ingilizce, sonMetin)) {
			istat.tekrar++;
			return;
		}
		// Ekrandaki metin uzadıysa (satır satır beliren altyazı) yeni kayıt açılmaz, son kayıt güncellenir.
		// Sabit yazı filtresi de sadece gerçekten yeni altyazılarla öğrenir (uzayan metnin ilk satırı
		// her seferinde aynı yerde durduğu için logo sanılmasın).
		const uzanti = uzantiMi(ingilizce, sonMetin);
		sonMetin = ingilizce;
		if (!uzanti) sabit.ogren(p.kelimeler, p.kisaSatirlar);
		try {
			// Parçalar (anlatıcı + diyalog gibi) ayrı ayrı ve aynı anda çevrilir
			const ceviriler = await Promise.all(asamalar.map((a) => cevir(a.cevrilecek)));
			istat.ceviri++;
			if (ingilizce === sonMetin)
				goster(
					ingilizce,
					ceviriler.join('\n'),
					asamalar.map((a) => a.cevrilecek).join('\n'),
					uzanti
				);
			sure = { ocr: Math.round(t1 - t0), ceviri: Math.round(performance.now() - t1) };
			bildir(`Çalışıyor · OCR güveni %${Math.round(p.guven)}`, 'ok');
		} catch (e) {
			bildir('Çeviri hatası: ' + (e as Error).message, 'warn');
			goster(ingilizce, '');
		}
	}

	async function baslatDurdur() {
		if (calisiyor) {
			calisiyor = false;
			clearTimeout(zamanlayici);
			bildir('Durduruldu.');
			return;
		}
		mesgul = true;
		try {
			// Kullanıcı tıklamasının içinden çağrılmalı ki Chrome dil paketini indirebilsin
			await Promise.all([
				cevirmenHazirla((y) => bildir(`Chrome Türkçe dil paketi indiriliyor: %${y}`)),
				isciHazirla(),
				ayar.yazim
					? yazimSozluguYukle().catch((e) => {
							console.warn(e);
							ayar.yazim = false;
						})
					: null
			]);
			calisiyor = true;
			sonImza = null;
			bekleyenImza = null;
			sonMetin = '';
			istat = bosIstatistik();
			bildir('Çalışıyor…', 'ok');
			tarama();
		} catch (e) {
			bildir((e as Error).message, 'warn');
		}
		mesgul = false;
	}

	function yazimDegisti() {
		if (ayar.yazim) yazimSozluguYukle().catch(() => (ayar.yazim = false));
		sonMetin = '';
		sonImza = null;
	}

	onMount(() => {
		tarayici = tarayiciKontrol();
		if (!tarayici.uygun) return;
		isTuvali = document.createElement('canvas');
		let ro: ResizeObserver | undefined;
		// Cihaz takılıp çıkarıldığında (OBS sanal kamera açılınca vb.) liste kendiliğinden yenilenir
		navigator.mediaDevices?.addEventListener('devicechange', kameralariListele);
		tick().then(() => {
			kameralariListele();
			ro = new ResizeObserver(bolgeCiz);
			ro.observe(bolgeTuval);
		});
		return () => {
			navigator.mediaDevices?.removeEventListener('devicechange', kameralariListele);
			ro?.disconnect();
			calisiyor = false;
			clearTimeout(zamanlayici);
			akis?.getTracks().forEach((t) => t.stop());
			isci?.terminate();
		};
	});

	const jsonLd = JSON.stringify([
		{
			'@context': 'https://schema.org',
			'@type': 'WebApplication',
			name: SITE_ADI,
			url: SITE_URL + '/',
			description: ACIKLAMA,
			applicationCategory: 'UtilitiesApplication',
			operatingSystem: 'Windows, macOS, Linux, ChromeOS',
			browserRequirements: `Google Chrome ${MIN_CHROME_SURUMU}+ (masaüstü)`,
			inLanguage: 'tr',
			offers: { '@type': 'Offer', price: '0', priceCurrency: 'TRY' }
		},
		{
			'@context': 'https://schema.org',
			'@type': 'FAQPage',
			mainEntity: [
				[
					'Oyunun Türkçe altyazısı yoksa ne yapabilirim?',
					"Bu araç oyundaki İngilizce altyazıları ekrandan okuyup Chrome'un yerleşik çevirmeniyle anında Türkçeye çevirir. Resmi bir çeviri değildir."
				],
				[
					'Ne gerekiyor?',
					'Bilgisayar, masaüstü Google Chrome 138+ ve PS5 görüntüsünü bilgisayara aktaran bir capture kart ya da ekrana bakan bir kamera.'
				],
				[
					'Ücretli mi?',
					'Hayır, tamamen ücretsizdir. Çeviri bilgisayarınızda yapılır, görüntü hiçbir sunucuya gönderilmez.'
				]
			].map(([q, a]) => ({
				'@type': 'Question',
				name: q,
				acceptedAnswer: { '@type': 'Answer', text: a }
			}))
		}
	]).replace(/</g, '\\u003c');
</script>

<svelte:head>
	<title>{BASLIK}</title>
	<meta name="description" content={ACIKLAMA} />
	<link rel="canonical" href="{SITE_URL}/" />
	<meta property="og:type" content="website" />
	<meta property="og:locale" content="tr_TR" />
	<meta property="og:site_name" content={SITE_ADI} />
	<meta property="og:title" content={BASLIK} />
	<meta property="og:description" content={ACIKLAMA} />
	<meta property="og:url" content="{SITE_URL}/" />
	<meta property="og:image" content="{SITE_URL}/og.png" />
	<meta name="twitter:card" content="summary_large_image" />
	{@html `<script type="application/ld+json">${jsonLd}</script>`}
</svelte:head>

<header>
	<h1>🎮 Altyazı Çeviri</h1>
	{#if tarayici?.uygun}<span class="durum {durum.sinif}">{durum.mesaj}</span>{/if}
	<span class="bosluk"></span>
	<Sayac />
</header>

{#if tarayici && !tarayici.uygun}
	<div class="engel">
		<div class="kart">
			<h2>🖥️ Sadece bilgisayarda Google Chrome</h2>
			<p class="neden">{tarayici.neden}</p>
			<p>
				Bu araç PS5 görüntüsünü bilgisayara bağlı kamera / capture kart üzerinden okur ve
				<b>Chrome'un yerleşik çevirmenini</b> kullanır. Bu yüzden yalnızca masaüstü Google Chrome
				(sürüm
				{MIN_CHROME_SURUMU}+) ile çalışır.
			</p>
			<a href="https://www.google.com/chrome/" target="_blank" rel="noopener">Chrome'u indir →</a>
		</div>
	</div>
{:else if tarayici?.uygun}
	<main>
		<section class="panel">
			<div class="sahne">
				<!-- svelte-ignore a11y_media_has_caption -->
				<video bind:this={video} autoplay playsinline muted onloadedmetadata={bolgeCiz}></video>
				<canvas
					bind:this={bolgeTuval}
					class="bolge"
					onpointerdown={basildi}
					onpointermove={hareket}
					onpointerup={birakildi}
				></canvas>
			</div>
			<p class="ipucu">
				Fareyle sürükleyerek görüntüde <b>altyazının çıktığı bölgeyi</b> seçin. Bölge ne kadar dar olursa
				OCR o kadar hızlı ve doğru çalışır.
			</p>
			<div class="altyazi">
				<div class="tr">{tr || '—'}</div>
				{#if ayar.ingilizceGoster}<div class="en">{en}</div>{/if}
			</div>
			{#if sure.ocr}
				<p class="ipucu sure">Son altyazı: OCR {sure.ocr} ms · çeviri {sure.ceviri} ms</p>
			{/if}
			{#if istat.tur}
				<p
					class="ipucu sure"
					title="Tarama: kare kontrolü · Bekleme: görüntü durulana kadar · OCR: yazı okuma · Tekrar/düşük: okunan ama çevrilmeyen"
				>
					{istat.tur} tarama · {istat.bekleme} bekleme · {istat.ocr} OCR (ort. {istat.ocr
						? Math.round(istat.ocrMs / istat.ocr)
						: 0} ms) · {istat.tekrar} tekrar · {istat.dusuk} düşük güven · {istat.ceviri} çeviri
				</p>
			{/if}
		</section>

		<aside class="panel">
			<label for="kamera">Kamera / capture kart</label>
			<div class="secim">
				<select id="kamera" bind:value={ayar.kamera} onchange={() => akis && kameraBaslat()}>
					<option value="">Varsayılan kamera</option>
					{#each kameralar as k, i (k.deviceId || i)}
						<option value={k.deviceId}>{k.label || 'Kamera ' + (i + 1)}</option>
					{/each}
				</select>
				<button
					class="ikincil yenile"
					onclick={kameralariYenile}
					disabled={yenileniyor}
					title="Kamera listesini yenile (sonradan bağlanan OBS sanal kamera, capture kart)"
					aria-label="Kamera listesini yenile">⟳</button
				>
			</div>
			<div class="satir">
				<button onclick={kameraBaslat}>
					{kameraAcik ? 'Kamerayı yeniden başlat' : 'Kamerayı başlat'}
				</button>
				<button class="ikincil" disabled={!kameraAcik || mesgul} onclick={baslatDurdur}>
					{calisiyor ? 'Durdur' : 'Çeviriyi başlat'}
				</button>
			</div>
			<KameraAyarlari {iz} />

			<label for="tip">Altyazı tipi</label>
			<select id="tip" bind:value={ayar.tip} onchange={() => (sonImza = null)}>
				<option value="white">Beyaz yazı (PS5 varsayılanı)</option>
				<option value="yellow">Sarı yazı</option>
				<option value="dark">Koyu yazı, açık zemin</option>
				<option value="none">İşlem yok (sadece gri)</option>
			</select>

			<label for="esik">Parlaklık eşiği <span class="deger">{ayar.esik}</span></label>
			<input id="esik" type="range" min="80" max="250" bind:value={ayar.esik} />

			<label for="aralik">Tarama aralığı <span class="deger">{ayar.aralik} ms</span></label>
			<input id="aralik" type="range" min="100" max="2000" step="50" bind:value={ayar.aralik} />

			<label for="guven">Min. OCR güveni <span class="deger">%{ayar.minGuven}</span></label>
			<input id="guven" type="range" min="0" max="95" bind:value={ayar.minGuven} />

			<label class="kutu">
				<input type="checkbox" bind:checked={ayar.yazim} onchange={yazimDegisti} /> OCR yazım hatalarını
				düzelt
			</label>
			<label class="kutu">
				<input type="checkbox" bind:checked={ayar.argo} onchange={() => (sonMetin = '')} /> Argoyu
				sadeleştir
				<small>({argoKuralSayisi} kural)</small>
			</label>
			<label class="kutu">
				<input type="checkbox" bind:checked={ayar.ingilizceGoster} /> İngilizce metni de göster
			</label>

			<div class="satir">
				<button class="ikincil" onclick={buyukAc}>Tam ekran çeviri</button>
			</div>

			<span class="baslik">OCR'a giden görüntü</span>
			<canvas bind:this={onizleme} class="onizleme"></canvas>
			<p class="ipucu">
				Burada yazı <b>beyaz zemin üstünde siyah</b> ve net görünmeli. Görünmüyorsa eşiği veya altyazı
				tipini değiştirin.
			</p>

			<span class="baslik">Geçmiş</span>
			<div class="gecmis">
				{#each gecmis as g, i (i)}
					<div>
						<span>{g.tr}</span><small>{g.en}</small>
						{#if g.giden !== g.en}<small class="giden" title="Çevirmene giden metin (argo sonrası)"
								>→ {g.giden}</small
							>{/if}
					</div>
				{/each}
			</div>
		</aside>
	</main>

	{#if buyukGorunum}
		<button class="buyuk" onclick={buyukKapat} title="Kapatmak için tıklayın">
			<span>{tr || '—'}</span>
		</button>
	{/if}
{:else}
	<div class="yukleniyor">Yükleniyor…</div>
{/if}

<!-- Arama motorları ve ilk kez gelen ziyaretçiler için açıklama (sunucuda HTML olarak üretilir) -->
<article class="bilgi">
	<h2>Nasıl çalışır?</h2>
	<ol>
		<li>
			PS5 görüntüsünü bilgisayara aktarın: <b>capture kart</b> (en iyi sonuç) veya ekrana bakan bir
			<b>web kamerası</b>.
		</li>
		<li>Oyunda altyazıları açın (Ayarlar → Ses ve Altyazılar).</li>
		<li>
			Bu sayfada <b>Kamerayı başlat</b>'a basın ve görüntüde altyazının çıktığı bölgeyi fareyle
			seçin.
		</li>
		<li>
			<b>Çeviriyi başlat</b>'a basın. İlk seferde Chrome Türkçe dil paketini ve OCR motorunu
			indirir; sonrasında altyazılar anında Türkçe görünür.
		</li>
	</ol>

	<h2>Neden hızlı?</h2>
	<p>
		Çeviri, Google Chrome'un <b>bilgisayarınızda çalışan yerleşik çevirmeniyle</b> yapılır. Metin internete
		gönderilmez, sunucu beklenmez. Okunan metindeki OCR hataları ve sokak argosu çeviriden önce düzeltilir
		("the hood" → "the neighborhood" gibi), böylece çeviri daha anlaşılır olur.
	</p>

	<h2>Sık sorulan sorular</h2>
	<h3>Oyunun Türkçe altyazısı yoksa ne yapabilirim?</h3>
	<p>
		Bu araç oyundaki İngilizce altyazıları ekrandan okuyup Chrome'un yerleşik çevirmeniyle anında
		Türkçeye çevirir. Resmi bir çeviri değildir.
	</p>
	<h3>Ne gerekiyor?</h3>
	<p>
		Bilgisayar, masaüstü Google Chrome {MIN_CHROME_SURUMU}+ ve PS5 görüntüsünü bilgisayara aktaran
		bir capture kart ya da ekrana bakan bir kamera. Telefon ve tabletlerde çalışmaz.
	</p>
	<h3>Ücretli mi?</h3>
	<p>
		Hayır, tamamen ücretsizdir. Görüntü ve metin hiçbir sunucuya gönderilmez; her şey tarayıcınızda
		işlenir.
	</p>
</article>

<footer class="surum" title="Derleme: {DERLEME}">
	Sürüm {SURUM}{COMMIT ? ` · ${COMMIT}` : ''}
</footer>

<style>
	header {
		padding: 12px 18px;
		border-bottom: 1px solid var(--line);
		display: flex;
		align-items: center;
		gap: 12px;
		flex-wrap: wrap;
	}
	h1 {
		font-size: 16px;
		margin: 0;
		font-weight: 600;
	}
	.bosluk {
		flex: 1;
	}
	.durum {
		color: var(--muted);
		font-size: 13px;
	}
	.durum.ok {
		color: var(--ok);
	}
	.durum.warn {
		color: var(--warn);
	}
	main {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 340px;
		gap: 16px;
		padding: 16px;
	}
	@media (max-width: 1000px) {
		main {
			grid-template-columns: 1fr;
		}
	}
	.panel {
		background: var(--panel);
		border: 1px solid var(--line);
		border-radius: 10px;
		padding: 14px;
	}
	.sahne {
		position: relative;
		width: 100%;
		background: #000;
		border-radius: 8px;
		overflow: hidden;
		line-height: 0;
		min-height: 200px;
	}
	video {
		width: 100%;
		height: auto;
		display: block;
	}
	.bolge {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		cursor: crosshair;
		touch-action: none;
	}
	.ipucu {
		color: var(--muted);
		font-size: 12px;
		margin: 8px 0 0;
	}
	.sure {
		text-align: right;
	}
	.altyazi {
		margin-top: 14px;
		min-height: 120px;
		padding: 18px;
		background: #000;
		border-radius: 10px;
		text-align: center;
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 8px;
	}
	.tr,
	.en,
	.buyuk span,
	.gecmis span,
	.gecmis small {
		white-space: pre-line;
	}
	.tr {
		font-size: 34px;
		font-weight: 700;
		line-height: 1.25;
		color: #fff;
		text-shadow: 0 2px 6px #000;
	}
	.en {
		font-size: 16px;
		color: var(--muted);
	}
	label,
	.baslik {
		display: block;
		margin: 10px 0 4px;
		color: var(--muted);
		font-size: 12px;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	select {
		width: 100%;
		background: var(--bg);
		color: var(--text);
		border: 1px solid var(--line);
		border-radius: 6px;
		padding: 7px 8px;
		font: inherit;
	}
	input[type='range'] {
		width: 100%;
	}
	.secim {
		display: flex;
		gap: 6px;
	}
	.secim select {
		flex: 1;
		min-width: 0;
	}
	.yenile {
		padding: 0 12px;
		font-size: 16px;
		line-height: 1;
	}
	.satir {
		display: flex;
		gap: 8px;
		margin-top: 8px;
	}
	.satir > * {
		flex: 1;
	}
	button {
		background: var(--accent);
		color: #fff;
		border: 0;
		border-radius: 6px;
		padding: 8px 12px;
		font: inherit;
		font-weight: 600;
		cursor: pointer;
	}
	button.ikincil {
		background: var(--line);
	}
	button:disabled {
		opacity: 0.5;
		cursor: default;
	}
	.kutu {
		display: flex;
		align-items: center;
		gap: 8px;
		color: var(--text);
		text-transform: none;
		letter-spacing: 0;
		font-size: 14px;
	}
	.kutu small {
		color: var(--muted);
	}
	.deger {
		float: right;
		color: var(--text);
		text-transform: none;
	}
	.onizleme {
		width: 100%;
		background: #fff;
		border-radius: 6px;
		margin-top: 6px;
		image-rendering: pixelated;
		min-height: 30px;
	}
	.gecmis {
		max-height: 260px;
		overflow: auto;
		margin-top: 6px;
		font-size: 13px;
	}
	.gecmis div {
		padding: 6px 0;
		border-bottom: 1px solid var(--line);
	}
	.gecmis small {
		color: var(--muted);
		display: block;
	}
	.gecmis .giden {
		color: var(--accent);
	}
	.buyuk {
		position: fixed;
		inset: 0;
		background: #000;
		border-radius: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 5vw;
		text-align: center;
		z-index: 10;
		font-size: 6vw;
		font-weight: 700;
		line-height: 1.2;
	}
	.engel {
		display: flex;
		justify-content: center;
		padding: 32px 16px;
	}
	.yukleniyor {
		padding: 48px 16px;
		text-align: center;
		color: var(--muted);
	}
	.kart {
		max-width: 520px;
		background: var(--panel);
		border: 1px solid var(--line);
		border-radius: 12px;
		padding: 24px;
	}
	.kart h2 {
		font-size: 20px;
		margin: 0 0 12px;
	}
	.neden {
		color: var(--warn);
		font-weight: 600;
	}
	.kart a {
		color: var(--accent);
		font-weight: 600;
	}
	.bilgi {
		max-width: 760px;
		margin: 24px auto 48px;
		padding: 0 16px;
		color: var(--muted);
	}
	.bilgi h2 {
		color: var(--text);
		font-size: 18px;
		margin: 28px 0 8px;
	}
	.bilgi h3 {
		color: var(--text);
		font-size: 15px;
		margin: 16px 0 4px;
	}
	.bilgi b {
		color: var(--text);
	}
	.surum {
		text-align: center;
		color: var(--muted);
		font-size: 11px;
		padding: 0 16px 24px;
		opacity: 0.7;
	}
</style>
