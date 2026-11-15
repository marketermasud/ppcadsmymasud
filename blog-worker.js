/* Cloudflare Worker for masudppc.com — runs ONLY for /blog and /blog/* (see wrangler.jsonc).
   Every other page of the site is served as a plain static file, exactly as before.

   What it does:
   - /blog                  fills the post list into the page (good for Google)
   - /blog/<post-link>      fills in the post + title, description and share image (Facebook / WhatsApp / LinkedIn previews)
   - /blog/sitemap.xml      list of all published posts for Google Search Console
   If anything fails, the untouched static page is returned and the page loads the posts itself. */
import { BLOG_CONFIG as C, decodeDoc, decodeList, docsUrl, listQuery, listHtml, fmtDate, esc } from './blog-settings.js';

const SITE = C.siteUrl.replace(/\/+$/, '');
const BRAND = 'Md Masud Rana — Google Ads Specialist';
const HTML_HEADERS = { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=120' };

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '');
    if (request.method === 'GET' || request.method === 'HEAD') {
      try {
        if (path === '/blog/sitemap.xml') return await sitemap(env);
        if (url.pathname === '/blog') return await listPage(url, env);
        const m = path.match(/^\/blog\/([a-z0-9][a-z0-9-]*)$/);
        if (m) return await postPage(m[1], url, env);
      } catch (err) {
        console.error('blog worker:', err && err.message);
      }
    }
    return env.ASSETS.fetch(request);
  }
};

/* ── Firestore (public REST API; the Firestore rules only expose published posts) ── */
function fsUrl(env, suffix) {
  const base = env.FIRESTORE_BASE ? docsUrl(C).replace('https://firestore.googleapis.com/v1', env.FIRESTORE_BASE) : docsUrl(C);
  return base + suffix + '?key=' + encodeURIComponent(C.firebase.apiKey);
}
const FS_HEADERS = { 'Content-Type': 'application/json', Referer: SITE + '/' };

async function fetchList(env) {
  const r = await fetch(fsUrl(env, ':runQuery'), { method: 'POST', headers: FS_HEADERS, body: JSON.stringify(listQuery(C)) });
  if (!r.ok) throw new Error('list HTTP ' + r.status);
  return decodeList(await r.json());
}
async function fetchPost(env, slug) {
  const r = await fetch(fsUrl(env, '/' + C.collection + '/' + slug), { headers: FS_HEADERS });
  if (r.status === 404 || r.status === 403) return null;          // missing, or not published
  if (!r.ok) throw new Error('post HTTP ' + r.status);
  const p = decodeDoc(await r.json());
  return p.status === 'published' ? p : null;
}
function asset(env, url, pathname) {
  return env.ASSETS.fetch(new Request(new URL(pathname, url).toString()));
}

/* ── /blog ── */
async function listPage(url, env) {
  const [page, posts] = await Promise.all([asset(env, url, '/blog'), fetchList(env)]);
  if (!page.ok) return page;
  const out = new HTMLRewriter()
    .on('#blogList', { element(e) { e.setAttribute('data-ssr', '1'); e.setInnerContent(listHtml(posts), { html: true }); } })
    .on('head', { element(e) { e.append('<link rel="canonical" href="' + SITE + '/blog">\n', { html: true }); } })
    .transform(page);
  return new Response(out.body, { status: 200, headers: HTML_HEADERS });
}

/* ── /blog/<slug> ── */
async function postPage(slug, url, env) {
  const [page, p] = await Promise.all([asset(env, url, '/blog-post'), fetchPost(env, slug)]);
  if (!page.ok) return page;
  if (!p) return notFound(env, url);

  const link = SITE + '/blog/' + slug;
  if (p.cover && p.cover.charAt(0) === '/') p.cover = SITE + p.cover;   // share previews need a full image address
  const desc = p.excerpt || '';
  const meta = [fmtDate(p.publishedAt)].concat(p.tags || []).filter(Boolean).join(' · ');
  const ld = {
    '@context': 'https://schema.org', '@type': 'BlogPosting', headline: p.title, description: desc,
    datePublished: p.publishedAt || undefined, dateModified: p.updatedAt || p.publishedAt || undefined,
    image: p.cover || undefined, mainEntityOfPage: link,
    author: { '@type': 'Person', name: 'Md Masud Rana', url: SITE + '/' }
  };
  const head = [
    '<link rel="canonical" href="' + esc(link) + '">',
    '<meta property="og:type" content="article">',
    '<meta property="og:site_name" content="' + esc(BRAND) + '">',
    '<meta property="og:title" content="' + esc(p.title) + '">',
    '<meta property="og:description" content="' + esc(desc) + '">',
    '<meta property="og:url" content="' + esc(link) + '">',
    p.cover ? '<meta property="og:image" content="' + esc(p.cover) + '">' : '',
    p.publishedAt ? '<meta property="article:published_time" content="' + esc(p.publishedAt) + '">' : '',
    '<meta name="twitter:card" content="' + (p.cover ? 'summary_large_image' : 'summary') + '">',
    '<meta name="twitter:title" content="' + esc(p.title) + '">',
    '<meta name="twitter:description" content="' + esc(desc) + '">',
    p.cover ? '<meta name="twitter:image" content="' + esc(p.cover) + '">' : '',
    '<script type="application/ld+json">' + JSON.stringify(ld).replace(/</g, '\\u003c') + '</script>'
  ].filter(Boolean).join('\n') + '\n';

  const out = new HTMLRewriter()
    .on('title', { element(e) { e.setInnerContent(p.title + ' | ' + BRAND); } })
    .on('meta[name="description"]', { element(e) { e.setAttribute('content', desc); } })
    .on('head', { element(e) { e.append(head, { html: true }); } })
    .on('#postArticle', { element(e) { e.setAttribute('data-ssr', '1'); e.setAttribute('data-slug', slug); } })
    .on('#postMeta', { element(e) { e.setInnerContent(meta); } })
    .on('#postTitle', { element(e) { e.setInnerContent(p.title); } })
    .on('#postExcerpt', { element(e) { if (desc) { e.removeAttribute('hidden'); e.setInnerContent(desc); } } })
    .on('#postCoverWrap', { element(e) { if (p.cover) e.removeAttribute('hidden'); } })
    .on('#postCover', { element(e) { if (p.cover) { e.setAttribute('src', p.cover); e.setAttribute('alt', p.coverAlt || p.title); } } })
    /* Post content is HTML written only by the signed-in site owner (enforced by the Firestore rules). */
    .on('#postBody', { element(e) { e.setInnerContent(p.content || '', { html: true }); } })
    .on('#postShare', { element(e) { e.removeAttribute('hidden'); } })
    .transform(page);
  return new Response(out.body, { status: 200, headers: HTML_HEADERS });
}

/* The site's own 404 page, with <base> so its links and styles also work under /blog/. */
async function notFound(env, url) {
  const page = await asset(env, url, '/404');
  const out = new HTMLRewriter()
    .on('head', { element(e) { e.prepend('<base href="/">', { html: true }); } })
    .transform(page);
  return new Response(out.body, { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}

/* ── /blog/sitemap.xml ── */
async function sitemap(env) {
  const posts = await fetchList(env);
  const urls = ['<url><loc>' + SITE + '/blog</loc></url>'].concat(posts.map(function (p) {
    const mod = String(p.updatedAt || p.publishedAt || '').slice(0, 10);
    return '<url><loc>' + esc(SITE + '/blog/' + p.slug) + '</loc>' + (mod ? '<lastmod>' + mod + '</lastmod>' : '') + '</url>';
  }));
  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls.join('\n') + '\n</urlset>\n';
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=600' } });
}
