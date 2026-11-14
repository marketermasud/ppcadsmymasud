/* =========================================================
   pin.js — delete PIN
   ---------------------------------------------------------
   A saved invoice cannot be deleted without the delete PIN.

   - The PIN itself is never stored. Only a salted SHA-256
     fingerprint is saved, in Firestore at settings/security
     (field "deletePin"), so it works on every device.
   - Menu (⋯) → Delete PIN to set or change it.
   - Forgot it? The same menu emails a reset link to your
     sign-in address (opens pin-reset.html), or you can
     confirm with your account password instead.
   ========================================================= */
const MPPin = (function () {
  const RESET_EMAIL_KEY = "mp_inv_pin_reset_email";
  const FAIL_KEY = "mp_inv_pin_fails";
  const MAX_FAILS = 5, LOCK_MS = 60 * 1000;
  let rec = null;          // { salt, hash, updatedAt } or null
  let loadError = null;    // set when settings/security cannot be read
  let verifiedUntil = 0;
  let unsub = null;
  const listeners = [];

  const docRef = () => db.collection("settings").doc("security");
  function notify() { listeners.forEach(fn => { try { fn(); } catch (e) { /* ignore */ } }); }
  function onChange(fn) { listeners.push(fn); }

  // Starts listening for the PIN record. Call once after sign-in.
  function start() {
    stop();
    if (!firebaseEnabled) { loadError = new Error("Cloud is not available."); return Promise.resolve(); }
    return new Promise(resolve => {
      let first = true;
      unsub = docRef().onSnapshot(snap => {
        const d = snap.exists ? snap.data() : null;
        rec = d && d.deletePin && d.deletePin.hash ? d.deletePin : null;
        loadError = null;
        notify();
        if (first) { first = false; resolve(); }
      }, err => {
        loadError = err; rec = null; notify();
        if (first) { first = false; resolve(); }
      });
    });
  }
  function stop() { if (unsub) { unsub(); unsub = null; } rec = null; verifiedUntil = 0; }

  function isSet() { return !!rec; }
  function validFormat(pin) { return /^\d{4,8}$/.test(pin || ""); }
  function toHex(buf) { return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join(""); }
  function fingerprint(pin, salt) {
    return crypto.subtle.digest("SHA-256", new TextEncoder().encode(salt + ":" + pin)).then(toHex);
  }
  function failState() { try { return JSON.parse(sessionStorage.getItem(FAIL_KEY)) || { n: 0, until: 0 }; } catch (e) { return { n: 0, until: 0 }; } }
  function saveFailState(st) { try { sessionStorage.setItem(FAIL_KEY, JSON.stringify(st)); } catch (e) { /* ignore */ } }

  // Resolves { ok: true } or { ok: false, message }.
  function check(pin) {
    if (!rec) return Promise.resolve({ ok: false, message: "No delete PIN is set yet." });
    const st = failState();
    if (st.until > Date.now()) return Promise.resolve({ ok: false, message: "Too many wrong tries. Wait " + Math.ceil((st.until - Date.now()) / 1000) + " seconds." });
    if (!validFormat(pin)) return Promise.resolve({ ok: false, message: "Enter your 4–8 digit PIN." });
    return fingerprint(pin, rec.salt).then(h => {
      if (h === rec.hash) { saveFailState({ n: 0, until: 0 }); return { ok: true }; }
      st.n += 1;
      if (st.n >= MAX_FAILS) { st.n = 0; st.until = Date.now() + LOCK_MS; }
      saveFailState(st);
      return { ok: false, message: st.until > Date.now() ? "Too many wrong tries. Wait 60 seconds." : "Wrong PIN." };
    });
  }
  function recentlyVerified() { return Date.now() < verifiedUntil; }

  function save(pin) {
    const salt = toHex(crypto.getRandomValues(new Uint8Array(16)).buffer);
    return fingerprint(pin, salt).then(hash => {
      const next = { salt: salt, hash: hash, updatedAt: new Date().toISOString() };
      return docRef().set({ deletePin: next }, { merge: true }).then(() => {
        rec = next; saveFailState({ n: 0, until: 0 }); notify();
      });
    });
  }
  function saveErrorText(err) {
    return err && err.code === "permission-denied"
      ? "Firestore refused to save the PIN. Update your Firestore rules as shown in README.md, then try again."
      : "Could not save the PIN: " + ((err && err.message) || "unknown error");
  }

  /* ---------------- Dialogs ---------------- */
  const ERR = '<div class="alert alert-danger" data-role="error" hidden></div>';
  const pinField = (id, label) => `<label class="field"><span>${label}</span>
    <input type="password" inputmode="numeric" autocomplete="off" maxlength="8" class="pin-input" id="${id}" placeholder="••••"></label>`;
  function showError(body, text) {
    const box = body.querySelector("[data-role=error]");
    if (box) { box.textContent = text || ""; box.hidden = !text; }
  }
  function email() { return fbAuth && fbAuth.currentUser ? fbAuth.currentUser.email || "" : ""; }

  function newPinForm(title) {
    const body = UI.dialog(title, `
      <form novalidate>
        <p class="dlg-text">Choose 4 to 8 digits. You will type this PIN every time you delete a saved invoice.</p>
        ${ERR}${pinField("pinNew", "New PIN")}${pinField("pinNew2", "Type it again")}
        <button type="submit" class="btn btn-primary btn-block">Save PIN</button>
      </form>`);
    body.querySelector("form").addEventListener("submit", e => {
      e.preventDefault();
      const a = body.querySelector("#pinNew").value, b = body.querySelector("#pinNew2").value;
      if (!validFormat(a)) return showError(body, "The PIN must be 4 to 8 digits.");
      if (a !== b) return showError(body, "The two PINs do not match.");
      const btn = body.querySelector("button[type=submit]"); btn.disabled = true;
      save(a).then(() => { UI.closeDialog(); UI.toast("Delete PIN saved."); })
        .catch(err => { btn.disabled = false; showError(body, saveErrorText(err)); });
    });
  }

  function verifyPassword(title, next) {
    const body = UI.dialog(title, `
      <form novalidate>
        <p class="dlg-text">To continue, enter the password you sign in with (${UI.esc(email())}).</p>
        ${ERR}
        <label class="field"><span>Account password</span><input type="password" id="pinPw" autocomplete="current-password"></label>
        <button type="submit" class="btn btn-primary btn-block">Continue</button>
      </form>`);
    body.querySelector("form").addEventListener("submit", e => {
      e.preventDefault();
      const pw = body.querySelector("#pinPw").value;
      if (!pw) return showError(body, "Enter your account password.");
      const btn = body.querySelector("button[type=submit]"); btn.disabled = true;
      const cred = firebase.auth.EmailAuthProvider.credential(email(), pw);
      fbAuth.currentUser.reauthenticateWithCredential(cred).then(() => next()).catch(err => {
        btn.disabled = false;
        const code = err && err.code;
        showError(body, code === "auth/wrong-password" || code === "auth/invalid-credential" ? "Wrong password."
          : code === "auth/too-many-requests" ? "Too many tries. Wait a moment and try again."
          : (err && err.message) || "Could not confirm the password.");
      });
    });
  }

  function openChange() {
    const body = UI.dialog("Change delete PIN", `
      <form novalidate>
        ${ERR}${pinField("pinCur", "Current PIN")}${pinField("pinNew", "New PIN (4–8 digits)")}${pinField("pinNew2", "Type the new PIN again")}
        <button type="submit" class="btn btn-primary btn-block">Change PIN</button>
        <button type="button" class="btn btn-link btn-block" data-role="forgot">Forgot current PIN?</button>
      </form>`);
    body.querySelector("[data-role=forgot]").addEventListener("click", openForgot);
    body.querySelector("form").addEventListener("submit", e => {
      e.preventDefault();
      const cur = body.querySelector("#pinCur").value;
      const a = body.querySelector("#pinNew").value, b = body.querySelector("#pinNew2").value;
      if (!validFormat(a)) return showError(body, "The new PIN must be 4 to 8 digits.");
      if (a !== b) return showError(body, "The two new PINs do not match.");
      const btn = body.querySelector("button[type=submit]"); btn.disabled = true;
      check(cur).then(res => {
        if (!res.ok) { btn.disabled = false; showError(body, res.message === "Wrong PIN." ? "Current PIN is wrong." : res.message); return; }
        return save(a).then(() => { UI.closeDialog(); UI.toast("Delete PIN changed."); });
      }).catch(err => { btn.disabled = false; showError(body, saveErrorText(err)); });
    });
  }

  function resetPageUrl() {
    const clean = !/\.html$/i.test(window.location.pathname) && !/\/$/.test(window.location.pathname);
    return new URL(clean ? "pin-reset" : "pin-reset.html", window.location.href.split(/[?#]/)[0]).href;
  }

  function openForgot() {
    const addr = email();
    const body = UI.dialog("Forgot delete PIN", `
      <p class="dlg-text">We will email a reset link to <strong>${UI.esc(addr)}</strong>. Open the link to choose a new PIN.</p>
      ${ERR}
      <div class="alert alert-ok" data-role="sent" hidden></div>
      <button type="button" class="btn btn-primary btn-block" data-role="send">${UI.icon("mail")} Email me a reset link</button>
      <button type="button" class="btn btn-soft btn-block" data-role="password">Use my account password instead</button>`);
    const sendBtn = body.querySelector("[data-role=send]");
    sendBtn.addEventListener("click", () => {
      sendBtn.disabled = true; showError(body, "");
      fbAuth.sendSignInLinkToEmail(addr, { url: resetPageUrl(), handleCodeInApp: true }).then(() => {
        try { localStorage.setItem(RESET_EMAIL_KEY, addr); } catch (e) { /* ignore */ }
        const sent = body.querySelector("[data-role=sent]");
        sent.textContent = "Reset link sent to " + addr + ". Check your inbox (and spam), then open the link.";
        sent.hidden = false;
        sendBtn.textContent = "Link sent";
      }).catch(err => {
        sendBtn.disabled = false;
        const code = err && err.code;
        showError(body,
          code === "auth/operation-not-allowed" ? "Email reset is not switched on yet. In Firebase Console → Authentication → Sign-in method → Email/Password, turn on “Email link (passwordless sign-in)”. Until then, use your account password below."
          : code === "auth/unauthorized-continue-uri" || code === "auth/invalid-continue-uri" ? "This website address is not approved in Firebase yet. Add it under Authentication → Settings → Authorized domains. Until then, use your account password below."
          : ((err && err.message) || "Could not send the email.") + " You can use your account password below.");
      });
    });
    body.querySelector("[data-role=password]").addEventListener("click", () => verifyPassword("Reset delete PIN", () => newPinForm("Reset delete PIN")));
  }

  // Menu entry point: set it the first time, otherwise change / reset.
  function openManage() {
    if (loadError) {
      UI.dialog("Delete PIN", `<div class="alert alert-danger">The app could not read the PIN settings from Firestore${loadError.code === "permission-denied" ? " (permission denied)" : ""}. Update your Firestore rules as shown in README.md, then reload.</div>`);
      return;
    }
    if (!isSet()) { verifyPassword("Set delete PIN", () => newPinForm("Set delete PIN")); return; }
    const body = UI.dialog("Delete PIN", `
      <p class="dlg-text">A delete PIN is set. Saved invoices cannot be deleted without it.</p>
      <button type="button" class="btn btn-primary btn-block" data-role="change">Change PIN</button>
      <button type="button" class="btn btn-soft btn-block" data-role="forgot">${UI.icon("mail")} Forgot PIN</button>`);
    body.querySelector("[data-role=change]").addEventListener("click", openChange);
    body.querySelector("[data-role=forgot]").addEventListener("click", openForgot);
  }

  // Asks for the PIN before a delete. Resolves true only when it is correct.
  function confirmDelete(text) {
    return new Promise(resolve => {
      let done = false;
      if (!isSet()) {
        const body = UI.dialog("Deleting is locked", `
          <p class="dlg-text">${UI.esc(text)}</p>
          <div class="alert alert-warn">${loadError ? "The PIN settings could not be read from Firestore, so deleting stays locked. Check your Firestore rules (README.md)." : "Set a delete PIN first. After that, every delete asks for it."}</div>
          <div class="dlg-actions">
            <button type="button" class="btn btn-soft" data-r="no">Cancel</button>
            ${loadError ? "" : '<button type="button" class="btn btn-primary" data-r="set">Set delete PIN</button>'}
          </div>`, () => resolve(false));
        body.querySelector("[data-r=no]").addEventListener("click", UI.closeDialog);
        const setBtn = body.querySelector("[data-r=set]");
        if (setBtn) setBtn.addEventListener("click", openManage);
        return;
      }
      const body = UI.dialog("Delete invoice", `
        <form novalidate>
          <p class="dlg-text">${UI.esc(text)}</p>
          ${ERR}${pinField("pinConfirm", "Delete PIN")}
          <div class="dlg-actions">
            <button type="button" class="btn btn-soft" data-r="no">Cancel</button>
            <button type="submit" class="btn btn-danger">Delete</button>
          </div>
          <button type="button" class="btn btn-link btn-block" data-r="forgot">Forgot PIN?</button>
        </form>`, () => { if (!done) resolve(false); });
      const input = body.querySelector("#pinConfirm");
      body.querySelector("[data-r=no]").addEventListener("click", UI.closeDialog);
      body.querySelector("[data-r=forgot]").addEventListener("click", openForgot);
      body.querySelector("form").addEventListener("submit", e => {
        e.preventDefault();
        const btn = body.querySelector("button[type=submit]"); btn.disabled = true;
        check(input.value).then(res => {
          btn.disabled = false;
          if (!res.ok) { showError(body, res.message); input.value = ""; input.focus(); return; }
          verifiedUntil = Date.now() + 15000;
          done = true; resolve(true); UI.closeDialog();
        }).catch(() => { btn.disabled = false; showError(body, "Could not check the PIN. Try again."); });
      });
    });
  }

  return { start, stop, onChange, isSet, check, save, saveErrorText, validFormat, recentlyVerified, openManage, confirmDelete, RESET_EMAIL_KEY };
})();
