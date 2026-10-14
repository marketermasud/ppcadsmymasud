/* Cloudflare Pages build: resizes root images, builds the gallery + hero, writes ./dist */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');
const IMG_RE = /\.(jpe?g|png|webp)$/i;
const SITE_EXT = /\.(html|css|js|svg|woff2|txt|xml|ico|json)$/i;
const SKIP = new Set(['build.js', 'package.json', 'package-lock.json']);

let sharp = null;
try { sharp = require('sharp'); } catch (e) { console.warn('! sharp not available — images will be copied without resizing'); }

const natural = (a, b) => a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' });
const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function caption(file) {
  let n = path.basename(file, path.extname(file));
  n = n.replace(/^\d+[\s._-]+/, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  return n;
}
function slug(file) {
  const base = path.basename(file, path.extname(file)).toLowerCase()
    .normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'image';
  return base;
}

async function processImage(file, maxW) {
  const src = path.join(ROOT, file);
  if (!sharp) {
    fs.copyFileSync(src, path.join(DIST, file));
    return file;
  }
  const out = slug(file) + '.webp';
  await sharp(src).rotate().resize({ width: maxW, withoutEnlargement: true }).webp({ quality: 82 }).toFile(path.join(DIST, out));
  return out;
}

(async () => {
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });

  const files = fs.readdirSync(ROOT).filter((f) => fs.statSync(path.join(ROOT, f)).isFile());

  // plain site files
  for (const f of files) {
    if (SKIP.has(f) || f.startsWith('.') || IMG_RE.test(f)) continue;
    if (SITE_EXT.test(f)) fs.copyFileSync(path.join(ROOT, f), path.join(DIST, f));
  }

  // images
  const imgs = files.filter((f) => IMG_RE.test(f) && !f.startsWith('_')).sort(natural);
  const isHero = (f) => /^(my_image|hero)$/i.test(path.basename(f, path.extname(f)));
  const hero = imgs.find(isHero);
  const gallery = imgs.filter((f) => !isHero(f));

  let heroOut = null;
  if (hero) heroOut = await processImage(hero, 1000);

  const used = new Set();
  let items = '';
  let i = 0;
  for (const f of gallery) {
    let out;
    try { out = await processImage(f, 1600); } catch (e) { console.warn('! skipped', f, e.message); continue; }
    if (used.has(out)) { console.warn('! duplicate name, skipped', f); continue; }
    used.add(out);
    const cap = esc(caption(f));
    items += `    <div class="screenshot-item${i >= 6 ? ' ss-hidden' : ''}" onclick="openLightbox(this)"><img src="${encodeURI(out)}" alt="${cap}" loading="lazy"><div class="screenshot-caption">${cap}</div></div>\n`;
    i++;
  }

  // case-studies gallery
  const csPath = path.join(DIST, 'case-studies.html');
  let cs = fs.readFileSync(csPath, 'utf8');
  const re = /<!--GALLERY:START-->[\s\S]*?<!--GALLERY:END-->/;
  if (!re.test(cs)) throw new Error('gallery markers missing in case-studies.html');
  cs = cs.replace(re, () => '<!--GALLERY:START-->\n' + items + '<!--GALLERY:END-->');
  fs.writeFileSync(csPath, cs);

  // hero
  if (heroOut) {
    const ip = path.join(DIST, 'index.html');
    let ix = fs.readFileSync(ip, 'utf8');
    ix = ix.replace(/(id="heroPhoto"\s+src=")[^"]*(")/, (m, a, b) => a + encodeURI(heroOut) + b);
    fs.writeFileSync(ip, ix);
  }
  console.log(`Built: ${i} gallery images${hero ? ', hero: ' + hero : ', no hero image found'} -> dist/`);
})().catch((e) => { console.error(e); process.exit(1); });
