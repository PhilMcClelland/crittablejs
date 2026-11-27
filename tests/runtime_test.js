// Runtime test for crittable/pinwall.js: no npm deps, a minimal hand-rolled DOM stub, loads the shipped file untouched.
// Covers: anchor save + re-resolve after reload, optimistic reply rollback on store failure, Esc ladder order.
// Run: node tests/runtime_test.js
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const DEMO = path.join(__dirname, '..', 'crittable');

/* ---------- minimal DOM stub ---------- */
class TextNode {
  constructor(s) { this.nodeValue = String(s); this.parentNode = null; }
  get textContent() { return this.nodeValue; }
  remove() { if (this.parentNode) this.parentNode.children.splice(this.parentNode.children.indexOf(this), 1); this.parentNode = null; }
}
const BOOLS = ['hidden', 'disabled', 'checked', 'readOnly'];
const ATTR_OF = { readOnly: 'readonly' };
class Element {
  constructor(tag, doc) {
    this.tagName = String(tag).toUpperCase(); this.localName = String(tag).toLowerCase(); this.ownerDocument = doc;
    this.attrs = {}; this.children = []; this.parentNode = null; this.listeners = []; this.dataset = {}; this.value = ''; this.scrollTop = 0;
    const set = new Set();
    this.classList = {
      add: (...c) => c.forEach(x => set.add(x)), remove: (...c) => c.forEach(x => set.delete(x)), contains: c => set.has(c),
      toggle: (c, on) => { const want = on === undefined ? !set.has(c) : !!on; want ? set.add(c) : set.delete(c); return want; },
      [Symbol.iterator]: () => set[Symbol.iterator](), _set: set };
    const props = {};
    this.style = { setProperty: (k, v) => { props[k] = v; }, getPropertyValue: k => props[k] || '', set cssText(v) {} };
  }
  get className() { return [...this.classList._set].join(' '); }
  set className(v) { this.classList._set.clear(); String(v).split(/\s+/).filter(Boolean).forEach(c => this.classList._set.add(c)); }
  get id() { return this.attrs.id || ''; } set id(v) { this.attrs.id = String(v); }
  get parentElement() { return this.parentNode instanceof Element ? this.parentNode : null; }
  get isConnected() { let n = this; while (n) { if (n === n.ownerDocument) return true; n = n.parentNode || n.host; } return false; }
  get textContent() { return this.children.map(c => c.textContent).join(''); }
  set textContent(v) { this.children.splice(0).forEach(c => { c.parentNode = null; }); if (String(v) !== '') this.append(String(v)); }
  get offsetWidth() { return 100; } get offsetHeight() { return 20; }
  getBoundingClientRect() { return { left: 10, top: 10, right: 110, bottom: 30, width: 100, height: 20 }; }
  setAttribute(k, v) { if (k === 'class') this.className = v; else this.attrs[k] = String(v); }
  getAttribute(k) { if (k === 'class') return this.className; return k in this.attrs ? this.attrs[k] : null; }
  removeAttribute(k) { delete this.attrs[k]; }
  toggleAttribute(k, on) { if (on) this.attrs[k] = ''; else delete this.attrs[k]; }
  append(...kids) {
    for (const k of kids) {
      const n = typeof k === 'string' ? new TextNode(k) : k;
      if (n.parentNode) n.remove();
      n.parentNode = this; this.children.push(n);
    }
  }
  replaceChildren(...kids) { this.children.splice(0).forEach(c => { c.parentNode = null; }); this.append(...kids); }
  insertBefore(n, ref) { if (n.parentNode) n.remove(); n.parentNode = this; const i = ref ? this.children.indexOf(ref) : -1; this.children.splice(i < 0 ? this.children.length : i, 0, n); }
  remove() { if (this.parentNode) { this.parentNode.children.splice(this.parentNode.children.indexOf(this), 1); this.parentNode = null; } }
  contains(n) { for (; n; n = n.parentNode || n.host) if (n === this) return true; return false; }
  attachShadow() { const r = new Shadow(this); this.shadowRoot = r; return r; }
  addEventListener(type, fn, cap) { this.listeners.push({ type, fn, cap: cap === true || (cap && cap.capture) }); }
  dispatchEvent(evt) { return dispatch(this, evt); }
  click() { dispatch(this, mkEvent('click', { button: 0 })); }
  focus() {
    let n = this; while (n.parentNode) n = n.parentNode;
    if (n instanceof Shadow) { n.activeElement = this; this.ownerDocument.activeElement = n.host; } else this.ownerDocument.activeElement = this;
  }
  blur() {} select() {} setSelectionRange() {} scrollIntoView() {} setPointerCapture() {} releasePointerCapture() {} hasPointerCapture() { return false; }
  querySelectorAll(sel) { return queryAll(this, sel); }
  querySelector(sel) { return queryAll(this, sel)[0] || null; }
}
BOOLS.forEach(b => Object.defineProperty(Element.prototype, b, {
  get() { return (ATTR_OF[b] || b) in this.attrs; }, set(v) { if (v) this.attrs[ATTR_OF[b] || b] = ''; else delete this.attrs[ATTR_OF[b] || b]; } }));
class Shadow {
  constructor(host) { this.host = host; this.children = []; this.parentNode = null; this.ownerDocument = host.ownerDocument; this.activeElement = null; }
  append(...kids) { Element.prototype.append.apply(this, kids); }
  contains(n) { return Element.prototype.contains.call(this, n); }
  querySelectorAll(sel) { return queryAll(this, sel); }
  querySelector(sel) { return queryAll(this, sel)[0] || null; }
}
const walk = (root, out = []) => { for (const c of root.children) if (c instanceof Element) { out.push(c); walk(c, out); } return out; };
function compound(el, part) {
  // supports: tag, #id, .class, [a], [a=v], [a^="v"], :checked, :disabled, :not(:disabled); anything else never matches
  const re = /^[a-zA-Z][\w-]*|#[\w-]+|\.[\w-]+|\[[^\]]+\]|:not\(:disabled\)|:checked|:disabled/g;
  const toks = part.match(re) || [];
  if (toks.join('') !== part) return false;
  return toks.every(t => {
    if (t[0] === '#') return el.id === t.slice(1);
    if (t[0] === '.') return el.classList.contains(t.slice(1));
    if (t === ':checked') return el.checked;
    if (t === ':disabled') return el.disabled;
    if (t === ':not(:disabled)') return !el.disabled;
    if (t[0] === '[') {
      const m = /^\[([\w-]+)(?:([\^*]?)=("?)([^"\]]*)\3(?: i)?)?\]$/.exec(t);
      if (!m) return false;
      const v = el.getAttribute(m[1]);
      if (m[4] === undefined) return v !== null;
      return v !== null && (m[2] === '^' ? v.startsWith(m[4]) : m[2] === '*' ? v.includes(m[4]) : v === m[4]);
    }
    return el.localName === t.toLowerCase();
  });
}
function queryAll(root, sel) {
  const all = walk(root), out = new Set();
  for (const alt of String(sel).split(',')) {
    const parts = alt.trim().split(/\s*>\s*|\s+/);
    for (const el of all) {
      if (!compound(el, parts[parts.length - 1])) continue;
      let ok = true, at = el;
      for (let i = parts.length - 2; i >= 0 && ok; i--) {
        at = at.parentElement; while (at && !compound(at, parts[i])) at = at.parentElement;
        ok = !!at;
      }
      if (ok) out.add(el);
    }
  }
  return [...out];
}
const mkEvent = (type, extra) => Object.assign({ type, button: 0, clientX: 0, clientY: 0, key: '', shiftKey: false, isComposing: false, _stop: false, _prevented: false,
  preventDefault() { this._prevented = true; }, stopPropagation() { this._stop = true; } }, extra);
function dispatch(target, evt) {
  evt.target = target;
  const path = []; for (let n = target; n; n = n.parentNode || n.host) path.push(n);
  evt.composedPath = () => path;
  const fire = (node, cap) => { for (const l of node.listeners.slice()) if (l.type === evt.type && !!l.cap === cap) l.fn.call(node, evt); };
  for (let i = path.length - 1; i >= 0 && !evt._stop; i--) if (path[i].listeners) fire(path[i], true);
  for (let i = 0; i < path.length && !evt._stop; i++) if (path[i].listeners) fire(path[i], false);
  return !evt._prevented;
}
const document = new (class extends Element {})('#document', null);
document.ownerDocument = document;
document.documentElement = new Element('html', document); document.head = new Element('head', document); document.body = new Element('body', document);
document.documentElement.style = Object.assign(document.documentElement.style, {}); document.documentElement.append(document.head, document.body);
document.append(document.documentElement);
document.createElement = tag => new Element(tag, document);
document.getElementsByTagName = tag => walk(document).filter(e => e.localName === String(tag).toLowerCase());
document.createRange = () => ({}); document.activeElement = document.body;

/* ---------- globals pinwall.js and store.js expect ---------- */
const mem = {};
const medium = { get length() { return Object.keys(mem).length; }, key: i => Object.keys(mem)[i], getItem: k => (k in mem ? mem[k] : null),
  setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } };
Object.assign(globalThis, { window: globalThis, document, Element, NodeFilter: { SHOW_TEXT: 4 }, localStorage: medium, innerWidth: 1000, innerHeight: 800,
  location: { href: 'http://localhost/', protocol: 'http:', host: 'localhost', origin: 'http://localhost', pathname: '/', search: '', hash: '', assign() {} }, history: { pushState() {}, replaceState() {} }, getComputedStyle: () => ({ display: 'block', visibility: 'visible', opacity: '1', zIndex: 'auto', getPropertyValue: () => '' }),
  MutationObserver: class { observe() {} }, matchMedia: () => ({ matches: false }), getSelection: () => ({ isCollapsed: true, rangeCount: 0 }) });
const frames = [];
globalThis.requestAnimationFrame = fn => frames.push(fn);
const flushFrames = () => frames.splice(0).forEach(f => f());
globalThis.addEventListener = () => {};
try { Object.defineProperty(globalThis, 'sessionStorage', { value: { getItem: () => null, removeItem() {}, setItem() {} }, configurable: true }); } catch (_) { /* keep default */ }
require(path.join(DEMO, 'store.js'));
const SRC = fs.readFileSync(path.join(DEMO, 'pinwall.js'), 'utf8');

const tick = (ms = 0) => new Promise(r => setTimeout(r, ms));
const settle = async () => { for (let i = 0; i < 5; i++) await tick(0); };

/* A fresh page + fresh pinwall instance around a given backend. */
async function boot(backend, opts, user = { id: 'me', name: 'Tester' }, kept = {}) {
  for (const h of document.body.children.slice()) h.remove();
  document.body.append(Object.assign(document.createElement('div'), {}));
  const target = document.createElement('div'); target.id = 'target'; target.append('Hello there');
  document.body.children.splice(0).forEach(c => { c.parentNode = null; });
  document.body.append(target);
  delete globalThis['__pin-note-board'];
  Object.keys(mem).forEach(k => delete mem[k]);
  for (const k in kept) mem['crittable.' + k] = JSON.stringify(kept[k]);   // what this browser kept from an earlier visit
  document.activeElement = document.body;
  globalThis.CRITTABLE_CONFIG = Object.assign({ backend }, opts);
  if (user) globalThis.CRITTABLE_USER = user; else delete globalThis.CRITTABLE_USER;
  vm.runInThisContext(SRC, { filename: 'pinwall.js' });
  await settle();
  const host = document.body.children.find(c => c.localName === 'pin-note-board');
  return { root: host.shadowRoot, target, host };
}
const memoryBackend = (seed, hooks = {}) => {
  const rows = JSON.parse(JSON.stringify(seed || []));
  return { rows,
    async load() { return JSON.parse(JSON.stringify(rows)); },
    async create(th) { if (hooks.create) await hooks.create(th); rows.push(JSON.parse(JSON.stringify(th))); return th; },
    async update(id, patch) { if (hooks.update) await hooks.update(id, patch); Object.assign(rows.find(r => r.id === id), JSON.parse(JSON.stringify(patch))); },
    async remove(id) { rows.splice(rows.findIndex(r => r.id === id), 1); } };
};
const key = (key, extra) => mkEvent('keydown', Object.assign({ key }, extra));
const editorRoot = () => { const h = document.body.children.find(c => c.localName === 'pin-note-board-editor'); return h ? h.shadowRoot : null; };
const pinTool = root => root.querySelector('.dock button');
const byLabel = (root, l) => root.querySelectorAll('button').find(b => b.getAttribute('aria-label') === l);
const aiming = root => pinTool(root).classList.contains('on');
const results = [];
const test = async (name, fn) => { await fn(); results.push(name); };

(async () => {
  /* ---------- 1. anchor save + re-resolve ---------- */
  await test('anchor: save, reload, re-resolve', async () => {
    const be = memoryBackend();
    let { root, target } = await boot(be);
    dispatch(document.body, key('c'));                                  // shortcut turns placing on
    assert(aiming(root), 'placing mode should be on after the shortcut');
    dispatch(target, mkEvent('click', { clientX: 40, clientY: 25 }));   // click the page => draft + composer
    const ed = editorRoot(); assert(ed, 'composer should open on page click');
    const field = ed.querySelector('textarea'); field.value = 'anchored note';
    dispatch(field, mkEvent('input'));
    ed.querySelector('.send').click(); await settle();
    assert.strictEqual(be.rows.length, 1, 'note should be stored');
    assert.strictEqual(be.rows[0].v, 1, 'a new note says which format wrote it');
    const a = be.rows[0].anchor;
    assert.deepStrictEqual([a.k, a.v, a.dx, a.dy], ['css', '#target', 30, 15], 'anchor should be id selector + offset from element corner');
    flushFrames();   // the box stays up for the one frame the new pin needs to be seated, then hands over to the note
    assert.strictEqual(editorRoot() === null, true, 'composer closes after save');
    assert.strictEqual(root.querySelectorAll('button.pin').length, 1, 'pin appears after save');

    // simulated reload: brand-new page and instance, same stored rows (JSON round-tripped)
    const again = await boot(memoryBackend(be.rows));
    const pin = again.root.querySelector('button.pin'); assert(pin, 'pin restored from storage after reload');
    flushFrames();
    assert.strictEqual(pin.style.transform, 'translate(26px,11px)', 'pin should land on stored offset from the re-resolved element');
    assert.notStrictEqual(pin.style.visibility, 'hidden', 'resolved pin is visible');
    pin.click(); await settle();
    assert(again.root.querySelector('.wash').classList.contains('on'), 'opening the note washes the element the anchor re-resolved to');
    assert(!again.target.style.outline && !again.target.style.boxShadow, 'the host element itself is left alone');
    assert(again.root.querySelector('.thread'), 'thread card opens');
  });

  await test('format: a note or reply from a newer format is left out and left alone', async () => {
    const row = (id, more) => Object.assign({ id, text: 'note ' + id, authorName: 'Other', authorId: 'u2', created: 1, updated: 1, route: '/', resolved: false, replies: [], anchor: { k: 'css', v: '#target', dx: 5, dy: 5 } }, more);
    const be = memoryBackend([row('old'), row('now', { v: 1, replies: [{ id: 'r1', text: 'kept', authorName: 'Other', authorId: 'u2', at: 2 }, { v: 2, id: 'r2', text: 'from the future', authorName: 'Other', authorId: 'u2', at: 3 }] }), row('later', { v: 2 })]);
    const { root } = await boot(be);
    flushFrames();
    assert.strictEqual(root.querySelectorAll('button.pin').length, 2, 'a note with no format and a format-1 note show; a format-2 note does not');
    assert.strictEqual(be.rows.length, 3, 'the newer note is left in the store untouched');
    const pins = root.querySelectorAll('button.pin'); pins[pins.length - 1].click(); await settle();
    const card = root.querySelector('.thread'); assert(card, 'thread card opens');
    assert(card.textContent.includes('kept') && !card.textContent.includes('from the future'), 'a reply from a newer format is left out; the others show');
  });

  await test('hostile store: a malformed note, or one whose page address is not a page on this site, is left out; one with only a bad place is kept, unplaced', async () => {
    const row = (id, more) => Object.assign({ id, text: 'note ' + id, authorName: 'Other', authorId: 'u2', created: 1, updated: 1, route: '/', resolved: false, replies: [], anchor: { k: 'css', v: '#target', dx: 5, dy: 5 } }, more);
    const be = memoryBackend([
      row('good'),
      row('script', { route: 'javascript:alert(1)' }), row('elsewhere', { route: 'https://evil.example/' }), row('other-host', { route: '//evil.example/x' }), row('data', { route: 'data:text/html,x' }),
      row('no-route', { route: null }), row('text-number', { text: 42 }), row('no-anchor', { anchor: null }), row('anchor-list', { anchor: [] }), null, 'a string', 7,
      row('odd-parts', { authorName: { toString: 1 }, authorAvatar: 9, replies: 'none', anchor: { k: 'css', v: '#target', dx: 5, dy: 5, alt: 'not a list' } }),
      row('bad-spares', { anchor: { k: 'css', v: '#target', dx: 5, dy: 5, alt: [null, 5, { k: 'css' }, { k: 'css', v: '#target' }] } }),
      row('bad-selection', { anchor: { k: 'css', v: '#target', dx: 'far', dy: 5, sel: { text: 'x', from: -5, to: 2 } } }),
      row('no-selector', { anchor: { k: 'css' } }), row('selector-number', { anchor: { k: 'css', v: 7 } }),
      row('odd-replies', { replies: [null, { text: 5 }, { id: 'r1', text: 'a sound reply', authorName: 'Other', authorId: 'u2', at: 2 }] })
    ]);
    const { root } = await boot(be);
    flushFrames();
    const labels = root.querySelectorAll('button.pin').map(p => p.getAttribute('aria-label'));
    assert.strictEqual(labels.length, 9, 'a note with a bad place is kept (anyone can change a place on a shared store, and that must not hide the note); the rest are left out: ' + JSON.stringify(labels));
    assert.strictEqual(be.rows.length, 18, 'nothing is deleted from the store: what is left out is left alone');
    assert.strictEqual(root.querySelectorAll('button.pin').filter(p => p.style.visibility === 'visible').length, 5, 'and every one of them is placed: a bad note costs nobody else their pin');
    const pins = root.querySelectorAll('button.pin'); pins[pins.length - 1].click(); await settle();
    const card = root.querySelector('.thread'); assert(card && card.textContent.includes('a sound reply'), 'a note with some bad replies opens and shows the good one');
  });

  await test('anchor: a spare description places the pin when the first no longer matches', async () => {
    const rows = [{ id: 's1', text: 'spare', authorName: 'Other', authorId: 'u2', created: 1, updated: 1, route: '/', resolved: false, replies: [],
      anchor: { k: 'css', v: '#renamed-away', score: 10, dx: 30, dy: 15, alt: [{ k: 'css', v: '#also-gone' }, { k: 'css', v: '#target' }] } }];
    const { root } = await boot(memoryBackend(rows));
    const pin = root.querySelector('button.pin'); assert(pin, 'pin drawn');
    flushFrames();
    assert.strictEqual(pin.style.transform, 'translate(26px,11px)', 'pin lands on the element the spare found');
    assert.notStrictEqual(pin.style.visibility, 'hidden', 'pin is visible');
  });

  /* ---------- 2. optimistic reply + rollback ---------- */
  const SEED = [{ id: 't1', text: 'first', authorName: 'Other', authorId: 'u2', created: 1, updated: 1, route: '/', resolved: false, replies: [],
    anchor: { k: 'css', v: '#target', score: 10, dx: 30, dy: 15 } }];
  const sendReply = async (root, text) => {
    const box = root.querySelector('.thread .compose textarea'); box.value = text;
    dispatch(box, mkEvent('input')); dispatch(box, key('Enter'));
  };
  await test('reply: optimistic, then rollback on store failure', async () => {
    let fail = true, gate;
    const be = memoryBackend(SEED, { update: () => { let rel; gate = new Promise(r => { rel = r; }); gate.release = rel; return gate.then(() => { if (fail) throw new Error('down'); }); } });
    const { root } = await boot(be);
    root.querySelector('button.pin').click(); await settle();
    assert.strictEqual(root.querySelectorAll('.thread .msg.reply').length, 0);
    await sendReply(root, 'my reply');
    assert.strictEqual(root.querySelectorAll('.thread .msg.reply').length, 1, 'reply shows immediately (optimistic)');
    assert.strictEqual(root.querySelector('.thread .compose textarea').value, '', 'composer is empty right after send');
    gate.release(); await settle();
    assert.strictEqual(root.querySelectorAll('.thread .msg.reply').length, 0, 'failed reply is rolled back');
    assert.strictEqual(root.querySelector('.thread .compose textarea').value, 'my reply', 'draft text restored for retry');
    const said = root.querySelector('.thread .card-err'); assert(said && /not saved/i.test(said.textContent), 'the card says the reply was not saved');
    assert.strictEqual(root.querySelector('.note-banner'), null, 'no page banner for a failure inside an open card');
    assert.strictEqual(be.rows[0].replies.length, 0, 'nothing persisted');
    // retry succeeds and sticks
    fail = false; await sendReply(root, 'my reply'); gate.release(); await settle();
    assert.strictEqual(root.querySelectorAll('.thread .msg.reply').length, 1, 'retry keeps the reply');
    assert.strictEqual(be.rows[0].replies.length, 1, 'retry persisted');
    assert.strictEqual(root.querySelector('.thread .compose textarea').value, '', 'composer empty after successful send');
  });


  await test('reply: a failed edit or delete is rolled back and said in the card', async () => {
    const seed = [{ id: 't9', text: 'note', authorName: 'Other', authorId: 'u2', created: 1, updated: 1, route: '/', resolved: false,
      replies: [{ authorName: 'Tester', authorId: 'me', text: 'mine', at: 2 }, { authorName: 'Other', authorId: 'u2', text: 'theirs', at: 3 }],
      anchor: { k: 'css', v: '#target', score: 10, dx: 30, dy: 15 } }];
    let fail = true;
    const be = memoryBackend(seed, { update: async () => { if (fail) throw new Error('down'); } });
    const { root } = await boot(be);
    root.querySelector('button.pin').click(); await settle();
    const bodies = () => root.querySelectorAll('.thread .msg.reply .body').map(b => b.textContent);
    const act = l => byLabel(root, l);
    assert(act('Edit your reply') && act('Delete your reply'), 'own reply offers Edit and Delete');
    assert.strictEqual(root.querySelectorAll('.thread .acts').length, 1, "someone else's reply offers neither");
    // edit fails: text rolled back, card says so, nothing stored
    act('Edit your reply').click(); await settle();
    assert.strictEqual(root.querySelector('.thread .compose'), null, 'reply row waits during an edit');
    const box = root.querySelector('.thread .editing textarea'); box.value = 'mine, changed';
    dispatch(box, key('Enter')); await settle();
    assert.deepStrictEqual(bodies().filter(Boolean).includes('mine, changed'), false, 'failed edit is not shown as saved');
    assert(/not saved/i.test((root.querySelector('.thread .card-err') || {}).textContent || ''), 'card says the edit was not saved');
    assert.strictEqual(be.rows[0].replies[0].text, 'mine', 'failed edit not stored');
    assert.strictEqual(root.querySelector('.note-banner'), null, 'no page banner');
    // cancel, then delete fails: reply comes back
    dispatch(root.querySelector('.thread .editing textarea'), key('Escape')); await settle();
    act('Delete your reply').click(); await settle();
    root.querySelector('.thread .confirm .danger').click(); await settle();
    assert.deepStrictEqual(bodies(), ['mine', 'theirs'], 'failed delete puts the reply back');
    assert(/not deleted/i.test((root.querySelector('.thread .card-err') || {}).textContent || ''), 'card says the reply was not deleted');
    // both succeed once the store is back
    fail = false;
    act('Delete your reply').click(); await settle();
    root.querySelector('.thread .confirm .danger').click(); await settle();
    assert.deepStrictEqual(bodies(), ['theirs'], 'reply deleted'); assert.strictEqual(be.rows[0].replies.length, 1, 'delete stored');
  });
  /* ---------- names: who someone is now, on everything they wrote ---------- */
  const byWhom = root => root.querySelectorAll('button.pin').map(p => / by (.*?),/.exec(p.getAttribute('aria-label'))[1]);
  await test('names: on a board kept in this browser, notes written under an old name show the current one', async () => {
    const seed = [{ id: 'n1', text: 'old', authorName: 'Old Me', authorId: 'me', created: 1, updated: 1, route: '/', resolved: false, anchor: { k: 'css', v: '#target', dx: 1, dy: 1 },
      replies: [{ id: 'r1', text: 'mine', authorName: 'Old Me', authorId: 'me', at: 2 }, { id: 'r2', text: 'theirs', authorName: 'Other', authorId: 'u2', at: 3 }] },
      { id: 'n2', text: 'not mine', authorName: 'Other', authorId: 'u2', created: 1, updated: 1, route: '/', resolved: false, replies: [], anchor: { k: 'css', v: '#target', dx: 2, dy: 2 } }];
    const { root } = await boot(memoryBackend(seed));
    assert.deepStrictEqual(byWhom(root), ['Tester', 'Other'], 'my note shows my name now; someone else\'s keeps theirs');
    root.querySelector('button.pin').click(); await settle();
    const who = root.querySelectorAll('.thread .msg.reply .who b').map(b => b.textContent);
    assert.deepStrictEqual(who, ['Tester', 'Other'], 'and so do the replies');
  });
  await test('names: on a shared store, the name is saved for everyone and old notes follow a rename', async () => {
    const said = [];
    const seed = [{ id: 'n1', text: 'old', authorName: 'Inky Otter', authorId: 'me', created: 1, updated: 1, route: '/', resolved: false, replies: [], anchor: { k: 'css', v: '#target', dx: 1, dy: 1 } }];
    const be = Object.assign(memoryBackend(seed), { shared: true, async whoami() { return { id: 'me' }; }, async setName(n) { said.push(n); } });
    const { root } = await boot(be, {}, null, { whoName: 'Early Name' });   // a name chosen under 0.2.0, before names were kept for everyone
    assert.deepStrictEqual(said, ['Early Name'], 'a name chosen before is saved for everyone at load, so notes already written follow it');
    const foot = root.querySelector('footer.you');
    assert(foot && !foot.hidden, 'the name row is there');
    byLabel(root, 'Change your name').click();
    const field = foot.querySelector('.namefield'); field.value = 'New Name';
    dispatch(field, key('Enter')); await settle();
    assert.strictEqual(said[said.length - 1], 'New Name', 'a rename is saved for everyone: ' + JSON.stringify(said));
    assert.deepStrictEqual(byWhom(root), ['New Name'], 'my old note shows the new name at once');
  });
  await test('names: a made-up name is not saved for everyone, and a read-only visitor saves nothing', async () => {
    const said = [];
    const be = Object.assign(memoryBackend(SEED), { shared: true, async whoami() { return { id: 'me' }; }, async setName(n) { said.push(n); } });
    await boot(be, {}, null);
    assert.deepStrictEqual(said, [], 'nothing saved under a made-up name');
    const ro = Object.assign(memoryBackend(SEED), { shared: true, readOnly: true, async whoami() { return { id: 'me' }; }, async setName(n) { said.push(n); } });
    await boot(ro, {}, { id: 'me', name: 'Reader' });
    assert.deepStrictEqual(said, [], 'nothing saved by a reader');
  });
  await test('names: a name the page gives reaches the store at load, only for someone who has written something', async () => {
    const said = [];
    const be = Object.assign(memoryBackend(SEED), { shared: true, async whoami() { return { id: 'me' }; }, async setName(n) { said.push(n); } });
    await boot(be, {}, { id: 'me', name: 'Site Name' });
    assert.deepStrictEqual(said, [], 'a visitor who has written nothing leaves no name behind');
    const mine = SEED.concat([{ id: 'm1', text: 'mine', authorName: 'Old', authorId: 'me', created: 2, updated: 2, route: '/', resolved: false, replies: [], anchor: { k: 'css', v: '#target', dx: 3, dy: 3 } }]);
    const be2 = Object.assign(memoryBackend(mine), { shared: true, async whoami() { return { id: 'me' }; }, async setName(n) { said.push(n); } });
    await boot(be2, {}, { id: 'me', name: 'Site Name' });
    assert.deepStrictEqual(said, ['Site Name'], 'someone with a note saves the name the page gives');
  });
  await test('names: the first note saves a name for someone who had written nothing', async () => {
    const said = [];
    const be = Object.assign(memoryBackend(SEED), { shared: true, async whoami() { return { id: 'me' }; }, async setName(n) { said.push(n); } });
    const { root } = await boot(be, {}, { id: 'me', name: 'Site Name' });
    root.querySelector('button.pin').click(); await settle();
    await sendReply(root, 'a first reply'); await settle();
    assert.deepStrictEqual(said, ['Site Name'], 'the first reply saves it: ' + JSON.stringify(said));
  });
  /* ---------- 3. Esc ladder ---------- */
  await test('esc: one level at a time: menu, draft, thread, placing', async () => {
    const be = memoryBackend(SEED);
    const { root, target } = await boot(be);
    const menus = () => root.querySelectorAll('.menu').filter(m => !m.hidden && m.getAttribute('aria-label') !== 'Note options');
    const esc = () => dispatch(document.body, key('Escape'));
    // rung 1: an open menu closes first, placing stays on
    pinTool(root).click();   // the one launcher opens the panel
    dispatch(document.body, key('c')); assert(aiming(root));
    byLabel(root, 'Sort and filter').click();
    assert.strictEqual(menus().length, 1, 'menu open');
    esc(); assert.strictEqual(menus().length, 0, 'Esc closes the open menu first'); assert(aiming(root), 'placing survives the menu close');
    // rung 2: a draft closes before placing mode ends
    dispatch(target, mkEvent('click', { clientX: 40, clientY: 25 })); assert(editorRoot(), 'draft open');
    esc(); assert.strictEqual(editorRoot(), null, 'Esc drops the draft'); assert(aiming(root), 'placing survives the draft close');
    // rung 3: an open thread closes; placing is its own level
    root.querySelector('button.pin').click(); await settle();
    assert(root.querySelector('.thread'), 'thread open'); assert(aiming(root));
    esc(); await tick(300);
    assert.strictEqual(root.querySelector('.thread'), null, 'Esc closes the thread'); assert(aiming(root), 'placing survives the thread close');
    // rung 4: placing alone
    esc(); assert(!aiming(root), 'Esc leaves placing mode');
    // typing in a field: the document-level ladder ignores Esc from a plain field it does not own
    dispatch(document.body, key('c'));
    const stray = document.createElement('textarea'); document.body.append(stray);
    dispatch(stray, key('Escape')); assert(aiming(root), 'Esc inside a host-page field is left alone');
  });

  console.log('runtime tests passed: ' + results.join('; '));
  process.exit(0);
})().catch(e => { console.error(e && e.stack || e); process.exit(1); });
