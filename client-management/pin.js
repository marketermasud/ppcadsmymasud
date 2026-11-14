/* =========================================================
   pin.js — delete PIN
   ---------------------------------------------------------
   Nothing can be deleted from the app without the delete PIN.

   - The PIN itself is never stored. Only a salted SHA-256
     fingerprint is saved, in one field ("deletePin") of the
     existing settings document, so it works on every device.
   - Set / change / reset it from Settings → Delete PIN.
   - Forgot it? Settings → Forgot PIN emails a reset link to
     the signed-in account's address (opens pin-reset.html),
     or you can confirm with the account password instead.
   ========================================================= */

const MPPin = (function () {
  const RESET_EMAIL_KEY = "mp_pin_reset_email";
  const FAIL_KEY = "mp_pin_fails";
  const MAX_FAILS = 5;
  const LOCK_MS = 60 * 1000;
  let verifiedUntil = 0;

  function firebaseOn() {
    return typeof MP_USE_FIREBASE !== "undefined" && MP_USE_FIREBASE &&
           typeof mpFirebaseAuth !== "undefined" && !!mpFirebaseAuth &&
           typeof mpFirestore !== "undefined" && !!mpFirestore;
  }
  function record() {
    if (typeof MPDB === "undefined") return null;
    const s = MPDB.getSettings();
    return s && s.deletePin && s.deletePin.hash ? s.deletePin : null;
  }
  function isSet() { return !!record(); }
  function validFormat(pin) { return /^\d{4,8}$/.test(pin || ""); }

  function toHex(buf) { return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join(""); }
  function newSalt() { return toHex(crypto.getRandomValues(new Uint8Array(16)).buffer); }
  function fingerprint(pin, salt) {
    return crypto.subtle.digest("SHA-256", new TextEncoder().encode(salt + ":" + pin)).then(toHex);
  }

  function failState() {
    try { return JSON.parse(sessionStorage.getItem(FAIL_KEY)) || { n: 0, until: 0 }; } catch (e) { return { n: 0, until: 0 }; }
  }
  function saveFailState(st) { try { sessionStorage.setItem(FAIL_KEY, JSON.stringify(st)); } catch (e) { /* ignore */ } }

  // Resolves { ok: true } or { ok: false, message }.
  function check(pin) {
    const rec = record();
    if (!rec) return Promise.resolve({ ok: false, message: "No delete PIN is set yet." });
    const st = failState();
    if (st.until > Date.now()) {
      return Promise.resolve({ ok: false, message: "Too many wrong tries. Wait " + Math.ceil((st.until - Date.now()) / 1000) + " seconds." });
    }
    if (!validFormat(pin)) return Promise.resolve({ ok: false, message: "Enter your 4–8 digit PIN." });
    return fingerprint(pin, rec.salt).then(h => {
      if (h === rec.hash) { saveFailState({ n: 0, until: 0 }); return { ok: true }; }
      st.n += 1;
      if (st.n >= MAX_FAILS) { st.n = 0; st.until = Date.now() + LOCK_MS; }
      saveFailState(st);
      return { ok: false, message: st.until > Date.now() ? "Too many wrong tries. Wait 60 seconds." : "Wrong PIN." };
    });
  }

  function markVerified() { verifiedUntil = Date.now() + 15000; }
  function recentlyVerified() { return Date.now() < verifiedUntil; }

  // Saves the new PIN fingerprint. Writes ONLY the deletePin field.
  function save(pin) {
    const salt = newSalt();
    return fingerprint(pin, salt).then(hash => {
      const rec = { salt: salt, hash: hash, updatedAt: new Date().toISOString() };
      saveFailState({ n: 0, until: 0 });
      if (firebaseOn()) {
        return mpFirestore.collection("settings").doc("agency").set({ deletePin: rec }, { merge: true }).then(() => {
          if (typeof MPDB !== "undefined") MPDB.getSettings().deletePin = rec;
        });
      }
      if (typeof MPDB !== "undefined") MPDB.updateSettings({ deletePin: rec });
    });
  }

  /* ---- Second lock: the delete functions themselves refuse to run
          unless the PIN was entered a moment ago. ---- */
  if (typeof MPDB !== "undefined") {
    ["deleteClient", "deleteService", "deletePayment", "deleteCurrency"].forEach(name => {
      const original = MPDB[name];
      if (typeof original !== "function") return;
      MPDB[name] = function () {
        if (!isSet() || !recentlyVerified()) {
          if (typeof MPUI !== "undefined") MPUI.toast("Delete blocked. Enter your delete PIN first.", "danger");
          return;
        }
        return original.apply(this, arguments);
      };
    });
  }

  /* ---------------- Dialogs ---------------- */
  function accountEmail() {
    if (firebaseOn() && mpFirebaseAuth.currentUser) return mpFirebaseAuth.currentUser.email || "";
    return "";
  }
  function esc(s) { return String(s).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch])); }

  function dialog(title, bodyHtml) {
    let el = document.getElementById("mpPinModal");
    if (!el) {
      el = document.createElement("div");
      el.className = "modal fade";
      el.id = "mpPinModal";
      el.setAttribute("tabindex", "-1");
      el.setAttribute("data-bs-backdrop", "static");
      el.innerHTML = `
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header"><h5 class="modal-title" id="mpPinTitle"></h5><button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button></div>
            <div class="modal-body" id="mpPinBody"></div>
          </div>
        </div>`;
      document.body.appendChild(el);
    }
    document.getElementById("mpPinTitle").textContent = title;
    const body = document.getElementById("mpPinBody");
    body.innerHTML = bodyHtml;
    bootstrap.Modal.getOrCreateInstance(el).show();
    setTimeout(() => { const first = body.querySelector("input"); if (first) first.focus(); }, 350);
    return body;
  }
  function closeDialog() {
    const el = document.getElementById("mpPinModal");
    if (el) bootstrap.Modal.getOrCreateInstance(el).hide();
  }
  function showError(body, text) {
    const box = body.querySelector("[data-role=error]");
    if (!box) return;
    box.textContent = text;
    box.classList.toggle("d-none", !text);
  }
  const ERR = '<div class="alert alert-danger py-2 small d-none" data-role="error"></div>';
  const pinField = (id, label) => `
    <div class="mb-3"><label class="form-label" for="${id}">${label}</label>
    <input type="password" inputmode="numeric" autocomplete="off" maxlength="8" class="form-control mp-pin-input" id="${id}" placeholder="••••"></div>`;

  function newPinForm(title) {
    const body = dialog(title, `
      <form novalidate>
        <p class="small text-muted-mp">Choose 4 to 8 digits. You will type this PIN every time you delete something.</p>
        ${ERR}
        ${pinField("mpPinNew", "New PIN")}
        ${pinField("mpPinNew2", "Type it again")}
        <button type="submit" class="btn btn-mp-primary w-100">Save PIN</button>
      </form>`);
    body.querySelector("form").addEventListener("submit", e => {
      e.preventDefault();
      const a = body.querySelector("#mpPinNew").value, b = body.querySelector("#mpPinNew2").value;
      if (!validFormat(a)) return showError(body, "The PIN must be 4 to 8 digits.");
      if (a !== b) return showError(body, "The two PINs do not match.");
      const btn = body.querySelector("button[type=submit]");
      btn.disabled = true;
      save(a).then(() => {
        closeDialog();
        MPUI.toast("Delete PIN saved.");
        renderSettingsCard();
      }).catch(err => { btn.disabled = false; showError(body, "Could not save the PIN: " + (err && err.message || "unknown error")); });
    });
  }

  // Confirms it is really the account owner by asking for the login password.
  function verifyPassword(title, next) {
    if (!firebaseOn() || !mpFirebaseAuth.currentUser) { next(); return; }
    const body = dialog(title, `
      <form novalidate>
        <p class="small text-muted-mp">To continue, enter the password you sign in with (${esc(accountEmail())}).</p>
        ${ERR}
        <div class="mb-3"><label class="form-label" for="mpPinPw">Account password</label>
        <input type="password" class="form-control" id="mpPinPw" autocomplete="current-password"></div>
        <button type="submit" class="btn btn-mp-primary w-100">Continue</button>
      </form>`);
    body.querySelector("form").addEventListener("submit", e => {
      e.preventDefault();
      const pw = body.querySelector("#mpPinPw").value;
      if (!pw) return showError(body, "Enter your account password.");
      const btn = body.querySelector("button[type=submit]");
      btn.disabled = true;
      const cred = firebase.auth.EmailAuthProvider.credential(accountEmail(), pw);
      mpFirebaseAuth.currentUser.reauthenticateWithCredential(cred).then(() => next()).catch(err => {
        btn.disabled = false;
        const code = err && err.code;
        showError(body, code === "auth/wrong-password" || code === "auth/invalid-credential" ? "Wrong password."
          : code === "auth/too-many-requests" ? "Too many tries. Wait a moment and try again."
          : (err && err.message) || "Could not confirm the password.");
      });
    });
  }

  function openSet() { verifyPassword("Set delete PIN", () => newPinForm("Set delete PIN")); }

  function openChange() {
    const body = dialog("Change delete PIN", `
      <form novalidate>
        ${ERR}
        ${pinField("mpPinCur", "Current PIN")}
        ${pinField("mpPinNew", "New PIN (4–8 digits)")}
        ${pinField("mpPinNew2", "Type the new PIN again")}
        <button type="submit" class="btn btn-mp-primary w-100">Change PIN</button>
        <button type="button" class="btn btn-link w-100 mt-2 small" data-role="forgot">Forgot current PIN?</button>
      </form>`);
    body.querySelector("[data-role=forgot]").addEventListener("click", openForgot);
    body.querySelector("form").addEventListener("submit", e => {
      e.preventDefault();
      const cur = body.querySelector("#mpPinCur").value;
      const a = body.querySelector("#mpPinNew").value, b = body.querySelector("#mpPinNew2").value;
      if (!validFormat(a)) return showError(body, "The new PIN must be 4 to 8 digits.");
      if (a !== b) return showError(body, "The two new PINs do not match.");
      const btn = body.querySelector("button[type=submit]");
      btn.disabled = true;
      check(cur).then(res => {
        if (!res.ok) { btn.disabled = false; showError(body, res.message === "Wrong PIN." ? "Current PIN is wrong." : res.message); return; }
        return save(a).then(() => { closeDialog(); MPUI.toast("Delete PIN changed."); renderSettingsCard(); });
      }).catch(err => { btn.disabled = false; showError(body, "Could not change the PIN: " + (err && err.message || "unknown error")); });
    });
  }

  function resetPageUrl() {
    // Hosts that hide ".html" in addresses get the clean form of the link.
    const clean = !/\.html$/i.test(window.location.pathname);
    return new URL(clean ? "pin-reset" : "pin-reset.html", window.location.href.split(/[?#]/)[0]).href;
  }

  function openForgot() {
    if (!firebaseOn() || !mpFirebaseAuth.currentUser) { newPinForm("Reset delete PIN"); return; }
    const email = accountEmail();
    const body = dialog("Forgot delete PIN", `
      <p class="small text-muted-mp">We will email a reset link to <strong>${esc(email)}</strong>. Open the link to choose a new PIN.</p>
      ${ERR}
      <div class="alert alert-success py-2 small d-none" data-role="sent"></div>
      <button type="button" class="btn btn-mp-primary w-100" data-role="send"><i class="bi bi-envelope me-1"></i>Email me a reset link</button>
      <button type="button" class="btn btn-mp-outline w-100 mt-2" data-role="password">Use my account password instead</button>`);
    const sendBtn = body.querySelector("[data-role=send]");
    sendBtn.addEventListener("click", () => {
      sendBtn.disabled = true;
      showError(body, "");
      mpFirebaseAuth.sendSignInLinkToEmail(email, { url: resetPageUrl(), handleCodeInApp: true }).then(() => {
        try { localStorage.setItem(RESET_EMAIL_KEY, email); } catch (e) { /* ignore */ }
        const sent = body.querySelector("[data-role=sent]");
        sent.textContent = "Reset link sent to " + email + ". Check your inbox (and spam), then open the link.";
        sent.classList.remove("d-none");
        sendBtn.innerHTML = '<i class="bi bi-check2 me-1"></i>Link sent';
      }).catch(err => {
        sendBtn.disabled = false;
        const code = err && err.code;
        showError(body,
          code === "auth/operation-not-allowed" ? "Email reset is not switched on yet. In Firebase Console → Authentication → Sign-in method → Email/Password, turn on “Email link (passwordless sign-in)”. Until then, use your account password below."
          : code === "auth/unauthorized-continue-uri" || code === "auth/invalid-continue-uri" ? "This website address is not approved in Firebase yet. Add it under Authentication → Settings → Authorized domains. Until then, use your account password below."
          : code === "auth/quota-exceeded" || code === "auth/too-many-requests" ? "Too many emails sent. Try again later, or use your account password below."
          : ((err && err.message) || "Could not send the email.") + " You can use your account password below.");
      });
    });
    body.querySelector("[data-role=password]").addEventListener("click", () => {
      verifyPassword("Reset delete PIN", () => newPinForm("Reset delete PIN"));
    });
  }

  /* ---------------- Settings card ---------------- */
  let cardWired = false;
  function renderSettingsCard() {
    const status = document.getElementById("pinStatus");
    if (!status) return;
    const set = isSet();
    status.innerHTML = set ? '<span class="mp-badge st-active">PIN is set</span>' : '<span class="mp-badge st-unpaid">Not set</span>';
    document.getElementById("pinNote").textContent = set
      ? "Nothing can be deleted from this app without this PIN."
      : "Deleting is locked until you set a PIN. After that, every delete asks for it.";
    document.getElementById("pinSetBtn").classList.toggle("d-none", set);
    document.getElementById("pinChangeBtn").classList.toggle("d-none", !set);
    document.getElementById("pinForgotBtn").classList.toggle("d-none", !set);
    if (!cardWired) {
      cardWired = true;
      document.getElementById("pinSetBtn").addEventListener("click", openSet);
      document.getElementById("pinChangeBtn").addEventListener("click", openChange);
      document.getElementById("pinForgotBtn").addEventListener("click", openForgot);
    }
  }

  return { isSet, check, save, validFormat, markVerified, recentlyVerified, openSet, openChange, openForgot, renderSettingsCard, RESET_EMAIL_KEY };
})();
