<script lang="ts">
	import favicon from '#lib/assets/favicon.svg';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}

<style>
	:global(:root) {
		--bg: #0f1115;
		--panel: #181b22;
		--line: #2a2f3a;
		--text: #e8eaf0;
		--muted: #8a93a6;
		--accent: #4f8cff;
		--ok: #3ecf8e;
		--warn: #f5a524;
		color-scheme: dark;
	}
	:global(*) {
		box-sizing: border-box;
	}
	:global(body) {
		margin: 0;
		background: var(--bg);
		color: var(--text);
		font:
			14px/1.45 system-ui,
			-apple-system,
			'Segoe UI',
			Roboto,
			sans-serif;
	}
</style>
