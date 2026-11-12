import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

// Sürüm bilgisi derleme sırasında koda gömülür (sayfanın altında ve /api/surum'da görünür).
// Commit: Coolify SOURCE_COMMIT'i build argümanı olarak verir; yerelde git'ten okunur.
const paket = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };
function commit(): string {
	if (process.env.SOURCE_COMMIT) return process.env.SOURCE_COMMIT.slice(0, 7);
	try {
		return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
			.toString()
			.trim();
	} catch {
		return '';
	}
}

export default defineConfig({
	define: {
		__SURUM__: JSON.stringify(paket.version),
		__COMMIT__: JSON.stringify(commit()),
		__DERLEME__: JSON.stringify(new Date().toISOString())
	},
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter()
		})
	]
});
