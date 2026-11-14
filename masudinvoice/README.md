# Invoice Studio — PPC Ads by Masud

Upload **all files in this folder** to the `masudinvoice` GitHub repo (replacing the old `index.html`).
Everything sits in the repo root — no sub-folders.

## One-time setup in Firebase (project: masudppcinvoice)

1. **Turn on sign-in:** Authentication → Sign-in method → **Email/Password** → Enable.
2. **Create your user:** Authentication → Users → **Add user** → your email + a strong password.
   This is the only account that can open the app.
3. **Approve the website address:** Authentication → Settings → **Authorized domains** → add the address
   where the app is hosted (for example `masudinvoice.masudpabna86.workers.dev`, and `masudppc.com` if you host it there).
4. **Lock the database:** Firestore Database → Rules → paste the contents of `firestore.rules`,
   put your sign-in email in place of `YOUR_LOGIN_EMAIL@example.com`, then **Publish**.
   Until you do this, the database is still open to anyone and the delete PIN cannot be saved.
5. **(For "Forgot PIN" by email)** Authentication → Sign-in method → Email/Password → turn on
   **Email link (passwordless sign-in)**.

### Check the verify page after step 4
The rules keep single-invoice lookups public, which is what a QR verify page normally does.
Scan one invoice QR after publishing the rules. If `masudppc.com/verify.html` stops finding invoices,
it is searching the collection instead of opening one invoice — send that file and it can be adjusted.

## Delete PIN
- Menu (⋯) → **Delete PIN** → set 4–8 digits (asks for your account password once).
- Deleting a saved invoice always asks for the PIN. With no PIN set, deleting is locked.
- 5 wrong tries lock deleting for 60 seconds.
- **Forgot PIN:** Menu → Delete PIN → Forgot PIN → *Email me a reset link*, or use your account password.
- Only a scrambled fingerprint of the PIN is stored, in Firestore at `settings/security`.

## Install as an app
- **PC (Chrome / Edge):** Menu (⋯) → **Install app**, or the install icon in the address bar.
- **Android (Chrome):** Menu → **Install app**, or browser menu → *Add to Home screen*.
- **iPhone (Safari):** Share → *Add to Home Screen*.

## When you change files later
Open `sw.js` and bump `VERSION` (`inv-v1` → `inv-v2`) so installed copies load the new files.

## What did not change
- The invoice design and the printed / PDF layout.
- The invoice data format and where it is stored (browser storage + Firestore `invoices`), so every
  existing invoice opens as before.
- Invoice numbering (`MPPC-YYYY-0001`), the QR link, the PAID stamp and the signature.
