# PPC Ads by Masud — Static Website (Junk Removal focus)

৯টা আলাদা HTML পেজ + 404.html। ছবি অটো রিসাইজ হয়ে পেজে যুক্ত হয় — কোনো কোড এডিট লাগে না।

## ছবি যোগ করার নিয়ম (সবচেয়ে সহজ)
- ছবিটা শুধু এই রুট ফোল্ডারে আপলোড (commit) করুন — .jpg, .jpeg, .png, .webp যেকোনো সাইজ।
- ডিপ্লয়ের সময় সাইট নিজে ছবিটা ছোট (১৬০০px, WebP) করে **Case Studies** পেজে যুক্ত করে দেবে।
- **ক্যাপশন = ফাইলের নাম।** `Junk Removal Truck Dashboard.png` → ক্যাপশন "Junk Removal Truck Dashboard"। (`_` ও `-` স্পেস হয়ে যায়)
- **ক্রম:** নামের আগে নম্বর দিন: `01 Junk Removal Leads.png`, `02 ...` — নম্বর ক্যাপশনে দেখায় না। নম্বর না দিলে A-Z ক্রমে।
- প্রথম ৬টা সবসময় দেখায়, বাকিগুলো "Show More" এর ভেতরে।
- **প্রোফাইল (হিরো) ছবি:** নাম `My_Image.jpg` (বা .jpeg/.png/.webp) রাখুন।
- যে ছবি পেজে দেখাতে চান না (যেমন লোগো), নামের আগে `_` দিন: `_logo.png`।
- ছবি মুছতে চাইলে GitHub থেকে ফাইলটা delete করুন।

## GitHub → Cloudflare Pages
1. এই ফোল্ডারের ভেতরের সব ফাইল GitHub repository-তে আপলোড করুন।
2. Cloudflare → Workers & Pages → Create → Pages → Connect to Git → repository বাছুন।
3. Framework preset: **None** · Build command: **`npm run build`** · Build output directory: **`dist`**
4. Save and Deploy। এরপর থেকে GitHub-এ ছবি/ফাইল commit করলেই অটো ডিপ্লয় হবে।

## অন্যান্য
- ফর্ম: Formspree (`xjgpyayg`) · ট্র্যাকিং: GTM `GTM-54D4877N`।
- বিল্ড স্ক্রিপ্ট: `build.js` (রিসাইজ + গ্যালারি তৈরি)। Resize টুল (`sharp`) কাজ না করলেও সাইট ডিপ্লয় হবে, শুধু ছবি আসল সাইজে যাবে।
