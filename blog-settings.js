/* Blog settings + helpers — used by blog.html, blog-post.html, blog-admin.html and blog-worker.js.
   The Firebase values are the same project the invoice verify page already uses. */
export const BLOG_CONFIG = {
  firebase: {
  apiKey: "AIzaSyCWtobSJBiUXmdgQli0Ve1oM-h1myl4ObE",
  authDomain: "masudppcinvoice.firebaseapp.com",
  projectId: "masudppcinvoice",
  storageBucket: "masudppcinvoice.firebasestorage.app",
  messagingSenderId: "88902990829",
  appId: "1:88902990829:web:c4a284fa28544f5bfe85e4"
},
  collection: "blogPosts",
  siteUrl: "https://masudppc.com",
  /* Cloudinary (free) stores the blog images. Fill these two values in — see BLOG-SETUP.md, step 3.
     While they are empty, the admin page asks for an image link instead of uploading. */
  cloudinary: { cloudName: "acyta3qg", uploadPreset: "ssczljcs" }
};

/* ───────── Nothing below this line needs editing ───────── */

export function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function slugify(s) {
  return String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80).replace(/-+$/, '');
}

export function fmtDate(iso) {
  if (!iso) return '';
  var d = new Date(iso);
  if (isNaN(d)) return '';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

/* Cloudinary delivery: best quality, modern format, at most 2400px wide (sharp on phone and retina screens). */
export const IMG_TRANSFORM = 'f_auto,q_auto:best,c_limit,w_2400';
/* Images saved with the earlier, more compressed setting are upgraded on the fly. */
export function hqImages(s) {
  return String(s || '').split('/upload/f_auto,q_auto,c_limit,w_1600/').join('/upload/' + IMG_TRANSFORM + '/');
}

/* Firestore REST → plain object */
function val(v) {
  if (!v) return '';
  if ('stringValue' in v) return v.stringValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(val);
  return '';
}
export function decodeDoc(doc) {
  var out = {}, f = (doc && doc.fields) || {};
  Object.keys(f).forEach(function (k) { out[k] = val(f[k]); });
  if (!out.slug && doc && doc.name) out.slug = doc.name.split('/').pop();
  if (!Array.isArray(out.tags)) out.tags = [];
  if (out.cover) out.cover = hqImages(out.cover);
  if (out.content) out.content = hqImages(out.content);
  return out;
}

export function docsUrl(cfg) {
  return 'https://firestore.googleapis.com/v1/projects/' + cfg.firebase.projectId + '/databases/(default)/documents';
}

/* Published posts only, without the (large) content field. Sorted afterwards, so no Firestore index is needed. */
export function listQuery(cfg) {
  return {
    structuredQuery: {
      from: [{ collectionId: cfg.collection }],
      where: { fieldFilter: { field: { fieldPath: 'status' }, op: 'EQUAL', value: { stringValue: 'published' } } },
      select: { fields: ['title', 'slug', 'excerpt', 'cover', 'coverAlt', 'tags', 'publishedAt', 'updatedAt'].map(function (f) { return { fieldPath: f }; }) },
      limit: 300
    }
  };
}
export function decodeList(rows) {
  return (rows || []).filter(function (r) { return r && r.document; })
    .map(function (r) { return decodeDoc(r.document); })
    .sort(function (a, b) { return String(b.publishedAt || '').localeCompare(String(a.publishedAt || '')); });
}

export function cardHtml(p) {
  var img = p.cover
    ? '<img src="' + esc(p.cover) + '" alt="' + esc(p.coverAlt || p.title) + '" loading="lazy">'
    : '<span class="post-card-mark" aria-hidden="true"></span>';
  var meta = [fmtDate(p.publishedAt), (p.tags || [])[0]].filter(Boolean).map(esc).join(' · ');
  return '<a class="post-card" href="/blog/' + encodeURIComponent(p.slug) + '">' +
    '<div class="post-card-img' + (p.cover ? '' : ' is-empty') + '">' + img + '</div>' +
    '<div class="post-card-body">' +
    (meta ? '<div class="post-card-meta">' + meta + '</div>' : '') +
    '<h2 class="post-card-title">' + esc(p.title) + '</h2>' +
    (p.excerpt ? '<p class="post-card-excerpt">' + esc(p.excerpt) + '</p>' : '') +
    '<span class="post-card-more">Read the post <span aria-hidden="true">→</span></span>' +
    '</div></a>';
}
export function listHtml(posts) {
  if (!posts.length) return '<p class="blog-state">No posts yet. Check back soon.</p>';
  return posts.map(cardHtml).join('');
}
