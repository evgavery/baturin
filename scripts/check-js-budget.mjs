// JS-бюджет на страницу (ТЗ §12: ≤ 50 КБ gzip). Для каждой dist-страницы суммируется честный
// eager-вес: внешние `<script src>` (гзипуются из dist) и инлайновые `<script type="module">`
// (Vite инлайнит листовые чанки без общих импортов — например hero-slider на главной).
// Не считаются: ld+json (не JS), инлайн Метрики (единственное санкционированное стороннее
// подключение) и квиз-чанк (динамический import — в HTML его нет вообще).
// exit 1, если хоть одна страница превышает бюджет.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIST = join(ROOT, 'dist');
const BUDGET_BYTES = 51200; // 50 КБ gzip — ТЗ §12

const SCRIPT_TAG_RE = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;

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

// (?<![\w-]) вместо \b: \b сам по себе не исключает дефис слева (дефис — не словесный символ,
// значит между ним и первой буквой имени атрибута тоже есть словесная граница) — без lookbehind
// `getAttr(attrs, 'src')` поймал бы значение из data-src="..." как обычный src. Нужна граница
// именно атрибута: слева — пробел или начало строки атрибутов, а не буква/цифра/дефис.
function getAttr(attrs, name) {
  const m = attrs.match(new RegExp(`(?<![\\w-])${name}\\s*=\\s*"([^"]*)"`, 'i'));
  return m ? m[1] : null;
}

/** URL страницы в терминах сайта (trailingSlash: 'always'), а не путь файла на диске. */
function toPageUrl(htmlPath) {
  const rel = relative(DIST, htmlPath).split(sep).join('/');
  if (rel === 'index.html') return '/';
  if (rel.endsWith('/index.html')) return `/${rel.slice(0, -'index.html'.length)}`;
  return `/${rel}`;
}

/** Честный eager-JS одной HTML-страницы: внешние script-ассеты + инлайн-модули Astro. */
function collectPageBudget(htmlPath) {
  const html = readFileSync(htmlPath, 'utf-8');
  const assets = [];
  let totalGzip = 0;

  for (const match of html.matchAll(SCRIPT_TAG_RE)) {
    const [, attrs, body] = match;
    const src = getAttr(attrs, 'src');

    if (src !== null) {
      if (/^(https?:)?\/\//i.test(src)) continue; // внешний скрипт (Метрика) — не наш JS-бюджет
      const assetPath = join(DIST, src.split('?')[0]);
      // Без явной проверки readFileSync уронил бы весь скрипт сырым ENOENT-стектрейсом —
      // непонятно, на какой странице и какого ассета не хватает. Диагностика вместо этого.
      if (!existsSync(assetPath)) {
        console.error(
          `Ассет не найден: ${relative(DIST, assetPath)} (страница ${toPageUrl(htmlPath)}, <script src="${src}">).`,
        );
        process.exit(1);
      }
      const gz = gzipSync(readFileSync(assetPath));
      totalGzip += gz.length;
      assets.push({ name: relative(DIST, assetPath).split(sep).join('/'), bytes: gz.length });
      continue;
    }

    const type = getAttr(attrs, 'type');
    if (type !== 'module') continue; // ld+json и прочее inline (Метрика без type) — не JS-бюджет
    if (!body.trim()) continue;

    const gz = gzipSync(Buffer.from(body, 'utf-8'));
    totalGzip += gz.length;
    assets.push({ name: '(инлайн-модуль)', bytes: gz.length });
  }

  return { totalGzip, assets };
}

const htmlFiles = findHtmlFiles(DIST).sort();
if (htmlFiles.length === 0) {
  console.error(`В ${relative(ROOT, DIST)} не найдено ни одного .html — сначала запустите build.`);
  process.exit(1);
}

const rows = htmlFiles.map((file) => ({ url: toPageUrl(file), ...collectPageBudget(file) }));

const urlWidth = Math.max(...rows.map((r) => r.url.length), 'Страница'.length) + 2;
const kb = (bytes) => (bytes / 1024).toFixed(2);

console.log(`${'Страница'.padEnd(urlWidth)}КБ gzip   ассетов`);
console.log('-'.repeat(urlWidth + 20));
for (const row of rows) {
  const over = row.totalGzip > BUDGET_BYTES;
  const mark = over ? '  ПРЕВЫШЕН' : '';
  console.log(
    `${row.url.padEnd(urlWidth)}${kb(row.totalGzip).padStart(7)}   ${String(row.assets.length).padStart(2)}${mark}`,
  );
}
console.log('-'.repeat(urlWidth + 20));
console.log(`Бюджет: ${kb(BUDGET_BYTES)} КБ gzip/страницу (ТЗ §12).`);

const overBudget = rows.filter((r) => r.totalGzip > BUDGET_BYTES);
if (overBudget.length > 0) {
  console.error(`\nПревышен бюджет на ${overBudget.length} стр.:`);
  for (const row of overBudget) {
    console.error(`  ${row.url}: ${kb(row.totalGzip)} КБ`);
    for (const asset of row.assets) console.error(`    - ${asset.name}: ${kb(asset.bytes)} КБ`);
  }
  process.exit(1);
}

console.log('\nВсе страницы уложились в бюджет.');
