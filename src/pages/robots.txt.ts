import { SITE } from '../config/site';

export const GET = () =>
  new Response('User-agent: *\nAllow: /\n\nSitemap: ' + new URL('sitemap-index.xml', SITE.url).href);
