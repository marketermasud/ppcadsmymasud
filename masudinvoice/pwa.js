/* =========================================================
   pwa.js — makes the app installable (phone + PC)
   ---------------------------------------------------------
   - Registers the service worker (sw.js).
   - Any element with [data-mp-install] becomes an "Install app"
     button; it is only shown when the browser can install.
   - iPhone/iPad Safari has no install prompt, so the button
     shows the "Add to Home Screen" steps instead.
   This file never reads or writes any app data.
   ========================================================= */
(function () {
  const root = document.documentElement;
  const standalone = window.matchMedia("(display-mode: standalone)").matches ||
                     window.matchMedia("(display-mode: window-controls-overlay)").matches ||
                     window.navigator.standalone === true;
  if (standalone) root.classList.add("mp-standalone");

  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function (err) {
        console.warn("Service worker registration failed:", err);
      });
    });
  }

  let deferredPrompt = null;
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    deferredPrompt = e;
    root.classList.add("mp-can-install");
  });
  window.addEventListener("appinstalled", function () {
    deferredPrompt = null;
    root.classList.remove("mp-can-install");
  });
  if (isIOS && !standalone) root.classList.add("mp-can-install");

  function showIOSHelp() {
    let el = document.getElementById("mpInstallHelp");
    if (!el) {
      el = document.createElement("div");
      el.id = "mpInstallHelp";
      el.className = "install-help";
      el.innerHTML =
        '<div class="install-help-card" role="dialog" aria-label="Install Invoice Studio">' +
          '<img src="icon-192.png" alt="" width="56" height="56">' +
          '<h2>Install Invoice Studio</h2>' +
          '<ol>' +
            '<li>Open this page in <strong>Safari</strong>.</li>' +
            '<li>Tap the <strong>Share</strong> button .</li>' +
            '<li>Choose <strong>Add to Home Screen</strong>, then <strong>Add</strong>.</li>' +
          '</ol>' +
          '<button type="button" class="btn btn-primary btn-block" data-mp-install-close>Got it</button>' +
        '</div>';
      document.body.appendChild(el);
      el.addEventListener("click", function (e) {
        if (e.target === el || e.target.closest("[data-mp-install-close]")) el.classList.remove("show");
      });
    }
    el.classList.add("show");
  }

  document.addEventListener("click", function (e) {
    const btn = e.target.closest("[data-mp-install]");
    if (!btn) return;
    e.preventDefault();
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function (choice) {
        if (choice && choice.outcome === "accepted") root.classList.remove("mp-can-install");
        deferredPrompt = null;
      });
    } else if (isIOS) {
      showIOSHelp();
    }
  });
})();
