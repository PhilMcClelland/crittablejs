/*! Crittable.js 0.3.0 · MIT · (c) 2026 Phil McClelland · https://github.com/PhilMcClelland/crittablejs */
// Crittable.js: attach notes to spots on a page.
(() => {
  'use strict';
  const OPTS = Object.assign({ tagName: 'pin-note-board', storagePrefix: 'crittable', anonymousName: 'Guest',
    maxNote: 1000, maxReply: 500, sidebarTitle: 'All notes', launcherLabel: 'Notes', productName: 'Crittable.js', gravatar: false,
    onEvent() {} }, window.CRITTABLE_CONFIG || {});
  /* The keys, each rebindable from the host's config: keys: { add, next, previous, back }. */
  const KEYS = Object.assign({ add: 'c', next: 'j', previous: 'k', back: 'Escape' }, OPTS.keys || {});
  const keyIs = (evt, name) => String(evt.key).toLowerCase() === String(KEYS[name]).toLowerCase();
  const isBack = evt => keyIs(evt, 'back');
  const keyCap = name => /^esc(ape)?$/i.test(KEYS[name]) ? 'Esc' : String(KEYS[name]).toUpperCase();
  const VERSION = '0.3.0';   // also in the first line of this file and in CHANGELOG.md
  const GUARD = '__' + OPTS.tagName;
  /* the product name, with a file extension (".js") split off so the lockup can set it quietly */
  const NAME = /^(.+?)(\.[a-z]{1,4})?$/i.exec(String(OPTS.productName)) || [0, String(OPTS.productName), ''];
  if (window[GUARD]) return;
  window[GUARD] = true;

  const PANEL_W = 320, GAP = 12, TRAY_SLOP = 24, PIN_SLOP = 5, PIN_SZ = 28;
  const calmMotion = () => !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches === true;
  const bound = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const ping = (type, detail) => { try { OPTS.onEvent(Object.assign({ type }, detail)); } catch (_) { /* hook errors never matter */ } };
  let seq = 0;
  const newKey = () => ['pw', (clock() + seq++).toString(36), (Math.random() * 1e9 | 0).toString(36)].join('-');
  const enc = JSON.stringify, dec = JSON.parse;
  const clock = () => +new Date();
  const pause = ms => new Promise(r => setTimeout(r, ms));

  /* ---------- storage ---------- */
  const Store = window.CrittableStore;
  /* storage: 'session' keeps notes and settings for this tab only (a page for trying the tool); the default is the browser's lasting storage */
  const store = OPTS.storage === 'session' ? Store.open(OPTS.storagePrefix, (() => { try { return window.sessionStorage; } catch (_) { return null; } })()) : Store.open(OPTS.storagePrefix);
  const shelf = { live: store.persistent, read: (n, d) => store.get(n, d), write: (n, v) => store.set(n, v) };
  const depot = OPTS.backend || {
    async load() { return shelf.read('threads', []); },
    async create(th) { const all = shelf.read('threads', []); all.push(th); shelf.write('threads', all); return th; },
    async update(id, patch) {
      const all = shelf.read('threads', []);
      const hit = all.find(x => x.id === id);
      if (!hit) throw new Error('missing');
      Object.assign(hit, patch);
      shelf.write('threads', all);
      return hit;
    },
    async remove(id) { shelf.write('threads', shelf.read('threads', []).filter(x => x.id !== id)); }
  };
  const handoff = {
    put(v) { try { sessionStorage[OPTS.storagePrefix + '.hint'] = enc(v); } catch (_) { /* no session storage */ } },
    take() {
      try {
        const raw = sessionStorage.getItem(OPTS.storagePrefix + '.hint');
        sessionStorage.removeItem(OPTS.storagePrefix + '.hint');
        return raw ? dec(raw) : null;
      } catch (_) { return null; }
    }
  };

  /* ---------- identity, routes, time ---------- */
  /* CRITTABLE_USER: { id, name, avatar? }. avatar is an image URL the host page supplies; without one, pins show initials. */
  const me = Object.assign({ id: 'anon', name: OPTS.anonymousName }, window.CRITTABLE_USER || {});
  /* A shared store (backend.shared) is one other people read and write too. Then "Guest" will not do: each browser gets
     its own id and a made-up name to write under straight away; the panel offers, quietly and for as long as it takes,
     to swap that for their own. Nothing stands between a person and their first note. A host page that already knows who is
     here says so with CRITTABLE_USER, and a store that signs people in answers whoami(). */
  const SHARED = !!(OPTS.backend && OPTS.backend.shared);
  /* a store may say this visitor can only read (backend.readOnly): they see every note and can open, search and step
     through them, and nothing that writes is offered. The store refuses a write as well; this is the manners. */
  const READ_ONLY = SHARED && !!OPTS.backend.readOnly;
  /* Every note and reply says which note format wrote it (`v`; none means 1). A shared store outlives any one copy of
     this script, so a note from a newer format is left out and left alone, never guessed at. */
  const FORMAT = 1;
  let toldNewer = false;
  const newer = x => {
    if (!x || (Number(x.v) || 1) <= FORMAT) return false;
    if (!toldNewer && window.console) { toldNewer = true; console.warn('Crittable.js: some notes were written by a newer version and are not shown. Update the script to see them.'); }
    return true;
  };
  /* What a shared store hands back was written by other people, and without a key by anyone at all. So a note is checked
     before the tool touches it: the right kinds of value, and a page address that is a page on this site. One that fails
     is left out, never repaired; nothing here is ever run, followed or put into the page as markup. */
  const samePage = route => {
    if (typeof route !== 'string' || route.length > 2000) return false;
    /* the same scheme and host as this page: that lets a prototype opened from a file keep working, and refuses
       javascript:, data: and any other site */
    try { const u = new URL(route, location.href); return /^(https?|file):$/.test(u.protocol) && u.protocol === location.protocol && u.host === location.host; } catch (_) { return false; }
  };
  const words = (v, most) => typeof v === 'string' && v.length <= most;
  /* A note's place is read on every frame, so every part of it is checked once, here. What can be put right is (a missing
     offset is 0, a bad spare or a bad selection is dropped); what cannot makes the note unsound. */
  /* a text anchor names the kind of element to read, and only the kinds the tool itself anchors by text: anything wider
     ("*") would have every reader's browser read the whole page for one note */
  const way = a => !!a && typeof a === 'object' && !Array.isArray(a) && words(a.k, 20) && words(a.v, 2000) && a.v.length > 0 &&
    (a.tag == null || (typeof a.tag === 'string' && LABELLED.has(a.tag.toUpperCase()))) && (a.k !== 'text' || a.tag != null);
  const whole = n => Number.isInteger(n) && n >= 0 && n <= 1e7;
  const soundPlace = a => {
    if (!way(a)) return false;
    for (const side of ['dx', 'dy']) { const n = Number(a[side]); a[side] = Number.isFinite(n) && Math.abs(n) <= 1e5 ? n : 0; }
    delete a.score;
    if (a.tag == null) delete a.tag;
    if (!words(a.was, 80)) delete a.was;
    if (Array.isArray(a.alt)) a.alt = a.alt.filter(way).slice(0, 8).map(s => (s.tag == null ? { k: s.k, v: s.v } : { k: s.k, v: s.v, tag: s.tag })); else delete a.alt;
    const s = a.sel;
    if (s && typeof s === 'object' && !Array.isArray(s) && words(s.text, 5000) && whole(s.from) && whole(s.to) && s.to >= s.from) {
      for (const side of ['ox', 'oy']) { const n = Number(s[side]); if (s[side] != null && Number.isFinite(n) && Math.abs(n) <= 1e5) s[side] = n; else delete s[side]; }
    } else delete a.sel;
    return true;
  };
  /* On a shared store a note's place can be changed by anyone, so a bad place must not cost the note: it stays in the
     list as one that cannot be located, and can be put back. (An id of "__proto__" cannot key the tool's own records.) */
  const NOWHERE = () => ({ k: 'css', v: ':not(*)', dx: 0, dy: 0 });
  const sound = th => !!th && typeof th === 'object' && words(th.id, 200) && th.id !== '' && th.id !== '__proto__' && words(th.text, 20000) && samePage(th.route) &&
    Number.isFinite(Number(th.created));
  const tidy = p => {   // a person's parts, on a note or a reply
    p.authorName = (typeof p.authorName === 'string' ? p.authorName.trim().slice(0, 80) : '') || OPTS.anonymousName;   // only ever a string: anything else could throw when read
    p.authorId = typeof p.authorId === 'string' || typeof p.authorId === 'number' ? String(p.authorId).slice(0, 200) : '';
    if (p.authorAvatar != null && typeof p.authorAvatar !== 'string') delete p.authorAvatar;
    return p;
  };
  const readable = list => (Array.isArray(list) ? list : []).filter(th => sound(th) && !newer(th)).map(th => {
    /* a time is the writer's to send, so none is believed past now (five minutes of slack for a clock that runs fast):
       a note dated next year would stay unread for everyone, for good */
    const soon = clock() + 3e5, held = (n, least) => { n = Number(n); return Number.isFinite(n) && n <= soon ? Math.max(least, n) : least; };
    /* (a time past that counts as no time at all, not as "now": "now" would be later on every load, and the note unread again each time) */
    tidy(th); if (!soundPlace(th.anchor)) th.anchor = NOWHERE(); th.created = Math.min(Number(th.created), soon); th.updated = held(th.updated, th.created); th.resolved = !!th.resolved;
    th.replies = (Array.isArray(th.replies) ? th.replies : []).filter(r => r && typeof r === 'object' && words(r.text, 20000) && !newer(r)).map(r => { tidy(r); if (r.at != null) r.at = held(r.at, 0); return r; });
    return th;
  });
  /* Made-up names: a word from the desk and a small animal, picked by the person's id, so the same browser is always the
     same character. Our own lists; every pairing is fit to show a client. */
  const DESK = ['Inky', 'Scribbling', 'Doodling', 'Pencilled', 'Dog-eared', 'Underlined', 'Dotted', 'Ruled', 'Bookish', 'Jotting',
    'Footnoted', 'Bold', 'Italic', 'Pinned', 'Folded', 'Stapled', 'Annotating', 'Margin', 'Highlighted', 'Careful'];
  const CRITTERS = ['Otter', 'Heron', 'Badger', 'Finch', 'Marten', 'Newt', 'Wren', 'Hare', 'Lynx', 'Vole', 'Robin', 'Moth',
    'Stoat', 'Gecko', 'Pika', 'Tern', 'Ibis', 'Quail', 'Puffin', 'Beetle', 'Magpie', 'Tapir', 'Dormouse', 'Hedgehog'];
  const aliasFor = id => { let n = 11; for (const ch of String(id)) n = (n * 33 + ch.charCodeAt(0)) >>> 0; return DESK[n % DESK.length] + ' ' + CRITTERS[(n >>> 8) % CRITTERS.length]; };
  me.alias = false;   // true while the person writes under a made-up name
  /* A board that is not shared works the same way: one way of being someone, whatever the store. There the name
     matters less (the notes stay in this browser), and costs nothing. */
  const NAMED = !window.CRITTABLE_USER;
  if (NAMED) {
    let own = shelf.read('whoId', null);
    if (!own) { own = newKey(); shelf.write('whoId', own); }
    me.id = own; me.name = String(shelf.read('whoName', '') || '').trim();
    if (!me.name) { me.name = aliasFor(own); me.alias = true; }
  }
  /* Gravatar lookup is off unless CRITTABLE_CONFIG.gravatar is true, because it makes every viewer's browser
     request an image from a third party. Only the SHA-256 of the address is used or stored, never the address:
     pass CRITTABLE_USER.emailHash to keep the address out of the page entirely, or CRITTABLE_USER.email to have it
     hashed here. d=404 makes a missing Gravatar fail to load, which leaves the initials showing. */
  const findGravatar = async () => {
    if (!OPTS.gravatar || me.avatar) return;
    let hex = typeof me.emailHash === 'string' && /^[0-9a-f]{64}$/i.test(me.emailHash.trim()) ? me.emailHash.trim().toLowerCase() : '';
    const sub = window.crypto && window.crypto.subtle;
    if (!hex && typeof me.email === 'string' && me.email.includes('@') && sub && window.TextEncoder) {
      const sum = await sub.digest('SHA-256', new TextEncoder().encode(me.email.trim().toLowerCase()));
      hex = Array.from(new Uint8Array(sum), b => b.toString(16).padStart(2, '0')).join('');
    }
    if (hex) me.avatar = 'https://gravatar.com/avatar/' + hex + '?s=80&d=404';
  };
  const tintFor = id => { let n = 7; for (const ch of String(id)) n = (n * 31 + ch.charCodeAt(0)) % 360; return n; };
  const lettersOf = name => (String(name).trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2) || '?').toUpperCase();
  const whereAmI = () => {
    const { pathname, search, hash } = location;
    const trimmed = /\/index\.html?$/.test(pathname) ? pathname.slice(0, pathname.lastIndexOf('/') + 1) : pathname;
    /* a hash route counts as part of the page; a share key riding in it (k=…, see backends/persistable) does not */
    const route = hash.replace(/([?&])k=[A-Za-z0-9_-]{16,200}(?=&|$)/, '$1').replace(/[?&]$/, '').replace('?&', '?');
    return (trimmed || '/') + search + (/^#[\/!]./.test(route) ? route : '');
  };
  const STEPS = [[36e5, 6e4, ' min ago'], [864e5, 36e5, ' h ago'], [12096e5, 864e5, ' d ago']];
  const since = (ts, long) => {
    if (long) return new Date(ts).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
    const gap = clock() - ts;
    if (gap < 6e4) return 'just now';
    for (const [limit, unit, tail] of STEPS) if (gap < limit) return Math.floor(gap / unit) + tail;
    return new Date(ts).toLocaleDateString();
  };

  /* ---------- tiny DOM builder ---------- */
  const build = (tag, attrs, ...kids) => {
    const node = document.createElement(String(tag));
    for (const [name, val] of Object.entries(attrs || {})) {
      if (val == null || val === false) continue;
      if (name === 'on') Object.entries(val).forEach(([evName, fn]) => node.addEventListener(evName, fn));
      else if (name === 'text') node.textContent = val;
      else node.setAttribute(name, val === true ? '' : val);
    }
    kids.flat().filter(k => k != null).forEach(k => node.append(k));
    return node;
  };
  const halt = evt => { evt.preventDefault(); evt.stopPropagation(); };

  /* ---------- anchors ---------- */
  const FLAKY = /(^|[-_])(hover|active|open|opened|focus|focused|selected|show|shown|visible|hidden|is-|has-)|\d{3,}|^css-|^sc-|^_|[a-z]_[A-Za-z0-9]{5,}$/i;
  const calmClasses = elm => [...elm.classList].filter(c => !FLAKY.test(c));
  const cssEsc = s => (typeof CSS !== 'undefined' && CSS.escape) ? CSS.escape(s) : String(s).replace(/\W/g, c => '\\' + c);
  const solo = css => {
    let n = 0;
    try { n = document.querySelectorAll(css).length; } catch (_) { n = 0; }
    return n === 1;
  };
  const LABELLED = new Set(['BUTTON', 'A', 'LABEL', 'SUMMARY', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'SPAN']);
  const VISUALS = new Set(['IMG', 'SVG', 'VIDEO', 'CANVAS', 'IFRAME', 'AUDIO', 'PICTURE']);
  const TEST_ATTRS = ['data-testid', 'data-test', 'data-qa', 'data-cy'];
  const withText = (tag, str) => [...document.getElementsByTagName(tag)].filter(n => n.textContent.trim() === str);

  const stepOf = elm => {
    const tag = elm.tagName.toLowerCase();
    const klass = calmClasses(elm).slice(0, 2).map(c => '.' + cssEsc(c)).join('');
    let seg = tag + klass;
    const sibs = elm.parentElement ? [...elm.parentElement.children].filter(n => n.tagName === elm.tagName) : [];
    if (!klass && sibs.length > 1) { const pos = sibs.indexOf(elm) + 1; seg = seg + ':nth-of-type(' + pos + ')'; }
    return seg;
  };
  /* every description that singles the element out right now; the first is the anchor, the rest are spares */
  const ladderOf = elm => {
    const rungs = [];
    const tag = elm.tagName.toUpperCase();
    if ([document.body, document.documentElement].includes(elm)) return [{ score: 1, v: 'body', k: 'css' }];
    if (elm.id && solo('#' + cssEsc(elm.id))) rungs.push({ k: 'css', v: '#' + cssEsc(elm.id), score: 10 });
    for (const c of calmClasses(elm)) {
      const css = '.' + cssEsc(c);
      if (solo(css)) { rungs.push({ k: 'css', v: css, score: 7 }); break; }
    }
    for (const dk of TEST_ATTRS) {
      const val = elm.getAttribute(dk);
      if (val && solo('[' + dk + '="' + val.replace(/"/g, '\\"') + '"]')) { rungs.push({ k: 'css', v: '[' + dk + '="' + val.replace(/"/g, '\\"') + '"]', score: 9 }); break; }
    }
    const label = String(elm.textContent || '').split(/\s+/).filter(Boolean).join(' ');
    if (LABELLED.has(tag) && label && label.length <= 60 && withText(elm.tagName, label).length === 1) {
      rungs.push({ k: 'text', tag: elm.tagName, v: label, score: ['BUTTON', 'A'].includes(tag) ? 8 : 6 });
    }
    if (VISUALS.has(tag)) {
      const bits = ['src', 'alt', 'aria-label', 'title'].map(a => [a, elm.getAttribute(a)]).filter(p => p[1]);
      for (const [a, val] of bits) {
        const css = elm.tagName.toLowerCase() + '[' + a + '="' + val.replace(/"/g, '\\"') + '"]';
        if (solo(css)) { rungs.push({ k: 'css', v: css, score: 6 }); break; }
      }
    }
    const trail = [];
    let cur = elm;
    for (let depth = 0; cur && cur !== document.body && depth < 5; depth++, cur = cur.parentElement) {
      trail.unshift(stepOf(cur));
      const path = trail.join(' > ');
      if (solo(path)) { rungs.push({ k: 'css', v: path, score: Math.max(2, 5 - depth) }); return rungs; }
    }
    if (!rungs.length) rungs.push({ k: 'css', v: (cur === document.body ? 'body > ' : '') + trail.join(' > '), score: 2 });
    return rungs;
  };
  const SPARES = 3;
  const FILLER = /^(no (items?|results?|data|notes?|entries)|nothing (here|to show)|empty)\b/i;
  /* A description that counts among siblings ("the second paragraph") matches the neighbour once its own element is
     gone. So such a place also keeps the first words of what it was put on, and is only believed while they still match:
     a row that says the pin cannot be located beats a pin on the wrong thing. */
  const POSITIONAL = /:nth-of-type\(/;
  const firstWords = elm => String(elm.textContent || '').slice(0, 400).split(/\s+/).filter(Boolean).join(' ').slice(0, 60);
  const seek = a => {
    let hit = seekOne(a);
    if (hit && typeof a.was === 'string' && POSITIONAL.test(a.v) && firstWords(hit) !== a.was) hit = null;
    return hit || (a.alt || []).filter(s => !POSITIONAL.test(s.v)).reduce((found, spare) => found || seekOne(spare), null);
  };
  const seekOne = a => {
    let hit = null;
    if (a.k === 'text') hit = withText(a.tag, a.v)[0] || null;
    else { try { hit = document.querySelector(a.v); } catch (_) { hit = null; } }
    if (hit && hit.textContent.trim().length < 40 && FILLER.test(hit.textContent.trim())) return null;
    return hit;
  };
  const spanOf = (host, from, to) => {
    const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
    let pos = 0, node, r = document.createRange(), started = false;
    while ((node = walker.nextNode())) {
      const len = node.nodeValue.length;
      if (!started && from <= pos + len) { r.setStart(node, from - pos); started = true; }
      if (started && to <= pos + len) { r.setEnd(node, to - pos); return r; }
      pos += len;
    }
    return null;
  };
  const grabSelection = host => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) return null;
    const rg = sel.getRangeAt(0);
    if (!host.contains(rg.commonAncestorContainer)) return null;
    const pre = document.createRange();
    pre.selectNodeContents(host);
    pre.setEnd(rg.startContainer, rg.startOffset);
    const from = pre.toString().length;
    return { text: sel.toString(), from, to: from + sel.toString().length };
  };
  const spanCache = new Map(); let spanGen = 0;
  const spanFor = (id, elm, sel) => {
    const c = spanCache.get(id);
    /* words that are no longer there are remembered as such, until the page changes (see the observer below) */
    if (c && c.elm === elm && c.sel === sel && (!c.rg || (c.rg.startContainer.isConnected && c.rg.endContainer.isConnected))) return c.rg;
    let rg = spanOf(elm, sel.from, sel.to); spanGen++;
    if (rg && rg.toString() !== sel.text) rg = null;
    spanCache.set(id, { elm, sel, rg });
    return rg;
  };
  const busyEl = elm => {
    if (!elm.getAnimations) return false;
    for (let n = elm; n; n = n.parentElement) if (n.getAnimations().some(a => a.playState === 'running')) return true;
    return false;
  };
  const dropAnchor = (elm, x, y) => {
    const field = elm.getBoundingClientRect();
    const [first, ...rest] = ladderOf(elm);
    const a = Object.assign(first, { dx: Math.round(x - field.left), dy: Math.round(y - field.top) });
    delete a.score;   // how the description was chosen, not part of the place
    if (POSITIONAL.test(a.v)) a.was = firstWords(elm);
    const sure = rest.filter(r => !POSITIONAL.test(r.v));
    if (sure.length) a.alt = sure.slice(0, SPARES).map(r => r.tag ? { k: r.k, v: r.v, tag: r.tag } : { k: r.k, v: r.v });
    const picked = grabSelection(elm);
    if (picked) {
      /* the pin goes where it was dropped, kept as a distance from the start of the words, so it moves with them */
      const lead = window.getSelection().getRangeAt(0).getClientRects()[0];
      if (lead) { picked.ox = Math.round(x - lead.left); picked.oy = Math.round(y - lead.top); }
      a.sel = picked;
    }
    return a;
  };

  /* ---------- state ---------- */
  const bare = () => Object.create(null);   // a record keyed by a note's id: an id may be "toString"
  const W = {
    threads: [], seen: shelf.read('seen', {}), route: whereAmI(), placing: false, showPins: shelf.read('showPins', true),
    showResolved: shelf.read('showResolved', false), sort: shelf.read('sort', 'new'), query: '',
    side: shelf.read('side', 'right'), sideOpen: false, draft: null, openId: null, selected: null,
    status: bare(), tries: bare(), tried: bare(), lostAt: bare(), rounds: bare(), stale: bare(), moving: null, notice: '', theme: shelf.read('theme', OPTS.theme || 'auto'), loading: true
  };
  const memoEl = new Map(), seenMemo = new Map(), pinMap = new Map(), inFlight = new Set();
  /* every pin asks for its note on every frame, so notes are found by id in a map, made again when the list changes */
  let byList = null, bySize = -1, byId = new Map();
  const lookup = id => {
    if (byList !== W.threads || bySize !== W.threads.length) { byList = W.threads; bySize = byList.length; byId = new Map(byList.map(th => [th.id, th])); }
    return byId.get(id);
  };
  /* the state sheet draws specimens with the product's own builders; `spec` stands in for the store while it does */
  let spec = null;
  /* a note's number is its place in order of writing; worked out once for a list, since every pin and row asks */
  let ordList = null, ordSize = -1, ordMap = new Map();
  const ordinal = id => {
    if (spec && spec.id === id) return spec.n;
    if (ordList !== W.threads || ordSize !== W.threads.length) {
      ordList = W.threads; ordSize = ordList.length;
      ordMap = new Map([...ordList].sort((a, b) => a.created - b.created).map((th, i) => [th.id, i + 1]));
    }
    return ordMap.get(id) || 0;
  };
  const isFresh = th => spec && spec.id === th.id ? !!spec.fresh : !(W.seen[th.id] >= th.updated);
  const logSeen = (...ids) => {
    const stamp = clock();
    /* never earlier than the note's own time: a writer whose clock runs ahead would otherwise leave a dot that cannot be cleared */
    ids.forEach(id => { const th = lookup(id); W.seen[id] = Math.max(stamp, th ? th.updated || 0 : 0); });
    shelf.write('seen', W.seen);
  };
  const markUnread = id => {
    if (!lookup(id) || isFresh(lookup(id))) return;
    delete W.seen[id];
    shelf.write('seen', W.seen);
    if (W.openId === id) shutThread();
    refreshPins(); scheduleList(); announce('Marked as unread');
  };

  /* ---------- design tokens (spec/DESIGN.md) ---------- */
  /* Colour roles per theme. Every colour the tool paints comes from here; components only use var(--cm-*). */
  const TOKENS = {
    light: {
      base: '#f6f6f9', raised: '#ffffff', hover: 'rgba(24,22,48,.06)', overlay: '#ffffff', input: '#ffffff', strip: '#efeff4',
      selected: 'rgba(255,216,58,.42)', 'accent-wash': 'rgba(255,216,58,.30)', halo: 'rgba(255,216,58,.55)',
      text: '#17161f', 'text-author': '#2a2935', 'text-body': '#3a3c4a', 'text-meta': '#5c6072', 'text-hint': '#676b7d',
      'border-hair': 'rgba(24,22,48,.10)', border: 'rgba(24,22,48,.18)', 'border-emph': 'rgba(24,22,48,.47)', 'control-edge': '#17161f',
      accent: '#ffd83a', 'accent-ink': '#17161f', 'accent-deep': '#f2c200', 'on-accent': '#17161f', 'accent-edge': '#17161f', focus: '#17161f', 'card-edge': 'rgba(24,22,48,.60)',
      ok: '#1d8448', warn: '#a8480c', err: '#bf2539', 'on-err': '#ffffff', info: '#2a68c8', neutral: '#566780', done: '#1d8448', 'on-done': '#ffffff',
      'send-off': '#dfdfe6', 'send-off-ink': '#8b8e9d', 'dock-edge': 'rgba(24,22,48,.10)', shade: '24,22,48', 'shade-a': '.10',
      /* a face in a card or the panel: the same wash and deep shade as in a pin */
      'face-0': '#a2c2cb', 'face-0-ink': '#033843', 'face-1': '#e8acc5', 'face-1-ink': '#5f153d', 'face-2': '#a7bdf5', 'face-2-ink': '#1a2c72', 'face-3': '#a6c6ae', 'face-3-ink': '#0d3d21', 'face-4': '#c6aedd', 'face-4-ink': '#3d1c56', 'face-5': '#edaea8', 'face-5-ink': '#641717'
    },
    dark: {
      base: '#121218', raised: '#1c1c25', hover: '#282832', overlay: '#16161d', input: '#0d0d12', strip: '#1a1a22',
      selected: 'rgba(255,216,58,.16)', 'accent-wash': 'rgba(255,216,58,.12)', halo: 'rgba(255,216,58,.30)',
      text: '#f3f3f8', 'text-author': '#dedee8', 'text-body': '#c6c8d5', 'text-meta': '#9a9eb0', 'text-hint': '#8d91a3',
      'border-hair': 'rgba(255,255,255,.07)', border: 'rgba(255,255,255,.13)', 'border-emph': 'rgba(255,255,255,.34)', 'control-edge': 'rgba(255,255,255,.13)',
      accent: '#ffd83a', 'accent-ink': '#ffd83a', 'accent-deep': '#ffe36e', 'on-accent': '#15151b', 'accent-edge': 'transparent', focus: '#ffd83a', 'card-edge': 'rgba(255,255,255,.34)',
      ok: '#3fcf7f', warn: '#ff9d57', err: '#ff6b7e', 'on-err': '#15151b', info: '#5ca4ff', neutral: '#8a99b0', done: '#d8dae2', 'on-done': '#15151b',
      'send-off': '#2b2b35', 'send-off-ink': '#6c6f7e', 'dock-edge': 'transparent', shade: '0,0,0', 'shade-a': '.42',
      /* reversed in dark: a dusk of the colour, initials in its pale wash */
      'face-0': '#1b3b47', 'face-0-ink': '#cedfe3', 'face-1': '#5a2542', 'face-1-ink': '#f4d3e0', 'face-2': '#24336a', 'face-2-ink': '#d0dcfb', 'face-3': '#1f3f2e', 'face-3-ink': '#d0e1d4', 'face-4': '#3f2855', 'face-4-ink': '#e1d4ed', 'face-5': '#5e2728', 'face-5-ink': '#f7d5d1'
    }
  };
  /* Theme-independent tokens: avatar palette, spacing, radii, type, elevation recipes, motion. */
  const SCALE = {
    /* a face in a pin: a pale wash of the person's colour, initials in its deep shade. On the host page, so it does not theme. */
    'av-0': '#a2c2cb', 'av-0-ink': '#033843', 'av-1': '#e8acc5', 'av-1-ink': '#5f153d', 'av-2': '#a7bdf5', 'av-2-ink': '#1a2c72', 'av-3': '#a6c6ae', 'av-3-ink': '#0d3d21', 'av-4': '#c6aedd', 'av-4-ink': '#3d1c56', 'av-5': '#edaea8', 'av-5-ink': '#641717',
    /* pins and the launcher sit on the host page, so their colours are fixed and never follow the theme */
    'pin-ink': '#15171c', 'pin-paper': '#ffffff', 'pin-ring': 'rgba(255,255,255,.75)', 'pin-wash': 'rgba(255,216,58,.34)', 'pin-drop': '0 2px 5px rgba(0,0,0,.28)', 'pin-lift': '0 8px 20px rgba(0,0,0,.32)',
    s1: '4px', s2: '8px', s3: '12px', s4: '16px', s5: '20px', s6: '24px',
    'r-sm': '6px', 'r-md': '8px', 'r-lg': '14px', 'r-tip': '3px', 'r-full': '999px',
    font: 'system-ui,-apple-system,"Segoe UI",Roboto,sans-serif', 'fs-face': '10px', 'fs-meta': '12px', 'fs-body': '14px', 'fs-head': '14px', 'fs-type': '16px',
    'fw-regular': '400', 'fw-strong': '600', lh: '1.45',
    'elev-1': '0 1px 2px rgba(var(--cm-shade),calc(var(--cm-shade-a)*1)),0 1px 4px rgba(var(--cm-shade),calc(var(--cm-shade-a)*.8))',
    'elev-2': '0 4px 14px rgba(var(--cm-shade),calc(var(--cm-shade-a)*1.4)),0 1px 3px rgba(var(--cm-shade),var(--cm-shade-a))',
    'elev-3': '0 12px 32px rgba(var(--cm-shade),calc(var(--cm-shade-a)*1.8)),0 2px 6px rgba(var(--cm-shade),var(--cm-shade-a))',
    'elev-edge': '0 0 24px rgba(var(--cm-shade),calc(var(--cm-shade-a)*1.6))',
    'z-dock': '900', 'z-card': '1000', 'z-panel': '1100', 'z-banner': '1200',
    fast: '.15s', medium: '.3s', linger: '.8s', instant: '0s',
    ease: 'cubic-bezier(.2,.7,.3,1)',
    /* the mark's own motion, and the one signature. Nothing but the mark, and a pin being planted, may use these. */
    'mark-blink': '.36s', 'mark-nod': '.3s', 'mark-shut': 'cubic-bezier(.4,0,.9,.6)', 'mark-open': 'cubic-bezier(.1,.8,.3,1)', plant: '.26s'
  };
  const vars = obj => Object.entries(obj).map(([k, v]) => '--cm-' + k + ':' + v + ';').join('');
  const AVATARS = 6;
  const ICON = {
    /* the empty panel's mark is the pin itself, eyes and all: round, with the one sharp corner that points at its spot */
    bubble: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20v-8a8 8 0 1 1 8 8zM10 10.5v3M14 10.5v3"/></svg>',
    list: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M5 12h14M5 17h9"/></svg>',
    send: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12 20 4l-4 16-4-6.5zM12 13.5 20 4"/></svg>',
    more: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18" cy="12" r="1.3"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17"/></svg>',
    filter: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4"/></svg>',
    search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/></svg>',
    unread: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.5"/></svg>',
    swap: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 9h13l-3-3M19 15H6l3 3"/></svg>',
    plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    pencil: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20l1-4.5L16.5 4a1.8 1.8 0 0 1 2.5 0l1 1a1.8 1.8 0 0 1 0 2.5L8.5 19zM14.5 6l3.5 3.5"/></svg>',
    sun: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/></svg>',
    moon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.2A8.2 8.2 0 0 1 9.8 4 8.2 8.2 0 1 0 20 14.2z"/></svg>',
    screen: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="11.5" rx="1.5"/><path d="M9 20h6M12 16.5V20"/></svg>',
    tick: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5.5 12.5 4.2 4.2 8.8-9.4"/></svg>'
  };
  /* the mark's two eyes (the pin is a critter, and it is looking at the page): plain boxes sized in parts of the mark, so they scale with it and can change shape (see LAUNCHER.Armed) */
  const eyes = () => { const s = document.createElement('span'); s.className = 'eyes'; s.setAttribute('aria-hidden', 'true'); s.append(document.createElement('i'), document.createElement('i')); return s; };
  const icon = name => { const s = document.createElement('span'); s.className = 'ic'; s.innerHTML = ICON[name]; return s; };

  /* ---------- shell: shadow host and styles ---------- */
  const SKIN = `
:host{${vars(TOKENS.light)}${vars(SCALE)}--pin-half:${PIN_SZ / 2}px;--pin-d:32px;--panel:${PANEL_W}px;color-scheme:light;all:initial}
:host([data-theme=dark]){${vars(TOKENS.dark)}color-scheme:dark}
@media (prefers-color-scheme:dark){:host(:not([data-theme=light])){${vars(TOKENS.dark)}color-scheme:dark}}
*{box-sizing:border-box;font-family:var(--cm-font);font-size:var(--cm-fs-body);line-height:var(--cm-lh);font-weight:var(--cm-fw-regular)}
button{cursor:pointer;color:inherit}
b,strong,h2,h3{font-weight:var(--cm-fw-strong)}
:focus-visible,.is-focus{outline:2px solid var(--cm-focus);outline-offset:2px}
.sr{overflow:hidden;position:absolute;height:1px;width:1px;clip:rect(0 0 0 0)}
.eyes{position:absolute;inset:0;display:block;color:var(--cm-pin-ink);pointer-events:none;transform-origin:50% 49.5%}
.eyes i{position:absolute;left:40%;top:49.5%;width:15.5%;height:27.3%;translate:-50% -50%;border-radius:var(--cm-r-full);background:currentColor;
  transition:left var(--cm-medium) var(--cm-ease),top var(--cm-medium) var(--cm-ease),width var(--cm-medium) var(--cm-ease),height var(--cm-medium) var(--cm-ease),rotate var(--cm-medium) var(--cm-ease),background-color var(--cm-fast) var(--cm-ease)}
.eyes i+i{left:66.4%}
/* the blink closes straight down: the pills flatten and widen a little, rest shut for a beat, then open hard and settle. Nothing swaps and nothing turns. */
@keyframes cm-blink{from{animation-timing-function:var(--cm-mark-shut)}34%,50%{transform:scaleY(.2);animation-timing-function:var(--cm-mark-open)}}
.ic{display:inline-grid;place-items:center;width:1.25em;height:1.25em;flex:none}
.ic svg{width:100%;height:100%;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}

/* LAUNCHER */
.dock{z-index:var(--cm-z-dock);gap:var(--cm-s2);position:fixed;left:0;top:0;display:flex;pointer-events:auto;transition:transform var(--cm-medium) var(--cm-ease)}
.dock.dragging{transition:none}
.dock.dragging button{cursor:grabbing;box-shadow:0 0 0 1.5px var(--cm-pin-ring),var(--cm-pin-lift);transition:none}
.dock.still{transition:none}
.dock.is-hidden{display:none}
.dock button{position:relative;width:44px;height:44px;border-radius:var(--cm-r-full);display:grid;place-items:center;font-size:20px;
  background:var(--cm-accent);color:var(--cm-pin-ink);border:1.5px solid var(--cm-pin-ink);box-shadow:0 0 0 1.5px var(--cm-pin-ring),var(--cm-pin-drop);
  transition:translate var(--cm-fast) var(--cm-ease),box-shadow var(--cm-fast) var(--cm-ease),background-color var(--cm-fast) var(--cm-ease),color var(--cm-fast) var(--cm-ease)}
.dock button:first-child{border-radius:50% 50% 50% var(--cm-r-tip)}
.dock button:hover,.dock button.is-hover{translate:0 -2px;box-shadow:0 0 0 1.5px var(--cm-pin-ring),var(--cm-pin-lift)}
.dock button:active,.dock button.is-pressed{translate:0 1px}
/* at rest the launcher is the mark: the highlighter pin, with nothing in it. While a note is being placed the yellow is on the pointer, so the button turns to ink and offers the way out. */
.dock .on,.dock .on:hover,.dock .on.is-hover{background:var(--cm-pin-ink);color:var(--cm-pin-paper)}
/* LAUNCHER.Armed: the eyes slide together, stretch and cross into the way out. One face, two looks; nothing is swapped. */
.dock .on .eyes{color:var(--cm-pin-paper)}
.dock .on .eyes i{left:50%;top:50%;width:9.5%;height:45%;rotate:45deg}
.dock .on .eyes i+i{rotate:-45deg}
/* the one playful touch: the mark blinks once when the pointer arrives */
.dock button:not(.on):hover .eyes,.dock button.is-hover:not(.on) .eyes{animation:cm-blink var(--cm-mark-blink)}

/* quiet error line / banner (EMPTY.StorageFailed) */
.note-banner{z-index:var(--cm-z-banner);position:fixed;top:var(--cm-s3);left:var(--cm-s3);max-width:320px;pointer-events:auto;padding:var(--cm-s2) var(--cm-s3);
  background:var(--cm-pin-ink);color:var(--cm-pin-paper);border:0;
  border-radius:var(--cm-r-md);box-shadow:0 0 0 1px var(--cm-pin-ring),var(--cm-pin-drop);animation:cm-fade var(--cm-fast) var(--cm-ease)}
.err{color:var(--cm-err);font-size:var(--cm-fs-meta);font-weight:var(--cm-fw-strong)}
.err:empty{display:none}

/* PIN */
.pin{position:fixed;left:0;top:0;width:var(--pin-d);height:var(--pin-d);margin:calc(var(--pin-half) - var(--pin-d)) 0 0 var(--pin-half);padding:0;
  touch-action:none;pointer-events:auto;display:grid;place-items:center;
  border-radius:50% 50% 50% var(--cm-r-tip);border:1.5px solid var(--cm-pin-ink);background:var(--cm-accent);color:var(--cm-pin-ink);font-size:16px;
  box-shadow:0 0 0 1px var(--cm-pin-ring),var(--cm-pin-drop);
  transition:translate var(--cm-fast) var(--cm-ease),opacity var(--cm-fast) var(--cm-ease),background-color var(--cm-fast) var(--cm-ease),box-shadow var(--cm-fast) var(--cm-ease)}
.pin .face{width:calc(var(--pin-d) - 9px);height:calc(var(--pin-d) - 9px);pointer-events:none;background:var(--av);color:var(--av-ink)}
.pin:hover,.pin.is-hover,.pin.hot{translate:0 -2px}
.pin.hot{box-shadow:0 0 0 3px var(--cm-accent),0 0 0 4.5px var(--cm-pin-ink)}
.pin[aria-expanded=true]{background:var(--cm-pin-ink);box-shadow:0 0 0 3px var(--cm-accent),0 0 0 4.5px var(--cm-pin-ink)}
.pin.lifted{translate:0 -4px;cursor:grabbing;box-shadow:0 0 0 1px var(--cm-pin-ring),var(--cm-pin-lift)}
.pin.done{background:var(--cm-pin-paper);opacity:.72}
.pin.done .face{filter:grayscale(1)}
/* the resolved check is a real element after the face, so it paints above it, and a drawn glyph, so it centres */
.pin .ok{position:absolute;z-index:1;bottom:-5px;right:-5px;width:14px;height:14px;display:grid;place-items:center;border-radius:var(--cm-r-full);background:var(--cm-pin-ink);color:var(--cm-pin-paper);border:1.5px solid var(--cm-pin-paper);pointer-events:none}
.pin .ok .ic{width:9px;height:9px}
.pin .ok svg{stroke-width:3}
.pin.rider .ok{display:none}
.pin[data-unread]::after{content:"";position:absolute;top:-5px;right:-5px;width:10px;height:10px;border-radius:var(--cm-r-full);
  background:var(--cm-pin-ink);border:2px solid var(--cm-pin-paper);transition:opacity var(--cm-fast) var(--cm-ease)}
.pin.draft{background:var(--cm-pin-paper);border-style:dashed;animation:cm-plant var(--cm-plant) var(--cm-ease)}
.pin.glide{transition:transform var(--cm-medium) var(--cm-ease)}
/* a pin riding its bubble: the bubble carries the pin's shape now, so the pin is only the avatar, above the card */
.bubble,.pin{--morph:calc(var(--cm-medium)*.8)}
.pin.rider,.pin.rider:hover,.pin.rider.hot,.pin.rider[aria-expanded=true]{background:transparent;border-color:transparent;box-shadow:none;opacity:1;
  z-index:calc(var(--cm-z-card) + 1)!important;transition:translate var(--morph) var(--cm-ease)}
/* only the avatar travels: the pin's outline and point never leave the anchor, so keyboard focus rings the whole note instead */
.pin.rider:focus-visible{outline:none}
.pin.rider:focus-visible~.bubble{outline:2px solid var(--cm-focus);outline-offset:2px}
.pin.rider::before,.pin.rider::after{display:none}
/* the wash on a target: the highlighter laid over the thing a note is, or would be, pinned to. It is ours, so the host element is never touched. */
.wash{position:fixed;left:0;top:0;pointer-events:none;background:var(--cm-pin-wash);border-radius:var(--cm-r-sm);opacity:0;transition:opacity var(--cm-fast) var(--cm-ease)}
.wash.on{opacity:var(--wash-k,1)}
.wash.hop{transition:opacity var(--cm-fast) var(--cm-ease),transform var(--cm-fast) var(--cm-ease),width var(--cm-fast) var(--cm-ease),height var(--cm-fast) var(--cm-ease),border-radius var(--cm-fast) var(--cm-ease)}
@keyframes cm-plant{from{translate:4px -16px;opacity:0}70%{translate:0 1.5px}}

/* cards: shared shell */
.card{z-index:var(--cm-z-card);position:fixed;pointer-events:auto;background:var(--cm-raised);color:var(--cm-text);border:1px solid var(--cm-card-edge);
  border-radius:var(--cm-r-lg) var(--cm-r-lg) var(--cm-r-lg) var(--cm-r-tip);box-shadow:var(--cm-elev-3);padding:var(--cm-s3)}
.card[data-tip=tl]{border-radius:var(--cm-r-tip) var(--cm-r-lg) var(--cm-r-lg) var(--cm-r-lg)}
.card[data-tip=tr]{border-radius:var(--cm-r-lg) var(--cm-r-tip) var(--cm-r-lg) var(--cm-r-lg)}
.card[data-tip=br]{border-radius:var(--cm-r-lg) var(--cm-r-lg) var(--cm-r-tip) var(--cm-r-lg)}
/* BUBBLE: one object per note. At rest it is the pin; on hover it grows into the preview; on click, into the thread.
   The sharp corner stays on the anchor and the avatar rides the top edge. Width and height are real, so nothing is revealed or swapped. */
.bubble{z-index:var(--cm-z-card);position:fixed;left:0;top:0;pointer-events:auto;background:var(--cm-raised);color:var(--cm-text);
  border:1px solid var(--cm-card-edge);border-radius:var(--cm-r-lg) var(--cm-r-lg) var(--cm-r-lg) var(--cm-r-tip);box-shadow:var(--cm-elev-3);
  transition:width var(--morph) var(--cm-ease),height var(--morph) var(--cm-ease),border-radius var(--morph) var(--cm-ease),
    background-color var(--morph) var(--cm-ease),border-color var(--morph) var(--cm-ease),box-shadow var(--morph) var(--cm-ease)}
.bubble[data-mode=peek]{box-shadow:var(--cm-elev-2);cursor:pointer}
.bubble[data-tip=tl]{border-radius:var(--cm-r-tip) var(--cm-r-lg) var(--cm-r-lg) var(--cm-r-lg)}
.bubble[data-tip=tr]{border-radius:var(--cm-r-lg) var(--cm-r-tip) var(--cm-r-lg) var(--cm-r-lg)}
.bubble[data-tip=br]{border-radius:var(--cm-r-lg) var(--cm-r-lg) var(--cm-r-tip) var(--cm-r-lg)}
.bubble.morphing{overflow:hidden}
.bubble.bud{border:1.5px solid var(--cm-pin-ink);box-shadow:0 0 0 1px var(--cm-pin-ring),var(--cm-pin-drop);
  border-radius:calc(var(--pin-d)/2) calc(var(--pin-d)/2) calc(var(--pin-d)/2) var(--cm-r-tip)}
/* the highlighter never spreads: it is a pin-sized patch that stays on the point and fades there, while the paper grows out around it.
   Folding back, it returns only as the bubble reaches pin size again. */
.bubble::before{content:"";position:absolute;left:0;bottom:0;width:calc(var(--pin-d) - 3px);height:calc(var(--pin-d) - 3px);pointer-events:none;
  border-radius:calc(var(--pin-d)/2) calc(var(--pin-d)/2) calc(var(--pin-d)/2) calc(var(--cm-r-tip) - 1.5px);background:var(--cm-accent);opacity:0;
  transition:opacity var(--cm-fast) var(--cm-ease)}
.bubble[data-tip$=r]::before{left:auto;right:0}
.bubble[data-tip^=t]::before{bottom:auto;top:0}
.bubble.bud::before{opacity:1;transition-delay:calc(var(--morph) - var(--cm-fast))}
.bubble.done::before{background:var(--cm-pin-paper)}
.bubble>.card{position:absolute;left:0;top:0;right:auto;bottom:auto;border:0;background:none;box-shadow:none;border-radius:0;animation:none!important;z-index:auto;
  transition:transform var(--morph) var(--cm-ease),opacity var(--cm-fast) var(--cm-ease)}
.bubble.bud>.card{opacity:0}
/* the riding pin stands in for the first avatar, which only keeps its seat */
.bubble .peek .lead>.face,.bubble .msg:not(.reply)>.face{visibility:hidden}
/* the preview is the thread's first message over the thread's own reply row, so a click only adds what sits between them */
.peek{width:312px;padding:0}
.peek .lead{display:flex;gap:var(--cm-s2);padding:var(--cm-s3)}
.peek .txt{min-width:0;flex:1}
.peek .compose{padding:var(--cm-s2) var(--cm-s3) var(--cm-s3);border-top:1px solid var(--cm-border-hair)}
.peek .compose *{pointer-events:none}
.peek .mock{flex:1;min-height:32px;padding:6px var(--cm-s2);background:var(--cm-input);color:var(--cm-text-hint);border:1px solid var(--cm-border);border-radius:var(--cm-r-sm)}
.peek .body{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden}
@keyframes cm-fade{from{opacity:0}}
.who{display:flex;align-items:center;gap:var(--cm-s2);min-width:0}
.who b{color:var(--cm-text-author);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.who time,.meta{font-size:var(--cm-fs-meta);color:var(--cm-text-meta)}
.face{width:26px;height:26px;border-radius:var(--cm-r-full);display:grid;place-items:center;flex:none;background:var(--face);color:var(--face-ink);
  font-size:var(--cm-fs-face);font-weight:var(--cm-fw-strong);position:relative;overflow:hidden}
.face img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.body{color:var(--cm-text-body);overflow-wrap:anywhere;white-space:pre-wrap}

/* CARD (thread card) */
.thread{width:312px;max-height:min(72vh,520px);display:flex;flex-direction:column;padding:0;
  animation:cm-fade var(--cm-fast) var(--cm-ease)}
.thread.steady{animation:none}
/* CARD.Adrift: the pin has nowhere to be on this page, so the note is a dialog: centred, no sharp corner (there is no anchor to
   point at), the page dimmed behind it by the card's own spread shadow */
.thread.adrift{z-index:calc(var(--cm-z-panel) + 1);top:0;bottom:0;margin:auto;height:fit-content;border-radius:var(--cm-r-lg);animation:cm-fade var(--cm-fast) var(--cm-ease);
  box-shadow:var(--cm-elev-3),0 0 0 200vmax color-mix(in srgb,var(--cm-pin-ink) 38%,transparent)}
.thread.adrift.steady{animation:none}
.thread.is-sheet{border-radius:var(--cm-r-lg)!important;width:340px;max-height:60vh}
.thread.adrift.leaving{animation:cm-fade var(--cm-fast) var(--cm-ease) reverse forwards}
.adrift-why{margin:0 var(--cm-s3) var(--cm-s2);padding:var(--cm-s1) var(--cm-s2);border-radius:var(--cm-r-sm);background:var(--cm-strip);
  color:var(--cm-text-meta);font-size:var(--cm-fs-meta)}
.thread.leaving{animation:cm-fade-out var(--cm-fast) var(--cm-ease) forwards;pointer-events:none}
@keyframes cm-fade-out{to{opacity:0}}
.thread>header{display:flex;align-items:center;gap:var(--cm-s1);padding:var(--cm-s2) var(--cm-s2) var(--cm-s1) var(--cm-s3);position:relative}
.thread>header h2{flex:1;min-width:0;margin:0;font-size:var(--cm-fs-head);color:var(--cm-text)}
.thread>header h2.q{flex:0 1 auto;margin-right:auto;padding:0 2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
  background:linear-gradient(var(--cm-selected),var(--cm-selected)) no-repeat 0 62%/100% 58%}
.thread:focus{outline:none}
.tb{display:inline-flex;align-items:center;gap:var(--cm-s1);height:28px;padding:0 var(--cm-s2);flex:none;border:1px solid var(--cm-control-edge);border-radius:var(--cm-r-md);
  background:transparent;color:var(--cm-text);font-size:var(--cm-fs-meta);font-weight:var(--cm-fw-strong);white-space:nowrap;
  transition:background-color var(--cm-fast) var(--cm-ease)}
.tb *{font-size:inherit;font-weight:inherit}
.tb:hover,.tb.is-hover{background:var(--cm-hover)}
.tb:disabled{opacity:.4;cursor:default}
.tb[aria-pressed=true]{color:var(--cm-text-meta)}
.toast{z-index:var(--cm-z-banner);position:fixed;left:50%;bottom:var(--cm-s5);translate:-50% 0;display:flex;align-items:center;gap:var(--cm-s3);pointer-events:auto;
  padding:var(--cm-s2) var(--cm-s2) var(--cm-s2) var(--cm-s4);border-radius:var(--cm-r-md);background:var(--cm-pin-ink);color:var(--cm-pin-paper);
  box-shadow:0 0 0 1px var(--cm-pin-ring),var(--cm-pin-lift);white-space:nowrap;animation:cm-fade var(--cm-fast) var(--cm-ease)}
.toast button{border:0;border-radius:var(--cm-r-sm);padding:var(--cm-s1) var(--cm-s2);background:var(--cm-accent);color:var(--cm-pin-ink);font-weight:var(--cm-fw-strong)}
.icb{width:28px;height:28px;padding:0;display:grid;place-items:center;border:0;border-radius:var(--cm-r-sm);background:transparent;color:var(--cm-text-meta);
  font-size:16px;transition:background-color var(--cm-fast) var(--cm-ease),color var(--cm-fast) var(--cm-ease)}
.icb:hover,.icb.is-hover{background:var(--cm-hover);color:var(--cm-text)}
.icb[aria-expanded=true]{background:var(--cm-accent-wash);color:var(--cm-accent-ink)}
.icb:disabled{opacity:.4;cursor:default}
.msgs{flex:1;overflow:auto;padding:var(--cm-s1) var(--cm-s3) var(--cm-s3);display:flex;flex-direction:column;gap:var(--cm-s3);
  scrollbar-width:thin;scrollbar-color:transparent transparent}
.msgs:hover{scrollbar-color:var(--cm-border-emph) transparent}
.msg{display:flex;gap:var(--cm-s2);align-items:flex-start}
.msg>.col{flex:1;min-width:0}
/* threads are flat, so every message and the reply row share one avatar column and one text column */
.msg.reply{animation:cm-fade var(--cm-fast) var(--cm-ease)}
.msg .acts{margin-left:auto;display:flex;gap:var(--cm-s2);opacity:0;transition:opacity var(--cm-fast) var(--cm-ease)}
.msg:hover .acts,.msg:focus-within .acts{opacity:1}
@media (hover:none){.msg .acts{opacity:1}}
.thread .compose .face,.peek .compose .face{width:26px;height:26px;margin-bottom:3px}
.confirm{border:1px solid var(--cm-border);border-radius:var(--cm-r-md);padding:var(--cm-s2) var(--cm-s3);background:var(--cm-strip)}
.confirm p{margin:0 0 var(--cm-s2);color:var(--cm-text)}
.thread.resolved .msgs .body{color:var(--cm-text-meta)}

/* MENU (filter, more, card more-options) */
.menu{position:absolute;top:calc(100% + var(--cm-s1));right:0;z-index:3;min-width:184px;padding:6px;
  background:var(--cm-overlay);color:var(--cm-text);border:1px solid var(--cm-border);border-radius:var(--cm-r-lg);box-shadow:var(--cm-elev-3);
  animation:cm-drop var(--cm-medium) var(--cm-ease)}
.menu[hidden]{display:none}
@keyframes cm-drop{from{opacity:0;transform:translateY(-4px)}}
.menu label,.menu button{display:flex;align-items:center;gap:var(--cm-s2);width:100%;text-align:left;padding:6px var(--cm-s2);
  border:0;border-radius:var(--cm-r-md);background:transparent;color:var(--cm-text);cursor:pointer;
  transition:background-color var(--cm-fast) var(--cm-ease)}
.menu label:hover,.menu button:hover,.menu label:focus-within,.menu .is-hover{background:var(--cm-hover)}
.menu [role=menuitemradio][aria-checked=true]{background:var(--cm-accent-wash)}
.menu [aria-disabled=true],.menu button:disabled{opacity:.45;cursor:default;background:transparent}
.menu hr{border:0;border-top:1px solid var(--cm-border-hair);margin:var(--cm-s1) 0}
.menu .cap{font-size:var(--cm-fs-meta);color:var(--cm-text-meta);padding:var(--cm-s2) var(--cm-s2) 2px}
.menu .cap:first-child{padding-top:var(--cm-s1)}
.menu .cap.why{padding:var(--cm-s1) var(--cm-s2) var(--cm-s1);max-width:200px}
/* where a menu has boxes and dots, plain actions start on the same text edge as the labels */
.menu:has(input)>button:not(:has(.sky)){padding-left:calc(14px + var(--cm-s2)*2)}
.menu kbd,.menu .val{margin-left:auto;font:inherit;font-size:var(--cm-fs-meta);color:var(--cm-text-meta)}
/* MENU.Theme: one row that steps light, dark, match system. Its sign sets like the sun and the next one rises: the old one drops
   straight down and the new one comes straight up, inside a box that hides whatever is under the horizon. */
.sky{position:relative;display:block;flex:none;width:16px;height:16px;margin:0 -1px;overflow:hidden}
.sky .ic{position:absolute;inset:0;width:auto;height:auto}
.sky .set{animation:cm-set var(--cm-medium) var(--cm-ease) forwards}
.sky .rise{animation:cm-rise var(--cm-medium) var(--cm-ease)}
@keyframes cm-set{to{translate:0 110%}}
@keyframes cm-rise{from{translate:0 110%}}
/* a theme step fades the colours across, so the panel does not flash; only while the step is happening */
.theming,.theming *,.theming *::before,.theming *::after{transition:background-color var(--cm-medium) var(--cm-ease),color var(--cm-medium) var(--cm-ease),border-color var(--cm-medium) var(--cm-ease),box-shadow var(--cm-medium) var(--cm-ease)!important}
.menu input{appearance:none;margin:0;flex:none;width:14px;height:14px;border:1.5px solid var(--cm-border-emph);display:grid;place-items:center;
  transition:background-color var(--cm-fast) var(--cm-ease),border-color var(--cm-fast) var(--cm-ease)}
.menu input[type=radio]{border-radius:var(--cm-r-full)}
.menu input[type=radio]:checked{border-color:var(--cm-accent-ink)}
.menu input[type=radio]:checked::after{content:"";width:6px;height:6px;border-radius:var(--cm-r-full);background:var(--cm-accent-ink)}
.menu input[type=checkbox]{border-radius:4px}
.menu input[type=checkbox]:checked{background:var(--cm-accent);border-color:var(--cm-accent-ink)}
.menu input[type=checkbox]:checked::after{content:"";width:3px;height:7px;margin-top:-2px;border:solid var(--cm-on-accent);border-width:0 2px 2px 0;transform:rotate(45deg)}
.menu .danger{color:var(--cm-err)}

/* COMPOSER (new note bar, reply field, inline edit) */
textarea,input[type=search],.namefield{width:100%;padding:6px var(--cm-s2);background:var(--cm-input);color:var(--cm-text);resize:none;
  border:1px solid var(--cm-control-edge);border-radius:var(--cm-r-md);
  transition:border-color var(--cm-fast) var(--cm-ease),box-shadow var(--cm-fast) var(--cm-ease)}
textarea::placeholder,input::placeholder{color:var(--cm-text-hint)}
textarea:focus,input[type=search]:focus,.namefield:focus,textarea.is-focus,input.is-focus{outline:none;border-color:var(--cm-focus);box-shadow:0 0 0 3px var(--cm-halo)}
textarea.warn,.namefield.warn{border-color:var(--cm-warn);box-shadow:0 0 0 3px color-mix(in srgb,var(--cm-warn) 30%,transparent);transition:none}
textarea.warn-off{transition:border-color var(--cm-linger) var(--cm-ease),box-shadow var(--cm-linger) var(--cm-ease)}
.toolong textarea,textarea.toolong{border-color:var(--cm-warn)}
.count{font-size:var(--cm-fs-meta);color:var(--cm-text-meta);text-align:right}
.count:empty{display:none}
.toolong .count{color:var(--cm-warn)}
.compose{display:flex;gap:var(--cm-s2);align-items:flex-end}
.compose textarea{min-height:32px;max-height:120px}.editing textarea{max-height:160px}
/* asked once, the first time someone writes to a store other people share */
/* SIDEBAR.Alias: the foot of the panel while someone writes under a made-up name. It says who they are to everyone else and
   offers to change it; the change happens here, in place. */
.you{display:flex;align-items:center;gap:var(--cm-s2);padding:var(--cm-s2) var(--cm-s3) var(--cm-s2) var(--cm-s4);border-top:1px solid var(--cm-border-hair);color:var(--cm-text-body);font-size:var(--cm-fs-meta)}
.you[hidden]{display:none}
.you.reading .as{white-space:normal}
.you .mine{display:flex;flex:none}
.you .face{width:22px;height:22px}
.you .as{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.you .as b{color:var(--cm-text-author)}
.you .namefield{flex:1;min-width:0;padding:3px var(--cm-s2);font-size:var(--cm-fs-body)}
/* naming keeps the row as it was: the face stays, the name becomes a field, the pencil becomes a tick */
.you:not(.naming) .namefield,.you:not(.naming) .save,.you.naming .as,.you.naming .edit{display:none}
.compose .face{width:22px;height:22px;margin-bottom:5px}
.thread .compose{padding:var(--cm-s2) var(--cm-s3) var(--cm-s3);border-top:1px solid var(--cm-border-hair)}
.composer{width:340px;padding:0;background:var(--cm-overlay);overflow:hidden}
.composer .strip{background:var(--cm-strip);padding:var(--cm-s2);display:flex;flex-direction:column;gap:var(--cm-s1);min-width:338px}
.composer .err{padding:0 var(--cm-s1)}
.thread .card-err{margin:0;padding:var(--cm-s2) var(--cm-s3) 0}
.send{width:32px;height:32px;flex:none;display:grid;place-items:center;border:1px solid var(--cm-accent-edge);border-radius:var(--cm-r-md);font-size:16px;
  background:var(--cm-accent);color:var(--cm-on-accent);transition:background-color var(--cm-fast) var(--cm-ease),color var(--cm-fast) var(--cm-ease)}
.send:hover:not(:disabled),.send.is-hover{background:var(--cm-accent-deep)}
.send:disabled{background:var(--cm-send-off);color:var(--cm-send-off-ink);border-color:transparent;cursor:not-allowed}
.saving textarea{opacity:.7}
.saving .send,.saving .send:disabled{background:var(--cm-accent);color:transparent;position:relative;cursor:progress}
.saving .send::after{content:"";position:absolute;inset:9px;border-radius:var(--cm-r-full);border:2px solid var(--cm-on-accent);border-right-color:transparent;animation:cm-spin .7s linear infinite}
@keyframes cm-spin{to{transform:rotate(1turn)}}
.failed textarea{border-color:var(--cm-err)}
.row{display:flex;justify-content:flex-end;align-items:center;gap:var(--cm-s2);margin-top:var(--cm-s2)}
.btn{background:var(--cm-accent);border:1px solid var(--cm-accent-edge);border-radius:var(--cm-r-md);color:var(--cm-on-accent);padding:5px var(--cm-s3);font-weight:var(--cm-fw-strong);
  transition:background-color var(--cm-fast) var(--cm-ease)}
.btn:hover:not(:disabled){background:var(--cm-accent-deep)}
.btn:disabled{background:var(--cm-send-off);color:var(--cm-send-off-ink);border-color:transparent;cursor:not-allowed}
.btn.danger{background:var(--cm-err);color:var(--cm-on-err);border-color:transparent}
.quiet{background:transparent;border:0;border-radius:var(--cm-r-md);padding:5px var(--cm-s2);color:var(--cm-text-meta);
  transition:background-color var(--cm-fast) var(--cm-ease),color var(--cm-fast) var(--cm-ease)}
.quiet:hover{background:var(--cm-hover);color:var(--cm-text)}
.link{background:none;border:0;padding:0;color:var(--cm-accent-ink);font-size:var(--cm-fs-meta);text-decoration:underline;text-underline-offset:2px}

/* SIDEBAR */
aside{z-index:var(--cm-z-panel);position:fixed;top:0;bottom:0;width:var(--panel);display:flex;flex-direction:column;pointer-events:auto;
  background:var(--cm-base);color:var(--cm-text);box-shadow:var(--cm-elev-edge);transition:transform var(--cm-medium) var(--cm-ease)}
aside.right{right:0;border-left:1px solid var(--cm-border-hair)}
aside.left{left:0;border-right:1px solid var(--cm-border-hair)}
aside.shut{visibility:hidden;transition:transform var(--cm-medium) var(--cm-ease),visibility 0s var(--cm-medium)}
aside.right.shut{transform:translateX(100%)}
aside.left.shut{transform:translateX(-100%)}
aside>header{position:relative;display:flex;align-items:center;gap:2px;padding:var(--cm-s2) var(--cm-s2) var(--cm-s1) var(--cm-s4)}
aside>header .menu{right:var(--cm-s2)}
/* the lockup: mark and name read as one unit, so the gap is tighter than between controls and the extension is quiet */
aside h2{margin:0;flex:1;display:flex;align-items:center;font-size:var(--cm-fs-head);color:var(--cm-text);letter-spacing:-.01em}
aside h2 .lockup{display:inline-flex;align-items:center;gap:6px}
aside h2 .ext{color:var(--cm-text-meta);font-weight:var(--cm-fw-regular)}
/* the mark: the pin, as it is drawn on the page */
.brand{position:relative;width:22px;height:22px;flex:none;background:var(--cm-accent);border:1.5px solid var(--cm-pin-ink);border-radius:50% 50% 50% var(--cm-r-tip)}
/* the mark in the panel greets the pointer too: a small bob, and a wink with the eye nearer the name */
aside h2 .lockup:hover .brand{animation:cm-bob var(--cm-mark-nod) var(--cm-ease)}
aside h2 .lockup:hover .brand .eyes i+i{animation:cm-wink var(--cm-mark-nod)}
@keyframes cm-bob{40%{translate:0 -2px}}
@keyframes cm-wink{from{animation-timing-function:var(--cm-mark-shut)}30%,58%{transform:scaleY(.2);animation-timing-function:var(--cm-mark-open)}}
/* the field and the button beside it are one row of controls: the same height, whichever is taller */
.tools{display:flex;align-items:stretch;gap:var(--cm-s2);padding:0 var(--cm-s3) var(--cm-s3);border-bottom:1px solid transparent;transition:border-color var(--cm-fast) var(--cm-ease)}
/* the line under the head is only there while notes are scrolled up beneath it */
aside.scrolled .tools{border-bottom-color:var(--cm-border-hair)}
.find input{align-self:stretch}
/* the panel's one filled control: it starts a note, which is the only live thing here */
.tools .add{display:inline-flex;align-items:center;gap:var(--cm-s1);flex:none;white-space:nowrap;padding:5px var(--cm-s2) 5px 6px}
.tools .add[aria-pressed=true]{background:var(--cm-accent-deep)}
.find{position:relative;flex:1;display:flex;align-items:center}
.find>.ic{position:absolute;left:var(--cm-s2);color:var(--cm-text-hint);pointer-events:none}
.find input{padding-left:28px;padding-right:28px}
.find input::-webkit-search-cancel-button{display:none}
.find .clear{position:absolute;right:2px;width:24px;height:24px;font-size:13px;opacity:0;visibility:hidden;transition:opacity var(--cm-fast) var(--cm-ease)}
aside.searching .find .clear{opacity:1;visibility:visible}
.icb.filtered{color:var(--cm-accent-ink)}
.icb.filtered::after{content:"";position:absolute;top:4px;right:4px;width:6px;height:6px;border-radius:var(--cm-r-full);background:var(--cm-accent-ink)}
.icb{position:relative}
.scroll{flex:1;overflow:auto;padding:var(--cm-s1) var(--cm-s2) var(--cm-s4);scrollbar-width:thin;scrollbar-color:transparent transparent}
.scroll:hover{scrollbar-color:var(--cm-border-emph) transparent}
.scroll h3{margin:var(--cm-s4) var(--cm-s2) var(--cm-s1);font-size:var(--cm-fs-meta);font-weight:var(--cm-fw-strong);color:var(--cm-text-meta)}
.scroll ul{margin:0;padding:0;list-style:none}
.loading-rows{display:none;padding:var(--cm-s2)}
aside.loading .loading-rows{display:block}
aside.loading .listing{display:none}
.ghost{height:52px;margin:var(--cm-s1) 0;border-radius:var(--cm-r-md);background:var(--cm-hover);animation:cm-breathe 1.2s ease-in-out infinite alternate}
@keyframes cm-breathe{to{opacity:.45}}
.load-failed{display:none;margin:var(--cm-s4) var(--cm-s2);color:var(--cm-err)}
aside.fail .load-failed{display:block}
aside.fail .listing{display:none}

/* ROW */
.scroll li{position:relative;display:flex;align-items:flex-start;margin:2px 0;border-radius:var(--cm-r-md);
  transition:background-color var(--cm-fast) var(--cm-ease),opacity var(--cm-fast) var(--cm-ease)}
.scroll li:hover,.scroll li.is-hover,.scroll li.hot{background:var(--cm-hover)}
.scroll li.sel,.scroll li.sel:hover{background:var(--cm-selected)}
.pick{flex:1;min-width:0;display:flex;gap:var(--cm-s2);align-items:flex-start;text-align:left;padding:var(--cm-s2);
  border:0;border-radius:var(--cm-r-md);background:transparent;color:var(--cm-text)}
.pick .txt{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}
.pick .face{width:22px;height:22px;margin-top:2px}
.pick .who{gap:var(--cm-s1)}
.pick .who .meta{margin-left:auto;min-width:48px;text-align:right;font-variant-numeric:tabular-nums;transition:opacity var(--cm-fast) var(--cm-ease)}
/* the row's two toggles take the number's place while the row is hovered, focused or open, so the note text keeps the full width */
.scroll li:hover .who .meta,.scroll li.is-hover .who .meta,.scroll li:focus-within .who .meta,.scroll li.sel .who .meta,.scroll li.resolved .who .meta,.scroll li.resolving .who .meta{opacity:0}
.pick .q{align-self:flex-start;max-width:100%;padding:0 2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--cm-text);
  background:linear-gradient(var(--cm-selected),var(--cm-selected)) no-repeat 0 62%/100% 58%}
.pick .ex{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;color:var(--cm-text-body)}
.pick .replies{color:var(--cm-accent-ink);font-size:var(--cm-fs-meta)}
.side-tools{position:absolute;top:5px;right:var(--cm-s1);display:flex;align-items:center}
.tick{width:26px;height:26px;padding:0;display:grid;place-items:center;border:0;border-radius:var(--cm-r-sm);background:transparent;color:var(--cm-text-meta);font-size:15px;
  opacity:0;transition:opacity var(--cm-fast) var(--cm-ease),background-color var(--cm-fast) var(--cm-ease),color var(--cm-fast) var(--cm-ease)}
.scroll li:hover .tick,.scroll li.is-hover .tick,.scroll li:focus-within .tick,.scroll li.sel .tick{opacity:1}
.tick:hover{background:var(--cm-hover);color:var(--cm-accent-ink)}
/* resolved: the same tick, on a filled disc, as on a resolved pin */
.tick[aria-pressed=true]{opacity:1}
.tick[aria-pressed=true] .ic{background:var(--cm-done);color:var(--cm-on-done);border-radius:var(--cm-r-full)}
.tick[aria-pressed=true] svg{width:68%;height:68%;stroke-width:2.6}
.dot{flex:none;width:7px;height:7px;border-radius:var(--cm-r-full);background:var(--cm-accent-ink);
  transition:opacity var(--cm-fast) var(--cm-ease)}
.scroll li.unread:hover .dot,.scroll li.unread.is-hover .dot,.scroll li.unread.sel .dot{opacity:0;transition-delay:.4s}
.scroll li.resolved .ex,.scroll li.resolved .who b{color:var(--cm-text-meta)}
.scroll li.other .pick>.face,.scroll li.lost .pick>.face,
.scroll li.other .txt>:not(.meta),.scroll li.lost .txt>:not(.meta){opacity:.68}
.scroll li.resolving .tick{pointer-events:none;opacity:.6}
@media (hover:none){.tick{opacity:.35}.pick .who .meta{opacity:0}}
.scroll li.entering{animation:cm-row-in var(--cm-fast) var(--cm-ease)}
.scroll li.leaving{animation:cm-row-out var(--cm-fast) var(--cm-ease) forwards;pointer-events:none}
@keyframes cm-row-in{from{opacity:0;transform:translateY(-6px)}}
@keyframes cm-row-out{to{opacity:0;transform:translateX(6px)}}

/* EMPTY */
.empty{padding:var(--cm-s6) var(--cm-s4);text-align:center;color:var(--cm-text-meta);animation:cm-fade var(--cm-fast) var(--cm-ease)}
.empty .ic{width:44px;height:44px;color:var(--cm-text-hint);margin-bottom:var(--cm-s2)}
.empty .ic svg{stroke-width:1.2}
.empty p{margin:0 0 var(--cm-s1);color:var(--cm-text-meta)}
.empty p+p{color:var(--cm-text-hint);font-size:var(--cm-fs-meta)}
.empty .link{margin-top:var(--cm-s2)}
.empty .share{margin-top:var(--cm-s4)}
.empty .share p{color:var(--cm-text-hint);font-size:var(--cm-fs-meta)}
.empty .share .link{margin-top:0}
.empty[hidden],.empty .ic[hidden],.empty .share[hidden]{display:none}

/* CARD.Sheet: a card beside a pin cannot fit a phone, so it docks to the bottom edge */
@media (max-width:520px){aside{width:100%}.thread,.composer{left:var(--cm-s2)!important;right:var(--cm-s2)!important;top:auto!important;bottom:var(--cm-s2)!important;width:auto;max-height:60vh;
  border-radius:var(--cm-r-lg)!important;transform-origin:center bottom}
  .composer{animation:cm-fade var(--cm-fast) var(--cm-ease)}.composer .strip{min-width:0}
  /* a sheet comes from its edge: it slides up, and back down on close */
  .thread{animation:cm-sheet-in var(--cm-medium) var(--cm-ease)}.thread.leaving{animation:cm-sheet-out calc(var(--cm-medium)*.8) var(--cm-ease) forwards}}
@keyframes cm-sheet-in{from{translate:0 calc(100% + var(--cm-s2))}}
@keyframes cm-sheet-out{to{translate:0 calc(100% + var(--cm-s2))}}
@media (pointer:coarse){:host{--pin-d:40px}.dock button{width:52px;height:52px}.icb,.send,.tb,.acts .link{min-width:40px;min-height:40px}.quiet,.btn{min-height:40px}
  /* what is typed with a thumb is set at 16px: below that, a phone zooms the whole page in when the field is touched, and
     does not zoom back. The field is as tall as the button beside it. */
  textarea,input[type=search],.namefield,.you .namefield{font-size:var(--cm-fs-type);min-height:40px;padding-top:var(--cm-s2);padding-bottom:var(--cm-s2)}.compose textarea{min-height:40px}
  textarea,.namefield,.you .namefield{padding-left:var(--cm-s3);padding-right:var(--cm-s3)}   /* not the search field: its sides make room for its icon and its clear button */
  .compose .face{margin-bottom:9px}.thread .compose .face,.peek .compose .face{margin-bottom:7px}   /* still level with the last line of the taller field */
  .tick{width:40px;height:40px;opacity:.6}.side-tools{top:-2px}.pick .who{min-height:36px}.pick .face{margin-top:7px}.pick .who .meta{min-width:84px}}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important}}`;

  /* Every wait in the tool, in one place. The first four come from the motion tokens, so a JS wait can never disagree with the tween it waits for. */
  const msOf = name => Math.round(parseFloat(SCALE[name]) * 1000);
  const TIME = {
    fast: msOf('fast'), medium: msOf('medium'), linger: msOf('linger'), morph: Math.round(msOf('medium') * .8),
    settle: 50,        // slack after a tween before its class or element is removed
    hover: 40,         // pointer rests on a pin before its preview opens
    blurGrace: 80,     // focus may move from pin to preview without closing it
    leaveGrace: 180,   // pointer may travel from pin to preview
    refocus: 90,       // the list redraws a row before focus returns to it
    handBack: 120,     // a hidden tab gets no frame; the composer still hands over
    tell: 30,          // a live region needs a beat between two messages
    blink: 2000,       // the wash on a target after its row is clicked
    warnHold: 2000,    // the blank-send warning stays this long, then fades over `linger`
    toast: 5000, banner: 6000,
    sync: 4000,        // how often a shared store is asked for other people's notes, when it cannot push
    syncSlow: 30000,   // the safety net when it can
    calm: 400, retry: 250, arrive: 500,
    copied: 2000       // "Link copied" stays this long before the item reads as it did
  };
  const makeHost = (parent, tag) => {
    const host = document.createElement(String(tag));
    host.style.cssText = 'all:initial;position:fixed;inset:0;pointer-events:none;z-index:2147483000';
    host.dataset.version = VERSION;   // so anyone can see which version a page is running
    const root = host.attachShadow({ mode: 'open' });
    root.append(build('style', { text: SKIN }));
    paintTheme(host);
    parent.append(host);
    return { host, root };
  };
  /* Theme: 'auto' follows the OS (media query in SKIN); 'light'/'dark' is a stored override that beats it.
     Set on every shadow host so all surfaces flip together. */
  function paintTheme(host) { if (W.theme === 'light' || W.theme === 'dark') host.dataset.theme = W.theme; else delete host.dataset.theme; }
  const setTheme = t => {
    W.theme = ['light', 'dark'].includes(t) ? t : 'auto'; shelf.write('theme', W.theme);
    /* fade the colours across (see .theming); the class is on each thing we have drawn, and only for the length of the fade */
    const drawn = [];
    for (const shell of [primary].concat(composer ? [composer] : [])) { for (const n of shell.root.children) if (n.localName !== 'style') { n.classList.add('theming'); drawn.push(n); } paintTheme(shell.host); }
    setTimeout(() => drawn.forEach(n => n.classList.remove('theming')), TIME.medium + TIME.settle);
  };
  const token = name => getComputedStyle(primary.host).getPropertyValue('--cm-' + name).trim();
  const primary = makeHost(document.body, OPTS.tagName);
  const ROOT = primary.root;
  const tell = build('div', { class: 'sr', role: 'status', 'aria-live': 'polite' });
  const announce = msg => { tell.textContent = ''; setTimeout(() => { tell.textContent = msg; }, TIME.tell); };
  ROOT.append(tell);
  const ours = evt => evt.composedPath().some(n => n instanceof Element && (n.localName === OPTS.tagName || n.localName === OPTS.tagName + '-editor'));

  /* ---------- placement helpers ---------- */
  const freeSpan = () => ({ lo: GAP + (W.sideOpen && W.side === 'left' ? PANEL_W : 0), hi: innerWidth - GAP - (W.sideOpen && W.side === 'right' ? PANEL_W : 0) });
  const nextTo = (card, ax, ay, aw, ah) => {
    const w = card.offsetWidth, h = card.offsetHeight, room = freeSpan();
    let x = ax + aw + 10;
    if (x + w > room.hi) x = ax - w - 10;
    card.style.left = bound(x, room.lo, Math.max(room.lo, room.hi - w)) + 'px';
    card.style.setProperty('--from', x < ax ? 'right top' : 'left top');
    card.dataset.tip = x < ax ? 'tr' : 'tl';
    card.style.top = bound(ay - 8, GAP, Math.max(GAP, innerHeight - h - GAP)) + 'px';
  };

  /* the new-note box grows out of the draft pin: its corner sits on the pin's corner and it opens up and to the right
     (to the left, or downward, only when there is no room). Anchored by the fixed edges, so a resize keeps the corner still. */
  const growFrom = (card, r) => {
    const w = card.offsetWidth, h = card.offsetHeight, room = freeSpan();
    /* the mark is the pin's sharp corner (r.left, r.bottom). Whichever way the box opens, the corner of the box sits there:
       not on the pin's far side, which put it a pin's width off the mark near the right and top edges. */
    const flip = r.left - 1 + w > room.hi && r.left + 1 - w >= room.lo, up = r.bottom + 1 - h >= GAP;
    if (flip) { card.style.left = 'auto'; card.style.right = Math.max(GAP, innerWidth - r.left - 1) + 'px'; }
    else card.style.left = bound(r.left - 1, room.lo, Math.max(room.lo, room.hi - w)) + 'px';
    if (up) { card.style.top = 'auto'; card.style.bottom = Math.max(GAP, innerHeight - r.bottom - 1) + 'px'; }
    else card.style.top = bound(r.bottom - 1, GAP, Math.max(GAP, innerHeight - h - GAP)) + 'px';
    card.dataset.tip = (up ? 'b' : 't') + (flip ? 'r' : 'l');
  };
  const sheetMode = () => !!window.matchMedia && window.matchMedia('(max-width:520px)').matches === true;

  /* ---------- visibility and element resolution ---------- */
  const isShown = elm => {
    const memo = seenMemo.get(elm);
    if (memo && clock() - memo.at < 1000) return memo.ok;
    let ok;
    if (elm.checkVisibility) ok = elm.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
    else { const cs = getComputedStyle(elm); ok = cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > 0; }
    if (ok) { const b = elm.getBoundingClientRect(); ok = b.width > 0 && b.height > 0; }
    seenMemo.set(elm, { at: clock(), ok });
    return ok;
  };
  /* Shown is not seen: an element can pass every test above and still be out of sight, under another element (a page that
     stacks its scenes in one place and swaps them) or clipped away (clip-path, overflow). So the page is asked what lies
     at the pin's own spot, top to bottom, the way a click there would find it, and the pin is drawn only if the element
     (or something inside it) is reached before anything that paints over it. Passed through on the way down: the tool's
     own layers; the element's own ancestors, which cannot cover what is inside them (a component's host is one); and
     anything see-through (fully transparent, or with no background and nothing of its own to show), such as a link stretched over a card to
     make all of it clickable. Never reached at all means clipped away.
     Not asked: the page itself, which is under everything; a spot off the screen, where nothing can be asked; and an
     element that takes no clicks (pointer-events: none), which the question passes through even where it is plainly in
     sight. The answer is kept for a quarter of a second, wherever the pin moves meanwhile: asking is the costly part,
     and an element scrolled along with its pin is rarely covered by the scroll. */
  const coverMemo = new WeakMap();
  const isOursEl = n => n.localName === OPTS.tagName || n.localName === OPTS.tagName + '-editor';
  const SOLID = new Set(['IMG', 'VIDEO', 'CANVAS', 'IFRAME', 'SVG', 'OBJECT', 'EMBED', 'INPUT', 'TEXTAREA', 'SELECT', 'PICTURE']);
  const seeThrough = n => {
    if (SOLID.has(n.tagName.toUpperCase())) return false;
    const cs = getComputedStyle(n), bg = cs.backgroundColor;
    return +cs.opacity === 0 || (bg === 'transparent' || /^rgba\(.*,\s*0\)$/.test(bg)) && cs.backgroundImage === 'none';
  };
  const isCovered = (key, elm, cx, cy, b) => {
    if (elm === document.body || elm === document.documentElement || typeof document.elementsFromPoint !== 'function') return false;
    const x = Math.min(Math.max(cx, b.left + 1), b.right - 1), y = Math.min(Math.max(cy, b.top + 1), b.bottom - 1);
    if (!(x >= 0 && y >= 0 && x < innerWidth && y < innerHeight)) return false;
    const memo = coverMemo.get(key), now = clock();
    if (memo && memo.elm === elm && now - memo.at < 250) return memo.no;
    let no = false;
    if (getComputedStyle(elm).pointerEvents !== 'none') {
      const stack = document.elementsFromPoint(x, y);
      no = stack.length > 0;
      for (const n of stack) {
        if (isOursEl(n)) continue;
        if (n === elm || elm.contains(n)) { no = false; break; }
        if (n.contains(elm) || seeThrough(n)) continue;
        break;
      }
    }
    coverMemo.set(key, { elm, at: now, no });
    return no;
  };
  const quoteOf = th => th.anchor && th.anchor.sel && th.anchor.sel.text ? String(th.anchor.sel.text).trim().split(/\s+/).join(' ') : '';
  const resolveEl = th => {
    const cached = memoEl.get(th.id);
    if (cached && cached.isConnected) return cached;
    memoEl.delete(th.id);
    const elm = seek(th.anchor);
    if (elm) memoEl.set(th.id, elm);
    return elm;
  };
  /* asked for every pin on every frame, and it reads the style of every ancestor: remembered for a second */
  const zMemo = new WeakMap();
  const zNear = elm => {
    const memo = zMemo.get(elm), now = clock();
    if (memo && now - memo.at < 1000) return memo.z;
    let z = 0;
    for (let n = elm; n && n !== document.documentElement; n = n.parentElement) {
      const v = parseInt(getComputedStyle(n).zIndex, 10);
      if (!Number.isNaN(v)) { z = v; break; }
    }
    zMemo.set(elm, { at: now, z });
    return z;
  };
  const markState = (id, v) => { if (W.status[id] !== v) { W.status[id] = v; scheduleList(); } };

  /* ---------- the wash on a target ---------- */
  /* One box of our own, laid over the target and moved with it. It takes the target's corners, stops at whatever clips the target,
     and thins as the target grows, down to nothing at WASH_MOST of the view: a note there is pinned to a spot, washing the page says nothing,
     and a large patch of colour coming and going under a moving pointer flickers. */
  const WASH_PAD = 3, WASH_MOST = .3;
  const wash = build('div', { class: 'wash', 'aria-hidden': 'true' });
  ROOT.append(wash);
  let litNow = null, hopWait = 0;
  const clipsOf = elm => {
    const out = [];
    /* an ancestor only clips what it contains: a fixed target escapes them all, an absolute one escapes those that are not positioned */
    let pos = getComputedStyle(elm).position;
    for (let n = elm.parentElement; n && pos !== 'fixed' && n !== document.body && n !== document.documentElement; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (pos === 'absolute' && (cs.position || 'static') === 'static') continue;
      if ([cs.overflowX, cs.overflowY].some(v => v && v !== 'visible')) out.push(n);
      pos = cs.position;
    }
    return out;
  };
  const seatWash = () => {
    if (!litNow) return;
    const elm = litNow.el;
    if (!elm.isConnected) { unlit(); return; }
    const b = elm.getBoundingClientRect();
    let l = b.left, t = b.top, r = b.right, u = b.bottom;
    for (const c of litNow.clips) { const k = c.getBoundingClientRect(); l = Math.max(l, k.left); t = Math.max(t, k.top); r = Math.min(r, k.right); u = Math.min(u, k.bottom); }
    const w = Math.min(r, innerWidth) - Math.max(l, 0), h = Math.min(u, innerHeight) - Math.max(t, 0);
    const strength = w > 0 && h > 0 && elm !== document.body ? Math.max(0, 1 - (w * h) / (WASH_MOST * innerWidth * innerHeight)) : 0;
    const show = strength > .05;
    if (show) {
      wash.style.transform = 'translate(' + Math.round(l - WASH_PAD) + 'px,' + Math.round(t - WASH_PAD) + 'px)';
      wash.style.width = Math.round(r - l + WASH_PAD * 2) + 'px'; wash.style.height = Math.round(u - t + WASH_PAD * 2) + 'px';
      wash.style.borderRadius = litNow.round; wash.style.zIndex = litNow.z; wash.style.setProperty('--wash-k', strength.toFixed(2));
      /* words that wrap are several boxes: wash each line, not the block round them */
      const bits = elm.getClientRects ? [...elm.getClientRects()] : [], ox = Math.round(l - WASH_PAD), oy = Math.round(t - WASH_PAD);
      wash.style.clipPath = bits.length < 2 ? '' : 'polygon(' + bits.map(k => {
        const x1 = Math.round(k.left - WASH_PAD - ox), y1 = Math.round(k.top - WASH_PAD - oy), x2 = Math.round(k.right + WASH_PAD - ox), y2 = Math.round(k.bottom + WASH_PAD - oy);
        return ['0 0', x1 + 'px ' + y1 + 'px', x2 + 'px ' + y1 + 'px', x2 + 'px ' + y2 + 'px', x1 + 'px ' + y2 + 'px', x1 + 'px ' + y1 + 'px', '0 0'].join(',');
      }).join(',') + ')';
    }
    wash.classList.toggle('on', show);
  };
  const unlit = () => { litNow = null; wash.classList.remove('on'); };
  const lit = elm => {
    if (litNow && litNow.el === elm) return;
    if (!elm) { unlit(); return; }
    /* from one target to the next the wash travels; from nothing it fades in where it is */
    const moving = wash.classList.contains('on');
    wash.classList.toggle('hop', moving);
    clearTimeout(hopWait); if (moving) hopWait = setTimeout(() => wash.classList.remove('hop'), TIME.fast + TIME.settle);
    const cs = getComputedStyle(elm), own = cs.borderTopLeftRadius || '';
    const round = /%$/.test(own) ? own : parseFloat(own) > 0 ? (parseFloat(own) + WASH_PAD) + 'px' : '';
    litNow = { el: elm, clips: clipsOf(elm), round, z: Math.max(4, zNear(elm)) };
    seatWash(); wake();
  };
  /* a row was clicked: wash its target for a moment even if nothing else keeps it lit */
  const blink = elm => {
    lit(elm);
    setTimeout(() => { if (litNow && litNow.el === elm && !W.openId && !peekFor && !W.placing && !carrying) unlit(); }, TIME.blink);
  };

  /* ---------- pins ---------- */
  /* the open note always has its pin on the page, whatever the filters say: the pin is what the note opens from */
  const visiblePins = () => W.threads.filter(th => th.route === W.route && (th.id === W.openId || (W.showPins && (W.showResolved || !th.resolved))));
  /* which of the six colours a person wears: by the name shown, so the same name is the same face in every browser, and the
     colour never disagrees with the initials on it. Only a note with no name falls back to the id. */
  const colourOf = th => tintFor(String(th.authorName || '').trim().toLowerCase() || th.authorId) % AVATARS;
  let loopId = 0, carrying = null;
  /* what a pin shows for its note: the face, the resolved check, the unread dot, and its spoken label */
  const dressPin = (entry2, th) => {
    const sig = th.authorName + '|' + (th.authorAvatar || (th.authorId === me.id && me.avatar) || '') + '|' + !!th.resolved;
    if (entry2.sig !== sig) { entry2.sig = sig; entry2.btn.replaceChildren(...[badge(th), th.resolved ? build('span', { class: 'ok', 'aria-hidden': 'true' }, icon('tick')) : null].filter(Boolean)); }
    entry2.btn.classList.toggle('done', !!th.resolved);
    entry2.btn.toggleAttribute('data-unread', isFresh(th));
    entry2.btn.setAttribute('aria-label', 'Note ' + ordinal(th.id) + ' by ' + th.authorName + (th.resolved ? ', resolved' : '') + (isFresh(th) ? ', unread' : '') + ', ' + th.replies.length + (th.replies.length === 1 ? ' reply' : ' replies'));
  };
  const refreshPins = () => {
    const want = new Map(visiblePins().map(th => [th.id, th]));
    for (const [id, entry2] of pinMap) if (!want.has(id)) {
      /* an open note keeps its pin (it is the note's avatar) until the note closes */
      if (bub && bub.id === id) bubShut(true);
      entry2.btn.remove(); pinMap.delete(id);
    }
    for (const [id, th] of want) {
      let entry2 = pinMap.get(id);
      if (!entry2) {
        const bead = build('button', { class: 'pin', type: 'button' });
        bead.style.transform = 'translate(-9999px,-9999px)';
        entry2 = { btn: bead };
        armPin(bead, id);
        ROOT.append(bead);
        pinMap.set(id, entry2);
      }
      dressPin(entry2, th);
      entry2.btn.setAttribute('aria-expanded', W.openId === id ? 'true' : 'false');
    }
    for (const th of W.threads) if (th.route !== W.route) W.status[th.id] = 'other';
    wake();
  };
  const SEEK_MS = 6;
  const wake = () => { if (!loopId) loopId = requestAnimationFrame(frameStep); };
  /* seat every pin right now, without waiting for the next frame */
  const seatNow = () => { if (loopId && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(loopId); frameStep(); };
  const frameStep = () => {
    loopId = 0;
    const now = clock();
    /* Looking for a pin's element means searching the page. Notes are written by strangers, and a few hundred that match
       nothing must not take the page from its reader: one frame spends at most SEEK_MS looking, and the rest wait for the next. */
    const began = performance.now(); let spent = false;
    for (const [id, entry2] of pinMap) { try {   // one note that cannot be placed costs its own pin, never the others'
      const th = lookup(id);
      if (!th || entry2.held) continue;
      /* a pin with nowhere to sit is looked for six times, 400ms apart, and then left alone until the page changes:
         looking means searching the page, and that must not happen on every frame */
      const tries = W.tries[id] || 0;
      if (tries && (tries >= 6 || now - (W.tried[id] || 0) <= 400)) { entry2.btn.style.visibility = 'hidden'; markState(id, tries >= 6 ? 'lost' : 'wait'); continue; }
      const known = memoEl.get(id);
      if (!(known && known.isConnected)) {
        if (spent || performance.now() - began > SEEK_MS) { spent = true; if (entry2.btn.style.visibility !== 'visible') markState(id, 'wait'); continue; }
      }
      const elm = resolveEl(th);
      if (!elm) {
        entry2.btn.style.visibility = 'hidden';
        W.tried[id] = now; W.tries[id] = tries + 1;
        if (tries + 1 >= 6) { W.lostAt[id] = now; W.rounds[id] = (W.rounds[id] || 0) + 1; }
        markState(id, tries + 1 >= 6 ? 'lost' : 'wait');
        continue;
      }
      W.rounds[id] = 0;
      if (!isShown(elm)) { entry2.btn.style.visibility = 'hidden'; markState(id, 'hidden'); continue; }
      const b = elm.getBoundingClientRect();
      let x = b.left + th.anchor.dx - PIN_SZ / 2, y = b.top + th.anchor.dy - PIN_SZ / 2;
      const sel = th.anchor.sel;
      const rg = sel && typeof sel.from === 'number' ? spanFor(id, elm, sel) : null;
      const rr = rg && rg.getClientRects()[0];
      if (rr && !entry2.fresh) { x = rr.left + (sel.ox || 0) - PIN_SZ / 2; y = rr.top + (sel.oy || 0) - PIN_SZ / 2; }   // notes from before ox/oy sit at the start of the words
      if (entry2.fresh) {
        /* just dragged: hold the dropped spot while the target animates, then re-base the offset */
        if (busyEl(elm) && now - entry2.fresh.at < 2000) { entry2.btn.style.visibility = 'visible'; continue; }
        const f = entry2.fresh; entry2.fresh = null;
        const was = enc(th.anchor);
        th.anchor.dx = Math.round(f.px - b.left); th.anchor.dy = Math.round(f.py - b.top);
        if (rr) { sel.ox = Math.round(f.px - rr.left); sel.oy = Math.round(f.py - rr.top); }   // a dragged pin on words stays where it was put, too
        x = b.left + th.anchor.dx - PIN_SZ / 2; y = b.top + th.anchor.dy - PIN_SZ / 2;
        /* the drop already saved the place; it is saved again only if the target moved under the pin while it settled */
        if (enc(th.anchor) !== was) { hold(id); depot.update(id, { anchor: th.anchor }).catch(() => {}).then(() => release(id)); }
      }
      /* out of sight the same way as an element that is not shown: an open note then waits as a dialog, as it does for one */
      if (isCovered(entry2, elm, x + PIN_SZ / 2, y + PIN_SZ / 2, b)) { entry2.btn.style.visibility = 'hidden'; markState(id, 'hidden'); continue; }
      entry2.btn.style.transform = 'translate(' + Math.round(x) + 'px,' + Math.round(y) + 'px)';
      entry2.btn.style.zIndex = Math.max(5, zNear(elm) + 1);
      entry2.btn.style.visibility = 'visible';
      if (bub && bub.id === id) bubMove();
      else if (W.openId === id && threadBox && threadBox.classList.contains('adrift')) drawThread();
      W.tries[id] = 0;
      const onscreen = b.bottom > 0 && b.top < innerHeight && b.right > 0 && b.left < innerWidth;
      markState(id, onscreen ? 'shown' : 'off');
    } catch (_) { entry2.btn.style.visibility = 'hidden'; } }
    paintQuotes(); seatWash();
    if (pinMap.size || W.draft || litNow) wake();
  };
  let quoteSig = '';
  const paintQuotes = () => {
    if (!window.Highlight || !window.CSS || !CSS.highlights) return;
    const rgs = [], ids = [];
    for (const [id] of pinMap) { const c = spanCache.get(id), th = lookup(id); if (c && c.rg && th && !th.resolved) { rgs.push(c.rg); ids.push(id); } }
    const sig = spanGen + ':' + ids.join(',');
    if (sig === quoteSig) return;
    quoteSig = sig;
    if (rgs.length) CSS.highlights.set('pw-quote', new Highlight(...rgs)); else CSS.highlights.delete('pw-quote');
  };
  /* PIN.Pointed / ROW.Pointed: a pin and its list row mark each other on hover */
  const point = (id, on) => {
    const entry2 = pinMap.get(id);
    if (entry2) entry2.btn.classList.toggle('hot', on && W.openId !== id);
    for (const li of ROOT.querySelectorAll('.scroll li')) if (li.dataset.id === id) li.classList.toggle('hot', on);
  };
  const pinBox = id => { const r = pinMap.get(id); return r ? r.btn.getBoundingClientRect() : null; };

  /* ---------- the bubble: pin, preview and thread are one object ---------- */
  let bub = null;
  const MORPH = TIME.morph;
  /* where a pin rests on the page, ignoring the hover lift and any ride */
  const restBox = pin => {
    const m = /translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/.exec(pin.style.transform || ''), D = pin.offsetWidth;
    if (!m) return null;
    const x = +m[1] + PIN_SZ / 2, y = +m[2] + PIN_SZ / 2;
    return { left: x, right: x + D, top: y - D, bottom: y, D };
  };
  const seatOf = card => {
    const f = card.querySelector('.face'), c = card.getBoundingClientRect(), b = (f || card).getBoundingClientRect();
    return f ? { x: b.left + b.width / 2 - c.left, y: b.top + b.height / 2 - c.top } : { x: 16, y: 16 };
  };
  const bubMove = () => {
    const e = bub && pinMap.get(bub.id), r = e && restBox(e.btn);
    if (r) bub.shell.style.transform = 'translate(' + (bub.flip ? r.right : r.left) + 'px,' + (bub.up ? r.bottom : r.top) + 'px)';
  };
  /* size the shell to its card and move the avatar to its seat. Everything travels in a straight line over the same time, so
     the shell, the card inside it and the riding pin stay locked together. */
  const bubFit = (fresh, from, turn) => {
    const { shell, card } = bub, pin = pinMap.get(bub.id).btn, r = restBox(pin);
    if (!r) return;
    const W2 = card.offsetWidth + 2, H = card.offsetHeight + 2, room = freeSpan(), seat = seatOf(card);
    if (fresh || turn) {
      const fitsUp = r.bottom - H >= GAP, fitsDown = r.top + H <= innerHeight - GAP;
      bub.up = fitsUp || (!fitsDown && r.bottom > innerHeight - r.top);
      bub.flip = r.left + W2 > room.hi && r.right - W2 >= room.lo;
    }
    if (fresh) {
      shell.style.width = (from ? from.w : r.D) + 'px'; shell.style.height = (from ? from.h : r.D) + 'px';
      if (from) pin.style.translate = (from.cx - (r.left + r.D / 2)) + 'px ' + (from.cy - (r.top + r.D / 2)) + 'px';
    }
    shell.style.translate = (bub.flip ? '-100%' : '0') + ' ' + (bub.up ? '-100%' : '0');
    shell.dataset.tip = (bub.up ? 'b' : 't') + (bub.flip ? 'r' : 'l');
    bubMove();
    /* start: the card is offset so its avatar seat lies exactly under the pin, wherever both are right now */
    const now = shell.getBoundingClientRect(), pc = pin.getBoundingClientRect();
    const edge = parseFloat(getComputedStyle(shell).borderTopWidth) || 1;
    card.style.transition = 'none';
    card.style.transform = 'translate(' + (pc.left + pc.width / 2 - now.left - edge - seat.x) + 'px,' + (pc.top + pc.height / 2 - now.top - edge - seat.y) + 'px)';
    void card.offsetWidth;
    pin.style.transition = ''; card.style.transition = ''; card.style.transform = '';
    /* end: full size, card at rest, pin on the seat */
    shell.classList.remove('bud'); shell.classList.add('morphing');
    shell.style.width = W2 + 'px'; shell.style.height = H + 'px';
    const L = bub.flip ? r.right - W2 : r.left, T = bub.up ? r.bottom - H : r.top;
    pin.style.translate = (L + 1 + seat.x - (r.left + r.D / 2)) + 'px ' + (T + 1 + seat.y - (r.top + r.D / 2)) + 'px';
    clearTimeout(bub.calm);
    const b = bub; b.calm = setTimeout(() => b.shell.classList.remove('morphing'), calmMotion() ? 0 : MORPH + 40);
  };
  /* put a card in the bubble of note `id`, growing the bubble out of the pin if it is not open yet.
     `from` starts it at another box instead (the new-note box it replaces). */
  const bubShow = (id, mode, card, from) => {
    const pin = pinMap.get(id).btn, th = lookup(id);
    if (bub && (bub.id !== id || bub.closing)) bubShut(true);
    const fresh = !bub;
    if (fresh) {
      const shell = build('div', { class: 'bubble' + (from ? '' : ' bud') + (th && th.resolved ? ' done' : '') });
      shell.addEventListener('pointerenter', () => { onPeek = true; });
      shell.addEventListener('pointerleave', () => { onPeek = false; lingerCheck(); });
      shell.addEventListener('click', () => { if (bub && bub.shell === shell && bub.mode === 'peek' && !bub.closing) showThread(id); });
      shell.addEventListener('pointerdown', evt => { const e = pinMap.get(id); if (bub && bub.shell === shell && bub.mode === 'peek' && !bub.closing && e && e.btn.__grab) e.btn.__grab(evt); });
      ROOT.append(shell);
      bub = { id, shell, card: null, mode, up: true, flip: false };
      /* the shell wears the pin's shape from here on; the pin drops its own at once so the two never show together */
      pin.style.transition = 'none'; pin.classList.add('rider');
    }
    if (bub.card && bub.card !== card) bub.card.remove();
    bub.card = card; bub.mode = mode; bub.shell.dataset.mode = mode;
    bub.shell.append(card);
    bubFit(fresh, from);
  };
  /* fold the bubble back into its pin */
  const bubShut = instant => {
    if (!bub) return;
    const b = bub, e = pinMap.get(b.id), pin = e && e.btn;
    const done = () => {
      clearTimeout(b.calm); clearTimeout(b.gone); b.shell.remove();
      if (pin) { pin.style.transition = 'none'; pin.classList.remove('rider'); pin.style.translate = ''; void pin.offsetWidth; pin.style.transition = ''; }
      if (bub === b) bub = null;
    };
    const r = pin && restBox(pin);
    if (instant || calmMotion() || !r) { done(); return; }
    if (b.closing) return;
    b.closing = true;
    const seat = seatOf(b.card);
    b.shell.classList.add('bud', 'morphing');
    b.shell.style.width = b.shell.style.height = r.D + 'px';
    b.card.style.transform = 'translate(' + (r.D / 2 - 1.5 - seat.x) + 'px,' + (r.D / 2 - 1.5 - seat.y) + 'px)';
    pin.style.translate = '0px 0px';
    clearTimeout(b.calm); b.gone = setTimeout(done, MORPH);
  };

  /* ---------- hover preview ---------- */
  let peekWait = 0, leaveWait = 0, onPeek = false, onPin = false, peekFor = null, mute = false;
  const quietFocus = el => { mute = true; try { el.focus({ preventScroll: true }); } finally { mute = false; } };
  const dropPeek = () => {
    clearTimeout(peekWait); clearTimeout(leaveWait);
    if (bub && bub.mode === 'peek') bubShut();
    peekFor = null; onPeek = false; if (!W.openId) unlit();
  };
  const peekCard = th => build('div', { class: 'card peek', role: 'tooltip' },
    build('div', { class: 'lead' }, badge(th), build('div', { class: 'txt' },
      build('div', { class: 'who' }, build('b', { text: th.authorName }), build('time', { text: since(th.created), title: since(th.created, true) })),
      build('div', { class: 'body', text: th.text }),
      th.replies.length ? build('div', { class: 'meta', text: th.replies.length + (th.replies.length === 1 ? ' reply' : ' replies') }) : null)),
    /* what a click opens, shown where it will be: the reply row. It is a picture of the row; the real one replaces it */
    READ_ONLY ? null : build('div', { class: 'compose', 'aria-hidden': 'true' }, badge({ authorName: me.name, authorId: me.id }),
      build('span', { class: 'mock', text: 'Reply…' }), build('button', { class: 'send', type: 'button', disabled: true, tabindex: '-1' }, icon('send'))));
  const raisePeek = (id, from) => {
    const th = lookup(id), e = pinMap.get(id);
    /* a pin that has not been seated yet (just created, or its target is hidden) has no place to grow from */
    if (!th || !e || W.openId === id || carrying || sheetMode() || e.btn.style.visibility !== 'visible') return;
    if (bub && bub.id === id && !bub.closing) return;
    if (W.openId != null) {
      /* one note at a time. An open note with work in it stays, and no preview is raised over it; an idle one closes properly, state and all */
      const t = threadBox && threadBox.querySelector('.compose textarea');
      if ((t && t.value.trim()) || editing || editReply || askDelete || askReply) return;
      shutThread(false);
    }
    clearTimeout(peekWait); clearTimeout(leaveWait);
    peekFor = id;
    bubShow(id, 'peek', peekCard(th), from);
    lit(memoEl.get(id) || null);
  };
  /* a preview raised by keyboard focus stays while its pin keeps that focus, wherever the pointer goes */
  const keyHeld = () => { const e = peekFor && pinMap.get(peekFor); try { return !!e && ROOT.activeElement === e.btn && e.btn.matches(':focus-visible'); } catch (_) { return false; } };
  const lingerCheck = () => { clearTimeout(leaveWait); leaveWait = setTimeout(() => { if (!onPin && !onPeek && !keyHeld()) dropPeek(); }, TIME.leaveGrace); };

  let fromRow = null;   // the note that was opened from its row, so closing it goes back there
  let threadBox = null, replyDraft = '', editing = null, askDelete = false, editReply = null, askReply = null, walking = false;
  const shutThread = (refocus = true) => {
    if (W.openId == null) return;
    const id = W.openId;
    W.openId = null; W.selected = null; replyDraft = ''; editing = null; askDelete = false; editReply = null; askReply = null; cardMenu = false; walking = false; cardErr = '';
    if (threadBox) {
      const gone = threadBox; threadBox = null;
      /* closed with the pointer still on the pin: shrink to the preview the hover would raise anyway, not to the pin and back */
      if (bub && bub.card === gone) { const th = lookup(id); if (onPin && refocus && th && !bub.closing) { peekFor = id; bubShow(id, 'peek', peekCard(th)); } else bubShut(); }
      else if (calmMotion()) gone.remove();
      else { gone.classList.remove('steady'); gone.classList.add('leaving'); setTimeout(() => gone.remove(), TIME.fast + TIME.settle); }
    }
    panel.inert = false; tray.inert = false;
    unlit();
    refreshPins(); scheduleList();
    /* focus goes back to the pin without re-opening its preview: the note has just folded away */
    if (refocus) {
      const entry2 = pinMap.get(id), seen = entry2 && entry2.btn.style.visibility === 'visible';
      const rowBtn = () => { const li = W.sideOpen ? [...ROOT.querySelectorAll('.scroll li')].find(n => n.dataset.id === id) : null; return li && li.querySelector('.pick'); };
      /* the list redraws the row once the note closes, so focus goes there after that redraw */
      if (rowBtn() && (fromRow === id || !seen)) { pinTool.focus({ preventScroll: true }); setTimeout(() => { const b = rowBtn(); if (b && !W.openId) b.focus({ preventScroll: true }); }, TIME.refocus); }
      else if (seen) quietFocus(entry2.btn);
      else (W.sideOpen ? pinTool : pinTool).focus({ preventScroll: true });
    }
    fromRow = null;
  };
  let undoBox = null, undoWait = 0;
  const dropUndo = () => { clearTimeout(undoWait); if (undoBox) { undoBox.remove(); undoBox = null; } };
  /* CARD.UndoOffered: resolving can hide the pin, so a slip must be one click to take back */
  const toastEl = (id, undo) => build('div', { class: 'toast', role: 'status' }, build('span', { text: 'Note ' + ordinal(id) + ' resolved' }),
    build('button', { type: 'button', text: 'Undo', on: { click: undo } }));
  const offerUndo = id => {
    dropUndo();
    undoBox = toastEl(id, () => { dropUndo(); toggleDone(id); });
    undoBox.addEventListener('pointerdown', evt => evt.stopPropagation());
    ROOT.append(undoBox);
    undoWait = setTimeout(dropUndo, TIME.toast);
  };
  /* a failure belongs where the action was: a line in the open card. The banner is for storage being down, or when no card is open */
  let cardErr = '';
  const fail = (id, msg) => { if (W.openId === id && threadBox) { cardErr = msg; announce(msg); } else warn(msg); };
  const toggleDone = async id => {
    const th = lookup(id);
    if (!th || inFlight.has(id)) return;
    cardErr = '';
    inFlight.add(id);
    scheduleList(); if (W.openId === id) drawThread();
    const next = !th.resolved, wasRead = !isFresh(th);
    try {
      await depot.update(id, { resolved: next, updated: clock() });
      th.resolved = next; th.updated = clock();
      if (wasRead) logSeen(id);   // your own resolve is not news to you
      ping('resolved', { id, resolved: next });
      announce(next ? 'Note marked resolved' : 'Note reopened');
      if (next) offerUndo(id); else dropUndo();
    } catch (_) { fail(id, th.resolved ? 'Note not reopened.' : 'Note not resolved.'); }
    settle(id);
    refreshPins(); scheduleList();
    if (W.openId === id) drawThread();
  };
  const mineNote = th => !READ_ONLY && th.authorId === me.id;   // a reader may change nothing, their own earlier notes included
  const saveEdit = async (id, raw) => {
    const th = lookup(id), text = String(raw).trim().slice(0, OPTS.maxNote);
    if (!th || !mineNote(th) || inFlight.has(id)) return;
    cardErr = '';
    if (!text) { fail(id, 'A note cannot be empty. Delete it instead.'); drawThread(); return; }
    if (text === th.text) { editing = null; drawThread(); return; }
    inFlight.add(id);
    try {
      const stamp = clock();
      await depot.update(id, { text, edited: stamp, updated: stamp });
      th.text = text; th.edited = stamp; th.updated = stamp;
      logSeen(id); editing = null;
      ping('edited', { id }); announce('Note edited');
    } catch (_) { fail(id, 'Edit not saved.'); }
    settle(id);
    if (W.openId === id) drawThread();
    refreshPins(); scheduleList();
  };
  const removeNote = async id => {
    const th = lookup(id);
    if (!th || !mineNote(th) || inFlight.has(id)) return;
    inFlight.add(id);
    try {
      await depot.remove(id);
      W.threads.splice(W.threads.indexOf(th), 1);
      delete W.seen[id]; shelf.write('seen', W.seen);
      memoEl.delete(id); spanCache.delete(id);
      if (W.moving === id) stopMove();
      if (W.openId === id) shutThread(false);
      if (W.selected === id) W.selected = null;
      ping('deleted', { id }); announce('Note deleted');
    } catch (_) { fail(id, 'Note not deleted.'); askDelete = false; if (W.openId === id) drawThread(); }
    settle(id);
    refreshPins(); scheduleList();
  };
  /* a reply's author can edit or delete it, the same way as a note: in place, rolled back if the write fails */
  const saveReply = async (id, r, raw) => {
    const th = lookup(id), text = String(raw).trim().slice(0, OPTS.maxReply);
    if (READ_ONLY || !th || r.authorId !== me.id || !th.replies.includes(r) || inFlight.has(id)) return;
    cardErr = '';
    if (!text) { fail(id, 'A reply cannot be empty. Delete it instead.'); drawThread(); return; }
    if (text === r.text) { editReply = null; drawThread(); return; }
    const was = r.text, wasEdited = r.edited;
    inFlight.add(id); r.text = text; r.edited = clock();
    try {
      if (depot.updateReply && r.id) await depot.updateReply(id, r.id, { text, edited: r.edited }); else await depot.update(id, { replies: th.replies, updated: clock() });
      th.updated = clock(); logSeen(id); editReply = null;
      ping('edited', { id, reply: true }); announce('Reply edited');
    } catch (_) { r.text = was; if (wasEdited) r.edited = wasEdited; else delete r.edited; fail(id, 'Edit not saved.'); }
    settle(id);
    if (W.openId === id) drawThread();
    scheduleList();
  };
  const removeReply = async (id, r) => {
    const th = lookup(id), at = th ? th.replies.indexOf(r) : -1;
    if (READ_ONLY || at < 0 || r.authorId !== me.id || inFlight.has(id)) return;
    cardErr = ''; inFlight.add(id); th.replies.splice(at, 1); askReply = null;
    try {
      if (depot.removeReply && r.id) await depot.removeReply(id, r.id); else await depot.update(id, { replies: th.replies, updated: clock() });
      th.updated = clock();
      ping('deleted', { id, reply: true }); announce('Reply deleted');
    } catch (_) { th.replies.splice(at, 0, r); fail(id, 'Reply not deleted.'); }
    settle(id);
    if (W.openId === id) drawThread();
    refreshPins(); scheduleList();
  };
  const setBox = v => { replyDraft = v; const t = threadBox && threadBox.querySelector('.compose textarea'); if (t) t.value = v; };
  const postReply = async id => {
    const th = lookup(id), text = replyDraft.trim();
    if (!th || !text) return;
    const entry = { v: FORMAT, id: newKey(), authorName: me.name, authorId: me.id, text: text.slice(0, OPTS.maxReply), at: clock() };
    if (me.avatar) entry.authorAvatar = me.avatar;
    th.replies.push(entry); cardErr = '';
    setBox('');
    logSeen(id);
    drawThread(); scheduleList(); refreshPins();
    hold(id);
    try {
      if (depot.addReply) await depot.addReply(id, entry); else await depot.update(id, { replies: th.replies, updated: clock() });
      th.updated = clock(); logSeen(id); saveName();
      ping('replied', { id }); announce('Reply added');
    } catch (_) {
      th.replies.splice(th.replies.indexOf(entry), 1);
      setBox(text);
      fail(id, 'Reply not saved.');
      drawThread(); scheduleList(); refreshPins();
    }
    release(id); wrote.set(id, clock());
  };
  /* an image address: https, an inline image, or one on this site. Judged after resolving it the way the browser will,
     since "//host" and "/\\host" both read as paths and are other sites. */
  const safeSrc = u => {
    if (typeof u !== 'string' || !u) return null;
    if (/^data:image\//i.test(u)) return u;
    try { const a = new URL(u, location.href); return a.protocol === 'https:' || (a.protocol === location.protocol && a.host === location.host) ? a.href : null; } catch (_) { return null; }
  };
  const badge = th => {
    const f = build('span', { class: 'face', 'aria-hidden': 'true', text: lettersOf(th.authorName) }); { const k = colourOf(th); for (const [n, v] of [['--face', 'face-' + k], ['--face-ink', 'face-' + k + '-ink'], ['--av', 'av-' + k], ['--av-ink', 'av-' + k + '-ink']]) f.style.setProperty(n, 'var(--cm-' + v + ')'); }
    /* on a shared store another person's image address is theirs to choose, and loading it tells that address who is
       looking. So only your own image shows, unless the host page says everyone's may (sharedAvatars: true), which is
       right when the page itself supplies them. */
    const mine = th.authorId === me.id;
    /* for your own notes the image is the one this page knows you by, never the one stored with the note: a note can
       claim to be yours */
    const theirs = !mine && (!SHARED || OPTS.sharedAvatars) ? th.authorAvatar : null;
    const src = safeSrc(mine ? me.avatar : theirs);
    /* initials stay underneath, so a missing or blocked image falls back without a reflow */
    if (src) { const im = build('img', { src, alt: '', referrerpolicy: 'no-referrer', draggable: 'false' }); im.addEventListener('error', () => im.remove()); f.append(im); }
    return f;
  };
  const iconBtn = (name, attrs) => { const b = build('button', Object.assign({ type: 'button' }, attrs)); b.classList.add('icb'); b.append(icon(name)); return b; };
  /* A field is as tall as its words, up to the height its stylesheet allows; past that it scrolls. Someone writing
     three lines sees three lines. `then` is told when the height changed, for a card that has to be fitted again. */
  const fit = (field, then) => {
    if (typeof field.scrollHeight !== 'number' || !field.isConnected) return;
    const was = field.offsetHeight;
    field.style.height = 'auto';
    const cs = getComputedStyle(field), edge = (parseFloat(cs.borderTopWidth) || 0) + (parseFloat(cs.borderBottomWidth) || 0);
    field.style.height = Math.ceil(field.scrollHeight + edge) + 'px';
    if (then && field.offsetHeight !== was) then();
  };
  const grows = (field, then) => {
    field.addEventListener('input', () => fit(field, then));
    requestAnimationFrame(() => fit(field, then));   // words it was given before it was on the page (a draft kept, a note being edited)
  };
  const counter = (field, max, wrap, out) => {
    const sync = () => { const n = field.value.length, near = n >= max * 0.9; out.textContent = near ? n + ' / ' + max : ''; wrap.classList.toggle('toolong', n >= max); };
    field.addEventListener('input', sync); sync();
  };
  let cardMenu = false;
  const drawThread = () => {
    const th = lookup(W.openId);
    if (!th) return;
    const keep = threadBox && threadBox.querySelector('.compose textarea');
    if (keep) replyDraft = keep.value;
    /* where the note opens: out of its pin; as a bottom sheet on a phone; or, when the pin has nowhere to be, as a dialog over the page */
    const seatPin = pinMap.get(th.id);
    const inBubble = !sheetMode() && seatPin && seatPin.btn.style.visibility === 'visible' && !!restBox(seatPin.btn);
    const adrift = !inBubble && !sheetMode();
    /* the missing-pin dialog is modal in fact, not only in name: the panel and launcher cannot be used while it is open */
    panel.inert = adrift; tray.inert = adrift;
    const { card, more, moreMenu, reply } = buildThread(th, adrift);
    const hadFocus = threadBox && ROOT.activeElement && threadBox.contains(ROOT.activeElement);
    const focusMore = hadFocus && ROOT.activeElement.getAttribute('aria-haspopup') === 'menu';
    const old = threadBox;
    const prev = old ? [old.style.left, old.style.top, old.style.getPropertyValue('--from'), old.dataset.tip] : null;
    if (old) { if (!(inBubble && bub && bub.card === old)) old.remove(); card.classList.add('steady'); }
    threadBox = card;
    if (inBubble) bubShow(th.id, 'thread', card);   // the same bubble the preview used, grown further
    else {
      if (bub) bubShut(true);
      ROOT.append(card);
      if (adrift) {
        /* CARD.Adrift: no pin to open from, so the note is a dialog centred on the page area beside the panel */
        const room = freeSpan();
        card.setAttribute('aria-modal', 'true');
        card.style.left = room.lo + 'px'; card.style.right = Math.max(GAP, innerWidth - room.hi) + 'px';
      }
    }
    const msgs = card.querySelector('.msgs');
    if (old && msgs) msgs.scrollTop = msgs.scrollHeight;
    if (askDelete || askReply) { const keep = card.querySelector('.confirm .quiet'); if (keep) keep.focus({ preventScroll: true }); }
    else if (focusMore) more.focus({ preventScroll: true });
    else if (cardMenu) { const first = moreMenu.querySelector('button:not(:disabled)'); if (first) first.focus({ preventScroll: true }); }
    else if (editing !== th.id && !editReply && (!old || hadFocus)) (walking || READ_ONLY ? card : reply).focus({ preventScroll: true });
  };
  /* the card itself, from the note and what is being done to it; where it goes is drawThread's business */
  const buildThread = (th, adrift) => {
    const send = build('button', { class: 'send', type: 'button', 'aria-label': 'Send reply', disabled: !replyDraft.trim(), on: { click: () => { replyDraft = reply.value; postReply(th.id); } } }, icon('send'));
    const reply = build('textarea', { rows: 1, maxlength: OPTS.maxReply, 'aria-label': 'Write a reply', placeholder: 'Reply…',
      on: { input() { send.disabled = !reply.value.trim(); },
        keydown(evt) {
          if (isBack(evt)) { halt(evt); shutThread(); }
          else if (evt.key === 'Enter' && !evt.shiftKey && !evt.isComposing) { halt(evt); replyDraft = reply.value; postReply(th.id); }
        } } });
    reply.value = replyDraft;
    /* the card's shell is as big as the card was when it opened: when a field in it grows, it is fitted again */
    const refit = () => { if (bub && bub.card === threadBox && !bub.closing) bubFit(false, null, true); };
    grows(reply, refit);
    const mine = mineNote(th);
    let main;
    /* one way to edit and one way to confirm a delete, for a note and for a reply: in place, where the words were */
    const editBlock = (value, max, label, save, cancel) => {
      const out = build('div', { class: 'count', 'aria-live': 'polite' });
      const box = build('textarea', { rows: 3, maxlength: max, 'aria-label': label,
        on: { keydown(evt) {
          if (isBack(evt)) { halt(evt); cancel(); }
          else if (evt.key === 'Enter' && !evt.shiftKey && !evt.isComposing) { halt(evt); save(box.value); }
        } } });
      box.value = value;
      const block = build('div', { class: 'editing' }, box, out, build('div', { class: 'row' },
        build('button', { class: 'quiet', type: 'button', text: 'Cancel', on: { click: cancel } }),
        build('button', { class: 'btn', type: 'button', text: 'Save', on: { click: () => save(box.value) } })));
      counter(box, max, block, out); grows(box, refit);
      if (!spec) setTimeout(() => { box.focus({ preventScroll: true }); box.setSelectionRange(box.value.length, box.value.length); }, 0);
      return block;
    };
    const confirmBlock = (ask, keep, drop) => build('div', { class: 'confirm', role: 'group', 'aria-label': 'Confirm delete' },
      build('p', { text: ask }),
      build('div', { class: 'row' },
        build('button', { class: 'quiet', type: 'button', text: 'Keep', on: { click: keep } }),
        build('button', { class: 'btn danger', type: 'button', text: 'Delete', on: { click: drop } })));
    const calm = () => { editing = null; askDelete = false; editReply = null; askReply = null; };
    if (mine && editing === th.id) main = editBlock(th.text, OPTS.maxNote, 'Edit note text', v => saveEdit(th.id, v), () => { calm(); drawThread(); });
    else if (mine && askDelete) main = confirmBlock('Delete this note and its replies?', () => { calm(); drawThread(); }, () => removeNote(th.id));
    else main = build('div', { class: 'body', text: th.text });
    const replyRow = r => {
      const own = !READ_ONLY && r.authorId === me.id, busy = editReply === r || askReply === r;
      return build('div', { class: 'msg reply' }, badge(r), build('div', { class: 'col' },
        build('div', { class: 'who' }, build('b', { text: r.authorName }), build('time', { text: since(r.at), title: since(r.at, true) }),
          own && !busy ? build('span', { class: 'acts' },
            build('button', { class: 'link', type: 'button', text: 'Edit', 'aria-label': 'Edit your reply', on: { click: () => { calm(); editReply = r; drawThread(); } } }),
            build('button', { class: 'link', type: 'button', text: 'Delete', 'aria-label': 'Delete your reply', on: { click: () => { calm(); askReply = r; drawThread(); } } })) : null),
        own && editReply === r ? editBlock(r.text, OPTS.maxReply, 'Edit reply text', v => saveReply(th.id, r, v), () => { calm(); drawThread(); })
          : own && askReply === r ? confirmBlock('Delete this reply?', () => { calm(); drawThread(); }, () => removeReply(th.id, r))
          : build('div', { class: 'body', text: r.text }),
        r.edited && !busy ? build('div', { class: 'meta', text: 'edited ' + since(r.edited), title: since(r.edited, true) }) : null));
    };

    const more = iconBtn('more', { 'aria-label': 'More options', 'aria-haspopup': 'menu', 'aria-expanded': String(cardMenu), on: { click: () => { cardMenu = !cardMenu; if (cardMenu && openMenu()) flipMenu(openMenu()[1], false); drawThread(); } } });
    const pick = fn => () => { cardMenu = false; fn(); };
    const moreMenu = build('div', { class: 'menu', role: 'menu', 'aria-label': 'Note options', hidden: !cardMenu },
      build('button', { type: 'button', role: 'menuitem', text: 'Mark as unread', disabled: isFresh(th), on: { click: pick(() => markUnread(th.id)) } }),
      build('button', { type: 'button', role: 'menuitem', text: 'Move pin', disabled: READ_ONLY, 'aria-describedby': READ_ONLY ? 'pw-why-not' : null, on: { click: pick(() => startMove(th.id)) } }),
      build('hr'),
      build('button', { type: 'button', role: 'menuitem', text: 'Edit', disabled: !mine, 'aria-describedby': mine ? null : 'pw-why-not', on: { click: pick(() => { calm(); editing = th.id; drawThread(); }) } }),
      build('button', { type: 'button', role: 'menuitem', class: 'danger', text: 'Delete', disabled: !mine, 'aria-describedby': mine ? null : 'pw-why-not', on: { click: pick(() => { calm(); askDelete = true; drawThread(); }) } }),
      mine ? null : build('div', { class: 'cap why', id: 'pw-why-not', text: READ_ONLY ? 'You are reading only.' : 'Only ' + th.authorName + ' can edit or delete this note.' }));
    const quote = quoteOf(th);
    const card = build('div', { class: 'card thread' + (th.resolved ? ' resolved' : '') + (adrift ? ' adrift' : ''), tabindex: '-1', role: 'dialog', 'aria-label': 'Note ' + ordinal(th.id) + ' by ' + th.authorName },
      build('header', {}, quote ? build('h2', { class: 'q', text: quote, title: 'Note #' + ordinal(th.id) }) : build('h2', { text: 'Note #' + ordinal(th.id) }),
        READ_ONLY ? null : build('button', { class: 'tb resolve', type: 'button', 'aria-pressed': String(!!th.resolved), disabled: inFlight.has(th.id), on: { click: () => toggleDone(th.id) } },
          th.resolved ? null : icon('tick'), build('span', { text: th.resolved ? 'Reopen' : 'Resolve' })),
        more,
        iconBtn('close', { 'aria-label': 'Close note', on: { click: () => shutThread() } }), moreMenu),
      adrift ? build('p', { class: 'adrift-why', text: REASONS[W.status[th.id]] && W.status[th.id] !== 'wait' ? REASONS[W.status[th.id]] : REASONS.lost }) : null,
      build('div', { class: 'msgs' },
        build('div', { class: 'msg' }, badge(th), build('div', { class: 'col' },
          build('div', { class: 'who' }, build('b', { text: th.authorName }), build('time', { text: since(th.created), title: since(th.created, true) })),
          main,
          (th.edited && editing !== th.id) ? build('div', { class: 'meta', text: 'edited ' + since(th.edited), title: since(th.edited, true) }) : null)),
        th.replies.map(replyRow)),
      cardErr ? build('p', { class: 'err card-err', role: 'alert', text: cardErr }) : null,
      /* while a note is being edited the card has one job and one filled button: the reply row waits */
      editing === th.id || editReply || READ_ONLY ? null : build('div', { class: 'compose' }, badge({ authorName: me.name, authorId: me.id }), reply, send));
    card.addEventListener('pointerdown', evt => { evt.stopPropagation(); walking = false; if (cardMenu && !evt.composedPath().some(n => n === moreMenu || n === more)) { cardMenu = false; more.setAttribute('aria-expanded', 'false'); moreMenu.hidden = true; } });
    return { card, more, moreMenu, reply };
  };
  const showThread = (id, walk) => {
    const th = lookup(id);
    if (!th) return;
    /* a preview of this same note is not dropped: its bubble simply grows into the thread */
    clearTimeout(peekWait); clearTimeout(leaveWait); peekFor = null; onPeek = false;
    if (bub && (bub.id !== id || bub.closing)) bubShut(true);
    dropDraft();
    /* moving from one note to another: start a fresh card instead of redrawing the old one in place */
    if (threadBox && W.openId !== id) { threadBox.remove(); threadBox = null; replyDraft = ''; editing = null; askDelete = false; editReply = null; askReply = null; cardMenu = false; cardErr = ''; }
    walking = !!walk;
    W.openId = id; W.selected = id;
    logSeen(id);
    /* bring the note's pin onto the page first (it may have been filtered out), so the note can open from it */
    refreshPins(); seatNow();
    const elm = resolveEl(th), r = pinBox(id);
    if (r && (r.top < 40 || r.bottom + 220 > innerHeight - 40) && elm) elm.scrollIntoView({ block: 'center', behavior: calmMotion() ? 'auto' : 'smooth' });
    drawThread();
    /* after the page has scrolled the anchor into view, re-pick the side the note opens on */
    setTimeout(() => {
      if (!threadBox || W.openId !== id) return;
      if (bub && bub.card === threadBox && !bub.closing) bubFit(false, null, true);
    }, TIME.medium + TIME.settle);
    lit(elm);
    refreshPins(); scheduleList();
  };

  /* a note takes a new place: on `spot`, at the point (x, y). Rolled back if the store refuses. */
  const reseat = async (id, spot, x, y) => {
    const th = lookup(id), entry2 = pinMap.get(id);
    if (!th || READ_ONLY) return false;
    const before = th.anchor, before_el = memoEl.get(id);
    th.anchor = dropAnchor(spot, x, y);
    memoEl.set(id, spot);
    spanCache.delete(id); W.tries[id] = 0; W.rounds[id] = 0;
    if (entry2) {
      entry2.fresh = { at: clock(), px: x, py: y };
      entry2.btn.style.transform = 'translate(' + Math.round(x - PIN_SZ / 2) + 'px,' + Math.round(y - PIN_SZ / 2) + 'px)';
      entry2.held = false;
    }
    wake(); hold(id);
    try { await depot.update(id, { anchor: th.anchor }); announce('Note moved'); return true; }
    catch (_) { if (entry2) entry2.fresh = null; th.anchor = before; if (before_el) memoEl.set(id, before_el); else memoEl.delete(id); warn('Note not moved.'); wake(); return false; }
    finally { release(id); wrote.set(id, clock()); }
  };
  /* PLACING.Moving: "Move pin" in a note's menu. The next spot chosen, by a click or by Enter on a focused element, is
     the note's new place; Escape leaves it where it was. It is the same act as dragging the pin, for a keyboard and for
     anyone who cannot drag. */
  const startMove = id => {
    const th = lookup(id);
    if (!th || READ_ONLY || th.route !== W.route) return;
    if (W.openId) shutThread(false);
    dropDraft(); dropPeek();
    W.moving = id;
    document.documentElement.classList.add('pw-aim');
    const e = pinMap.get(id); if (e) { e.btn.classList.add('lifted'); quietFocus(e.btn); }   // focus stays on the pin being moved, not on nothing
    announce('Choose the new place for note ' + ordinal(id) + ': click it, or move focus to it and press Enter. ' + keyCap('back') + ' cancels.');
  };
  const stopMove = () => {
    const id = W.moving;
    if (id == null) return;
    W.moving = null; unlit();
    const e = pinMap.get(id); if (e) e.btn.classList.remove('lifted');
    if (!W.placing) { document.documentElement.classList.remove('pw-aim'); document.documentElement.classList.add('pw-calm'); setTimeout(() => document.documentElement.classList.remove('pw-calm'), TIME.calm); }
    return id;
  };
  const moveTo = async (id, spot, x, y) => {
    stopMove();
    if (spot === document.documentElement) spot = document.body;
    await reseat(id, spot, x, y);
    const e = pinMap.get(id);
    if (e && e.btn.isConnected) quietFocus(e.btn);
  };
  const armPin = (bead, id) => {
    let down = null;
    bead.addEventListener('pointerenter', () => { onPin = true; if (carrying) return; point(id, true); clearTimeout(peekWait); peekWait = setTimeout(() => raisePeek(id), TIME.hover); });
    bead.addEventListener('pointerleave', () => { onPin = false; point(id, false); clearTimeout(peekWait); lingerCheck(); });
    bead.addEventListener('focus', () => { if (!mute) requestAnimationFrame(() => {
      if (ROOT.activeElement !== bead) return;
      /* reached by keyboard while its target is off screen: focus must be somewhere the reader can see */
      const elm = memoEl.get(id), b = elm && elm.isConnected ? elm.getBoundingClientRect() : null;
      let byKey = false; try { byKey = bead.matches(':focus-visible'); } catch (_) { /* older browsers */ }
      if (byKey && b && (b.bottom < 0 || b.top > innerHeight || b.right < 0 || b.left > innerWidth)) elm.scrollIntoView({ block: 'center', behavior: 'auto' });
      raisePeek(id);
    }); });
    bead.addEventListener('blur', () => { setTimeout(() => { if (peekFor === id && !onPeek) dropPeek(); }, TIME.blurGrace); });
    bead.addEventListener('click', evt => {
      if (bead.__drop) { bead.__drop = false; halt(evt); return; }
      if (W.moving != null) { halt(evt); return; }   // a place is being chosen: a pin is not a place
      fromRow = null; showThread(id);
    });
    const grab = evt => {
      const th = lookup(id);
      if (evt.button !== 0 || !th || th.route !== W.route) return;
      down = { x: evt.clientX, y: evt.clientY, moved: false };
      bead.setPointerCapture(evt.pointerId);
    };
    bead.addEventListener('pointerdown', grab);
    /* the preview is the pin grown, so pressing anywhere on it picks the note up as well */
    bead.__grab = grab;
    bead.addEventListener('pointermove', evt => {
      if (READ_ONLY) return;   // a reader can open a note, not move its pin
      if (!down) return;
      const travelled = Math.hypot(evt.clientY - down.y, evt.clientX - down.x);
      if (!down.moved && travelled < PIN_SLOP) return;
      if (!down.moved) { down.moved = true; carrying = id; if (W.openId === id) shutThread(false); dropPeek(); if (bub && bub.id === id) bubShut(true); pinMap.get(id).held = true; bead.style.pointerEvents = 'none'; bead.classList.add('lifted'); }
      bead.style.transform = 'translate(' + Math.round(evt.clientX - PIN_SZ / 2) + 'px,' + Math.round(evt.clientY - PIN_SZ / 2) + 'px)';
      const under = document.elementFromPoint(evt.clientX, evt.clientY);
      lit(under && !ours({ composedPath: () => [under] }) ? under : null);
    });
    const finish = async evt => {
      if (!down) return;
      const span = down; down = null;
      if (bead.hasPointerCapture(evt.pointerId)) bead.releasePointerCapture(evt.pointerId);
      if (!span.moved) return;
      bead.__drop = true;
      setTimeout(() => { bead.__drop = false; }, 0);
      carrying = null; bead.style.pointerEvents = ''; bead.classList.remove('lifted');
      const spot = document.elementFromPoint(evt.clientX, evt.clientY);
      unlit();
      const th = lookup(id), entry2 = pinMap.get(id);
      if (!th || !entry2) return;
      if (!spot || spot === document.documentElement || ours({ composedPath: () => [spot] })) {
        entry2.btn.classList.add('glide'); entry2.held = false; wake();
        setTimeout(() => entry2.btn.classList.remove('glide'), TIME.medium + TIME.settle);
        return;
      }
      await reseat(id, spot, evt.clientX, evt.clientY);
    };
    bead.addEventListener('pointerup', finish);
    bead.addEventListener('pointercancel', finish);
  };

  /* ---------- drafts and the composer ---------- */
  let composer = null;
  const dropDraft = () => {
    if (!W.draft) return;
    W.draft.pin.remove();
    if (composer) { composer.host.remove(); composer = null; }
    W.draft = null;
  };
  const modalHost = () => {
    const open = [...document.querySelectorAll('dialog[open],[role=dialog],[role=alertdialog],[aria-modal=true],[class*=modal i],[class*=Modal],[data-radix-portal],[data-portal]')]
      .filter(n => !ours({ composedPath: () => [n] }) && isShown(n));
    return open.length ? open[open.length - 1] : null;
  };
  const beginDraft = (evt, elm) => {
    const keepPin = W.draft && W.draft.pin;
    if (W.draft) { if (composer) { composer.host.remove(); composer = null; } }
    const anchor = dropAnchor(elm, evt.clientX, evt.clientY);
    const pin = keepPin || build('button', { class: 'pin draft', type: 'button', tabindex: '-1', 'aria-hidden': 'true', text: '+' });
    pin.style.transform = 'translate(' + Math.round(evt.clientX - PIN_SZ / 2) + 'px,' + Math.round(evt.clientY - PIN_SZ / 2) + 'px)';
    if (!keepPin) ROOT.append(pin);
    /* where focus was, when the spot was chosen from the keyboard: backing out returns there */
    W.draft = { pin, anchor, x: evt.clientX, y: evt.clientY, back: evt.from || null };
    showEditor();
  };
  /* the new-note bar itself; showEditor places it and wires saving */
  const composerParts = on => {
    const err = build('div', { class: 'err', role: 'alert' });
    const out = build('div', { class: 'count', 'aria-live': 'polite' });
    const field = build('textarea', { rows: 1, maxlength: OPTS.maxNote, 'aria-label': 'New note text', placeholder: 'Leave a note…', tabindex: '0',
      on: { input() { save.disabled = !field.value.trim(); card.classList.remove('failed'); err.textContent = ''; },
        keydown(evt) {
          if (isBack(evt)) { halt(evt); on.esc(); }
          else if (evt.key === 'Enter' && !evt.shiftKey && !evt.isComposing) { halt(evt); on.commit(); }
        } } });
    const save = build('button', { class: 'send', type: 'button', disabled: true, 'aria-label': 'Save note', title: 'Save note', on: { click: () => on.commit() } }, icon('send'));
    const card = build('div', { class: 'card composer', role: 'dialog', 'aria-label': 'New note' },
      build('div', { class: 'strip' }, build('div', { class: 'compose' }, badge({ authorName: me.name, authorId: me.id }), field, save), out, err));
    counter(field, OPTS.maxNote, card, out); grows(field);
    card.addEventListener('pointerdown', evt => evt.stopPropagation());
    return { card, field, save, err, out };
  };
  const showEditor = () => {
    const d = W.draft;
    const shell = makeHost(modalHost() || document.body, OPTS.tagName + '-editor');
    composer = shell;
    const { card, field, save, err } = composerParts({ esc: () => { const back = d.back; dropDraft(); (back && back.isConnected ? back : pinTool).focus(); }, commit: () => commit() });
    d.field = field;
    let flash = 0;
    const commit = async () => {
      if (card.classList.contains('saving')) return;
      const text = field.value.trim();
      if (!text) {
        clearTimeout(flash); field.classList.remove('warn-off'); field.classList.add('warn'); field.focus(); err.textContent = 'A note cannot be empty.';
        flash = setTimeout(() => { field.classList.add('warn-off'); field.classList.remove('warn'); flash = setTimeout(() => field.classList.remove('warn-off'), TIME.linger + 2 * TIME.settle); }, TIME.warnHold);
        return;
      }
      const now = clock();
      const entry2 = { v: FORMAT, id: newKey(), authorName: me.name, authorId: me.id, text: text.slice(0, OPTS.maxNote), created: now, updated: now,
        route: W.route, anchor: d.anchor, resolved: false, replies: [] };
      if (me.avatar) entry2.authorAvatar = me.avatar;
      card.classList.add('saving'); card.classList.remove('failed'); field.readOnly = true; save.disabled = true; save.setAttribute('aria-busy', 'true');
      try { await depot.create(entry2); }
      catch (_) {
        card.classList.remove('saving'); card.classList.add('failed'); field.readOnly = false; save.disabled = false; save.removeAttribute('aria-busy');
        err.textContent = 'Could not save this note. Try again.';
        if (W.draft === d) { field.focus(); return; }
        /* this box is gone (another spot was chosen meanwhile): say so on the page, and give the words back where they can be sent again */
        const live = W.draft && W.draft.field;
        if (live && !live.value) { live.value = text; live.dispatchEvent(new Event('input')); }
        warn('A note could not be saved.'); return;
      }
      if (!lookup(entry2.id)) W.threads.push(entry2);   // a sync may already have brought it back from a shared store
      wrote.set(entry2.id, clock()); saveName();
      logSeen(entry2.id);
      /* another spot was clicked while this note was saving: that draft and its box are the reader's present business,
         so this note just takes its place on the page */
      if (W.draft !== d) { refreshPins(); scheduleList(); ping('created', { id: entry2.id }); announce('Note added'); return; }
      memoEl.set(entry2.id, seek(entry2.anchor));
      /* the box settles into the saved note in place: it stays up for the one frame the new pin needs to be seated,
         then the note's bubble starts from the box's own outline */
      let from = null;
      if (!sheetMode() && !calmMotion()) {
        const cb = card.getBoundingClientRect(), fb = (card.querySelector('.face') || card).getBoundingClientRect();
        from = { w: cb.width, h: cb.height, cx: fb.left + fb.width / 2, cy: fb.top + fb.height / 2, host: shell.host };
        composer = null;
      }
      dropDraft();
      refreshPins(); scheduleList();
      { const made = pinMap.get(entry2.id);
        if (made && made.btn.isConnected) quietFocus(made.btn); else pinTool.focus({ preventScroll: true });
        if (from) {
          let handed = false;
          const hand = () => { if (handed) return; handed = true; from.host.remove(); raisePeek(entry2.id, from); };
          requestAnimationFrame(hand); setTimeout(hand, TIME.handBack);   // a hidden tab gets no frame; never leave the box up
        }
        else if (made) requestAnimationFrame(() => raisePeek(entry2.id)); }
      ping('created', { id: entry2.id }); announce('Note added');
    };
    shell.root.append(card);
    /* the box is the draft pin grown: same corner the saved note will keep, so nothing jumps when it is sent */
    { const D = d.pin.offsetWidth; growFrom(card, { left: d.x, right: d.x + D, top: d.y - D, bottom: d.y });
      if (!sheetMode()) {
        d.pin.style.visibility = 'hidden';
        if (!calmMotion() && card.animate) card.animate([
          { width: D + 'px', height: D + 'px', borderRadius: (D / 2) + 'px ' + (D / 2) + 'px ' + (D / 2) + 'px ' + token('r-tip'), backgroundColor: token('pin-paper'), borderColor: token('pin-ink') },
          { width: card.offsetWidth + 'px', height: card.offsetHeight + 'px' }], { duration: MORPH, easing: token('ease') || 'ease' });
      } else d.pin.style.visibility = ''; }
    let tries = 0;
    const grab = () => { field.focus({ preventScroll: true }); if (shell.root.activeElement !== field && ++tries < 8) requestAnimationFrame(grab); };
    grab();
  };

  /* ---------- placing mode ---------- */
  /* the cursor is the pin itself, tip on the hotspot, so what you carry is what lands */
  const cursorSheet = build('style', { text: 'html.pw-aim,html.pw-aim *{cursor:url("data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2228%22 height=%2228%22 viewBox=%220 0 28 28%22%3E%3Cpath d=%22M3 25V14A11 11 0 0 1 25 14A11 11 0 0 1 14 25z%22 fill=%22' + encodeURIComponent(TOKENS.light.accent) + '%22 stroke=%22' + encodeURIComponent(SCALE['pin-ink']) + '%22 stroke-width=%222%22/%3E%3C/svg%3E") 3 25,crosshair!important}html.pw-calm *{cursor:revert!important}::highlight(pw-quote){background-color:' + TOKENS.light.halo + '}html.pw-aim ::selection{background-color:' + TOKENS.light.halo + ';color:inherit}' });
  document.head.append(cursorSheet);
  const setAiming = on => {
    if (on && READ_ONLY) { warn('You are reading only.'); return; }
    W.placing = on;
    shelf.write('placing', on);
    document.documentElement.classList.toggle('pw-aim', on);
    if (!on) { stopMove(); unlit(); dropDraft(); document.documentElement.classList.add('pw-calm'); setTimeout(() => document.documentElement.classList.remove('pw-calm'), TIME.calm); }
    pinTool.classList.toggle('on', on);
    pinTool.setAttribute('aria-label', on ? 'Stop adding a note' : OPTS.launcherLabel); pinTool.title = on ? 'Stop adding a note (' + keyCap('back') + ')' : OPTS.launcherLabel;
    addTool.setAttribute('aria-pressed', String(on));
    announce(on ? 'Placing mode on' : 'Placing mode off');
  };
  document.addEventListener('click', evt => {
    if ((!W.placing && W.moving == null) || ours(evt) || evt.button !== 0) return;
    if (W.sideOpen) {
      const left = W.side === 'left' ? evt.clientX < PANEL_W : evt.clientX > innerWidth - PANEL_W;
      if (left) return;
    }
    halt(evt);
    const elm = evt.target instanceof Element ? evt.target : document.body;
    if (W.moving != null) { moveTo(W.moving, elm, evt.clientX, evt.clientY); return; }
    if (W.openId) shutThread(false);
    beginDraft(evt, elm);
  }, true);
  /* PLACING.TargetHint: wash the element under the pointer; PLACING.WideTarget: none when it fills the view; PLACING.OverOwnUI: none over our UI */
  document.addEventListener('pointermove', evt => {
    if ((!W.placing && W.moving == null) || W.openId || peekFor || carrying) return;
    /* PLACING.Selecting: while words are being dragged over, the words are the target, so they alone are marked (in the
       highlighter, as the note will quote them) and the wash on the element steps back */
    if (evt.buttons & 1) { const sel = window.getSelection(); if (sel && !sel.isCollapsed) { unlit(); return; } }
    lit(ours(evt) || !(evt.target instanceof Element) || evt.target === document.documentElement ? null : evt.target);
  }, true);
  document.addEventListener('pointerdown', evt => {
    if (W.openId && !ours(evt)) shutThread(false);
  }, true);
  const inField = evt => {
    const n = evt.composedPath()[0];
    if (!(n instanceof Element)) return false;
    return /^(INPUT|TEXTAREA|SELECT)$/.test(n.tagName) || n.isContentEditable;
  };
  /* For the single-letter keys only: the host page's own widgets take letters too. A custom element (its field may be
     inside a closed shadow root, where we cannot look), or anything with a role that types, picks by first letter or
     steers with keys. Escape and Enter are not letters, and work there as anywhere. */
  const inWidget = evt => {
    const n = evt.composedPath()[0];
    if (!(n instanceof Element) || ours(evt)) return false;
    if (String(n.localName || '').includes('-')) return true;
    const role = n.closest ? n.closest('[role]') : null;
    return !!role && WIDGET.test(role.getAttribute('role'));
  };
  const WIDGET = /^(textbox|searchbox|combobox|listbox|option|spinbutton|slider|menu|menubar|menuitem|menuitemcheckbox|menuitemradio|tree|treeitem|grid|gridcell|tablist|tab|radiogroup|application)$/i;
  document.addEventListener('keydown', evt => {
    const tgt = evt.composedPath()[0], inMenu = tgt instanceof Element && tgt.closest ? tgt.closest('.menu') : null;
    /* arrows move through a menu without choosing; Enter or Space chooses */
    if (inMenu && ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(evt.key)) {
      halt(evt);
      const items = [...inMenu.querySelectorAll('input,button:not(:disabled)')], at = items.indexOf(tgt), n = items.length;
      const to = evt.key === 'Home' ? 0 : evt.key === 'End' ? n - 1 : (at + (evt.key === 'ArrowDown' ? 1 : -1) + n) % n;
      if (items[to]) items[to].focus({ preventScroll: true });
      return;
    }
    if (inMenu && evt.key === 'Enter' && tgt.tagName === 'INPUT') { halt(evt); tgt.click(); return; }
    /* the missing-pin dialog is modal: Tab stays inside it */
    if (evt.key === 'Tab' && threadBox && threadBox.classList.contains('adrift')) {
      const stops = [...threadBox.querySelectorAll('button:not(:disabled),textarea,input')].filter(n => n.offsetParent !== null || n === ROOT.activeElement);
      const at = stops.indexOf(ROOT.activeElement), edge = evt.shiftKey ? at <= 0 : at < 0 || at === stops.length - 1;
      if (stops.length && edge) { halt(evt); stops[evt.shiftKey ? stops.length - 1 : 0].focus({ preventScroll: true }); }
      return;
    }
    if (isBack(evt) && openMenu()) { halt(evt); const [t, m] = openMenu(); flipMenu(m, false); t.focus(); return; }
    if (isBack(evt) && cardMenu && threadBox) { halt(evt); cardMenu = false; drawThread(); const t = threadBox && threadBox.querySelector('[aria-haspopup=menu]'); if (t) t.focus(); return; }
    /* Escape backs out one level, the most specific first: a delete being confirmed, a search, the panel focus is in, a draft, a preview, an open note, placing mode */
    if (isBack(evt) && threadBox && (askDelete || askReply)) { halt(evt); askDelete = false; askReply = null; drawThread(); return; }
    if (isBack(evt) && W.sideOpen && !W.draft && !W.placing && ROOT.activeElement && panel.contains(ROOT.activeElement)) {   // placing, started from the panel, is the more recent level
      halt(evt);
      if (youBox.classList.contains('naming') && youBox.contains(ROOT.activeElement)) youBox.rest();   // back out of naming before anything larger
      else if (q.value) { qClear.click(); q.focus({ preventScroll: true }); } else { toggleSide(false); pinTool.focus({ preventScroll: true }); }
      return;
    }
    if (inField(evt)) return;
    if (isBack(evt)) {
      if (W.moving != null) { halt(evt); const id = stopMove(), e = pinMap.get(id); announce('Note not moved'); if (e && e.btn.isConnected) quietFocus(e.btn); }
      else if (W.draft) { dropDraft(); }
      else if (bub && bub.mode === 'peek' && !bub.closing) dropPeek();
      else if (W.openId) shutThread();
      else if (W.placing) setAiming(false);
      /* the panel is the last level, and only when the key is ours to take: focus is in the tool or on nothing. With focus on
         one of the host page's own controls the key belongs to the page (its dialog, its menu). */
      else if (W.sideOpen && !W.hideLauncher && (ROOT.activeElement || !document.activeElement || document.activeElement === document.body || document.activeElement === document.documentElement)) {
        halt(evt); toggleSide(false); if (ROOT.activeElement) pinTool.focus({ preventScroll: true });
      }
      return;
    }
    if (evt.key === 'Enter' && (W.placing || W.moving != null) && !W.draft && !evt.altKey && !evt.metaKey && !evt.ctrlKey && !evt.shiftKey) {
      const f = document.activeElement;
      if (f instanceof Element && f !== document.body && f !== document.documentElement && f.localName !== OPTS.tagName && f.localName !== OPTS.tagName + '-editor') {
        halt(evt);
        const r = f.getBoundingClientRect();
        const x = Math.round(Math.min(Math.max(r.left + r.width / 2, 0), innerWidth - 1)), y = Math.round(Math.min(Math.max(r.top + r.height / 2, 0), innerHeight - 1));
        if (W.openId) shutThread(false);
        if (W.moving) { moveTo(W.moving, f, x, y); return; }
        beginDraft({ clientX: x, clientY: y, from: f }, f);
        return;
      }
    }
    if (evt.altKey || evt.metaKey || evt.ctrlKey) return;
    if (!W.hotkeys || W.moving != null || inWidget(evt)) return;   // the single-key shortcuts are the reader's to turn off (More options)
    if ((keyIs(evt, 'next') || keyIs(evt, 'previous')) && !evt.shiftKey && !W.placing && W.showPins) {
      /* CARD.Walked: next / previous open note on this page, oldest first; focus stays on the card so the keys keep working */
      const run = W.threads.filter(th => th.route === W.route && !th.resolved && th.text.trim()).sort((a, b) => a.created - b.created);
      if (!run.length) return;
      halt(evt);
      const at = run.findIndex(th => th.id === W.openId), step = keyIs(evt, 'next') ? 1 : -1;
      jumpTo(run[at < 0 ? (step > 0 ? 0 : run.length - 1) : (at + step + run.length) % run.length].id, true);
      return;
    }
    if (!keyIs(evt, 'add')) return;
    if (evt.shiftKey) { setShowPins(!W.showPins); announce(W.showPins ? 'Pins shown' : 'Pins hidden'); scheduleList(); }
    else if (!W.placing) {
      /* the key does what "Add note" does, from anywhere: the panel opens, so the new note is seen to land in the list,
         and placing starts. Not on a phone, where the panel would cover the page being aimed at. */
      if (!READ_ONLY && !W.sideOpen && !sheetMode()) toggleSide(true);
      setAiming(true);
    }
    else { setAiming(false); if (W.sideOpen && !W.hideLauncher) toggleSide(false); }   // the same key again is the way back out: placing stops and the panel shuts
  }, true);

  const setShowPins = on => {
    W.showPins = on; shelf.write('showPins', on);
    const box = ROOT.querySelector('input[data-pins]'); if (box) box.checked = on;
    refreshPins();
  };

  /* ---------- launcher tray ---------- */
  /* One launcher. At rest it opens the panel, where "Add note" lives; while a note is being placed it is the way out.
     (The two are not tied together: the panel can be open or shut while placing.) */
  const pinTool = build('button', { type: 'button', 'aria-label': OPTS.launcherLabel, 'aria-expanded': 'false', title: OPTS.launcherLabel }, eyes());
  const tray = build('div', { class: 'dock', role: 'group', 'aria-label': OPTS.productName }, pinTool);
  ROOT.append(tray);
  /* The launcher keeps its distance from the corner it was left nearest, measured inside the part of the view the panel leaves
     free. So it stays in its corner through a resize, rides the panel's edge as the panel opens and shuts, and a drag starts
     from where it really is. One transform places it; nothing else moves it. */
  const TRAY_EDGE = 16;
  let traySpot = { r: true, b: true, x: TRAY_EDGE, y: TRAY_EDGE }, trayPlaced = false;
  const trayRoom = () => { const side = W.sideOpen && !sheetMode() ? W.side : ''; return { lo: side === 'left' ? PANEL_W : 0, hi: innerWidth - (side === 'right' ? PANEL_W : 0) }; };
  const trayAt = () => {
    const w = tray.offsetWidth, h = tray.offsetHeight, room = trayRoom();
    return { x: bound(traySpot.r ? room.hi - w - traySpot.x : room.lo + traySpot.x, room.lo, Math.max(room.lo, room.hi - w)),
      y: bound(traySpot.b ? innerHeight - h - traySpot.y : traySpot.y, 0, Math.max(0, innerHeight - h)) };
  };
  const seatTray = glide => {
    const at = trayAt(), still = !glide || !trayPlaced;
    if (still) tray.classList.add('still');
    tray.style.transform = 'translate(' + at.x + 'px,' + at.y + 'px)';
    if (still) { void tray.offsetWidth; tray.classList.remove('still'); }
    trayPlaced = true;
  };
  const dropTray = (x, y) => {   // a point in the view becomes a distance from the nearest corner of the free part
    const w = tray.offsetWidth, h = tray.offsetHeight, room = trayRoom();
    x = bound(x, room.lo, Math.max(room.lo, room.hi - w)); y = bound(y, 0, Math.max(0, innerHeight - h));
    const r = x + w / 2 > (room.lo + room.hi) / 2, b = y + h / 2 > innerHeight / 2;
    traySpot = { r, b, x: r ? room.hi - w - x : x - room.lo, y: b ? innerHeight - h - y : y };
    seatTray(false);
  };
  (() => {
    const saved = shelf.read('launcher', null);
    if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) traySpot = { r: !!saved.r, b: !!saved.b, x: Math.max(0, saved.x), y: Math.max(0, saved.y) };
  })();
  { const grip = pinTool;
    let phase = null;
    grip.addEventListener('pointerdown', evt => { phase = { x: evt.clientX, y: evt.clientY, from: trayAt(), far: false }; grip.setPointerCapture(evt.pointerId); });
    grip.addEventListener('pointermove', evt => {
      if (!phase) return;
      const dx = evt.clientX - phase.x, dy = evt.clientY - phase.y;
      if (Math.hypot(dx, dy) > TRAY_SLOP) phase.far = true;
      if (phase.far) { tray.classList.add('dragging'); dropTray(phase.from.x + dx, phase.from.y + dy); }
    });
    const end = evt => {
      if (!phase) return;
      const remote = phase.far; phase = null;
      if (grip.hasPointerCapture(evt.pointerId)) grip.releasePointerCapture(evt.pointerId);
      tray.classList.remove('dragging');
      if (remote) { shelf.write('launcher', traySpot); grip.__skip = true; setTimeout(() => { grip.__skip = false; }, 0); }
    };
    grip.addEventListener('pointerup', end);
    grip.addEventListener('pointercancel', end);
  }
  pinTool.addEventListener('click', () => { if (pinTool.__skip) return; if (W.placing) setAiming(false); else toggleSide(!W.sideOpen); });

  const bannerEl = msg => build('div', { class: 'note-banner', role: 'status', text: msg });
  const warn = msg => {
    const old = ROOT.querySelector('.note-banner');
    if (old) old.remove();
    const n = bannerEl(msg);
    ROOT.append(n);
    announce(msg);
    setTimeout(() => n.remove(), TIME.banner);
  };

  /* ---------- sidebar ---------- */
  W.hideLauncher = shelf.read('hideLauncher', false);
  /* MENU.Shortcuts: the keys that are single letters (add, next, previous) can be turned off by the reader; Escape, Enter and Tab stay */
  W.hotkeys = shelf.read('hotkeys', true) !== false;
  const q = build('input', { type: 'search', 'aria-label': 'Search notes', placeholder: 'Search notes', on: { input() {
    W.query = q.value.trim().toLowerCase(); panel.classList.toggle('searching', !!q.value); scheduleList(); } } });
  const qClear = iconBtn('close', { class: 'clear', 'aria-label': 'Clear search', on: { click: () => { q.value = ''; W.query = ''; panel.classList.remove('searching'); scheduleList(); q.focus(); } } });
  const sideClose = iconBtn('close', { 'aria-label': 'Close list', title: 'Close', on: { click: () => toggleSide(false) } });
  const filterTool = iconBtn('filter', { 'aria-label': 'Sort and filter', title: 'Sort and filter', 'aria-haspopup': 'menu', 'aria-expanded': 'false' });
  const moreTool = iconBtn('more', { 'aria-label': 'More options', title: 'More options', 'aria-haspopup': 'menu', 'aria-expanded': 'false' });
  const item = (role, input, label, extra) => build('label', { role }, input, build('span', { text: label }), extra || null);
  const radio = (group, val, label, on, pick) => item('menuitemradio', build('input', { type: 'radio', name: group, value: val, checked: on, on: { change: () => pick(val) } }), label);
  const check = (label, on, flip, attr, hint) => item('menuitemcheckbox', build('input', Object.assign({ type: 'checkbox', checked: on, on: { change: evt => flip(evt.target.checked) } }, attr || {})), label, hint ? build('kbd', { text: hint }) : null);
  const markAll = build('button', { type: 'button', role: 'menuitem', text: 'Mark all as read', on: { click: () => { logSeen(...W.threads.map(th => th.id)); flipMenu(filterMenu, false); refreshPins(); scheduleList(); } } });
  const filterMenu = build('div', { class: 'menu', role: 'menu', 'aria-label': 'Sort and filter', hidden: true },
    build('div', { class: 'cap', text: 'Sort' }),
    radio('order', 'new', 'Newest first', W.sort === 'new', v => { W.sort = v; shelf.write('sort', v); syncChecks(); scheduleList(); }),   // a setting: the menu stays open
    radio('order', 'unread', 'Unread first', W.sort === 'unread', v => { W.sort = v; shelf.write('sort', v); syncChecks(); scheduleList(); }),
    build('hr'),
    check('Show resolved', W.showResolved, on => { W.showResolved = on; shelf.write('showResolved', on); refreshPins(); scheduleList(); }, { 'data-resolved': '1' }),
    build('hr'), markAll);
  /* A store that keeps notes among the people who hold a link says what that link is (backend.link). Then the tool
     offers to copy it: first in the More menu, and under the empty panel, where sharing is the next thing to do. */
  const SHARE = 'Copy link to share';
  const linkOf = () => { try { return (SHARED && typeof depot.link === 'function' && depot.link()) || null; } catch (_) { return null; } };
  const CAN_SHARE = !!linkOf();
  const copyLink = async (btn, rest) => {
    const link = linkOf();
    try { if (!link) throw new Error('no link'); await navigator.clipboard.writeText(link); }
    catch (_) { warn('The link could not be copied.'); return; }
    btn.textContent = 'Link copied'; announce('Link copied');
    setTimeout(() => { btn.textContent = rest; }, TIME.copied);
  };
  const shareItem = () => build('button', { type: 'button', role: 'menuitem', 'data-share': '1', text: SHARE, on: { click: evt => copyLink(evt.currentTarget, SHARE) } });
  /* MENU.Theme: one row, three steps, in this order. The menu stays open, as it does for a checkbox, so the next step is one more press. */
  const THEMES = [['light', 'Light', 'sun'], ['dark', 'Dark', 'moon'], ['auto', 'Match system', 'screen']];
  const themeNow = () => THEMES.find(t => t[0] === W.theme) || THEMES[2];
  const themeSky = build('span', { class: 'sky', 'aria-hidden': 'true' }, icon(themeNow()[2])), themeVal = build('span', { class: 'val', text: themeNow()[1] });
  const themeTool = build('button', { type: 'button', role: 'menuitem', 'data-theme-step': '1', 'aria-label': 'Theme: ' + themeNow()[1], on: { click: () => {
    const next = THEMES[(THEMES.indexOf(themeNow()) + 1) % THEMES.length];
    setTheme(next[0]);
    themeVal.textContent = next[1]; themeTool.setAttribute('aria-label', 'Theme: ' + next[1]); announce('Theme: ' + next[1]);
    for (const old of [...themeSky.children]) { old.className = 'ic set'; setTimeout(() => old.remove(), TIME.medium); }
    const sign = icon(next[2]); sign.classList.add('rise'); themeSky.append(sign);
  } } }, themeSky, build('span', { text: 'Theme' }), themeVal);
  const moreMenu = build('div', { class: 'menu', role: 'menu', 'aria-label': 'More options', hidden: true },
    ...(CAN_SHARE ? [shareItem(), build('hr')] : []),
    check('Show pins', W.showPins, on => setShowPins(on), { 'data-pins': '1' }, 'Shift+' + keyCap('add')),
    check('Show launcher', !W.hideLauncher, on => setHideLauncher(!on), { 'data-launcher': '1' }),
    check('Keyboard shortcuts', W.hotkeys, on => { W.hotkeys = on; shelf.write('hotkeys', on); announce(on ? 'Keyboard shortcuts on' : 'Keyboard shortcuts off'); }, { 'data-hotkeys': '1' }),
    build('button', { type: 'button', role: 'menuitem', text: 'Move list to other side', on: { click: () => {
      flipMenu(moreMenu, false); W.side = W.side === 'right' ? 'left' : 'right'; shelf.write('side', W.side); seatSide(); } } }),
    build('hr'), themeTool);
  const MENUS = [[filterTool, filterMenu], [moreTool, moreMenu]];
  const syncChecks = () => MENUS.forEach(([, m]) => m.querySelectorAll('[role^="menuitem"]').forEach(l => {
    const b = l.querySelector('input'); if (b) l.setAttribute('aria-checked', String(b.checked));
    if (l.tagName === 'BUTTON') l.setAttribute('aria-disabled', String(l.disabled));
  }));
  const flipMenu = (m, on = m.hidden) => {
    const had = !on && ROOT.activeElement && m.contains(ROOT.activeElement);
    for (const [t, other] of MENUS) {
      const open = other === m ? on : false;
      other.hidden = !open; t.setAttribute('aria-expanded', String(open));
      if (other === m && had) t.focus({ preventScroll: true });
    }
    syncChecks();
    if (on && cardMenu && threadBox) { cardMenu = false; drawThread(); }
    if (on) { const first = m.querySelector('input:checked,button:not(:disabled),input'); if (first) first.focus({ preventScroll: true }); }
  };
  const openMenu = () => MENUS.find(([, m]) => !m.hidden);
  MENUS.forEach(([t, m], i) => {
    m.id = 'pw-menu-' + i; t.setAttribute('aria-controls', m.id);
    t.addEventListener('click', () => flipMenu(m));
    m.addEventListener('change', syncChecks);
  });
  document.addEventListener('pointerdown', evt => {
    const hit = openMenu();
    if (hit && !evt.composedPath().some(n => n === hit[0] || n === hit[1])) flipMenu(hit[1], false);
  }, true);

  const nowList = build('ul', { 'aria-label': 'Notes on this page' }), awayList = build('ul', { 'aria-label': 'Notes on other pages' });
  const nowHead = build('h3'), awayHead = build('h3');
  const emptyGlyph = icon('bubble'), emptyMain = build('p'), emptyHint = build('p'), emptyWay = build('button', { class: 'link', type: 'button' });
  const emptyShare = build('div', { class: 'share', hidden: true }, build('p', { text: 'Send people this page\'s link and their notes show up here.' }),
    build('button', { class: 'link', type: 'button', text: 'Copy link', on: { click: evt => copyLink(evt.currentTarget, 'Copy link') } }));
  const noneNote = build('div', { class: 'empty', role: 'status' }, emptyGlyph, emptyMain, emptyHint, emptyWay, emptyShare);
  const nowBox = build('section', {}, nowHead, nowList), awayBox = build('section', {}, awayHead, awayList);
  const retry = build('button', { class: 'link', type: 'button', text: 'Try again', on: { click: () => loadAll() } });
  const addTool = build('button', { class: 'btn add', type: 'button', 'aria-pressed': 'false', title: 'Add note (' + keyCap('add') + ')',
    on: { click: () => { const on = !W.placing; setAiming(on); if (on && sheetMode()) toggleSide(false); } } }, icon('plus'), build('span', { text: 'Add note' }));
  /* SIDEBAR.Alias / SIDEBAR.Naming */
  const youParts = (show, naming, as = me.name) => {
    /* not a sign-in: password managers are asked to leave the field alone */
    const field = build('input', { class: 'namefield', type: 'text', maxlength: '40', placeholder: 'Your name', 'aria-label': 'Your name', autocomplete: 'off', 'data-1p-ignore': '', 'data-lpignore': 'true', 'data-form-type': 'other' });
    const label = () => me.alias ? 'Use your name' : 'Change your name';
    const edit = iconBtn('pencil', { class: 'edit', 'aria-label': label(), title: label(), on: { click: () => {
      field.value = me.alias ? '' : me.name;   // a made-up name is not a starting point; a real one is
      box.classList.add('naming'); field.focus({ preventScroll: true }); field.select(); } } });
    const save = iconBtn('tick', { class: 'save', 'aria-label': 'Save name', title: 'Save name', on: { click: () => keep() } });
    const face = build('span', { class: 'mine' }, badge({ authorName: as, authorId: me.id })), name = build('b', { text: as });
    const box = build('footer', { class: 'you' + (naming ? ' naming' : ''), hidden: !show }, face, build('span', { class: 'as' }, 'Critting as ', name), edit, field, save);
    const keep = () => {
      const v = field.value.trim().slice(0, 40);
      if (!v) { field.classList.add('warn'); field.focus({ preventScroll: true }); announce('Type your name first'); return; }
      me.name = v; me.alias = false; shelf.write('whoName', v);
      name.textContent = v; face.replaceChildren(badge({ authorName: v, authorId: me.id }));
      edit.setAttribute('aria-label', label()); edit.title = label();
      const carried = namesFollow();
      if (carried) {
        stampMine(); refreshPins(); scheduleList();
        saveName().then(ok => { if (!ok) announce('Your name could not be saved for everyone just now. It will be tried again next time.'); });
      }
      announce('You are now ' + v + (carried ? '. Your notes show it too.' : '. Notes you have already left keep the name they were written under.'));
      if (W.openId && threadBox) drawThread();
      box.rest();
    };
    field.addEventListener('input', () => field.classList.remove('warn'));
    /* leaving the row without saving puts it back as it was */
    field.addEventListener('blur', () => setTimeout(() => { if (box.classList.contains('naming') && !box.contains(ROOT.activeElement)) { box.classList.remove('naming'); field.classList.remove('warn'); } }, 0));
    field.addEventListener('keydown', evt => { if (evt.key === 'Enter') { halt(evt); keep(); } });
    box.rest = () => { box.classList.remove('naming'); field.classList.remove('warn'); edit.focus({ preventScroll: true }); };
    return box;
  };
  /* there for anyone the tool had to name itself: under a made-up name, and after, so the name can be changed again */
  const youBox = youParts(NAMED && !READ_ONLY, false);
  /* SIDEBAR.ReadOnly: the foot says why nothing here writes */
  const readParts = show => build('footer', { class: 'you reading', hidden: !show }, build('span', { class: 'as', text: 'You are reading. People with the link can add notes.' }));
  const readBox = readParts(READ_ONLY);
  const panel = build('aside', { 'aria-label': OPTS.sidebarTitle, role: 'region', class: 'loading' },
    build('header', {}, build('h2', {}, build('span', { class: 'lockup' }, build('span', { class: 'brand', 'aria-hidden': 'true' }, eyes()), build('span', {}, NAME[1], NAME[2] ? build('span', { class: 'ext', text: NAME[2] }) : null))), filterTool, moreTool, sideClose, filterMenu, moreMenu),
    build('div', { class: 'tools' }, build('div', { class: 'find' }, icon('search'), q, qClear), READ_ONLY ? null : addTool),
    build('div', { class: 'scroll' },
      build('div', { class: 'loading-rows', 'aria-label': 'Loading notes' }, build('div', { class: 'ghost' }), build('div', { class: 'ghost' }), build('div', { class: 'ghost' })),
      build('div', { class: 'load-failed', role: 'alert' }, build('span', { text: 'Saved notes could not be loaded. ' }), retry),
      build('div', { class: 'listing' }, noneNote, nowBox, awayBox)), youBox, readBox);
  { const sc = panel.querySelector('.scroll'); sc.addEventListener('scroll', () => panel.classList.toggle('scrolled', sc.scrollTop > 0), { passive: true }); }
  ROOT.append(panel);
  const setHideLauncher = off => {
    W.hideLauncher = off; shelf.write('hideLauncher', off);
    tray.classList.toggle('is-hidden', off);
    if (!off) seatTray(false);   // it has no size while hidden
    const box = ROOT.querySelector('input[data-launcher]'); if (box) box.checked = !off;
    sideClose.style.display = off ? 'none' : ''; /* keep the sidebar open so the launcher can be restored */
    if (off && !W.sideOpen) toggleSide(true);
  };
  let hostPad = null;
  const seatSide = glide => {
    panel.classList.toggle('left', W.side === 'left'); panel.classList.toggle('right', W.side !== 'left');
    panel.classList.toggle('shut', !W.sideOpen);
    const rootEl = document.documentElement;
    /* the page's own inline padding, if it set any, is put back whenever the panel's is not there */
    if (!hostPad) hostPad = { Left: rootEl.style.paddingLeft, Right: rootEl.style.paddingRight };
    rootEl.style.paddingLeft = hostPad.Left; rootEl.style.paddingRight = hostPad.Right;
    /* on a phone the panel covers the page: padding it aside would leave a sliver of page nobody can use */
    const taken = W.sideOpen && !sheetMode() ? PANEL_W : 0;
    if (taken) rootEl.style['padding' + (W.side === 'left' ? 'Left' : 'Right')] = taken + 'px';
    /* Padding moves what is in the page's flow. A fixed element, or one sized in vw, is measured against the window and
       never sees it, so the page is also told how much room the panel takes on each side (0px when it takes none), and a
       resize is fired when that changes, which is what a layout script already listens for. */
    const inset = (W.side === 'left' ? taken : 0) + ':' + (W.side === 'left' ? 0 : taken);
    rootEl.style.setProperty('--crittable-inset-left', (W.side === 'left' ? taken : 0) + 'px');
    rootEl.style.setProperty('--crittable-inset-right', (W.side === 'left' ? 0 : taken) + 'px');
    seatTray(glide);
    if (inset !== insetNow) {
      const first = insetNow === null; insetNow = inset;
      if (!first || taken) { telling = true; try { window.dispatchEvent(new Event('resize')); } catch (_) { /* no events here */ } finally { telling = false; } }
    }
  };
  let insetNow = null, telling = false;
  const insetOf = () => ({ side: W.side, inset: W.sideOpen && !sheetMode() ? PANEL_W : 0 });
  addEventListener('resize', () => { if (!telling) seatSide(false); });   // not for the resize we fire ourselves
  const toggleSide = on => {
    W.sideOpen = on; shelf.write('sideOpen', on);
    pinTool.setAttribute('aria-expanded', String(on));
    if (!on) { const hit = openMenu(); if (hit) flipMenu(hit[1], false); }
    seatSide(true); ping(on ? 'panel-opened' : 'panel-closed', insetOf());
    if (on) scheduleList();
  };
  let listDrawn = false;
  const reconcile = (ul, rows) => {
    const live = () => [...ul.children].filter(li => !li.classList.contains('leaving'));
    const have = new Map(live().map(li => [li.dataset.id, li]));
    const animate = listDrawn && !calmMotion();
    rows.forEach((row, i) => {
      let li = have.get(row.id), born = false;
      const sig = JSON.stringify(row.sig);
      if (!li) { li = document.createElement('li'); li.dataset.id = row.id; born = animate;
        li.addEventListener('pointerenter', () => point(row.id, true)); li.addEventListener('pointerleave', () => point(row.id, false)); }
      if (li.dataset.sig !== sig) { li.dataset.sig = sig; li.replaceChildren(...row.build()); }
      li.className = row.cls + (born ? ' entering' : '');
      if (born) setTimeout(() => li.classList.remove('entering'), TIME.fast + TIME.settle);
      const at = live()[i];
      if (at !== li) ul.insertBefore(li, at || null);
      have.delete(row.id);
    });
    for (const li of have.values()) {
      if (!animate) { li.remove(); continue; }
      li.classList.add('leaving');
      setTimeout(() => { if (li.classList.contains('leaving')) li.remove(); }, TIME.fast + TIME.settle);
    }
  };
  const REASONS = { lost: "Can't be located on this page", hidden: 'Hidden on this page right now', other: 'Lives on another page', wait: 'Looking for it…', off: 'Off screen' };
  const rowOf = th => {
    const phase = (spec && spec.id === th.id && spec.phase) || W.status[th.id] || 'wait', fresh = isFresh(th), sel = W.selected === th.id;
    const stamp = since(th.created), n = ordinal(th.id), quote = quoteOf(th);
    const cls = [sel && 'sel', fresh && 'unread', th.resolved && 'resolved', phase === 'other' && 'other', phase === 'off' && 'off',
      (phase === 'lost' || phase === 'hidden') && 'lost', inFlight.has(th.id) && 'resolving'].filter(Boolean).join(' ');
    const where = phase === 'other' ? th.route : phase === 'shown' || phase === 'wait' ? 'This page' : REASONS[phase];
    return {
      id: th.id, cls,
      sig: [th.text, quote, th.authorName, th.replies.length, fresh, th.resolved, phase, sel, n, stamp, th.route, inFlight.has(th.id)],
      build: () => [
        build('button', { class: 'pick', type: 'button', title: REASONS[phase] && phase !== 'wait' ? REASONS[phase] : since(th.created, true), 'aria-current': sel ? 'true' : null, on: { click: () => { fromRow = th.id; jumpTo(th.id); } } },
          badge(th),
          build('span', { class: 'txt' },
            where === 'This page' ? null : build('span', { class: 'meta', text: where }),
            build('span', { class: 'who' }, build('b', { text: th.authorName }), build('time', { text: stamp }), fresh ? build('span', { class: 'dot', 'aria-hidden': 'true' }) : null, build('span', { class: 'meta', text: '#' + n })),
            quote ? build('span', { class: 'q', text: quote }) : null,
            build('span', { class: 'ex', text: th.text }),
            th.replies.length ? build('span', { class: 'replies', text: th.replies.length + (th.replies.length === 1 ? ' reply' : ' replies') }) : null,
            build('span', { class: 'sr', text: (fresh ? 'Unread. ' : '') + (th.resolved ? 'Resolved.' : '') }))),
        build('span', { class: 'side-tools' },
          fresh ? null : (() => { const b = build('button', { class: 'tick', type: 'button', 'aria-label': 'Mark note ' + n + ' as unread', title: 'Mark as unread', on: { click: () => markUnread(th.id) } }); b.append(icon('unread')); return b; })(),
          READ_ONLY ? null : (() => { const b = build('button', { class: 'tick', type: 'button', 'aria-pressed': String(!!th.resolved), 'aria-label': th.resolved ? 'Reopen note ' + n : 'Resolve note ' + n, title: th.resolved ? 'Reopen' : 'Resolve', on: { click: () => toggleDone(th.id) } }); b.append(icon('tick')); return b; })())
      ]
    };
  };
  let listPending = false;
  const scheduleList = () => { if (listPending) return; listPending = true; requestAnimationFrame(() => { listPending = false; drawList(); }); };
  const showEmpty = (kind, share = CAN_SHARE) => {
    noneNote.dataset.state = kind;
    emptyShare.hidden = !(share && kind === 'NoThreads');
    const way = { NoThreads: READ_ONLY ? null : ['Add note', () => addTool.click()], NoMatch: ['Clear search', () => qClear.click()], AllHidden: !W.showResolved && W.threads.some(th => th.resolved) ? ['Show resolved', () => { const b = filterMenu.querySelector('[data-resolved]'); b.checked = true; b.dispatchEvent(new Event('change')); }] : null }[kind];
    const words = {
      NoThreads: READ_ONLY ? ['No notes yet', 'When people with the link add notes, they will show here.'] : ['No notes yet', 'Add one, then click the page where it belongs. ' + keyCap('add') + ' does the same.'],
      NoMatch: ['No notes match this search', 'Try other words or clear the search.'],
      AllHidden: ['Nothing to show', 'Resolved notes or filters may be hiding them.']
    }[kind];
    emptyGlyph.hidden = kind !== 'NoThreads';
    emptyMain.textContent = words[0]; emptyHint.textContent = words[1];
    emptyWay.hidden = !way; if (way) { emptyWay.textContent = way[0]; emptyWay.onclick = way[1]; }
  };
  const drawList = () => {
    const changed = W.sort !== 'new' || W.showResolved;
    filterTool.classList.toggle('filtered', changed);
    filterTool.setAttribute('aria-label', changed ? 'Sort and filter, changed from the default' : 'Sort and filter'); filterTool.title = changed ? 'Sort and filter (changed)' : 'Sort and filter';
    markAll.disabled = !W.threads.some(isFresh); syncChecks();
    panel.classList.toggle('loading', !!W.loading); panel.classList.toggle('fail', !!W.loadFailed);
    if (!W.sideOpen) return;
    const keep = th => th.text.trim() && (W.showResolved || !th.resolved) && (!W.query || [th.text, th.authorName, th.route].some(s => s.toLowerCase().includes(W.query)));
    const order = (a, b) => (W.sort === 'unread' && isFresh(a) !== isFresh(b)) ? (isFresh(a) ? -1 : +1) : b.created - a.created;
    const shown = W.threads.filter(keep).sort(order);
    const mineHere = shown.filter(th => th.route === W.route), others = shown.filter(th => th.route !== W.route);
    nowHead.textContent = 'This page (' + mineHere.length + ')';
    awayHead.textContent = 'Other pages (' + others.length + ')';
    nowBox.hidden = !mineHere.length; awayBox.hidden = !others.length; noneNote.hidden = shown.length > 0;
    if (!shown.length) showEmpty(!W.threads.length ? 'NoThreads' : W.query ? 'NoMatch' : 'AllHidden');
    reconcile(nowList, mineHere.map(rowOf)); reconcile(awayList, others.map(rowOf));
    listDrawn = true;
  };
  const jumpTo = (id, walk) => {
    const th = lookup(id);
    if (!th) return;
    /* on a phone the panel covers the page, so it steps aside for the note it was asked to open */
    if (sheetMode() && W.sideOpen) toggleSide(false);
    if (th.route !== W.route) { if (!samePage(th.route)) return; handoff.put({ id, sidebar: W.sideOpen }); location.assign(new URL(th.route, location.href).href); return; }   // never follow an address that is not a page on this site; resolved against this page, as samePage judged it, not against a <base>
    const elm = resolveEl(th);
    if (elm) {
      const b = elm.getBoundingClientRect(), seen = Math.max(0, Math.min(b.bottom, innerHeight) - Math.max(b.top, 0));
      if (seen < b.height / 2) elm.scrollIntoView({ block: 'center', behavior: calmMotion() ? 'auto' : 'smooth' });
      blink(elm);
    }
    showThread(id, walk);
  };

  /* ---------- routes and page changes ---------- */
  const routeChanged = () => {
    const next = whereAmI();
    if (next === W.route) return;
    W.route = next; W.tries = bare(); W.rounds = bare(); W.stale = bare(); W.status = bare();
    stopMove(); shutThread(false); dropDraft(); dropPeek();
    refreshPins(); scheduleList();
  };
  for (const name of ['pushState', 'replaceState']) {
    const orig = history[name];
    history[name] = function () { const out = orig.apply(this, arguments); queueMicrotask(routeChanged); return out; };
  }
  addEventListener('popstate', routeChanged);
  addEventListener('hashchange', routeChanged);
  addEventListener('resize', () => wake());
  /* The page changed, so a lost pin may have somewhere to sit now. It is looked for again, but each time one is looked
     for and not found it waits twice as long before the next look (1s, 2s … 30s): on a page that changes every second,
     a clock say, every lost pin would otherwise be searched for all over again every second. A pin still being looked
     for is left to finish. When the wait is not over yet, the look happens when it is, change or no change. */
  let relookWait = 0;
  const relook = () => {
    const now = clock(); let next = 0;
    for (const id in W.stale) {
      const due = (W.lostAt[id] || 0) + Math.min(30000, 500 * 2 ** (W.rounds[id] || 1));
      if (now >= due) { W.tries[id] = 0; delete W.stale[id]; } else next = next ? Math.min(next, due) : due;
    }
    clearTimeout(relookWait); if (next) relookWait = setTimeout(relook, next - now + 10);
    wake();
  };
  let rev = 0;
  new MutationObserver(muts => {
    if (muts.every(m => ours({ composedPath: () => [m.target] }))) return;
    clearTimeout(rev);
    rev = setTimeout(() => {
      for (const id in W.tries) if (W.tries[id] >= 6) W.stale[id] = true;
      seenMemo.clear(); for (const [id, c] of spanCache) if (!c.rg) spanCache.delete(id);
      relook();
    }, TIME.retry);
  }).observe(document.body, { subtree: true, childList: true, characterData: true });

  /* ---------- boot ---------- */
  let booted = false;
  /* SYNC: with a shared store, other people's notes and replies arrive while the page is open. The store either pushes
     (watch) or is asked again every few seconds. What comes back is merged into the notes already here, keeping the
     same objects, so an open card, a half-written reply or an edit in progress is not disturbed. */
  const writing = new Map();
  const hold = id => writing.set(id, (writing.get(id) || 0) + 1);
  const release = id => { const n = (writing.get(id) || 1) - 1; if (n > 0) writing.set(id, n); else writing.delete(id); };
  /* A load takes time, and what it brings back is the store as it was when the load began. So a note written here since
     then (made, moved, changed, deleted) keeps what this page knows, and the next load settles it. `wrote` is when. */
  const wrote = new Map();
  const settle = id => { inFlight.delete(id); wrote.set(id, clock()); };
  let syncing = false, again = false;
  const shape = th => JSON.stringify([th.text, th.resolved, th.edited, th.authorName, (th.replies || []).map(r => [r.id, r.text, r.edited, r.authorName])]);
  const sync = async () => {
    if (!booted || document.hidden) return;
    /* asked while a load is under way (a store that pushes says so for every change): remembered, and done once that load is in */
    if (syncing) { again = true; return; }
    syncing = true;
    const began = clock(), since = id => (wrote.get(id) || 0) >= began, rerun = () => { if (again) { again = false; setTimeout(sync, TIME.retry); } };
    let list;
    try { list = readable(await depot.load()); } catch (_) { syncing = false; if (++misses >= 2) setStore(false); rerun(); return; }   // a missed beat is not an error; two in a row is the store being down
    syncing = false; misses = 0; setStore(true); W.loadFailed = false;
    const have = new Map(W.threads.map(th => [th.id, th])), open = W.openId ? lookup(W.openId) : null, before = open ? shape(open) : '';
    const next = [];
    for (const row of (list || []).filter(th => th && th.text && th.text.trim() && th.anchor)) {
      row.replies = row.replies || [];
      const cur = have.get(row.id);
      if (!cur) { if (!since(row.id)) next.push(row); else again = true; continue; }   // deleted here after the load began: it does not come back
      if (since(row.id)) again = true;   // written here since: this load is older than what the page knows, so ask once more
      if (!inFlight.has(row.id) && !writing.has(row.id) && !since(row.id)) {
        const olds = new Map(cur.replies.filter(r => r.id).map(r => [r.id, r]));
        row.replies = row.replies.map(r => r.id && olds.has(r.id) ? Object.assign(olds.get(r.id), r) : r);
        if (JSON.stringify(cur.anchor) !== JSON.stringify(row.anchor)) { memoEl.delete(cur.id); spanCache.delete(cur.id); W.tries[cur.id] = 0; W.rounds[cur.id] = 0; }
        Object.assign(cur, row);
      }
      next.push(cur);
    }
    { const kept = new Set(next); for (const th of W.threads) if ((inFlight.has(th.id) || writing.has(th.id) || since(th.id)) && !kept.has(th)) next.push(th); }
    W.threads = next;
    if (W.moving != null && !lookup(W.moving)) stopMove();
    for (const [id, at] of wrote) if (at < began - 60000) wrote.delete(id);
    if (open) {
      if (!lookup(open.id)) shutThread(false);
      else if (shape(open) !== before) { logSeen(open.id); if (!editing && !editReply && !askDelete && !askReply) drawThread(); }
    }
    refreshPins(); scheduleList();
    rerun();
  };
  const startSync = () => {
    if (!SHARED) return;
    if (typeof depot.watch === 'function') { try { depot.watch(() => sync()); } catch (_) { /* fall back to asking */ } }
    setInterval(sync, typeof depot.watch === 'function' ? TIME.syncSlow : (depot.poll || TIME.sync));
    document.addEventListener('visibilitychange', () => { if (!document.hidden) sync(); });
  };
  /* Is the shared store answering? One answer, told to the host page each time it changes; what to do about it is theirs.
     Heard from the adapter when it can say (status), and from our own loads either way. */
  let storeUp = null, misses = 0;
  const setStore = up => {
    if (!SHARED || up === storeUp) return;
    const back = up && storeUp === false; storeUp = up;
    ping('store', { up });
    try { window.dispatchEvent(new CustomEvent('crittable:store', { detail: { up } })); } catch (_) { /* no events here */ }
    if (back) sync();   // it is back: catch up without being asked
  };
  if (SHARED && typeof depot.status === 'function') { try { depot.status(up => setStore(!!up)); } catch (_) { /* our own loads will say */ } }
  /* A name is who someone is now, not who they were when they wrote: change it and every note and reply of theirs shows
     the new one. On a shared store that takes the store's help (backend.setName, which keeps one name per person and
     names them by the store's own record of who wrote what); one that cannot gives each note the name it was written
     under, as before. A board kept in this browser has one person, who is always the one reading. */
  const namesFollow = () => !SHARED || (!READ_ONLY && typeof depot.setName === 'function');
  const stampMine = () => {
    if (me.id === 'anon') return;
    for (const th of W.threads) {
      if (th.authorId === me.id) th.authorName = me.name;
      for (const r of th.replies || []) if (r && r.authorId === me.id) r.authorName = me.name;
    }
  };
  /* Saved for everyone only once there is something of theirs to put it on: a visitor who only reads leaves no name
     behind, so the store does not become a list of everyone who came. A made-up name is never saved: it is only ever
     this browser's, and the notes already carry it. Resolves to false when it could not be saved. */
  const hasWritten = () => me.id !== 'anon' && W.threads.some(th => th.authorId === me.id || (th.replies || []).some(r => r && r.authorId === me.id));
  const saveName = async () => {
    if (!SHARED || READ_ONLY || typeof depot.setName !== 'function' || me.alias || me.id === 'anon' || !me.name || me.name === OPTS.anonymousName || !hasWritten()) return true;
    try { await depot.setName(me.name); return true; } catch (_) { return false; }
  };
  const loadAll = async () => {
    W.loading = true; W.loadFailed = false; scheduleList();
    let list = [];
    /* Three seconds is how long the panel waits before saying so, not a verdict on the store: a slow answer is still an
       answer, and is taken up when it comes. Only a refusal, or no answer at all, is the store being down. */
    const asked = depot.load(); let slow = false;
    try { list = readable(await Promise.race([asked, pause(3000).then(() => { slow = true; throw new Error('slow'); })])); setStore(true); }
    catch (_) {
      W.loadFailed = true; if (!W.sideOpen) warn('Saved notes could not be loaded.');   // the panel says so itself when it is open
      if (slow) asked.then(() => sync(), () => setStore(false)); else setStore(false);
    }
    W.loading = false;
    const got = (list || []).filter(th => th && th.text && th.text.trim() && th.anchor);
    const known = new Set(W.threads.map(th => th.id));
    W.threads = W.threads.concat(got.filter(th => !known.has(th.id)));
    for (const th of W.threads) {
      th.replies = th.replies || [];
      /* notes written here before this browser had an id are this browser's, so they show its name like the rest */
      if (!SHARED && me.id !== 'anon' && (th.authorId === 'anon' || th.replies.some(r => r && r.authorId === 'anon'))) {
        const mine = th.authorId !== 'anon' ? {} : NAMED ? { authorId: me.id } : { authorId: me.id, authorName: me.name };
        if (th.replies.some(r => r && r.authorId === 'anon')) { th.replies.forEach(r => { if (r && r.authorId === 'anon') r.authorId = me.id; }); mine.replies = th.replies; }
        Object.assign(th, mine); depot.update(th.id, mine).catch(() => {});
      }
    }
    if (!SHARED) stampMine();
    refreshPins(); scheduleList();
  };
  /* a launcher the reader hid last time stays hidden; the panel it opens needs the list, so this waits until the list is set up */
  if (W.hideLauncher) setHideLauncher(true);
  (async () => {
    if (!shelf.live && !OPTS.backend) warn('Browser storage is unavailable. Notes will be lost on reload.');
    if (shelf.read('placing', false)) setAiming(true);
    /* panelOpen: true opens it on a first visit and then remembers what the reader did; 'always' opens it on every load
       (a page whose point is to show the panel). Never on a phone, where it would cover the page. */
    if (OPTS.panelOpen === 'always' ? !sheetMode() : shelf.read('sideOpen', !!OPTS.panelOpen && !sheetMode())) toggleSide(true); else seatSide();
    try { await findGravatar(); } catch (_) {}
    if (SHARED && typeof depot.whoami === 'function') { try { const w = await depot.whoami(); if (w && w.id) Object.assign(me, w); } catch (_) { /* stay as we are */ } }
    await loadAll();
    /* a name chosen before names were kept for everyone, or one the page gives, reaches the notes already written */
    if (!W.loadFailed) saveName();
    booted = true;
    startSync();
    const pending = handoff.take();
    if (pending) setTimeout(() => { if (pending.sidebar) toggleSide(true); if (lookup(pending.id)) jumpTo(pending.id); }, TIME.arrive);
    if (typeof OPTS.stateSheet === 'function') {
      /* PARTS: specimens are made by the product's own builders, with `spec` and the card's state set for the length of one build */
      const as = (th, v, fn) => {
        const saved = [spec, editing, askDelete, editReply, askReply, cardMenu, cardErr, replyDraft, W.selected, W.status[th.id]], busy = inFlight.has(th.id);
        spec = { id: th.id, n: v.n || 4, fresh: !!v.unread, phase: v.phase };
        editing = v.editing ? th.id : null; askDelete = !!v.askDelete; editReply = v.editReply ? th.replies[v.editReply - 1] : null; askReply = v.askReply ? th.replies[v.askReply - 1] : null;
        cardMenu = !!v.menu; cardErr = v.err || ''; replyDraft = v.replyText || ''; if (v.sel) W.selected = th.id; if (v.phase) W.status[th.id] = v.phase; if (v.busy) inFlight.add(th.id);
        try { return fn(); }
        finally { [spec, editing, askDelete, editReply, askReply, cardMenu, cardErr, replyDraft, W.selected] = saved; if (saved[9] === undefined) delete W.status[th.id]; else W.status[th.id] = saved[9]; if (!busy) inFlight.delete(th.id); }
      };
      let clones = 0;
      const bare = el => { el.removeAttribute('style'); el.removeAttribute('id'); el.querySelectorAll('[id]').forEach(n => n.removeAttribute('id')); return el; };
      const parts = {
        me,
        pin: (th, v = {}) => as(th, v, () => { const e = { btn: build('button', { class: 'pin', type: 'button' }) }; dressPin(e, th); e.btn.setAttribute('aria-expanded', String(!!v.open)); return e.btn; }),
        wash: () => build('div', { class: 'wash on', 'aria-hidden': 'true' }),
        dock: () => { const d = bare(tray.cloneNode(true)); d.className = 'dock'; d.querySelectorAll('button').forEach(b => { b.className = ''; b.removeAttribute('style'); }); return d; },
        peek: (th, v = {}) => as(th, v, () => peekCard(th)),
        thread: (th, v = {}) => as(th, v, () => { const c = buildThread(th, !!v.adrift).card; if (!v.entering) c.classList.add('steady'); return c; }),
        composer: () => composerParts({ esc() {}, commit() {} }),
        you: naming => youParts(true, !!naming, aliasFor('a made-up person')),
        reading: () => readParts(true),
        row: (th, v = {}) => as(th, v, () => { const r = rowOf(th), li = document.createElement('li'); li.className = r.cls; li.append(...r.build()); return li; }),
        /* a cloned radio would join the live group and steal its choice, so each clone gets its own group name and the live choices copied in */
        menu: which => { const src = which === 'filter' ? filterMenu : moreMenu, m = bare(src.cloneNode(true)), from = src.querySelectorAll('input'), into = [...m.querySelectorAll('input')], tag = '-spec' + (++clones);
          m.hidden = false; into.forEach(i => { if (i.type === 'radio') i.name += tag; });
          into.forEach((i, n) => { i.checked = from[n].checked; i.closest('label').setAttribute('aria-checked', String(i.checked)); });
          if (which === 'share' || which === 'copied') { const item = shareItem(); if (which === 'copied') item.textContent = 'Link copied'; m.querySelectorAll('[data-share], [data-share] + hr').forEach(n => n.remove()); m.prepend(item, build('hr')); }
          return m; },
        panel: () => { const a = bare(panel.cloneNode(true)); a.className = 'right'; a.querySelectorAll('.menu').forEach(m => m.remove()); a.querySelectorAll('ul').forEach(u => u.replaceChildren());
          a.querySelectorAll('section').forEach(s => { s.hidden = true; }); a.querySelectorAll('.icb').forEach(b => { b.classList.remove('filtered'); b.setAttribute('aria-expanded', 'false'); }); return a; },
        empty: (kind, share = false) => { const was = noneNote.dataset.state, hid = noneNote.hidden; showEmpty(kind, share); const c = bare(noneNote.cloneNode(true)); c.hidden = false; if (was) showEmpty(was); noneNote.hidden = hid; return c; },
        toast: n => { const s = spec; spec = { id: '~toast', n }; try { return toastEl('~toast', () => {}); } finally { spec = s; } },
        banner: bannerEl
      };
      try { OPTS.stateSheet({ parts, build, icon, badge, colourOf, lettersOf, TOKENS, SCALE, GLOSSARY_SKIN: SKIN, mount: (el, theme) => {
        const root = el.attachShadow({ mode: 'open' }); root.append(build('style', { text: SKIN }));
        if (theme) el.dataset.theme = theme; return root; } }); } catch (e) { if (window.console) console.warn(e); }
    }
  })();
})();
