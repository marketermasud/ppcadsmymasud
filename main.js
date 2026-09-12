/* ============================================================
   Md Masud Rana — shared site script (used on every page)
   ============================================================ */

/* ── SCROLL REVEAL — safe version ── */
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('visible');
      revealObserver.unobserve(e.target);
    }
  });
}, { threshold: 0.08, rootMargin: '0px 0px -30px 0px' });

/* Only animate contact section panels — everything else stays visible */
document.querySelectorAll('.reveal-left, .reveal-right').forEach(el => {
  el.classList.add('animate-on');
  revealObserver.observe(el);
});

/* ── MOBILE NAV TOGGLE ── */
const navToggle = document.getElementById('navToggle');
const navLinksEl = document.getElementById('navLinks');

if (navToggle && navLinksEl) {
  navToggle.addEventListener('click', () => {
    const isOpen = navLinksEl.classList.toggle('open');
    navToggle.classList.toggle('open', isOpen);
    navToggle.setAttribute('aria-expanded', isOpen);
  });

  navLinksEl.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      navLinksEl.classList.remove('open');
      navToggle.classList.remove('open');
      navToggle.setAttribute('aria-expanded', 'false');
    });
  });
}

/* ── GTM DATALAYER EVENTS ── */
window.dataLayer = window.dataLayer || [];

document.getElementById('heroAuditBtn')?.addEventListener('click', () => {
  window.dataLayer.push({ event: 'contact_click', method: 'email_hero' });
});

document.getElementById('whatsappBtn')?.addEventListener('click', () => {
  window.dataLayer.push({ event: 'contact_click', method: 'whatsapp' });
});

document.getElementById('calendlyBtn')?.addEventListener('click', () => {
  window.dataLayer.push({ event: 'contact_click', method: 'calendly_booking' });
});

document.querySelectorAll('.order-now-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    window.dataLayer.push({
      event: 'pricing_click',
      plan: btn.dataset.plan
    });
  });
});

/* ── FORMSPREE AJAX SUBMIT (contact page only) ── */
const form = document.getElementById('contactForm');

if (form) {
  const submitBtn = document.getElementById('submitBtn');
  const submitText = submitBtn.querySelector('.submit-text');
  const submitLoading = submitBtn.querySelector('.submit-loading');
  const formSuccess = document.getElementById('formSuccess');
  const formError = document.getElementById('formError');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    submitBtn.disabled = true;
    submitText.style.display = 'none';
    submitLoading.style.display = 'inline';
    formSuccess.style.display = 'none';
    formError.style.display = 'none';

    try {
      const data = new FormData(form);
      const res = await fetch(form.action, {
        method: 'POST',
        body: data,
        headers: { 'Accept': 'application/json' }
      });

      if (res.ok) {
        formSuccess.style.display = 'block';
        form.reset();
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({
          event: 'lead_form_submit',
          form_name: 'contact_form'
        });
      } else {
        formError.style.display = 'block';
      }
    } catch {
      formError.style.display = 'block';
    } finally {
      submitBtn.disabled = false;
      submitText.style.display = 'inline';
      submitLoading.style.display = 'none';
    }
  });
}

/* ── ANIMATE NUMBERS ON SCROLL (results page only) ── */
function animateCounter(el, target, suffix = '') {
  let start = 0;
  const duration = 1800;
  const step = timestamp => {
    if (!start) start = timestamp;
    const prog = Math.min((timestamp - start) / duration, 1);
    const eased = 1 - Math.pow(1 - prog, 3);
    const current = Math.floor(eased * target);
    el.textContent = current + suffix;
    if (prog < 1) requestAnimationFrame(step);
    else el.textContent = target + suffix;
  };
  requestAnimationFrame(step);
}

const resultItems = document.querySelectorAll('.result-item');
if (resultItems.length) {
  const resultObserver = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting && !e.target.dataset.animated) {
        e.target.dataset.animated = '1';
        const numEl = e.target.querySelector('.result-num');
        if (!numEl) return;
        const txt = numEl.textContent.trim();
        const match = txt.match(/^[\$]?(\d+\.?\d*)(.*)/);
        if (match) {
          const num = parseFloat(match[1]);
          const suffix = match[2] || '';
          animateCounter(numEl, num, suffix);
        }
      }
    });
  }, { threshold: 0.5 });

  resultItems.forEach(el => resultObserver.observe(el));
}

/* ── FAQ ACCORDION (faq page only) ── */
document.querySelectorAll('.faq-item').forEach(item => {
  const question = item.querySelector('.faq-question');
  const answer = item.querySelector('.faq-answer');
  question.addEventListener('click', () => {
    const isOpen = item.classList.contains('open');
    document.querySelectorAll('.faq-item.open').forEach(openItem => {
      if (openItem !== item) {
        openItem.classList.remove('open');
        openItem.querySelector('.faq-question').setAttribute('aria-expanded', 'false');
        openItem.querySelector('.faq-answer').style.maxHeight = null;
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

/* ── FLOATING CONTACT WIDGET (every page) ── */
const fabWidget = document.getElementById('fabWidget');
const fabToggle = document.getElementById('fabToggle');
if (fabWidget && fabToggle) {
  fabToggle.addEventListener('click', () => fabWidget.classList.toggle('active'));
  document.addEventListener('click', (e) => {
    if (!fabWidget.contains(e.target)) fabWidget.classList.remove('active');
  });
}

/* ============================================================
   CASE STUDIES PAGE — screenshot "show more" + lightbox
   ============================================================ */

(function() {
  const hidden = document.querySelectorAll('.screenshot-item.ss-hidden');
  const toggleWrap = document.getElementById('ssToggleWrap');
  if (hidden.length > 0 && toggleWrap) {
    toggleWrap.style.display = 'block';
  }
})();

var ssExpanded = false;

function toggleScreenshots() {
  ssExpanded = !ssExpanded;
  const allExtra = document.querySelectorAll('#screenshotsGrid .screenshot-item:nth-child(n+7)');

  allExtra.forEach(function(el) {
    el.style.display = ssExpanded ? 'block' : 'none';
  });

  const btn = document.getElementById('ssToggleBtn');
  const btnText = document.getElementById('ssToggleText');
  if (btnText) btnText.textContent = ssExpanded ? 'Show Less' : 'Show More';
  if (btn) btn.classList.toggle('expanded', ssExpanded);
}

function openLightbox(el) {
  const img = el.querySelector('img');
  const cap = el.querySelector('.screenshot-caption');
  const lbImg = document.getElementById('ssLightboxImg');
  const lbCap = document.getElementById('ssLightboxCaption');
  const lb = document.getElementById('ssLightbox');
  if (!lbImg || !lb) return;
  lbImg.src = img.src;
  lbImg.alt = img.alt;
  if (lbCap) lbCap.textContent = cap ? cap.textContent : '';
  lb.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeLightbox(e) {
  const lb = document.getElementById('ssLightbox');
  if (e.target === lb) {
    closeLightboxBtn();
  }
}

function closeLightboxBtn() {
  const lb = document.getElementById('ssLightbox');
  if (lb) lb.classList.remove('active');
  document.body.style.overflow = '';
}

/* ESC key closes lightbox */
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') closeLightboxBtn();
});
