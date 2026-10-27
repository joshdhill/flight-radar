// Builds the Claude dashboard version: one self-contained HTML page with the same UI,
// using app/transport-claude.js instead of the website's /api functions.
//   node tools/build-claude.mjs [out.html]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const out = process.argv[2] || path.join(root, 'dist', 'claude-dashboard.html');

const index = read('index.html');
const body = index.slice(index.indexOf('<body>') + 6, index.indexOf('<script src="app/core.js">'));
const fonts = index.match(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^>]+>/)[0];
const js = (p) => `<script>\n${read(p).replace(/<\/script/gi, '<\\/script')}\n</script>`;

const html = [
  '<title>Over Germantown</title>',
  '<meta name="claude:viewport-fit-sides" content="cover">',
  '<link rel="preconnect" href="https://fonts.googleapis.com">',
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
  fonts,
  `<style>\n${read('app/style.css')}\n</style>`,
  body.trim(),
  `<script type="application/json" id="mapdata">${read('data/map.json')}</script>`,
  '<script>window.OG_EMBEDDED = true; document.documentElement.classList.add("embedded");</script>',
  js('app/core.js'), js('app/sprites.js'), js('app/transport-claude.js'), js('app/ui.js'),
].join('\n');

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log(`wrote ${out} (${(html.length / 1024).toFixed(0)} KB)`);
