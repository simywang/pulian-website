// Generates static pages per language from src/ templates, src/products.json and locales/<lang>.json:
//   dist/<lang>/index.html                     home page
//   dist/<lang>/products/<slug>/index.html     one page per product
//   dist/<lang>/about/index.html               company profile, factory photos, certificates
import fs from 'node:fs';
import path from 'node:path';
import { DIAGRAMS } from './diagrams.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');
const SITE_URL = 'https://pulian-website.vercel.app';
const CJK_COMPANY_NAME = '合肥普联自动化仪表有限公司';
const WHATSAPP_URL = 'https://wa.me/31645228942';

// "draft" languages are built only for Preview deployments and never reach production.
const LANGS = {
  en: { htmlLang: 'en',    dir: 'ltr', label: 'English', short: 'EN', status: 'public' },
  zh: { htmlLang: 'zh-CN', dir: 'ltr', label: '中文',    short: '中', status: 'public' },
  ru: { htmlLang: 'ru',    dir: 'ltr', label: 'Русский', short: 'RU', status: 'draft' },
  ar: { htmlLang: 'ar',    dir: 'rtl', label: 'العربية', short: 'ع',  status: 'draft' },
};

// Safe default: drafts and noindex only when the environment is explicitly a Preview.
const isPreview = process.argv.includes('--preview') || process.env.VERCEL_ENV === 'preview';
const built = Object.keys(LANGS).filter(code => isPreview || LANGS[code].status === 'public');

const escapeHtml = value => String(value)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const homeTemplate = fs.readFileSync(path.join(ROOT, 'src/index.html'), 'utf8');
const productTemplate = fs.readFileSync(path.join(ROOT, 'src/product.html'), 'utf8');
const aboutTemplate = fs.readFileSync(path.join(ROOT, 'src/about.html'), 'utf8');
const products = readJson(path.join(ROOT, 'src/products.json'));
const certificates = readJson(path.join(ROOT, 'src/certificates.json'));
const source = readJson(path.join(ROOT, 'locales/en.json'));

// Shared page chrome lives in the home template; product pages reuse it.
const extract = (pattern, name) => {
  const match = homeTemplate.match(pattern);
  if (!match) throw new Error(`Could not find ${name} in src/index.html`);
  return match[0];
};
const SPRITE = extract(/<svg width="0"[\s\S]*?<\/svg>/, 'icon sprite');
const NAV = extract(/<nav id="navbar">[\s\S]*?<\/nav>/, 'navbar');
const FOOTER = extract(/<footer>[\s\S]*?<\/footer>/, 'footer');
const FACTORY = extract(/<section id="factory"[\s\S]*?<\/section>/, 'factory section');

function loadStrings(code) {
  const strings = readJson(path.join(ROOT, `locales/${code}.json`));
  const missing = Object.keys(source).filter(key => !(key in strings));
  if (missing.length && LANGS[code].status === 'public') {
    throw new Error(`locales/${code}.json is missing ${missing.length} keys: ${missing.join(', ')}`);
  }
  if (missing.length) console.warn(`[${code}] ${missing.length} keys missing, falling back to English`);
  return { ...source, ...strings };
}

function fontsFor(code) {
  const families = [
    'family=Barlow+Condensed:wght@400;600;700;800',
    'family=Source+Sans+3:wght@300;400;600',
  ];
  if (code === 'zh') families.push('family=Noto+Sans+SC:wght@300;400;700');
  if (code === 'ru') families.push('family=Roboto+Condensed:wght@400;600;700;800');
  if (code === 'ar') families.push('family=Noto+Sans+Arabic:wght@300;400;600;700;800');
  const links = [`https://fonts.googleapis.com/css2?${families.join('&')}&display=swap`];
  // Other pages only need the glyphs of the Chinese company name.
  if (code !== 'zh') {
    links.push(`https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400&text=${encodeURIComponent(CJK_COMPANY_NAME)}&display=swap`);
  }
  return links.map(href => `  <link href="${escapeHtml(href)}" rel="stylesheet" />`).join('\n');
}

// `page` is the path after the language prefix, e.g. '' or 'products/scraper-flowmeter/'.
function headFor(code, page) {
  const lines = [`  <link rel="canonical" href="${SITE_URL}/${code}/${page}" />`];
  for (const other of built) {
    lines.push(`  <link rel="alternate" hreflang="${LANGS[other].htmlLang}" href="${SITE_URL}/${other}/${page}" />`);
  }
  lines.push(`  <link rel="alternate" hreflang="x-default" href="${SITE_URL}/" />`);
  if (isPreview) lines.push('  <meta name="robots" content="noindex" />');
  return lines.join('\n');
}

function langMenuFor(code, strings, page) {
  const items = built.map(other => {
    const { htmlLang, label } = LANGS[other];
    const current = other === code ? ' aria-current="page"' : '';
    return `        <li><a href="/${other}/${page}" hreflang="${htmlLang}" lang="${htmlLang}" data-lang="${other}"${current}>${escapeHtml(label)}</a></li>`;
  }).join('\n');
  const { short, label } = LANGS[code];
  return `    <div class="lang-menu">
      <button class="lang-btn" id="langBtn" type="button" aria-expanded="false" aria-controls="langList" aria-label="${escapeHtml(`${strings.language}: ${label}`)}">${escapeHtml(short)}<span class="caret" aria-hidden="true"></span></button>
      <ul class="lang-list" id="langList" hidden>
${items}
      </ul>
    </div>`;
}

function draftBannerFor(code, strings) {
  if (LANGS[code].status !== 'draft') return '';
  return `<div class="draft-banner" role="note">${escapeHtml(strings['draft-banner'] ?? 'Draft translation — not reviewed')}</div>`;
}

// Escape "<" so translated text can never close the surrounding <script>.
const jsStringsFor = strings => JSON.stringify({
  sending: strings['js-sending'],
  submit: strings['send-inquiry'],
  submitFailed: strings['js-submit-failed'],
  networkError: strings['js-network-error'],
  close: strings['lightbox-close'],
  prev: strings['carousel-prev'],
  next: strings['carousel-next'],
  enlarge: strings['view-larger'],
}).replaceAll('<', '\\u003c');

// Product fragments contain {{key}} placeholders that the translation pass resolves.
const textOrKey = item => item.valueKey ? `{{${item.valueKey}}}` : escapeHtml(item.value);
const productUrl = (code, product) => `/${code}/products/${product.slug}/`;
const productBySlug = slug => {
  const product = products.find(p => p.slug === slug);
  if (!product) throw new Error(`Unknown product ${slug}`);
  return product;
};

function placeholderHtml(product, extraClass = '') {
  return `<div class="ph ${extraClass}" role="img" aria-label="{{${product.placeholderKey}}}"><svg aria-hidden="true"><use href="#ico-meter"/></svg><span class="ph-note">{{product-photo-coming-soon}}</span></div>`;
}

function galleryHtml(product) {
  if (!product.images.length) return placeholderHtml(product);
  const slides = product.images.map((img, i) =>
    `<img class="carousel-slide" src="${img.src}" alt="{{${img.altKey}}}" width="${img.width}" height="${img.height}"${i ? ' loading="lazy"' : ''} />`).join('\n            ');
  return `<div class="carousel" data-carousel data-photo-label="{{carousel-photo}}" role="region" aria-roledescription="carousel" aria-label="{{${product.nameKey}}}">
          <div class="carousel-track">
            ${slides}
          </div>
          <button class="carousel-btn carousel-prev" type="button" aria-label="{{carousel-prev}}"><span aria-hidden="true">‹</span></button>
          <button class="carousel-btn carousel-next" type="button" aria-label="{{carousel-next}}"><span aria-hidden="true">›</span></button>
          <div class="carousel-dots"></div>
        </div>`;
}

function cardHtml(code, product) {
  const image = product.images[0]
    ? `<img class="card-img card-photo" src="${product.images[0].src}" alt="{{${product.images[0].altKey}}}" width="${product.images[0].width}" height="${product.images[0].height}" loading="lazy" />`
    : placeholderHtml(product, 'card-img');
  return `<a class="product-card reveal" href="${productUrl(code, product)}">
        ${image}
        <div class="card-body">
          <div class="card-tag">{{${product.tagKey}}}</div>
          <div class="card-title">{{${product.nameKey}}}</div>
          <div class="card-cn sub-name">${escapeHtml(product.subName)}</div>
          <div class="card-desc">{{${product.descKey}}}</div>
          <div class="card-params">${product.cardParams.key ? `{{${product.cardParams.key}}}` : escapeHtml(product.cardParams.value)}</div>
          <span class="card-more">{{view-details}} <span class="arrow" aria-hidden="true">→</span></span>
        </div>
      </a>`;
}

function highlightsHtml(product) {
  if (!product.highlights.length) return '';
  const items = product.highlights.map(h =>
    `<div class="highlight-item"><div class="highlight-num">${escapeHtml(h.value)}</div><div class="highlight-label">{{${h.labelKey}}}</div></div>`).join('');
  return `<div class="product-highlights">${items}</div>`;
}

function specsHtml(product) {
  if (!product.specs.length) return '';
  return `<h3 class="detail-subtitle">{{specifications}}</h3>${specsTable(product)}`;
}

function specsTable(product) {
  const rows = product.specs.map(s => `<tr><td>{{${s.labelKey}}}</td><td>${textOrKey(s)}</td></tr>`).join('\n          ');
  return `<table class="spec-table detail-specs">
          ${rows}
        </table>`;
}

function listHtml(titleKey, keys) {
  if (!keys.length) return '';
  const items = keys.map(k => `<li>{{${k}}}</li>`).join('');
  return `<h3 class="detail-subtitle">{{${titleKey}}}</h3><ul class="detail-features">${items}</ul>`;
}

const cellText = cell => cell.key ? `{{${cell.key}}}` : escapeHtml(cell.text);
const spanAttrs = cell => `${cell.colspan ? ` colspan="${cell.colspan}"` : ''}${cell.rowspan ? ` rowspan="${cell.rowspan}"` : ''}`;

// Body cells are plain strings or {text|key, rowspan, colspan, th}; a plain string in the first column is the row header.
function bodyCell(cell, isFirst) {
  if (typeof cell === 'string') return isFirst ? `<th scope="row">${escapeHtml(cell)}</th>` : `<td>${escapeHtml(cell)}</td>`;
  const tag = cell.th ? 'th' : 'td';
  return `<${tag}${cell.th ? ' scope="row"' : ''}${spanAttrs(cell)}>${cellText(cell)}</${tag}>`;
}

function tablesHtml(tables) {
  return tables.map(table => {
    const head = table.head.map(row =>
      `<tr>${row.map(cell => `<th scope="col"${spanAttrs(cell)}>${cellText(cell)}</th>`).join('')}</tr>`).join('');
    const body = table.rows.map(row =>
      `<tr>${row.map((cell, i) => bodyCell(cell, i === 0)).join('')}</tr>`).join('\n            ');
    const note = table.noteKey ? `<p class="table-note">{{${table.noteKey}}}</p>` : '';
    return `<h3 class="detail-subtitle">{{${table.captionKey}}}</h3>
        ${note}
        <div class="table-scroll" role="region" aria-label="{{${table.captionKey}}}" tabindex="0">
          <table class="flow-table">
            <thead>${head}</thead>
            <tbody>
            ${body}
            </tbody>
          </table>
        </div>`;
  }).join('\n        ');
}

function figureHtml(fig) {
  const legend = fig.legendKeys?.length
    ? `<ul class="diagram-legend">${fig.legendKeys.map((k, i) =>
        `<li>${fig.numbered ? `<span class="n">${i + 1}</span>` : ''}{{${k}}}</li>`).join('')}</ul>`
    : '';
  return `<figure class="principle-figure">
          <div class="diagram-wrap">${DIAGRAMS[fig.diagram]('{{' + fig.captionKey + '}}')}</div>
          <figcaption>{{${fig.captionKey}}}</figcaption>
        </figure>
        ${legend}`;
}

function overviewHtml(product) {
  if (!product.introKey) return '';
  return `<h3 class="detail-subtitle">{{product-overview}}</h3><p class="detail-intro">{{${product.introKey}}}</p>`;
}

function principleHtml(product) {
  const pr = product.principle;
  if (!pr) return '';
  return `<h3 class="detail-subtitle">{{working-principle}}</h3>
        ${figureHtml(pr)}
        <p class="principle-text">{{${pr.textKey}}}</p>`;
}

function installationHtml(product) {
  const ins = product.installation;
  if (!ins) return '';
  return `<h3 class="detail-subtitle">{{installation-notes}}</h3>
        ${ins.figure ? figureHtml(ins.figure) : ''}
        ${ins.tables ? tablesHtml(ins.tables) : ''}
        <ul class="detail-features">${ins.noteKeys.map(k => `<li>{{${k}}}</li>`).join('')}</ul>`;
}

// Products without verified detailed data say so instead of showing invented values.
function moreComingHtml(product) {
  if (product.detailed) return '';
  return `<div class="detail-note">{{more-specs-coming}} <a href="#" data-quote>{{contact-us}} <span class="arrow" aria-hidden="true">→</span></a></div>`;
}

const localizeAnchors = (html, code) => html
  .replace(/href="#hero"/g, `href="/${code}/"`)
  .replace(/href="#/g, `href="/${code}/#`);

function translate(html, code, strings) {
  html = html.replace(/\{\{([a-z0-9-]+)\}\}/g, (match, key) => {
    if (!(key in strings)) throw new Error(`Unknown translation key ${match} (${code})`);
    return escapeHtml(strings[key]);
  });
  html = html.replace('</body>', `${draftBannerFor(code, strings)}\n</body>`);
  const leftover = html.match(/\{\{[^}]*\}\}/);
  if (leftover) throw new Error(`Unresolved placeholder ${leftover[0]} in ${code}`);
  return html;
}

function inject(template, injections) {
  return template.replace(/\{\{@(\w+)\}\}/g, (match, name) => {
    if (!(name in injections)) throw new Error(`Unknown injection ${match}`);
    return injections[name];
  });
}

function common(code, strings, page) {
  return {
    htmlLang: LANGS[code].htmlLang,
    dir: LANGS[code].dir,
    head: headFor(code, page),
    fonts: fontsFor(code),
    langMenu: langMenuFor(code, strings, page),
    jsStrings: jsStringsFor(strings),
  };
}

function renderHome(code) {
  const strings = loadStrings(code);
  const html = inject(homeTemplate, {
    ...common(code, strings, ''),
    catalogCards: products.map(p => cardHtml(code, p)).join('\n      '),
    featuredGalleryMiniature: galleryHtml(productBySlug('miniature-flowmeter')),
    featuredGalleryScraper: galleryHtml(productBySlug('scraper-flowmeter')),
  });
  return translate(html, code, strings);
}

function renderProduct(code, product) {
  const strings = loadStrings(code);
  const page = `products/${product.slug}/`;
  const quoteHref = product.formValue ? `/${code}/?product=${product.formValue}#contact` : `/${code}/#contact`;
  let html = inject(productTemplate, {
    ...common(code, strings, page),
    sprite: SPRITE,
    nav: localizeAnchors(NAV, code),
    footer: localizeAnchors(FOOTER, code),
    lang: code,
    nameKey: `{{${product.nameKey}}}`,
    descKey: `{{${product.descKey}}}`,
    tagKey: `{{${product.tagKey}}}`,
    subName: escapeHtml(product.subName),
    gallery: galleryHtml(product),
    highlights: highlightsHtml(product),
    specs: specsHtml(product),
    features: listHtml('key-features', product.featureKeys),
    applications: listHtml('applications', product.applicationKeys),
    variants: product.variantList ? listHtml(product.variantList.titleKey, product.variantList.keys) : '',
    options: product.optionList ? listHtml(product.optionList.titleKey, product.optionList.keys) : '',
    overview: overviewHtml(product),
    principle: principleHtml(product),
    tables: tablesHtml(product.tables),
    installation: installationHtml(product),
    flowTables: tablesHtml(product.flowTables),
    moreComing: moreComingHtml(product),
    quoteHref,
    whatsappUrl: WHATSAPP_URL,
    otherProducts: products.filter(p => p !== product).map(p => cardHtml(code, p)).join('\n      '),
  });
  // The shared nav carries its own {{@langMenu}}, so product pages need a second pass.
  html = inject(html, common(code, strings, page));
  html = html.replace(/href="#" data-quote/g, `href="${quoteHref}"`);
  return translate(html, code, strings);
}

function certificatesHtml() {
  const items = certificates.items.map(c =>
    `        <figure class="cert-card"><img src="${c.src}" alt="{{${c.titleKey}}}" loading="lazy" data-lightbox="certificates" /><figcaption>{{${c.titleKey}}}</figcaption></figure>`);
  const empty = Math.max(0, certificates.slots - certificates.items.length);
  for (let i = 0; i < empty; i++) {
    items.push(`        <figure class="cert-card"><div class="ph cert-ph" role="img" aria-label="{{certificate-coming-soon}}"><svg aria-hidden="true"><use href="#ico-certificate"/></svg><span class="ph-note">{{certificate-coming-soon}}</span></div></figure>`);
  }
  return items.join('\n');
}

function renderAbout(code) {
  const strings = loadStrings(code);
  const page = 'about/';
  let html = inject(aboutTemplate, {
    ...common(code, strings, page),
    sprite: SPRITE,
    nav: localizeAnchors(NAV, code),
    footer: localizeAnchors(FOOTER, code),
    lang: code,
    // Alternate section backgrounds on the About page: profile, capabilities, factory, certificates.
    factorySection: FACTORY.replace('section section-white', 'section section-cream'),
    certificates: certificatesHtml(),
    whatsappUrl: WHATSAPP_URL,
  });
  // The shared nav carries its own {{@langMenu}}, so this page needs a second pass.
  html = inject(html, common(code, strings, page));
  return translate(html, code, strings);
}

function renderRoot() {
  const links = built.map(code =>
    `    <li><a href="/${code}/" hreflang="${LANGS[code].htmlLang}" lang="${LANGS[code].htmlLang}">${escapeHtml(LANGS[code].label)}</a></li>`).join('\n');
  const alternates = built.map(code =>
    `  <link rel="alternate" hreflang="${LANGS[code].htmlLang}" href="${SITE_URL}/${code}/" />`).join('\n');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Hefei Pulian Automated Instruments Co., Ltd.</title>
${alternates}
  <link rel="alternate" hreflang="x-default" href="${SITE_URL}/" />
${isPreview ? '  <meta name="robots" content="noindex" />\n' : ''}  <script>
    (function () {
      var langs = ${JSON.stringify(built)};
      var lang = null;
      try { lang = localStorage.getItem('pl_lang'); } catch (e) {}
      if (lang === 'cn') lang = 'zh';
      if (langs.indexOf(lang) < 0) {
        lang = 'en';
        var prefs = navigator.languages || [navigator.language || ''];
        for (var i = 0; i < prefs.length; i++) {
          var code = String(prefs[i]).slice(0, 2).toLowerCase();
          if (langs.indexOf(code) >= 0) { lang = code; break; }
        }
      }
      location.replace('/' + lang + '/' + location.hash);
    })();
  </script>
  <style>
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #1B3A2F; color: #C0C8C2; font-family: system-ui, sans-serif; }
    ul { list-style: none; padding: 0; display: flex; gap: 24px; }
    a { color: #D4A843; }
  </style>
</head>
<body>
  <ul>
${links}
  </ul>
</body>
</html>
`;
}

function renderSitemap() {
  const pages = ['', 'about/', ...products.map(p => `products/${p.slug}/`)];
  const urls = built.flatMap(code => pages.map(page => `  <url><loc>${SITE_URL}/${code}/${page}</loc></url>`)).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

fs.rmSync(DIST, { recursive: true, force: true });
fs.cpSync(path.join(ROOT, 'public'), DIST, { recursive: true });
for (const code of built) {
  fs.mkdirSync(path.join(DIST, code), { recursive: true });
  fs.writeFileSync(path.join(DIST, code, 'index.html'), renderHome(code));
  fs.mkdirSync(path.join(DIST, code, 'about'), { recursive: true });
  fs.writeFileSync(path.join(DIST, code, 'about', 'index.html'), renderAbout(code));
  for (const product of products) {
    const dir = path.join(DIST, code, 'products', product.slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), renderProduct(code, product));
  }
}
fs.writeFileSync(path.join(DIST, 'index.html'), renderRoot());
fs.writeFileSync(path.join(DIST, 'sitemap.xml'), renderSitemap());
fs.writeFileSync(path.join(DIST, 'robots.txt'), isPreview
  ? 'User-agent: *\nDisallow: /\n'
  : `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`);
console.log(`Built ${built.join(', ')} (${isPreview ? 'preview' : 'production-safe'}) with ${products.length} product pages each into dist/`);
