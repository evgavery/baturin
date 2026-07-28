import { cpSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const packs = ['onest', 'jetbrains-mono', 'unbounded'];
const out = 'public/fonts';

mkdirSync(out, { recursive: true });

for (const p of packs) {
  const dirs = [
    `node_modules/@fontsource-variable/${p}/files`,
    `node_modules/@fontsource/${p}/files`,
  ].filter(existsSync);

  if (!dirs.length) {
    console.error(`нет пакета шрифта: ${p}`);
    process.exitCode = 1;
    continue;
  }

  const files = readdirSync(dirs[0]).filter((f) => /-(cyrillic|latin)-wght-normal\.woff2$/.test(f));

  if (!files.length) {
    console.error(`нет variable-файлов (-{cyrillic,latin}-wght-normal.woff2) в пакете: ${p}`);
    process.exitCode = 1;
    continue;
  }

  for (const f of files) {
    cpSync(join(dirs[0], f), join(out, f));
    console.log('copied', f);
  }
}
