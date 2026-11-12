import { SITE_URL } from '#lib/site.ts';

export const prerender = true;

export const GET = () =>
	new Response(`User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${SITE_URL}/sitemap.xml\n`, {
		headers: { 'Content-Type': 'text/plain' }
	});
