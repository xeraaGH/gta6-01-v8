// Bahía Azul — build script: copies game/ + screenshots/ to /output and writes dossier.json.
// Node 22, standard library only. Run: node main.ts
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const ROOT = dirname(fileURLToPath(import.meta.url));
const OUT = '/output';
const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function build(): Uint8Array {
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  cpSync(join(ROOT, 'game'), join(OUT, 'game'), { recursive: true });
  cpSync(join(ROOT, 'screenshots'), join(OUT, 'screenshots'), { recursive: true });
  const dossier = buildDossier(OUT, CAPS);
  writeFileSync(join(OUT, 'dossier.json'), dossier);
  return dossier;
}

const dossier = build();
console.log(`dossier.json written: ${dossier.length} bytes`);
console.log('game/ and screenshots/ copied to /output');

// --- output verification: parse the dossier back and check the gate caps ---
const parsed = JSON.parse(readFileSync(join(OUT, 'dossier.json'), 'utf8'));
const failures: string[] = [];
if (parsed.schema !== 'makefun/dossier/v1') failures.push(`unexpected dossier schema: ${parsed.schema}`);
if (typeof parsed.text !== 'string' || Buffer.byteLength(parsed.text, 'utf8') > CAPS.text_max_bytes) {
  failures.push(`dossier text over ${CAPS.text_max_bytes} bytes`);
}
if (!Array.isArray(parsed.images) || parsed.images.length < 3 || parsed.images.length > CAPS.screenshots.max) {
  failures.push(`expected 3-${CAPS.screenshots.max} screenshots, got ${parsed.images?.length}`);
}
for (const name of readdirSync(join(OUT, 'screenshots'))) {
  const size = statSync(join(OUT, 'screenshots', name)).size;
  if (size > CAPS.screenshots.max_bytes) failures.push(`screenshot ${name} is ${size} bytes, over ${CAPS.screenshots.max_bytes}`);
  if (!/\.(png|jpe?g)$/i.test(name)) failures.push(`screenshot ${name} is not PNG or JPEG`);
}
const indexSize = statSync(join(OUT, 'game', 'index.html')).size;
if (indexSize > 1024 * 1024) failures.push(`game/index.html is ${indexSize} bytes, over 1 MiB`);
if (failures.length > 0) {
  console.error('OUTPUT VERIFICATION FAILED:');
  for (const f of failures) console.error('  - ' + f);
  process.exit(1);
}
console.log(`verified: schema ${parsed.schema}, text ${Buffer.byteLength(parsed.text, 'utf8')} bytes, ${parsed.images.length} screenshots, index.html ${indexSize} bytes — all within the gate caps`);
