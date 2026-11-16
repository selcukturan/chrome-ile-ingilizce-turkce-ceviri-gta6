<script lang="ts">
	// Ayarların yanındaki "!" simgesi: üzerine gelince, klavyeyle odaklanınca ya da tıklayınca
	// ilgili bölümü açıklayan küçük bir balon açar. Balon ekran kenarlarına taşmaz.
	let { metin, baslik = '' }: { metin: string; baslik?: string } = $props();

	const uid = $props.id();
	const GENISLIK = 300;
	let dugme = $state() as HTMLButtonElement;
	let acik = $state(false);
	let stil = $state('');

	function goster() {
		const r = dugme.getBoundingClientRect();
		const genislik = Math.min(GENISLIK, innerWidth - 16);
		const sol = Math.min(
			Math.max(8, r.left + r.width / 2 - genislik / 2),
			innerWidth - genislik - 8
		);
		// Altta yer yoksa simgenin üstünde açılır
		const dikey =
			innerHeight - r.bottom > 180
				? `top:${r.bottom + 6}px`
				: `bottom:${innerHeight - r.top + 6}px`;
		stil = `left:${sol}px;${dikey};width:${genislik}px`;
		acik = true;
	}
	const gizle = () => (acik = false);
</script>

<span class="bilgi">
	<button
		bind:this={dugme}
		type="button"
		class="ikon"
		aria-label={baslik ? `Bilgi: ${baslik}` : 'Bilgi'}
		aria-describedby={acik ? uid : undefined}
		onmouseenter={goster}
		onmouseleave={gizle}
		onfocus={goster}
		onblur={gizle}
		onclick={(e) => {
			e.preventDefault();
			e.stopPropagation();
			if (acik) gizle();
			else goster();
		}}
		onkeydown={(e) => e.key === 'Escape' && gizle()}>!</button
	>
	{#if acik}
		<span role="tooltip" id={uid} class="balon" style={stil}>
			{#if baslik}<b>{baslik}</b>{/if}
			{metin}
		</span>
	{/if}
</span>

<style>
	.bilgi {
		display: inline-block;
		vertical-align: middle;
		margin-left: 4px;
		line-height: 1;
	}
	.ikon {
		width: 16px;
		height: 16px;
		padding: 0;
		border-radius: 50%;
		border: 1px solid var(--muted);
		background: transparent;
		color: var(--muted);
		font:
			700 10px/14px system-ui,
			sans-serif;
		text-align: center;
		cursor: help;
	}
	.ikon:hover,
	.ikon:focus-visible {
		border-color: var(--accent);
		color: var(--accent);
		outline: none;
	}
	.balon {
		position: fixed;
		z-index: 20;
		display: block;
		padding: 10px 12px;
		background: #232733;
		border: 1px solid var(--line);
		border-radius: 8px;
		box-shadow: 0 6px 24px rgba(0, 0, 0, 0.45);
		color: var(--text);
		/* bulunduğu etiketin (BÜYÜK HARF, aralıklı) biçimini almasın */
		font:
			400 13px/1.45 system-ui,
			sans-serif;
		text-transform: none;
		letter-spacing: 0;
		text-align: left;
		white-space: normal;
		pointer-events: none;
	}
	.balon b {
		display: block;
		margin-bottom: 4px;
		font-weight: 600;
	}
</style>
