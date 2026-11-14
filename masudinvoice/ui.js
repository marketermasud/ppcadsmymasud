/* =========================================================
   ui.js — small shared helpers: toasts and dialogs
   (replaces the browser's alert / confirm pop-ups)
   ========================================================= */
const UI = (function () {
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  }
  function icon(name) { return '<svg class="ic" aria-hidden="true"><use href="#i-' + name + '"/></svg>'; }

  function toast(message, kind) {
    const stack = document.getElementById("toasts");
    if (!stack) return;
    const el = document.createElement("div");
    el.className = "toast " + (kind || "ok");
    el.textContent = message;
    stack.appendChild(el);
    setTimeout(() => { el.classList.add("out"); setTimeout(() => el.remove(), 250); }, kind === "error" ? 5200 : 3200);
  }

  /* One dialog at a time. dialog() returns its body element; onClose runs
     however it is dismissed. Clicking outside does NOT close it, so typed
     text is never lost by accident. */
  let onCloseCb = null;
  function closeDialog() {
    const ov = document.getElementById("dlgOverlay");
    if (!ov.classList.contains("show")) return;
    ov.classList.remove("show");
    const cb = onCloseCb; onCloseCb = null;
    if (cb) cb();
  }
  function dialog(title, html, onClose) {
    if (onCloseCb) { const cb = onCloseCb; onCloseCb = null; cb(); }
    document.getElementById("dlgTitle").textContent = title;
    const body = document.getElementById("dlgBody");
    body.innerHTML = html;
    onCloseCb = onClose || null;
    document.getElementById("dlgOverlay").classList.add("show");
    setTimeout(() => { const first = body.querySelector("input, button.btn-primary, button.btn-danger"); if (first) first.focus(); }, 60);
    return body;
  }
  document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("dlgClose").addEventListener("click", closeDialog);
    document.addEventListener("keydown", e => { if (e.key === "Escape") closeDialog(); });
  });

  // Resolves true / false.
  function confirm(opts) {
    return new Promise(resolve => {
      let answered = false;
      const body = dialog(opts.title || "Are you sure?", `
        <p class="dlg-text">${esc(opts.text || "")}</p>
        <div class="dlg-actions">
          <button type="button" class="btn btn-soft" data-r="no">${esc(opts.cancelLabel || "Cancel")}</button>
          <button type="button" class="btn ${opts.danger ? "btn-danger" : "btn-primary"}" data-r="yes">${esc(opts.okLabel || "OK")}</button>
        </div>`, () => { if (!answered) resolve(false); });
      body.querySelector("[data-r=yes]").addEventListener("click", () => { answered = true; resolve(true); closeDialog(); });
      body.querySelector("[data-r=no]").addEventListener("click", closeDialog);
    });
  }

  return { esc, icon, toast, dialog, closeDialog, confirm };
})();
