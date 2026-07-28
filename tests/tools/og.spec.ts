import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test } from '@playwright/test';

// Инструмент, а не тест: рендерит og-image 1200×630 и кладёт готовый PNG в public/.
// Запуск вручную после правок картинки:
//   npx playwright test --config=tests/tools/pw.config.ts
// Значения цветов и шрифтов повторяют токены src/styles/global.css — это единственное
// место вне global.css, где они выписаны литералами: картинка рендерится вне сборки сайта.
const FONT_DIR = fileURLToPath(new URL('../../public/fonts/', import.meta.url));
const OUT = fileURLToPath(new URL('../../public/og-image.png', import.meta.url));

function fontFace(family: string, file: string, weight: string): string {
  const data = readFileSync(`${FONT_DIR}${file}`).toString('base64');
  return `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};src:url(data:font/woff2;base64,${data}) format('woff2-variations');}`;
}

const FONTS = [
  fontFace('Unbounded', 'unbounded-cyrillic-wght-normal.woff2', '200 900'),
  fontFace('Unbounded', 'unbounded-latin-wght-normal.woff2', '200 900'),
  fontFace('Onest', 'onest-cyrillic-wght-normal.woff2', '100 900'),
  fontFace('Onest', 'onest-latin-wght-normal.woff2', '100 900'),
  fontFace('JetBrains Mono', 'jetbrains-mono-cyrillic-wght-normal.woff2', '100 800'),
  fontFace('JetBrains Mono', 'jetbrains-mono-latin-wght-normal.woff2', '100 800'),
].join('');

const HTML = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><style>
${FONTS}
*{box-sizing:border-box;margin:0;}
body{width:1200px;height:630px;position:relative;overflow:hidden;background:#0B0E14;font-family:'Onest',system-ui,sans-serif;-webkit-font-smoothing:antialiased;}
.halo{position:absolute;right:-160px;top:-220px;width:940px;height:940px;border-radius:50%;
  background:radial-gradient(circle at 50% 50%,rgba(60,110,240,.30) 0%,rgba(30,91,255,.10) 46%,rgba(11,14,20,0) 70%);}
.screen{position:absolute;right:-120px;bottom:-96px;width:620px;height:349px;border-radius:20px;
  border:1px solid #35507F;
  background:radial-gradient(120% 130% at 50% 0%,rgba(234,241,255,.30) 0%,rgba(60,110,240,.34) 42%,rgba(16,28,64,.92) 100%);
  box-shadow:0 0 64px rgba(122,160,255,.34),0 0 180px rgba(30,91,255,.18);}
.top{position:absolute;left:72px;top:70px;right:72px;}
.kicker{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:18px;letter-spacing:.14em;
  text-transform:uppercase;color:#7C8798;}
h1{font-family:'Unbounded',system-ui,sans-serif;font-weight:600;font-size:66px;line-height:1.04;
  letter-spacing:-.025em;color:#EAF1FF;margin-top:28px;max-width:830px;}
.bottom{position:absolute;left:72px;bottom:70px;}
.rule{width:64px;height:3px;background:#1E5BFF;box-shadow:0 0 18px rgba(30,91,255,.7);margin-bottom:24px;}
.sub{font-size:30px;line-height:1.35;color:#C6CFDD;}
</style></head><body>
<div class="halo"></div>
<div class="screen"></div>
<div class="top">
  <div class="kicker">Москва и область · AV-оборудование в аренду</div>
  <h1>Аренда экранов для мероприятий в Москве</h1>
</div>
<div class="bottom">
  <div class="rule"></div>
  <div class="sub">Смета за 30 минут в вашем мессенджере</div>
</div>
</body></html>`;

test.use({ viewport: { width: 1200, height: 630 } });

test('og-image 1200×630', async ({ page }) => {
  await page.setContent(HTML, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: OUT, clip: { x: 0, y: 0, width: 1200, height: 630 } });
});
