# Client Management — PPC Ads by Masud

Upload this whole `client-management` folder into the masudppc.com GitHub repo.
The app then opens at `https://masudppc.com/client-management/`.

## One-time setup after upload
1. Google Cloud Console → Credentials → your OAuth Client ID → **Authorized JavaScript origins** → add `https://masudppc.com` (needed for payment-proof upload to Google Drive).
2. Firebase Console → Authentication → Settings → **Authorized domains** → add `masudppc.com`.

3. For **Forgot PIN by email**: Firebase Console → Authentication → Sign-in method → Email/Password → turn on **Email link (passwordless sign-in)**. Step 2 is required for this too.

## Delete PIN
- Settings → **Delete PIN** → Set delete PIN (asks for your login password once, then 4–8 digits).
- Every delete (client, service, payment, currency, proof photo) asks for the PIN. With no PIN set, deleting is locked.
- 5 wrong tries lock deleting for 60 seconds.
- **Forgot PIN:** Settings → Forgot PIN → *Email me a reset link* (goes to your login email; the link opens `pin-reset.html` where you choose a new PIN), or confirm with your account password instead.
- The PIN is saved only as a scrambled fingerprint in one new field, `deletePin`, inside the existing `settings/agency` document. No other data is touched.
- "Clear All Data" has been removed from the app completely.

## Google Drive permission (payment proofs)
- The app now remembers Drive access on the device and no longer forces Google's permission screen on every upload.
- Google Cloud Console → OAuth consent screen: if **Publishing status** is "Testing", press **Publish app**. In Testing, Google cancels the permission every 7 days and shows the warning screen again.
- If this browser is signed in to several Google accounts, put your Drive Gmail address in `MP_DRIVE_LOGIN_HINT` inside `drive-config.js` so Google stops asking which account.

## Install as an app
- **PC (Chrome / Edge):** open the site → click **Install app** in the sidebar (or the install icon in the address bar).
- **Android (Chrome):** open the site → **Install app** button, or browser menu → *Add to Home screen*.
- **iPhone (Safari):** Share button → *Add to Home Screen*.

## When you change files later
Open `sw.js` and bump `VERSION` (e.g. `cm-v1` → `cm-v2`) so installed copies pick up the new files.

## Data
`auth.js` and `firebase-config.js` are unchanged. `drive.js` only changed how Google permission is requested. In `db.js` the only change is that the "clear all data" function was removed.
