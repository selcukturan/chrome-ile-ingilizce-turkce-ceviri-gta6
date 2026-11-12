<script lang="ts">
	import { onMount } from 'svelte';
	import type { Istatistik } from '#lib/tipler.ts';

	let ist = $state<Istatistik | null>(null);

	onMount(async () => {
		// Aynı sekmede sayfa yenilemeleri tekrar sayılmasın
		let sayildi = false;
		try {
			sayildi = sessionStorage.getItem('gta6tr_sayildi') === '1';
		} catch {
			/* yoksay */
		}
		try {
			const r = await fetch('/api/sayac', { method: sayildi ? 'GET' : 'POST' });
			if (!r.ok) return;
			ist = await r.json();
			try {
				sessionStorage.setItem('gta6tr_sayildi', '1');
			} catch {
				/* yoksay */
			}
		} catch {
			/* sayaç çalışmasa da uygulama çalışır */
		}
	});

	const f = (n: number) => n.toLocaleString('tr-TR');
</script>

{#if ist}
	<span class="sayac" title="Sayım başlangıcı: {ist.baslangic}">
		👥 Bugün {f(ist.bugun.tekil)} kişi · Toplam {f(ist.tekilZiyaretci)} kişi / {f(
			ist.toplamZiyaret
		)} ziyaret
	</span>
{/if}

<style>
	.sayac {
		color: var(--muted);
		font-size: 12px;
		white-space: nowrap;
	}
</style>
