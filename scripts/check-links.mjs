// Проверка внутренних ссылок по файловой системе, а не через HTTP: `php -S -t dist` без
// роутера отдаёт 200 на любой несуществующий путь, так что HTTP-проверки битых ссылок не
// ловят. Каждый внутренний href/src должен резолвиться в реальный файл dist с учётом
// trailingSlash: 'always'. exit 1, если хоть одна ссылка битая.

import { readFileSync, readdirSync, existsSync, realpathSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIST = join(ROOT, 'dist');

// (?<![\w-]) вместо \b: \b сам по себе НЕ исключает дефис слева (дефис — не словесный символ,
// значит между ним и "s" в "data-src" тоже есть словесная граница) — regex ловил бы data-src,
// data-href и т.п. как обычный href/src. Нужна граница именно атрибута: слева — пробел, `<` или
// начало строки, а не буква/цифра/дефис.
const HTML_ATTR_RE = /(?<![\w-])(?:href|src)\s*=\s*"([^"]+)"/gi;

function findHtmlFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...findHtmlFiles(full));
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      out.push(full);
    }
  }
  return out;
}

function toPageUrl(htmlPath) {
  const rel = relative(DIST, htmlPath).split(sep).join('/');
  if (rel === 'index.html') return '/';
  if (rel.endsWith('/index.html')) return `/${rel.slice(0, -'index.html'.length)}`;
  return `/${rel}`;
}

/** Внутренняя ли ссылка: абсолютный путь от корня сайта, не протокол-относительный (`//host/...`). */
function isInternal(href) {
  return href.startsWith('/') && !href.startsWith('//');
}

/** Путь ссылки → ожидаемый файл в dist, с учётом trailingSlash: 'always' (astro.config.ts). */
function resolveDistPath(href) {
  const clean = href.split('#')[0].split('?')[0]; // якорь/query — не часть пути файла
  if (clean === '' || clean === '/') return join(DIST, 'index.html');
  if (clean.endsWith('/')) return join(DIST, clean, 'index.html');
  return join(DIST, clean);
}

const htmlFiles = findHtmlFiles(DIST).sort();
if (htmlFiles.length === 0) {
  console.error(`В ${relative(ROOT, DIST)} не найдено ни одного .html — сначала запустите build.`);
  process.exit(1);
}

/** href → страницы, где он встретился (Map для дедупликации: один href проверяем один раз). */
const linksToPages = new Map();

for (const file of htmlFiles) {
  const html = readFileSync(file, 'utf-8');
  const page = toPageUrl(file);
  for (const match of html.matchAll(HTML_ATTR_RE)) {
    const href = match[1];
    if (!isInternal(href)) continue;
    if (!linksToPages.has(href)) linksToPages.set(href, new Set());
    linksToPages.get(href).add(page);
  }
}

const REAL_DIST = realpathSync.native(DIST);

/** Годится только файл (не директория: `/plazmy/75` без слэша — авторская ошибка) и только
 * в точном регистре: APFS на macOS регистронезависима, Linux-хостинг — нет. */
function isValidTarget(target) {
  if (!existsSync(target) || !statSync(target).isFile()) return false;
  return relative(REAL_DIST, realpathSync.native(target)) === relative(DIST, target);
}

const broken = [];
for (const [href, pages] of linksToPages) {
  const target = resolveDistPath(href);
  if (!isValidTarget(target)) {
    broken.push({ href, target: relative(ROOT, target), pages: [...pages].sort() });
  }
}

console.log(`Проверено уникальных внутренних ссылок: ${linksToPages.size} (${htmlFiles.length} html-страниц).`);

if (broken.length > 0) {
  console.error(`\nБитых ссылок: ${broken.length}`);
  for (const b of broken.sort((a, b2) => a.href.localeCompare(b2.href))) {
    console.error(`  ${b.href}  →  ожидался файл ${b.target} (не найден)`);
    console.error(`    встречается на: ${b.pages.join(', ')}`);
  }
  process.exit(1);
}

console.log('Все внутренние ссылки ведут на реальные файлы в dist.');
