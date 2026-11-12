<script lang="ts">
	// Kameranın donanım ayarları (parlaklık, kontrast, pozlama...).
	// Sadece cihazın desteklediği ayarlar gösterilir. Web kameraları genelde birkaç ayar sunar;
	// capture kartlar ve OBS sanal kamera çoğunlukla hiç ayar sunmaz.
	// Ayarlar her cihaz için ayrı saklanır ve kamera açılınca tekrar uygulanır.
	import { oku, yaz } from '#lib/depo.ts';

	let { iz }: { iz: MediaStreamTrack | null } = $props();

	type Aralik = { min: number; max: number; step?: number };
	type Ayarlar = Record<string, number | string>;

	// [ayar adı, etiket, bağlı olduğu mod] — mod "manual" olmadan değer değişmez
	const SAYISAL: [string, string, string?][] = [
		['brightness', 'Parlaklık'],
		['contrast', 'Kontrast'],
		['saturation', 'Doygunluk'],
		['sharpness', 'Keskinlik'],
		['exposureCompensation', 'Pozlama telafisi'],
		['exposureTime', 'Pozlama süresi', 'exposureMode'],
		['colorTemperature', 'Renk sıcaklığı', 'whiteBalanceMode'],
		['focusDistance', 'Odak mesafesi', 'focusMode']
	];
	const MODLAR: [string, string][] = [
		['exposureMode', 'Pozlama'],
		['whiteBalanceMode', 'Beyaz dengesi'],
		['focusMode', 'Odak']
	];
	const MOD_ADI: Record<string, string> = {
		manual: 'Elle',
		continuous: 'Otomatik',
		'single-shot': 'Tek sefer',
		none: 'Yok'
	};
	const TUM = [...SAYISAL.map((s) => s[0]), ...MODLAR.map((m) => m[0])];

	let yetenek = $state<Record<string, unknown>>({});
	let deger = $state<Ayarlar>({});
	let ilk: Ayarlar = {};
	let hata = $state('');

	const anahtar = () => 'kamera_' + (iz?.getSettings().deviceId ?? '');
	const sec = (s: object): Ayarlar =>
		Object.fromEntries(
			Object.entries(s).filter(([k, v]) => TUM.includes(k) && v !== undefined)
		) as Ayarlar;

	const sayisalAyarlar = $derived(
		SAYISAL.filter(([ad]) => {
			const a = yetenek[ad] as Aralik | undefined;
			return a && typeof a.min === 'number' && a.max > a.min;
		})
	);
	const modAyarlari = $derived(
		MODLAR.filter(([ad]) => Array.isArray(yetenek[ad]) && (yetenek[ad] as string[]).length > 1)
	);
	const ayarVar = $derived(sayisalAyarlar.length + modAyarlari.length > 0);

	$effect(() => {
		hata = '';
		if (!iz || typeof iz.getCapabilities !== 'function') {
			yetenek = {};
			return;
		}
		yetenek = iz.getCapabilities() as Record<string, unknown>;
		ilk = sec(iz.getSettings());
		deger = { ...ilk };
		// Bu cihaz için kaydedilmiş ayarları uygula
		const kayitli = oku<Ayarlar>(anahtar(), {});
		if (Object.keys(kayitli).length) uygula(kayitli, false);
	});

	async function uygula(degisim: Ayarlar, kaydet = true) {
		if (!iz) return;
		try {
			await iz.applyConstraints({ advanced: [degisim as MediaTrackConstraintSet] });
			deger = { ...deger, ...sec(iz.getSettings()) };
			hata = '';
			if (kaydet) yaz(anahtar(), { ...oku<Ayarlar>(anahtar(), {}), ...degisim });
		} catch (e) {
			hata = 'Ayar uygulanamadı: ' + (e as Error).message;
		}
	}

	function sayiDegisti(ad: string, mod: string | undefined, v: number) {
		const degisim: Ayarlar = { [ad]: v };
		// Pozlama süresi, renk sıcaklığı ve odak ancak ilgili mod "elle" iken değişir
		if (mod && Array.isArray(yetenek[mod]) && (yetenek[mod] as string[]).includes('manual'))
			degisim[mod] = 'manual';
		uygula(degisim);
	}

	async function sifirla() {
		yaz(anahtar(), {});
		await uygula(ilk, false);
	}
</script>

{#if iz}
	<details class="kamera-ayar">
		<summary>Kamera ayarları</summary>
		{#if ayarVar}
			{#each modAyarlari as [ad, etiket] (ad)}
				<label for={'mod-' + ad}>{etiket}</label>
				<select
					id={'mod-' + ad}
					value={deger[ad]}
					onchange={(e) => uygula({ [ad]: e.currentTarget.value })}
				>
					{#each yetenek[ad] as string[] as m (m)}
						<option value={m}>{MOD_ADI[m] ?? m}</option>
					{/each}
				</select>
			{/each}
			{#each sayisalAyarlar as [ad, etiket, mod] (ad)}
				{@const a = yetenek[ad] as Aralik}
				<label for={'ayar-' + ad}>{etiket} <span class="deger">{deger[ad]}</span></label>
				<input
					id={'ayar-' + ad}
					type="range"
					min={a.min}
					max={a.max}
					step={a.step || (a.max - a.min) / 100}
					value={deger[ad]}
					onchange={(e) => sayiDegisti(ad, mod, Number(e.currentTarget.value))}
				/>
			{/each}
			<div class="satir">
				<button class="ikincil" onclick={sifirla}>Başlangıç ayarlarına dön</button>
			</div>
			{#if hata}<p class="ipucu uyari">{hata}</p>{/if}
		{:else}
			<p class="ipucu">
				Bu cihaz yazılımdan ayar desteklemiyor. Capture kartlarda ve OBS sanal kamerada bu
				normaldir; görüntüyü OBS'ten ayarlayın veya aşağıdaki <b>Parlaklık eşiği</b>ni kullanın.
			</p>
		{/if}
	</details>
{/if}

<style>
	.kamera-ayar {
		margin-top: 10px;
		border: 1px solid var(--line);
		border-radius: 6px;
		padding: 6px 10px;
	}
	summary {
		cursor: pointer;
		color: var(--muted);
		font-size: 12px;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	label {
		display: block;
		margin: 10px 0 4px;
		color: var(--muted);
		font-size: 12px;
	}
	.deger {
		float: right;
		color: var(--text);
	}
	select {
		width: 100%;
		background: var(--bg);
		color: var(--text);
		border: 1px solid var(--line);
		border-radius: 6px;
		padding: 6px 8px;
		font: inherit;
	}
	input[type='range'] {
		width: 100%;
	}
	.satir {
		display: flex;
		margin-top: 10px;
	}
	button {
		flex: 1;
		background: var(--line);
		color: #fff;
		border: 0;
		border-radius: 6px;
		padding: 7px 10px;
		font: inherit;
		font-weight: 600;
		cursor: pointer;
	}
	.ipucu {
		color: var(--muted);
		font-size: 12px;
		margin: 8px 0 4px;
	}
	.uyari {
		color: var(--warn);
	}
</style>
