// Generates one static page per language (dist/<lang>/index.html) from src/index.html and locales/<lang>.json.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');
const SITE_URL = 'https://pulian-website.vercel.app';
const CJK_COMPANY_NAME = '合肥普联自动化仪表有限公司';

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
const template = fs.readFileSync(path.join(ROOT, 'src/index.html'), 'utf8');
const source = readJson(path.join(ROOT, 'locales/en.json'));

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

function headFor(code) {
  const lines = [`  <link rel="canonical" href="${SITE_URL}/${code}/" />`];
  for (const other of built) {
    lines.push(`  <link rel="alternate" hreflang="${LANGS[other].htmlLang}" href="${SITE_URL}/${other}/" />`);
  }
  lines.push(`  <link rel="alternate" hreflang="x-default" href="${SITE_URL}/" />`);
  if (isPreview) lines.push('  <meta name="robots" content="noindex" />');
  return lines.join('\n');
}

function langMenuFor(code, strings) {
  const items = built.map(other => {
    const { htmlLang, label } = LANGS[other];
    const current = other === code ? ' aria-current="page"' : '';
    return `        <li><a href="/${other}/" hreflang="${htmlLang}" lang="${htmlLang}" data-lang="${other}"${current}>${escapeHtml(label)}</a></li>`;
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

function renderPage(code) {
  const strings = loadStrings(code);
  const injections = {
    htmlLang: LANGS[code].htmlLang,
    dir: LANGS[code].dir,
    head: headFor(code),
    fonts: fontsFor(code),
    langMenu: langMenuFor(code, strings),
    // Escape "<" so translated text can never close the surrounding <script>.
    jsStrings: JSON.stringify({
      sending: strings['js-sending'],
      submit: strings['send-inquiry'],
      submitFailed: strings['js-submit-failed'],
      networkError: strings['js-network-error'],
    }).replaceAll('<', '\\u003c'),
  };
  let html = template.replace(/\{\{@(\w+)\}\}/g, (match, name) => {
    if (!(name in injections)) throw new Error(`Unknown injection ${match}`);
    return injections[name];
  });
  html = html.replace(/\{\{([a-z0-9-]+)\}\}/g, (match, key) => {
    if (!(key in strings)) throw new Error(`Unknown translation key ${match}`);
    return escapeHtml(strings[key]);
  });
  html = html.replace('</body>', `${draftBannerFor(code, strings)}\n</body>`);
  const leftover = html.match(/\{\{[^}]*\}\}/);
  if (leftover) throw new Error(`Unresolved placeholder ${leftover[0]} in ${code}`);
  return html;
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
  const urls = built.map(code => `  <url><loc>${SITE_URL}/${code}/</loc></url>`).join('\n');
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
  fs.writeFileSync(path.join(DIST, code, 'index.html'), renderPage(code));
}
fs.writeFileSync(path.join(DIST, 'index.html'), renderRoot());
fs.writeFileSync(path.join(DIST, 'sitemap.xml'), renderSitemap());
fs.writeFileSync(path.join(DIST, 'robots.txt'), isPreview
  ? 'User-agent: *\nDisallow: /\n'
  : `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`);
console.log(`Built ${built.join(', ')} (${isPreview ? 'preview' : 'production-safe'}) into dist/`);
