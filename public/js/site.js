function storeLang(lang) {
  try { localStorage.setItem('pl_lang', lang); } catch {}
}

/* ── Disclosure menus (language + products) ── */
function setupDisclosure(button, panel) {
  const items = () => [...panel.querySelectorAll('a')];
  const open = () => { button.setAttribute('aria-expanded', 'true'); panel.hidden = false; };
  const close = (focusButton) => {
    button.setAttribute('aria-expanded', 'false');
    panel.hidden = true;
    if (focusButton) button.focus();
  };
  button.addEventListener('click', () => {
    if (panel.hidden) open(); else close(false);
  });
  button.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); open(); items()[0]?.focus(); }
  });
  panel.addEventListener('keydown', e => {
    const list = items();
    const i = list.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); list[(i + 1) % list.length].focus(); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); list[(i - 1 + list.length) % list.length].focus(); }
    if (e.key === 'Escape')    { close(true); }
  });
  button.addEventListener('keydown', e => { if (e.key === 'Escape') close(false); });
  document.addEventListener('click', e => {
    if (!panel.hidden && !button.contains(e.target) && !panel.contains(e.target)) close(false);
  });
  panel.addEventListener('focusout', e => {
    if (!panel.contains(e.relatedTarget) && e.relatedTarget !== button) close(false);
  });
  panel.querySelectorAll('a').forEach(a => a.addEventListener('click', () => close(false)));
}

setupDisclosure(document.getElementById('langBtn'), document.getElementById('langList'));
const productsToggle = document.querySelector('.nav-dropdown-toggle');
setupDisclosure(productsToggle, document.getElementById('productsMenu'));

// Keep the visitor's language choice for the root redirect, and keep their place on the page.
document.querySelectorAll('#langList a[data-lang]').forEach(a => {
  a.addEventListener('click', () => {
    storeLang(a.dataset.lang);
    if (location.hash) a.href = a.getAttribute('href') + location.hash;
  });
});

/* ── Navbar scroll effect ── */
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 20);
}, { passive: true });

/* ── Mobile nav toggle ── */
const navToggle = document.getElementById('navToggle');
const navLinks  = document.getElementById('navLinks');
navToggle.addEventListener('click', () => {
  const isOpen = navLinks.classList.toggle('open');
  navToggle.setAttribute('aria-expanded', String(isOpen));
});
navLinks.querySelectorAll('a').forEach(a => {
  a.addEventListener('click', () => {
    navLinks.classList.remove('open');
    navToggle.setAttribute('aria-expanded', 'false');
  });
});

/* ── Active nav link on scroll ── */
const sections = document.querySelectorAll('section[id]');
const navAnchors = document.querySelectorAll('.nav-links a[href^="#"]');

function updateActiveNav() {
  let current = '';
  sections.forEach(sec => {
    if (window.scrollY >= sec.offsetTop - 120) current = sec.id;
  });
  navAnchors.forEach(a => {
    a.classList.toggle('active', a.getAttribute('href') === '#' + current);
  });
  productsToggle.classList.toggle('active', current === 'products' || current === 'product-line');
}
window.addEventListener('scroll', updateActiveNav, { passive: true });

/* ── Reveal on scroll ── */
const revealEls = document.querySelectorAll('.reveal');
const observer = new IntersectionObserver((entries) => {
  entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); } });
}, { threshold: 0.12 });
revealEls.forEach(el => observer.observe(el));

/* ── Photo carousels ── */
document.querySelectorAll('[data-carousel]').forEach(carousel => {
  const track = carousel.querySelector('.carousel-track');
  const slides = [...track.children];
  if (slides.length < 2) { carousel.dataset.single = ''; return; }
  const dotsBox = carousel.querySelector('.carousel-dots');
  const label = carousel.dataset.photoLabel;
  let current = 0;
  // Scrolling the track directly (not scrollIntoView) keeps the page itself from jumping.
  const goTo = i => {
    markActive((i + slides.length) % slides.length);
    track.scrollTo({ left: slides[current].offsetLeft - track.offsetLeft });
  };
  const dots = slides.map((_, i) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.setAttribute('aria-label', `${label} ${i + 1} / ${slides.length}`);
    dot.addEventListener('click', () => goTo(i));
    dotsBox.appendChild(dot);
    return dot;
  });
  const markActive = i => {
    current = i;
    dots.forEach((d, j) => d.setAttribute('aria-current', String(j === i)));
  };
  markActive(0);
  const seen = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) markActive(slides.indexOf(e.target)); });
  }, { root: track, threshold: 0.6 });
  slides.forEach(s => seen.observe(s));
  carousel.querySelector('.carousel-prev').addEventListener('click', () => goTo(current - 1));
  carousel.querySelector('.carousel-next').addEventListener('click', () => goTo(current + 1));
});

/* ── Lightbox: photos with data-lightbox="<group>" open full size ── */
const zoomable = [...document.querySelectorAll('img[data-lightbox]')];
if (zoomable.length) {
  const box = document.createElement('div');
  box.className = 'lightbox';
  box.hidden = true;
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.innerHTML = `
    <figure class="lightbox-figure"><img alt="" /><figcaption></figcaption></figure>
    <button class="lightbox-close" type="button"><span aria-hidden="true">×</span></button>
    <button class="lightbox-prev" type="button"><span aria-hidden="true">‹</span></button>
    <button class="lightbox-next" type="button"><span aria-hidden="true">›</span></button>`;
  document.body.appendChild(box);
  const [boxImg, boxCaption] = [box.querySelector('img'), box.querySelector('figcaption')];
  const closeBtn = box.querySelector('.lightbox-close');
  closeBtn.setAttribute('aria-label', T.close);
  box.querySelector('.lightbox-prev').setAttribute('aria-label', T.prev);
  box.querySelector('.lightbox-next').setAttribute('aria-label', T.next);

  let group = [], index = 0, opener = null;
  const captionOf = img => img.closest('figure')?.querySelector('figcaption')?.textContent || img.alt;
  const show = i => {
    index = (i + group.length) % group.length;
    const img = group[index];
    boxImg.src = img.currentSrc || img.src;
    boxImg.alt = img.alt;
    boxCaption.textContent = captionOf(img);
    box.setAttribute('aria-label', captionOf(img));
  };
  const open = img => {
    group = zoomable.filter(z => z.dataset.lightbox === img.dataset.lightbox);
    opener = img;
    box.toggleAttribute('data-single', group.length < 2);
    show(group.indexOf(img));
    box.hidden = false;
    document.body.style.overflow = 'hidden';
    closeBtn.focus();
  };
  const close = () => {
    box.hidden = true;
    document.body.style.overflow = '';
    opener?.focus();
  };

  zoomable.forEach(img => {
    img.tabIndex = 0;
    img.setAttribute('role', 'button');
    img.setAttribute('aria-label', `${T.enlarge}: ${captionOf(img)}`);
    img.addEventListener('click', () => open(img));
    img.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(img); }
    });
  });
  closeBtn.addEventListener('click', close);
  box.querySelector('.lightbox-prev').addEventListener('click', () => show(index - 1));
  box.querySelector('.lightbox-next').addEventListener('click', () => show(index + 1));
  box.addEventListener('click', e => { if (e.target === box) close(); });
  box.addEventListener('keydown', e => {
    const rtl = document.documentElement.dir === 'rtl';
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowRight') show(index + (rtl ? -1 : 1));
    if (e.key === 'ArrowLeft') show(index + (rtl ? 1 : -1));
    // Keep keyboard focus inside the dialog.
    if (e.key === 'Tab') {
      const buttons = [...box.querySelectorAll('button')].filter(b => b.offsetParent);
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
}

/* ── Preselect the product when arriving from a product page (?product=scraper) ── */
const productSelect = document.getElementById('fproduct');
const wantedProduct = new URLSearchParams(location.search).get('product');
if (productSelect && wantedProduct && [...productSelect.options].some(o => o.value === wantedProduct)) {
  productSelect.value = wantedProduct;
}

/* ── Form submission (AJAX) ── */
const form = document.getElementById('inquiryForm');
const successDiv = document.getElementById('formSuccess');
if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('.form-submit');
    btn.textContent = T.sending;
    btn.disabled = true;
    try {
      const res = await fetch(form.action, {
        method: 'POST',
        body: new FormData(form),
        headers: { 'Accept': 'application/json' }
      });
      if (res.ok) {
        form.style.display = 'none';
        successDiv.style.display = 'block';
      } else {
        btn.textContent = T.submit;
        btn.disabled = false;
        alert(T.submitFailed);
      }
    } catch {
      btn.textContent = T.submit;
      btn.disabled = false;
      alert(T.networkError);
    }
  });
}
