/* Auto image processor.
   1) Resizes every image in this folder (max 1600px, WebP; profile photo 1000px)
   2) Rebuilds the Case Studies gallery (caption = file name) and the hero photo
   3) Copies the finished site to ./dist
   Runs on GitHub (Actions) and/or on Cloudflare Pages ("npm run build"). Safe to run repeatedly. */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');
const IMG_RE = /\.(jpe?g|png|webp)$/i;
const SITE_EXT = /\.(html|css|js|svg|woff2|txt|xml|ico|json)$/i;
const SKIP = new Set(['build.js', 'package.json', 'package-lock.json']);
const MAX_GALLERY = 1600, MAX_HERO = 1000;

let sharp = null;
try { sharp = require('sharp'); } catch (e) { console.warn('! sharp not available — images are used without resizing'); }

const natural = (a, b) => a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' });
const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const isHero = (f) => /^(my_image|hero)$/i.test(path.basename(f, path.extname(f)));
function caption(file) {
  return path.basename(file, path.extname(file))
    .replace(/^\d+[\s._-]+/, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
}
const list = () => fs.readdirSync(ROOT).filter((f) => fs.statSync(path.join(ROOT, f)).isFile() && IMG_RE.test(f) && !f.startsWith('_'));

/* Step 1: resize in place. Non-WebP files become <same name>.webp and the original is removed. */
async function optimise(file) {
  if (!sharp) return file;
  const max = isHero(file) ? MAX_HERO : MAX_GALLERY;
  const src = path.join(ROOT, file);
  const base = path.basename(file, path.extname(file));
  const outName = base + '.webp';
  const isWebp = /\.webp$/i.test(file);
  try {
    const meta = await sharp(src).metadata();
    if (isWebp && meta.width <= max) return file;                 // already done
    const buf = await sharp(src).rotate().resize({ width: max, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
    fs.writeFileSync(path.join(ROOT, outName), buf);
    if (file !== outName) fs.unlinkSync(src);
    console.log('  resized:', file, '->', outName);
    return outName;
  } catch (e) {
    console.warn('! could not process', file, '-', e.message);
    return file;
  }
}

(async () => {
  const done = [];
  for (const f of list().sort(natural)) done.push(await optimise(f));
  const imgs = [...new Set(done)].sort(natural);
  const hero = imgs.find(isHero);
  const gallery = imgs.filter((f) => !isHero(f));

  /* Step 2: gallery + hero */
  let items = '';
  gallery.forEach((f, i) => {
    const cap = esc(caption(f));
    items += `    <div class="screenshot-item${i >= 6 ? ' ss-hidden' : ''}" onclick="openLightbox(this)"><img src="${encodeURI(f)}" alt="${cap}" loading="lazy"><div class="screenshot-caption">${cap}</div></div>\n`;
  });
  const csPath = path.join(ROOT, 'case-studies.html');
  let cs = fs.readFileSync(csPath, 'utf8');
  const re = /<!--GALLERY:START-->[\s\S]*?<!--GALLERY:END-->/;
  if (!re.test(cs)) throw new Error('gallery markers missing in case-studies.html');
  const next = cs.replace(re, () => '<!--GALLERY:START-->\n' + items + '<!--GALLERY:END-->');
  if (next !== cs) fs.writeFileSync(csPath, next);

  if (hero) {
    const ip = path.join(ROOT, 'index.html');
    const ix = fs.readFileSync(ip, 'utf8');
    const nx = ix.replace(/(id="heroPhoto"\s+src=")[^"]*(")/, (m, a, b) => a + encodeURI(hero) + b);
    if (nx !== ix) fs.writeFileSync(ip, nx);
  }
  console.log(`Gallery: ${gallery.length} images${hero ? ', hero: ' + hero : ', no hero image'}`);

  /* Step 3: copy to dist */
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });
  for (const f of fs.readdirSync(ROOT)) {
    const p = path.join(ROOT, f);
    if (!fs.statSync(p).isFile() || SKIP.has(f) || f.startsWith('.')) continue;
    if (SITE_EXT.test(f) || f === '_redirects' || imgs.includes(f)) fs.copyFileSync(p, path.join(DIST, f));
  }
})().catch((e) => { console.error(e); process.exit(1); });
