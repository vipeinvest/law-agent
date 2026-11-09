/* Mehrsprachigkeit. Deutsch ist die Quelle und zugleich der Schlüssel, die anderen Sprachen liegen in i18n-*.js.
 * Zusammengesetzte Sätze haben Platzhalter wie {n}. tests/smoke.cjs bricht ab, wenn ein Schlüssel fehlt oder eine Zahl abweicht.
 */
const I18N = (() => {
  'use strict';
  const LANGS = {
    de: { label: 'DE', locale: 'de-AT', region: /^de-AT/i },
    en: { label: 'EN', locale: 'en-GB', region: /^en-GB/i },
    it: { label: 'IT', locale: 'it-IT', region: /^it-IT/i },
    fr: { label: 'FR', locale: 'fr-FR', region: /^fr-FR/i },
  };
  const STORE_KEY = 'bodensee-expedition-lang-v1';
  const dict = { en: {}, it: {}, fr: {} };
  const textOf = new WeakMap();
  const labelOf = new WeakMap();
  let lang = 'de';

  function load() {
    let wanted = null;
    try {
      wanted = new URLSearchParams(window.location.search).get('lang') || localStorage.getItem(STORE_KEY);
    } catch (e) { /* storage unavailable: German for this visit */ }
    if (wanted && LANGS[wanted]) lang = wanted;
  }
  const t = (s) => {
    if (!s || lang === 'de') return s;
    const hit = dict[lang][s];
    return hit === undefined ? s : hit;
  };
  const tf = (s, vars) => t(s).replace(/\{(\w+)\}/g, (m, k) => (vars[k] === undefined ? m : vars[k]));

  function translateNode(node) {
    if (!textOf.has(node)) textOf.set(node, node.nodeValue);
    const raw = textOf.get(node);
    const m = raw.match(/^(\s*)([\s\S]*?)(\s*)$/);
    const core = m[2].replace(/\s+/g, ' ');
    if (core) node.nodeValue = m[1] + t(core) + m[3];
  }
  // Static page text and labels. Text that scripts write goes through t() where it is written.
  function applyDom(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) translateNode(n);
    root.querySelectorAll('[placeholder]').forEach((el) => {
      if (!el.dataset.ph) el.dataset.ph = el.getAttribute('placeholder');
      el.setAttribute('placeholder', t(el.dataset.ph));
    });
    root.querySelectorAll('[aria-label]').forEach((el) => {
      if (!labelOf.has(el)) labelOf.set(el, el.getAttribute('aria-label'));
      el.setAttribute('aria-label', t(labelOf.get(el)));
    });
    document.documentElement.lang = lang;
  }
  function domKeys(root) {
    const out = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const core = (textOf.get(n) || n.nodeValue).replace(/\s+/g, ' ').trim();
      if (core) out.push(core);
    }
    root.querySelectorAll('[aria-label]').forEach((el) => out.push(labelOf.get(el) || el.getAttribute('aria-label')));
    root.querySelectorAll('[placeholder]').forEach((el) => out.push(el.dataset.ph || el.getAttribute('placeholder')));
    return out;
  }
  function set(code) {
    if (!LANGS[code]) return;
    lang = code;
    try { localStorage.setItem(STORE_KEY, code); } catch (e) { /* same */ }
  }

  load();
  return {
    LANGS,
    t,
    tf,
    set,
    applyDom,
    domKeys,
    add(code, map) { Object.assign(dict[code], map); },
    has(code, key) { return dict[code][key] !== undefined; },
    value(code, key) { return dict[code][key]; },
    get lang() { return lang; },
    get info() { return LANGS[lang]; },
  };
})();
const _t = I18N.t;
const _tf = I18N.tf;
