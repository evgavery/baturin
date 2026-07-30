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

  // Нужны оба сабсета: global.css объявляет @font-face и на cyrillic, и на latin —
  // пропавший файл молча уронил бы половину алфавита на fallback-шрифт.
  const missing = ['cyrillic', 'latin'].filter((s) => !files.some((f) => f.includes(`-${s}-`)));
  if (missing.length) {
    console.error(`в пакете ${p} нет сабсетов: ${missing.join(', ')} (-wght-normal.woff2)`);
    process.exitCode = 1;
    continue;
  }

  for (const f of files) {
    cpSync(join(dirs[0], f), join(out, f));
    console.log('copied', f);
  }
}
