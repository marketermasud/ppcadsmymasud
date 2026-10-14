# PPC Ads by Masud — Static Website (Junk Removal focus)

৯টা আলাদা HTML পেজ + 404.html। ছবি অটো রিসাইজ হয়ে Case Studies পেজে যুক্ত হয় — কোনো কোড এডিট লাগে না।

## ছবি যোগ করার নিয়ম
- ছবিটা শুধু এই রুট ফোল্ডারে GitHub-এ আপলোড (commit) করুন — .jpg, .jpeg, .png, .webp, যেকোনো সাইজ।
- এরপর নিজে নিজে: ছবি ছোট (১৬০০px, WebP) হবে → Case Studies গ্যালারিতে যোগ হবে → সাইট আপডেট হবে (১–২ মিনিট)।
- **ক্যাপশন = ফাইলের নাম।** `Junk Removal Truck Dashboard.png` → "Junk Removal Truck Dashboard"। (`_` ও `-` স্পেস হয়)
- **ক্রম:** নামের আগে নম্বর দিন: `01 Junk Removal Leads.png`, `02 ...` (নম্বর ক্যাপশনে দেখায় না)। নম্বর না দিলে A-Z ক্রমে।
- প্রথম ৬টা সবসময় দেখায়, বাকিগুলো "Show More" এর ভেতরে।
- **প্রোফাইল (হিরো) ছবি:** নাম `My_Image.jpg` (বা .jpeg/.png/.webp)।
- গ্যালারিতে না চাইলে নামের আগে `_` দিন: `_logo.png`। ছবি মুছতে GitHub থেকে ফাইলটা delete করুন।

## Cloudflare সেটআপ (Workers Builds / Pages — একই সেটিংস)
- **Build command:** `npm run build`
- **Deploy command:** `npx wrangler deploy` (যা ডিফল্ট থাকে তাই)
- **Output / root directory:** ডিফল্ট রাখুন — `wrangler.jsonc` ফাইলই `dist` ফোল্ডার ডিপ্লয় করে।
- ফাইল ডিপ্লয় হয় না বলে "Asset too large ... node_modules" এরর এলে বুঝবেন Build command খালি আছে বা `wrangler.jsonc` আপলোড হয়নি।
- `build` চালালে ছবি ছোট হয়, গ্যালারি তৈরি হয় আর `dist` বানায়। শুধু `dist` ডিপ্লয় হয়, `node_modules` না।

## (ঐচ্ছিক) GitHub Action — `images.yml`
রুটে `images.yml` ফাইলটা আছে। এটা **না লাগালেও সাইট ঠিকমতো চলবে**, কারণ Cloudflare-এর `npm run build` একই কাজ করে (ছবি ছোট + গ্যালারি)।
যদি GitHub নিজেই ছবি ছোট করে commit করুক চান: GitHub-এ Add file → Create new file → নাম লিখুন `.github/workflows/images.yml` (স্ল্যাশ দিলে ফোল্ডার নিজে তৈরি হয়) → `images.yml`-এর লেখা কপি করে পেস্ট → Commit। তারপর Settings → Actions → General → Workflow permissions → Read and write।
(GitHub শুধু `.github/workflows/` এর ভেতরের ফাইল চালায়, তাই রুটে রাখলে ফাইলটা নিজে থেকে কাজ করে না।)

## GitHub-এ কী কী যাবে না
`node_modules` ও `dist` আপলোড করবেন না (`.gitignore` এ দেওয়া আছে)।

## অন্যান্য
- ফর্ম সফলভাবে সাবমিট হলে ভিজিটর অটো **thank-you** পেজে যায় (`thank-you.html`)। GTM-এ `thank_you_view` ইভেন্টও যায়, কনভার্সন ট্র্যাকিং-এ কাজে লাগবে।
- ফর্ম: Formspree (`xjgpyayg`) · ট্র্যাকিং: GTM `GTM-54D4877N`।
- স্ক্রিপ্ট: `build.js`। রিসাইজ টুল কাজ না করলেও সাইট চলবে, শুধু ছবি আসল সাইজে যাবে।
