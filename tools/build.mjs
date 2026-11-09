#!/usr/bin/env node
/**
 * Construit le site.
 *
 *   npm run build
 *
 * 1. écrit images/<cas>/<série>/manifest.json   (le navigateur ne peut pas lister un dossier)
 * 2. génère cas/<cas>/index.html                (une page par cas, avec ses balises Open Graph)
 * 3. génère content/cases.json                  (la liste affichée sur l'accueil)
 *
 * À relancer après chaque ajout d'images, de cas ou de série.
 */
import { readdir, writeFile, readFile, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CASES_DIR = path.join(ROOT, 'content', 'cases');
const IMG_DIR = path.join(ROOT, 'images');
const OUT_DIR = path.join(ROOT, 'cas');
const EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']);
const SLUG = /^[a-z0-9][a-z0-9-]*$/;

const natural = (a, b) => a.localeCompare(b, 'fr', { numeric: true, sensitivity: 'base' });
const mo = (bytes) => (bytes / (1024 * 1024)).toFixed(1) + ' Mo';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

async function listImages(dir) {
  try {
    return (await readdir(dir))
      .filter((f) => EXT.has(path.extname(f).toLowerCase()))
      .sort(natural);
  } catch { return []; }
}

async function buildManifests(caseData, warnings) {
  let total = 0;
  let totalBytes = 0;
  let thumb = null;

  for (const serie of caseData.series) {
    if (!serie || !SLUG.test(String(serie.id || ''))) {
      throw new Error(`série invalide dans ${caseData.id} : "id" doit être un slug (a-z, 0-9, -)`);
    }
    const folder = String(serie.folder || '').replace(/\/+$/, '');
    if (!folder) throw new Error(`série "${serie.id}" de ${caseData.id} : "folder" manquant`);

    const abs = path.join(ROOT, folder);
    const files = await listImages(abs);

    if (!files.length) {
      warnings.push(`${caseData.id}/${serie.id} : aucune image dans ${folder}/`);
      await mkdir(abs, { recursive: true });
      await writeFile(path.join(abs, 'manifest.json'), '[]\n');
      continue;
    }

    let bytes = 0;
    for (const f of files) bytes += (await stat(path.join(abs, f))).size;
    totalBytes += bytes;
    total += files.length;
    if (!thumb) thumb = folder + '/' + files[0];

    await writeFile(path.join(abs, 'manifest.json'), JSON.stringify(files, null, 2) + '\n');

    const moyenne = Math.round(bytes / files.length / 1024);
    console.log(`  ${folder.padEnd(34)} ${String(files.length).padStart(4)} images · ${mo(bytes).padStart(7)}`);
    if (moyenne > 400) {
      warnings.push(`${folder} : ${moyenne} Ko par image. Réduisez à 1600 px :
     sips -Z 1600 -s formatOptions 80 ${folder}/*.jpg`);
    }
  }

  return { total, totalBytes, thumb };
}

function fillTemplate(tpl, values) {
  return tpl.replace(/\{\{([A-Z_]+)\}\}/g, (_, key) => (key in values ? values[key] : ''));
}

async function main() {
  const pkg = JSON.parse(await readFile(path.join(ROOT, 'package.json'), 'utf8'));
  const version = pkg.version || '0.0.0';
  const homepage = (pkg.homepage || '').replace(/\/?$/, '/');

  const template = await readFile(path.join(ROOT, '_template.html'), 'utf8').catch(() => {
    throw new Error('_template.html introuvable à la racine du projet.');
  });

  let files;
  try {
    files = (await readdir(CASES_DIR)).filter((f) => f.endsWith('.json')).sort(natural);
  } catch {
    throw new Error('Dossier content/cases/ introuvable.');
  }
  if (!files.length) throw new Error('Aucun cas dans content/cases/.');

  await mkdir(OUT_DIR, { recursive: true });

  const warnings = [];
  const index = [];
  let grandTotal = 0;

  console.log(`\nRadQuizz v${version} — construction\n`);

  for (const file of files) {
    const raw = await readFile(path.join(CASES_DIR, file), 'utf8');
    let data;
    try { data = JSON.parse(raw); } catch (err) { throw new Error(`${file} : JSON invalide (${err.message})`); }

    if (!SLUG.test(String(data.id || ''))) {
      throw new Error(`${file} : "id" doit être un slug (a-z, 0-9, -), reçu "${data.id}"`);
    }
    if (!Array.isArray(data.series) || !data.series.length) {
      throw new Error(`${file} : aucune "series"`);
    }
    if (!data.title) throw new Error(`${file} : "title" manquant`);

    console.log(`• ${data.id} — ${data.title}`);
    const { total, totalBytes, thumb } = await buildManifests(data, warnings);
    grandTotal += totalBytes;

    const ogImage = thumb
      ? (homepage ? new URL(thumb, homepage).href : thumb)
      : (homepage ? new URL('assets/og-image.png', homepage).href : 'assets/og-image.png');

    const html = fillTemplate(template, {
      TITLE: esc(data.title),
      STEM: esc(data.stem || ''),
      URL: esc(homepage ? new URL(`cas/${data.id}/`, homepage).href : `cas/${data.id}/`),
      OG_IMAGE: esc(ogImage),
      CASE_ID: esc(data.id),
      BASE: '../../',
      VERSION: esc(version),
    });

    const outDir = path.join(OUT_DIR, data.id);
    await mkdir(outDir, { recursive: true });
    await writeFile(path.join(outDir, 'index.html'), html);

    index.push({
      id: data.id,
      title: data.title,
      stem: data.stem || '',
      exam: data.exam || '',
      href: `cas/${data.id}/`,
      thumb: thumb || '',
      seriesCount: data.series.length,
      sliceCount: total,
    });

    console.log(`  → cas/${data.id}/index.html  (${total} coupes)\n`);
  }

  await writeFile(
    path.join(ROOT, 'content', 'cases.json'),
    JSON.stringify({ version, cases: index }, null, 2) + '\n'
  );

  // l'accueil est statique : on tient à jour le ?v= de ses assets
  const homePath = path.join(ROOT, 'index.html');
  const home = await readFile(homePath, 'utf8');
  const busted = home.replace(/(assets\/[\w.-]+\.(?:css|js))\?v=[\w.-]+/g, `$1?v=${version}`);
  if (busted !== home) await writeFile(homePath, busted);

  console.log(`Total : ${index.length} cas, ${grandTotal / 1024 / 1024 >= 0.1 ? mo(grandTotal) : Math.round(grandTotal / 1024) + ' Ko'}.`);
  console.log('Rappel GitHub Pages : 1 Go par site, ~100 Go de trafic par mois (limite souple).');

  if (!homepage) warnings.push('package.json : "homepage" manquant, les URLs Open Graph seront relatives (LinkedIn les ignorera).');
  if (warnings.length) {
    console.log('\nAvertissements :');
    for (const w of warnings) console.log('  ⚠ ' + w);
  }
  console.log('');
}

main().catch((err) => {
  console.error('\n✗ ' + err.message + '\n');
  process.exit(1);
});
