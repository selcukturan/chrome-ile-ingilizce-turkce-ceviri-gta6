// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	// vite.config.ts → define
	const __SURUM__: string;
	const __COMMIT__: string;
	const __DERLEME__: string;

	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
