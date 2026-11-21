# ব্লগ সিস্টেম — সেটআপ গাইড (masudppc.com)

## কী কী যোগ হয়েছে
কোনো ফোল্ডার নেই — ৬টা ফাইল, সবই রিপোর রুটে (যেখানে `index.html` আছে) থাকবে।

| ফাইল | কাজ |
|---|---|
| `blog.html` | ব্লগ লিস্ট পেজ — `masudppc.com/blog` |
| `blog-post.html` | একটা পোস্ট দেখানোর টেমপ্লেট (শেয়ার বাটনসহ) |
| `blog-admin.html` | অ্যাডমিন পেজ — `masudppc.com/blog-admin` — ইমেইল + পাসওয়ার্ড লগইন, লেখা, ছবি, Draft / Publish |
| `blog-settings.js` | Firebase ও Cloudinary সেটিংস (শুধু এই ফাইলের উপরের অংশ কখনো এডিট করতে হতে পারে) |
| `blog-worker.js` | প্রতিটা পোস্টের নিজস্ব লিংক (`masudppc.com/blog/post-er-naam`), Facebook/WhatsApp শেয়ার প্রিভিউ, `masudppc.com/blog/sitemap.xml` |
| `wrangler.jsonc` | **একমাত্র পুরনো ফাইল যা বদলেছে** — ৩টা লাইন যোগ হয়েছে যাতে শুধু `/blog` আর `/blog/...` ঠিকানায় worker চলে |

আপনার বাকি সব পেজ, ছবি, `build.js`, `main.js`, `style.css`, `verify.html` — কিছুই বদলানো হয়নি।

---

## ধাপ ১ — Firebase-এ লগইন অ্যাকাউন্ট তৈরি (একবার)
Firebase Console → প্রজেক্ট **masudppcinvoice** → **Authentication**
1. **Sign-in method** → **Email/Password** → Enable → Save।
2. **Users** → **Add user** → আপনার ইমেইল আর একটা শক্ত পাসওয়ার্ড দিন। এই ইমেইল-পাসওয়ার্ড দিয়েই অ্যাডমিনে ঢুকবেন।
3. **Settings → Authorized domains**-এ `masudppc.com` না থাকলে যোগ করুন।

অ্যাডমিন পেজে নতুন অ্যাকাউন্ট খোলার কোনো অপশন নেই — শুধু লগইন।

## ধাপ ২ — Firestore rules (একবার) — এটাই আসল তালা
Firebase Console → **Firestore Database → Rules**।

**আগের rules মুছবেন না।** `match /databases/{database}/documents {` লাইনের ঠিক নিচে এই অংশটুকু যোগ করুন, আর `YOUR-LOGIN-EMAIL`-এর জায়গায় ধাপ ১-এর ইমেইলটা লিখুন (ছোট হাতের অক্ষরে):

```
    // ---- Blog (masudppc.com/blog) ----
    function isBlogAdmin() {
      return request.auth != null && request.auth.token.email == 'YOUR-LOGIN-EMAIL';
    }
    match /blogPosts/{postId} {
      allow read: if isBlogAdmin() || resource.data.status == 'published';
      allow write: if isBlogAdmin();
    }
```
তারপর **Publish**।

এর মানে: Published পোস্ট সবাই পড়তে পারবে; Draft দেখা, লেখা, বদলানো, মোছা — শুধু আপনার ইমেইল দিয়ে লগইন করা অবস্থায়।

> সতর্কতা: আপনার বর্তমান rules-এ যদি `match /{document=**}`-এর নিচে `allow read, write: if true;` জাতীয় খোলা লাইন থাকে, তাহলে ব্লগসহ পুরো ডেটাবেস যে কেউ বদলাতে পারবে। এমন লাইন দেখলে বদলানোর আগে জানান — invoice সিস্টেম না ভেঙে ঠিক করতে হবে।

## ধাপ ৩ — ছবি আপলোডের জন্য Cloudinary (একবার)
1. cloudinary.com-এ লগইন → Dashboard থেকে **Cloud name** কপি করুন।
2. **Settings → Upload → Upload presets → Add upload preset** → **Signing mode: Unsigned** → Save → preset-এর নাম কপি করুন।
3. GitHub-এ `blog-settings.js` ফাইল খুলে উপরের দিকের `cloudinary` লাইনে বসান:
   `cloudinary: { cloudName: "আপনার-cloud-name", uploadPreset: "আপনার-preset-নাম" }`

এটা না করা পর্যন্ত অ্যাডমিন পেজ ছবি আপলোডের বদলে ছবির লিংক চাইবে — বাকি সব কাজ করবে।

## ধাপ ৪ — GitHub-এ আপলোড
রিপো `marketermasud/ppcadsmymasud` → **Add file → Upload files** → zip খুলে এই ৬টা ফাইল একসাথে সিলেক্ট করে টেনে ছেড়ে দিন:
`blog.html`, `blog-post.html`, `blog-admin.html`, `blog-settings.js`, `blog-worker.js`, `wrangler.jsonc` (পুরনোটার জায়গায় বসবে) → Commit।

Cloudflare নিজে থেকে ১–২ মিনিটে ডিপ্লয় করবে। Build command / Deploy command যা আছে তাই থাকবে।

## ধাপ ৫ — পরীক্ষা
1. `masudppc.com/` আর আরও দু-একটা পুরনো পেজ খুলে দেখুন আগের মতোই আছে।
2. `masudppc.com/blog-admin` → লগইন → একটা পোস্ট লিখে **Publish**।
3. `masudppc.com/blog` → পোস্টটা দেখাবে (সর্বোচ্চ ২ মিনিট লাগতে পারে)।
4. পোস্ট খুলে লিংকটা WhatsApp-এ নিজেকে পাঠান — টাইটেল, সারাংশ আর কভার ছবি প্রিভিউতে আসবে।
5. Google Search Console-এ sitemap হিসেবে `https://masudppc.com/blog/sitemap.xml` জমা দিন।

## রোজকার ব্যবহার
- **Save draft** — সেভ হয়, সাইটে দেখায় না। **Publish** — সাইটে চলে যায়। **Unpublish** — আবার draft।
- **Post link** প্রথমবার সেভের পর আর বদলানো যায় না (শেয়ার করা লিংক যাতে না ভাঙে)।
- **Short summary** ১৬০ অক্ষরের মধ্যে রাখুন — এটাই Google আর শেয়ার প্রিভিউতে দেখায়।
- **Cover image** ১২০০×৬৩০ অনুপাতের হলে প্রিভিউতে সবচেয়ে ভালো দেখায়।
- Instagram ওয়েবসাইট থেকে সরাসরি লিংক শেয়ার নিতে দেয় না। মোবাইলে "Instagram & more" বাটন ফোনের শেয়ার মেনু খোলে; ডেস্কটপে "Copy link"।

## সমস্যা হলে
- **পুরনো অবস্থায় ফিরতে:** GitHub-এ `wrangler.jsonc`-এর আগের ভার্সন ফিরিয়ে দিন (History → আগের commit)। তাতে worker বন্ধ হয়ে সাইট আগের মতো শুধু static ফাইল দেবে; ব্লগের ফাইলগুলো থাকলেও কোনো ক্ষতি নেই।
- **"This account is not allowed to manage the blog"** — ধাপ ২-এর rules বসেনি বা ইমেইল মেলেনি।
- **"Email/password sign-in is not turned on"** — ধাপ ১.১ বাকি।
- **Facebook পুরনো প্রিভিউ দেখাচ্ছে** — developers.facebook.com/tools/debug-এ লিংক দিয়ে "Scrape Again" চাপুন।

---

## কেস স্টাডি পোস্ট করা (নতুন)
একই অ্যাডমিন পেজ — `masudppc.com/blog-admin` — একই লগইন। **Firebase-এ নতুন কোনো সেটআপ লাগবে না**, আগের rules দিয়েই চলবে।

1. লগইন করে বাম পাশে **Case studies** ট্যাব → **+ New case study** (অথবা ফর্মের উপরে **Case study** বাটন)।
2. **Upload screenshot** চাপুন (বা ছবির বক্সে ক্লিক) → ছবি সিলেক্ট করুন।
3. **Caption** — ছবির নিচে যে নাম দেখাবে (যেমন `Junk Removal: 64 booked jobs in 30 days`)।
4. **Industry** আর **Service** — লিস্ট থেকে বেছে নিন বা নতুন লিখুন। ভিজিটর এগুলো দিয়ে ফিল্টার করতে পারবে।
5. **Publish** → ১ মিনিটের মধ্যে `masudppc.com/case-studies`-এর সবার উপরে, আর হোম পেজের "Latest Case Studies" অংশে (সর্বশেষ ৩টা) চলে আসবে।

- কেস স্টাডিতে টাইটেল-লিংক, সামারি, ট্যাগ, লেখা — কিছুই লাগে না; ব্লগে কিছু যায় না।
- একবার সেভ করার পর টাইপ (Blog / Case study) আর বদলানো যায় না।
- Unpublish করলে সাইট থেকে সরে যায়, Delete করলে একেবারে মুছে যায়।
- GitHub-এ ছবি আপলোড করার পুরনো পদ্ধতিও আগের মতো কাজ করবে — ওই ছবিগুলো নিচে থাকে, অ্যাডমিন থেকে দেওয়াগুলো উপরে।
