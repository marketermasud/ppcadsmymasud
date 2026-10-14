/* ============================================================
   Md Masud Rana — site script (every page)
   Motion plan: one orchestrated hero entrance, a flip-board for the
   results, a route that fills as you scroll, tickets that print in.
   Everything else is quiet. Reduced-motion users get a static page.
   ============================================================ */
(function () {
  'use strict';

  var doc = document;
  var root = doc.documentElement;
  var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  root.classList.add('js');
  window.__masudReady = true;
  window.dataLayer = window.dataLayer || [];

  function qs(s, c) { return (c || doc).querySelector(s); }
  function qsa(s, c) { return Array.prototype.slice.call((c || doc).querySelectorAll(s)); }
  function ease(t) { return 1 - Math.pow(1 - t, 3); }

  /* ── Mobile menu ─────────────────────────────────────────── */
  var nav = qs('nav.site-nav');
  var navToggle = qs('#navToggle');
  var navLinks = qs('#navLinks');

  function closeMenu() {
    if (!navLinks || !navToggle) return;
    navLinks.classList.remove('open');
    navToggle.classList.remove('open');
    navToggle.setAttribute('aria-expanded', 'false');
  }
  if (navToggle && navLinks) {
    navToggle.addEventListener('click', function () {
      var open = navLinks.classList.toggle('open');
      navToggle.classList.toggle('open', open);
      navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open && nav) nav.classList.remove('is-hidden');
    });
    qsa('a', navLinks).forEach(function (a) { a.addEventListener('click', closeMenu); });
  }

  /* ── Tracking (GTM dataLayer) ────────────────────────────── */
  function track(id, payload) {
    var el = doc.getElementById(id);
    if (el) el.addEventListener('click', function () { window.dataLayer.push(payload); });
  }
  track('heroAuditBtn', { event: 'contact_click', method: 'email_hero' });
  track('whatsappBtn', { event: 'contact_click', method: 'whatsapp' });
  track('calendlyBtn', { event: 'contact_click', method: 'calendly_booking' });
  qsa('.order-now-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      window.dataLayer.push({ event: 'pricing_click', plan: btn.dataset.plan });
    });
  });

  /* ── Scroll: progress line, hide-on-scroll nav, process route ── */
  var bar = null;
  if (nav) {
    bar = doc.createElement('div');
    bar.className = 'scroll-progress';
    bar.setAttribute('aria-hidden', 'true');
    nav.appendChild(bar);
  }

  var steps = qs('.process-steps');
  var stepCards = steps ? qsa('.step-card', steps) : [];

  function updateProcess() {
    if (!steps || !stepCards.length) return;
    var vh = window.innerHeight;
    var r = steps.getBoundingClientRect();
    var horizontal = stepCards.length > 1 && stepCards[0].offsetTop === stepCards[1].offsetTop;
    var p;
    if (reduceMotion) {
      p = 1;
    } else if (horizontal) {
      p = Math.max(0, Math.min(1, (vh * 0.82 - r.top) / (vh * 0.42)));
    } else {
      p = 0;
    }
    steps.style.setProperty('--p', p.toFixed(3));
    stepCards.forEach(function (card, i) {
      var on;
      if (reduceMotion) on = true;
      else if (horizontal) on = p >= i / (stepCards.length - 1) - 0.02;
      else on = card.getBoundingClientRect().top < vh * 0.72;
      card.classList.toggle('is-on', on);
    });
  }

  var lastY = window.pageYOffset;
  var ticking = false;
  function onScroll() {
    ticking = false;
    var y = window.pageYOffset;
    var max = root.scrollHeight - window.innerHeight;
    if (bar) bar.style.transform = 'scaleX(' + (max > 0 ? Math.min(y / max, 1) : 0).toFixed(4) + ')';
    if (nav) {
      var menuOpen = navLinks && navLinks.classList.contains('open');
      if (!menuOpen) {
        if (y > lastY + 6 && y > 260) nav.classList.add('is-hidden');
        else if (y < lastY - 6 || y <= 80) nav.classList.remove('is-hidden');
      }
    }
    lastY = y;
    updateProcess();
  }
  window.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; window.requestAnimationFrame(onScroll); }
  }, { passive: true });
  window.addEventListener('resize', onScroll);
  onScroll();

  /* ── Reveal on scroll ────────────────────────────────────── */
  var io = null;
  if ('IntersectionObserver' in window && !reduceMotion) {
    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -6% 0px' });
  }
  function reveal(el) {
    if (io) io.observe(el); else el.classList.add('in');
  }
  function mark(sel, type, mode) {
    var own = sel.split('>').pop().trim();
    qsa(sel).forEach(function (el) {
      var sibs = Array.prototype.filter.call(el.parentNode.children, function (c) { return c.matches(own); });
      var idx = sibs.indexOf(el);
      var i = mode === 'col3' ? idx % 3 : Math.min(idx, 5);
      el.setAttribute('data-r', type);
      el.style.setProperty('--i', i);
      reveal(el);
    });
  }

  [
    ['.section-label', 'rise'],
    ['.section-sub', 'rise'],
    ['.pricing-note', 'rise'],
    ['.ss-toggle-wrap', 'rise'],
    ['.social-bar', 'rise'],
    ['.services-grid > .service-card', 'rule'],
    ['.why-grid > .why-card', 'rule'],
    ['.ps-grid > .ps-card', 'rule'],
    ['.faq-list > .faq-item', 'rule'],
    ['.pricing-grid > .price-card', 'print'],
    ['.results-grid > .result-item', 'rise'],
    ['.process-steps > .step-card', 'rise'],
    ['.testimonial-grid > .testimonial-card', 'rise'],
    ['.tools-grid > .tool-pill', 'rise'],
    ['.screenshots-grid > .screenshot-item', 'rise', 'col3'],
    ['.contact-left', 'left'],
    ['.contact-right', 'right']
  ].forEach(function (a) { mark(a[0], a[1], a[2]); });

  /* ── Headlines: words rise out of a mask ─────────────────── */
  function splitWords(el) {
    var n = 0;
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (ch) {
        if (ch.nodeType === 3) {
          var frag = doc.createDocumentFragment();
          ch.nodeValue.split(/(\s+)/).forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) {
              frag.appendChild(doc.createTextNode(' '));
            } else {
              var w = doc.createElement('span');
              w.className = 'w';
              var s = doc.createElement('span');
              s.textContent = part;
              s.style.setProperty('--w', n++);
              w.appendChild(s);
              frag.appendChild(w);
            }
          });
          ch.parentNode.replaceChild(frag, ch);
        } else if (ch.nodeType === 1 && ch.nodeName !== 'BR') {
          walk(ch);
        }
      });
    })(el);
    el.classList.add('split');
  }

  var heroTitle = qs('.hero h1');
  qsa('.hero h1, .section-title, .contact-heading').forEach(function (h) {
    splitWords(h);
    if (h !== heroTitle) reveal(h);
  });
  if (heroTitle) {
    var started = false;
    var go = function () {
      if (started) return;
      started = true;
      window.requestAnimationFrame(function () {
        window.requestAnimationFrame(function () { heroTitle.classList.add('in'); });
      });
    };
    if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(go);
    window.setTimeout(go, 1200);
  }

  /* ── Numbers ─────────────────────────────────────────────── */
  function countUp(el) {
    var txt = el.textContent.trim();
    var m = txt.match(/^(\D*?)(\d+(?:\.\d+)?)(\D*)$/);
    if (!m || reduceMotion) return;
    var pre = m[1], target = parseFloat(m[2]), suf = m[3];
    var dec = (m[2].split('.')[1] || '').length;
    var t0 = null, dur = 1500;
    function step(ts) {
      if (t0 === null) t0 = ts;
      var t = Math.min((ts - t0) / dur, 1);
      el.textContent = t < 1 ? pre + (target * ease(t)).toFixed(dec) + suf : txt;
      if (t < 1) window.requestAnimationFrame(step);
    }
    window.requestAnimationFrame(step);
  }
  window.setTimeout(function () { qsa('.hero-stat-num').forEach(countUp); }, 1100);

  /* Results: a split-flap board. Digits shuffle, then settle left to right. */
  function buildFlip(el) {
    var txt = el.textContent.trim();
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', txt);
    el.textContent = '';
    txt.split('').forEach(function (ch) {
      var s = doc.createElement('span');
      s.className = /\d/.test(ch) ? 'd' : 's';
      s.setAttribute('aria-hidden', 'true');
      s.setAttribute('data-v', ch);
      s.textContent = ch;
      el.appendChild(s);
    });
  }
  function runFlip(el) {
    if (reduceMotion) return;
    qsa('.d', el).forEach(function (d, i) {
      var final = d.getAttribute('data-v');
      var stop = 500 + i * 280;
      var start = Date.now();
      var iv = window.setInterval(function () {
        if (Date.now() - start >= stop) {
          window.clearInterval(iv);
          d.textContent = final;
        } else {
          d.textContent = Math.floor(Math.random() * 10);
        }
      }, 55);
    });
  }
  var flipItems = qsa('.result-item');
  if (flipItems.length) {
    flipItems.forEach(function (item) { var n = qs('.result-num', item); if (n) buildFlip(n); });
    if ('IntersectionObserver' in window) {
      var flipIo = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            var n = qs('.result-num', e.target);
            if (n) runFlip(n);
            flipIo.unobserve(e.target);
          }
        });
      }, { threshold: 0.6 });
      flipItems.forEach(function (item) { flipIo.observe(item); });
    }
  }

  /* ── Trust strip as a marquee ────────────────────────────── */
  var strip = qs('.trust-bar');
  var stripInner = strip ? qs('.trust-bar-inner', strip) : null;
  function buildMarquee() {
    if (!strip || !stripInner || reduceMotion) return;
    qsa('[data-clone]', stripInner).forEach(function (c) { c.parentNode.removeChild(c); });
    strip.classList.add('is-marquee');
    var items = qsa('.trust-item', stripInner);
    if (!items.length) return;
    var setW = stripInner.offsetWidth;
    if (!setW) return;
    var total = setW, guard = 0;
    while (total < strip.offsetWidth + setW + 10 && guard < 8) {
      items.forEach(function (it) {
        var c = it.cloneNode(true);
        c.setAttribute('aria-hidden', 'true');
        c.setAttribute('data-clone', '1');
        stripInner.appendChild(c);
      });
      total += setW;
      guard++;
    }
    stripInner.style.setProperty('--mq-shift', (-setW) + 'px');
    stripInner.style.setProperty('--mq-dur', (setW / 55).toFixed(1) + 's');
  }
  buildMarquee();
  var rzT;
  window.addEventListener('resize', function () {
    window.clearTimeout(rzT);
    rzT = window.setTimeout(buildMarquee, 200);
  });

  /* ── Hero photo follows the pointer a little ─────────────── */
  var hero = qs('.hero');
  var card = qs('.photo-card');
  if (hero && card && !reduceMotion && window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    var raf = 0;
    hero.addEventListener('pointermove', function (e) {
      if (raf) return;
      raf = window.requestAnimationFrame(function () {
        raf = 0;
        var r = hero.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width - 0.5;
        var y = (e.clientY - r.top) / r.height - 0.5;
        card.style.setProperty('--ry', (x * 10).toFixed(2) + 'deg');
        card.style.setProperty('--rx', (-y * 8).toFixed(2) + 'deg');
      });
    });
    hero.addEventListener('pointerleave', function () {
      card.style.setProperty('--rx', '0deg');
      card.style.setProperty('--ry', '0deg');
    });
  }

  /* ── FAQ accordion ───────────────────────────────────────── */
  qsa('.faq-item').forEach(function (item) {
    var question = qs('.faq-question', item);
    var answer = qs('.faq-answer', item);
    if (!question || !answer) return;
    question.addEventListener('click', function () {
      var isOpen = item.classList.contains('open');
      qsa('.faq-item.open').forEach(function (o) {
        if (o !== item) {
          o.classList.remove('open');
          qs('.faq-question', o).setAttribute('aria-expanded', 'false');
          qs('.faq-answer', o).style.maxHeight = null;
        }
      });
      if (isOpen) {
        item.classList.remove('open');
        question.setAttribute('aria-expanded', 'false');
        answer.style.maxHeight = null;
      } else {
        item.classList.add('open');
        question.setAttribute('aria-expanded', 'true');
        answer.style.maxHeight = answer.scrollHeight + 'px';
      }
    });
  });
  window.addEventListener('resize', function () {
    qsa('.faq-item.open .faq-answer').forEach(function (a) { a.style.maxHeight = a.scrollHeight + 'px'; });
  });

  /* ── Contact form (Formspree) ────────────────────────────── */
  var form = qs('#contactForm');
  if (form) {
    var submitBtn = qs('#submitBtn');
    var submitText = qs('.submit-text', submitBtn);
    var submitLoading = qs('.submit-loading', submitBtn);
    var formSuccess = qs('#formSuccess');
    var formError = qs('#formError');

    qsa('.form-input', form).forEach(function (f) {
      var clear = function () { f.classList.remove('is-invalid'); f.removeAttribute('aria-invalid'); };
      f.addEventListener('input', clear);
      f.addEventListener('change', clear);
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var firstBad = null;
      qsa('[required]', form).forEach(function (f) {
        var v = (f.value || '').trim();
        var bad = !v || (f.type === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v));
        f.classList.toggle('is-invalid', bad);
        if (bad) { f.setAttribute('aria-invalid', 'true'); if (!firstBad) firstBad = f; }
      });
      if (firstBad) { firstBad.focus(); return; }

      submitBtn.disabled = true;
      submitText.style.display = 'none';
      submitLoading.style.display = 'inline';
      formSuccess.style.display = 'none';
      formError.style.display = 'none';

      fetch(form.action, {
        method: 'POST',
        body: new FormData(form),
        headers: { 'Accept': 'application/json' }
      }).then(function (res) {
        if (res.ok) {
          formSuccess.style.display = 'block';
          form.reset();
          window.dataLayer.push({ event: 'lead_form_submit', form_name: 'contact_form' });
          setTimeout(function () { window.location.href = 'thank-you.html'; }, 350);
        } else {
          formError.style.display = 'block';
        }
      }).catch(function () {
        formError.style.display = 'block';
      }).then(function () {
        submitBtn.disabled = false;
        submitText.style.display = 'inline';
        submitLoading.style.display = 'none';
      });
    });
  }

  /* ── Floating contact button ─────────────────────────────── */
  var fabWidget = qs('#fabWidget');
  var fabToggle = qs('#fabToggle');
  if (fabWidget && fabToggle) {
    fabToggle.addEventListener('click', function () { fabWidget.classList.toggle('active'); });
    doc.addEventListener('click', function (e) {
      if (!fabWidget.contains(e.target)) fabWidget.classList.remove('active');
    });
  }

  /* ── Case studies: show more + lightbox ──────────────────── */
  var lb = qs('#ssLightbox');
  var lbImg = qs('#ssLightboxImg');
  var lbCap = qs('#ssLightboxCaption');
  var lbItems = [];
  var lbIndex = -1;
  var ssExpanded = false;

  var wrap = qs('#ssToggleWrap');
  if (wrap && qsa('.screenshot-item.ss-hidden').length) wrap.style.display = 'block';

  function shown(el) { return window.getComputedStyle(el).display !== 'none'; }

  function lbShow(i) {
    var el = lbItems[i];
    if (!el || !lbImg) return;
    var img = qs('img', el);
    var cap = qs('.screenshot-caption', el);
    lbImg.src = img.getAttribute('data-full') || img.src;
    lbImg.alt = img.alt;
    if (lbCap) lbCap.textContent = cap ? cap.textContent : '';
    lbIndex = i;
    lbImg.style.animation = 'none';
    void lbImg.offsetWidth;
    lbImg.style.animation = '';
  }

  window.toggleScreenshots = function () {
    ssExpanded = !ssExpanded;
    qsa('#screenshotsGrid .screenshot-item:nth-child(n+7)').forEach(function (el) {
      el.style.display = ssExpanded ? 'block' : 'none';
    });
    var btn = qs('#ssToggleBtn');
    var txt = qs('#ssToggleText');
    if (txt) txt.textContent = ssExpanded ? 'Show Less' : 'Show More';
    if (btn) btn.classList.toggle('expanded', ssExpanded);
  };

  window.openLightbox = function (el) {
    if (!lb) return;
    lbItems = qsa('#screenshotsGrid .screenshot-item').filter(shown);
    lbShow(lbItems.indexOf(el));
    lb.classList.add('active');
    doc.body.style.overflow = 'hidden';
  };

  window.closeLightboxBtn = function () {
    if (lb) lb.classList.remove('active');
    doc.body.style.overflow = '';
  };

  window.closeLightbox = function (e) {
    if (e.target === lb) window.closeLightboxBtn();
  };

  doc.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { window.closeLightboxBtn(); closeMenu(); if (fabWidget) fabWidget.classList.remove('active'); }
    if (lb && lb.classList.contains('active') && lbItems.length > 1) {
      if (e.key === 'ArrowRight') lbShow((lbIndex + 1) % lbItems.length);
      if (e.key === 'ArrowLeft') lbShow((lbIndex - 1 + lbItems.length) % lbItems.length);
    }
  });
})();
