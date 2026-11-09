#!/usr/bin/env node
/**
 * Génère un manifest.json par dossier d'images.
 *
 *   node tools/build.mjs
 *
 * Un dossier = une série. Le site ne peut pas lister un dossier tout seul
 * (GitHub Pages n'a pas de listing), donc ce script écrit la liste des fichiers
 * dans images/<serie>/manifest.json. À relancer après chaque ajout d'images.
 */
import { readdir, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const IMG_DIR = path.join(ROOT, 'images');
const EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']);

const natural = (a, b) => a.localeCompare(b, 'fr', { numeric: true, sensitivity: 'base' });
const mo = (bytes) => (bytes / (1024 * 1024)).toFixed(1) + ' Mo';

async function main() {
  let dirs;
  try {
    dirs = (await readdir(IMG_DIR, { withFileTypes: true }))
      .filter((d) => d.isDirectory() && !d.name.startsWith('.'))
      .map((d) => d.name)
      .sort(natural);
  } catch {
    console.error('✗ Dossier images/ introuvable.');
    process.exit(1);
  }

  if (!dirs.length) {
    console.error('✗ Aucun sous-dossier dans images/. Créez images/ma-serie/ et déposez-y des JPG.');
    process.exit(1);
  }

  let grandTotal = 0;

  for (const dir of dirs) {
    const abs = path.join(IMG_DIR, dir);
    const files = (await readdir(abs))
      .filter((f) => EXT.has(path.extname(f).toLowerCase()))
      .sort(natural);

    if (!files.length) {
      console.log(`… ${dir.padEnd(24)} aucune image, manifest vide`);
      await writeFile(path.join(abs, 'manifest.json'), '[]\n');
      continue;
    }

    let bytes = 0;
    for (const f of files) bytes += (await stat(path.join(abs, f))).size;
    grandTotal += bytes;

    await writeFile(path.join(abs, 'manifest.json'), JSON.stringify(files, null, 2) + '\n');

    const moyen = Math.round(bytes / files.length / 1024);
    console.log(`✓ ${dir.padEnd(24)} ${String(files.length).padStart(4)} images · ${mo(bytes).padStart(7)} · ${moyen} Ko/image`);
    if (moyen > 400) {
      console.log(`  ⚠ ${moyen} Ko par image, c'est lourd. Réduisez à 1600 px :
     sips -Z 1600 -s formatOptions 80 images/${dir}/*.jpg`);
    }
  }

  console.log(`\nTotal images : ${mo(grandTotal)} pour ${dirs.length} série(s).`);
  console.log('Rappel GitHub Pages : 1 Go par site, 100 Go de trafic par mois (limite souple).');
}

main().catch((err) => { console.error(err); process.exit(1); });
