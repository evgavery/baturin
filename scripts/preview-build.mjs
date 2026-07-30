// Пост-обработка dist/ для ТЕСТОВОГО превью на GitHub Pages (запускается только из
// .github/workflows/preview.yml, боевую сборку для Reg.ru не трогает).
//
// GitHub Pages отдаёт сайт проекта из подкаталога (https://<user>.github.io/<repo>/),
// а все внутренние пути в коде — корневые (`/plazmy/`, `/fonts/…`). Поэтому:
//   1) всем корневым href/src/srcset в HTML и url(...) в CSS дописывается префикс PREVIEW_BASE;
//   2) в <head> каждой страницы вставляется <meta name="robots" content="noindex, nofollow">;
//   3) robots.txt перезаписывается на полный запрет, sitemap*.xml удаляются —
//      превью не должно индексироваться;
//   4) удаляется .htaccess (Apache-конфиг, на GitHub Pages не работает);
//   5) создаётся .nojekyll — иначе GitHub Pages не отдаёт каталоги с подчёркиванием (_astro/).
import { readdirSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';

const DIST = new URL('../dist', import.meta.url).pathname;
const BASE = process.env.PREVIEW_BASE ?? '';
if (!existsSync(DIST)) {
  console.error('preview-build: нет dist/ — сначала npm run build');
  process.exit(1);
}
if (BASE && !BASE.startsWith('/')) {
  console.error(`preview-build: PREVIEW_BASE должен начинаться с "/", получено: ${BASE}`);
  process.exit(1);
}

const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
  );

const NOINDEX = '<meta name="robots" content="noindex, nofollow">';
let htmlCount = 0;

for (const file of walk(DIST)) {
  const ext = extname(file);
  if (ext === '.html') {
    let html = readFileSync(file, 'utf8');
    // `(?!/)` не трогает протокол-относительные `//host/...`; внешние http(s)-ссылки не совпадают.
    html = html.replace(/(href|src|srcset)="\/(?!\/)/g, `$1="${BASE}/`);
    if (!html.includes('name="robots"')) html = html.replace('<head>', `<head>${NOINDEX}`);
    writeFileSync(file, html);
    htmlCount += 1;
  } else if (ext === '.css') {
    writeFileSync(file, readFileSync(file, 'utf8').replaceAll('url(/', `url(${BASE}/`));
  } else if (ext === '.js') {
    // fetch('/api/lead.php') в островах; PHP на Pages всё равно не работает, но пути держим едиными.
    writeFileSync(file, readFileSync(file, 'utf8').replace(/(['"])\/api\//g, `$1${BASE}/api/`));
  }
}

writeFileSync(join(DIST, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
writeFileSync(join(DIST, '.nojekyll'), '');
for (const f of ['sitemap-index.xml', 'sitemap-0.xml', '.htaccess'])
  rmSync(join(DIST, f), { force: true });

console.log(`preview-build: base="${BASE}", обработано HTML-страниц: ${htmlCount}, noindex включён`);
