#!/usr/bin/env node
// Browser-level behaviour test for crittable/pinwall.js. The static checks cannot see focus, Escape levels or layout;
// this drives the real tool in headless Chrome. It needs playwright-core, which the repo does not depend on:
//   PLAYWRIGHT_CORE=/path/to/node_modules/playwright-core node tests/browser_test.js
// Without it the test is skipped (exit 0) and says so.
'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), assert = require('assert');
let pw;
try { pw = require(process.env.PLAYWRIGHT_CORE || 'playwright-core'); }
catch (_) { console.log('browser test skipped: playwright-core not found (set PLAYWRIGHT_CORE)'); process.exit(0); }
const root = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
/* a shared store for the two-people scenario: one list of notes in memory, read and written over HTTP */
const shared = [];
const storeOp = body => {
  const o = JSON.parse(body || '{}'), th = shared.find(x => x.id === o.id);
  if (o.op === 'create') shared.push(o.th);
  else if (!th) throw new Error('missing');
  else if (o.op === 'update') Object.assign(th, o.patch);
  else if (o.op === 'remove') shared.splice(shared.indexOf(th), 1);
  else if (o.op === 'addReply') { th.replies.push(o.reply); th.updated = Date.now(); }
};
const SHARED_STORE = `window.CRITTABLE_CONFIG = { backend: (() => {
  const send = o => fetch('/__store', { method: 'POST', body: JSON.stringify(o) }).then(r => { if (!r.ok) throw new Error('store'); });
  return { shared: true, poll: 300, load: () => fetch('/__store').then(r => r.json()),
    create: th => send({ op: 'create', th }), update: (id, patch) => send({ op: 'update', id, patch }), remove: id => send({ op: 'remove', id }),
    addReply: (id, reply) => send({ op: 'addReply', id, reply }) }; })() };`;
let storeMock = null;     // tests/persistable_mock.mjs: the Persistable.js Worker's own code, with stand-in storage
let supaMock = null;   // tests/vendor/persistable_supabase_mock.mjs, loaded on first use: stands in for a Supabase project
const server = http.createServer((req, res) => {
  if (/^\/v1\/s\//.test(req.url)) {
    let body = ''; req.on('data', c => { body += c; }); req.on('end', async () => {
      storeMock = storeMock || (await import('./persistable_mock.mjs')).default;
      const headers = {}; for (const k of ['authorization', 'content-type', 'origin']) if (req.headers[k]) headers[k] = req.headers[k];
      const r = await storeMock('http://mock' + req.url, { method: req.method, headers, body: body || undefined });
      res.writeHead(r.status, { 'content-type': 'application/json' }); res.end(await r.text());
    }); return;
  }
  if (/^\/(auth|rest)\/v1\//.test(req.url)) {
    let body = ''; req.on('data', c => { body += c; }); req.on('end', async () => {
      if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
      supaMock = supaMock || (await import('./vendor/persistable_supabase_mock.mjs')).default;
      const sent = { apikey: req.headers.apikey, Authorization: req.headers.authorization };
      const r = await supaMock('http://mock' + req.url, { method: req.method, body: body || undefined, headers: sent });
      res.writeHead(r.status, { 'content-type': 'application/json' }); res.end(await r.text());
    }); return;
  }
  /* a site's token address: it knows its visitors by a cookie, puts each in the review group's space, and turns the rest away */
  if (/^\/__token/.test(req.url)) {
    (async () => {
      const who = (/(?:^|;\s*)who=([a-z]+)/.exec(req.headers.cookie || '') || [])[1];
      if (!who) { res.writeHead(401, { 'content-type': 'text/plain' }); res.end('sign in first'); return; }
      const mock = await import('./persistable_mock.mjs'), { tokenResponse } = await import('./vendor/persistable_token.mjs');
      storeMock = storeMock || mock.default; mock.env.TOKEN_SECRET = mock.env.TOKEN_SECRET || 'made-up-for-the-test-' + 'x'.repeat(24);
      const r = await tokenResponse(mock.env.TOKEN_SECRET, Object.assign({ space: 'review/harbour', person: who }, who === 'ada' ? { name: 'Ada of Harbour' } : who === 'rita' ? { read: true } : {}));
      res.writeHead(200, Object.fromEntries(r.headers)); res.end(await r.text());
    })(); return;
  }
  if (req.url === '/__store') {
    if (req.method === 'GET') { res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(shared)); return; }
    let body = ''; req.on('data', c => { body += c; }); req.on('end', () => { try { storeOp(body); res.writeHead(204); } catch (_) { res.writeHead(404); } res.end(); }); return;
  }
  const file = path.join(root, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' }); fs.createReadStream(file).pipe(res);
});
const seeded = fail => `(() => { const rows = [
  { id: 'mine', text: 'on the button', authorName: 'Guest', authorId: 'anon', created: Date.now() - 6e4, updated: 1, route: '/sample/', resolved: false, replies: [{ authorName: 'Guest', authorId: 'anon', text: 'my reply', at: 2 }], anchor: { k: 'text', tag: 'BUTTON', v: 'Reserve a crate', dx: 20, dy: 8 } },
  { id: 'theirs', text: 'someone else wrote this', authorName: 'Ada Vale', authorId: 'u9', created: Date.now() - 7e4, updated: 1, route: '/sample/', resolved: false, replies: [], anchor: { k: 'text', tag: 'BUTTON', v: 'Order a bunch', dx: 20, dy: 8 } },
  { id: 'gone', text: 'target is gone', authorName: 'Guest', authorId: 'anon', created: Date.now() - 9e4, updated: 1, route: '/sample/', resolved: false, replies: [], anchor: { k: 'css', v: '#no-such-thing', dx: 5, dy: 5 } }];
  window.CRITTABLE_CONFIG = { backend: { async load() { return JSON.parse(JSON.stringify(rows)); }, async create(t) { rows.push(t); return t; },
    async update(id, p) { if (${fail}) throw new Error('down'); Object.assign(rows.find(r => r.id === id), p); }, async remove(id) { rows.splice(rows.findIndex(r => r.id === id), 1); } } }; })();`;

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const url = 'http://127.0.0.1:' + server.address().port + '/sample/index.html';
  const browser = await pw.chromium.launch({ channel: 'chrome', headless: true });
  const done = [];
  const scene = async (name, opts, init, fn) => {
    const ctx = await browser.newContext(Object.assign({ viewport: { width: 1200, height: 760 } }, opts)); const page = await ctx.newPage();
    const errs = []; page.on('pageerror', e => errs.push(String(e)));
    if (init) await page.addInitScript(init);
    await page.goto(url); await page.waitForTimeout(init ? 3600 : 500);
    const q = (sel, f) => page.evaluate(([sel, f]) => { const o = []; for (const h of [...document.body.children].filter(e => e.shadowRoot)) for (const el of h.shadowRoot.querySelectorAll(sel)) o.push(new Function('el', 'return ' + f)(el)); return o; }, [sel, f || '1']);
    const focus = () => page.evaluate(() => { let a = document.activeElement; while (a && a.shadowRoot && a.shadowRoot.activeElement) a = a.shadowRoot.activeElement; if (!a || a === document.body) return 'nothing'; return (a.closest('aside') ? 'panel:' : a.closest('.thread') ? 'card:' : '') + (a.getAttribute('aria-label') || a.textContent.trim().slice(0, 30) || a.className); });
    const pinOf = async n => (await q('.pin', '(r => [r.left + r.width / 2, r.top + r.height / 2, getComputedStyle(el).visibility, el.getAttribute("aria-label")])(el.getBoundingClientRect())')).filter(p => p[2] === 'visible')[n || 0];
    /* the add key opens the panel on a desktop; most scenes are about the page, so they shut it again and carry on placing */
    const place = async (text, tap) => { await page.keyboard.press('c'); if (!tap) { await page.waitForTimeout(150); const x = page.locator('aside button[aria-label="Close list"]'); if (await x.isVisible()) { await x.click(); await page.waitForTimeout(350); } }
      const b = await page.locator('text=Reserve a crate').first().boundingBox();
      if (tap) await page.touchscreen.tap(b.x + 20, b.y + 8); else await page.mouse.click(b.x + 20, b.y + 8);
      await page.waitForTimeout(450); await page.keyboard.type(text); await page.keyboard.press('Enter'); await page.waitForTimeout(750); };
    const key = async (k, ms) => { await page.keyboard.press(k); await page.waitForTimeout(ms || 350); };
    try { await fn({ page, q, focus, pinOf, place, key }); assert.deepStrictEqual(errs, [], 'page errors'); done.push(name); }
    catch (e) { e.message = name + ': ' + e.message; throw e; }
    finally { await ctx.close(); }
  };
  const aiming = page => page.evaluate(() => document.documentElement.classList.contains('pw-aim'));
  try {
    await scene('escape backs out one level', {}, null, async ({ page, q, focus, pinOf, place, key }) => {
      await place('first note');
      assert.strictEqual((await q('.bubble[data-mode=peek]')).length, 1, 'preview shows after a save');
      await key('Escape'); assert.strictEqual((await q('.bubble[data-mode=peek]')).length, 0, 'Escape closes the preview'); assert(await aiming(page), 'placing survives');
      await key('Escape'); assert(!(await aiming(page)), 'next Escape leaves placing mode');
      const pin = await pinOf(); await page.mouse.click(pin[0], pin[1]); await page.waitForTimeout(700);
      await page.keyboard.type('a reply'); await key('Enter', 500);
      await page.locator('.thread .msg.reply').first().hover(); await page.locator('.thread .acts button:text("Delete")').click(); await page.waitForTimeout(300);
      assert.strictEqual(await focus(), 'card:Keep', 'asking to delete puts focus on Keep');
      await key('Escape'); assert.strictEqual((await q('.thread .confirm')).length, 0, 'Escape cancels the confirmation'); assert.strictEqual((await q('.thread')).length, 1, 'and leaves the note open');
      await page.locator('.thread .compose textarea').focus(); await key('Escape', 600);
      assert.strictEqual((await q('.thread')).length, 0, 'Escape closes the note'); assert(/^Note 1/.test(await focus()), 'focus returns to the pin');
    });
    await scene('the wash on a target: ours, soft, and absent on a target that fills the view', {}, null, async ({ page, q, key }) => {
      const wash = async () => (await q('.wash', '(r => [el.classList.contains("on"), Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)])(el.getBoundingClientRect())'))[0];
      const touched = () => page.evaluate(() => [...document.querySelectorAll('body *')].filter(e => !e.shadowRoot && e.style && (e.style.outline || e.style.boxShadow)).length);
      await key('c');
      const b = await page.locator('text=Reserve a crate').first().boundingBox();
      await page.mouse.move(b.x + 20, b.y + 8); await page.waitForTimeout(350);
      let w = await wash();
      assert(w[0], 'a small target is washed');
      assert.deepStrictEqual(w.slice(1), [Math.round(b.x) - 3, Math.round(b.y) - 3, Math.round(b.width) + 6, Math.round(b.height) + 6], 'the wash sits just outside the target');
      assert.strictEqual(await touched(), 0, 'the host element is not written to');
      await page.mouse.wheel(0, 0); await page.evaluate(() => { document.body.style.paddingTop = '40px'; }); await page.waitForTimeout(200);
      const b2 = await page.locator('text=Reserve a crate').first().boundingBox(); w = await wash();
      assert.strictEqual(w[2], Math.round(b2.y) - 3, 'the wash follows its target when the page moves');
      await page.setViewportSize({ width: 1000, height: 760 }); await page.waitForTimeout(200);
      const link = page.locator('text=opening rota').first(), lines = await link.evaluate(el => el.getClientRects().length), lb = await link.boundingBox();
      await page.mouse.move(lb.x + lb.width - 4, lb.y + 6); await page.waitForTimeout(350);
      const cut = (await q('.wash', 'el.style.clipPath'))[0];
      assert(lines < 2 || /^polygon\(/.test(cut), 'words that wrap are washed line by line, not as one block');
      await page.setViewportSize({ width: 1200, height: 760 }); await page.waitForTimeout(200);
      await page.mouse.move(4, 700); await page.waitForTimeout(350);
      assert(!(await wash())[0], 'a target that fills the view gets no wash');
      await page.mouse.click(4, 700); await page.waitForTimeout(450);
      const draft = (await q('.pin.draft', '(r => [Math.round(r.left), Math.round(r.bottom)])(el.getBoundingClientRect())'))[0];
      assert(draft && Math.abs(draft[0] - 4) <= 2 && Math.abs(draft[1] - 700) <= 2, 'and the pin still lands on the spot that was clicked');
      await key('Escape'); await key('Escape');
      assert(!(await wash())[0], 'leaving placing mode clears the wash');
      for (const [x, y, what] of [[1180, 400, 'right edge'], [600, 30, 'top edge'], [1185, 25, 'top right corner']]) {
        await key('c'); await page.locator('aside button[aria-label="Close list"]').click(); await page.waitForTimeout(450);   // the key opens the panel; these spots are under it
        await page.mouse.click(x, y); await page.waitForTimeout(450);
        const c = (await q('.composer', '(r => [r.left, r.right, r.top, r.bottom])(el.getBoundingClientRect())'))[0];
        const dx = Math.min(Math.abs(c[0] - x), Math.abs(c[1] - x)), dy = Math.min(Math.abs(c[2] - y), Math.abs(c[3] - y));
        assert(dx <= 3 && dy <= 3, 'near the ' + what + ' the note box still opens with a corner on the mark: off by ' + dx + ', ' + dy);
        await key('Escape'); await key('Escape');
      }
      await key('c');
      const words = await page.locator('text=Morning catch').first().boundingBox();
      await page.mouse.move(words.x + 2, words.y + 8); await page.waitForTimeout(250);
      assert((await wash())[0], 'before a drag the target is washed');
      await page.mouse.down(); await page.mouse.move(words.x + 90, words.y + 8, { steps: 5 }); await page.waitForTimeout(250);
      assert((await page.evaluate(() => String(getSelection()))).length > 2, 'dragging selects words');
      assert(!(await wash())[0], 'while words are dragged over, only the words are marked: the wash steps back');
      assert(/255, 216, 58/.test(await page.evaluate(() => getComputedStyle(document.body, '::selection').backgroundColor)), 'and they are marked in the highlighter');
      await page.mouse.up(); await page.waitForTimeout(450);
      assert.strictEqual((await q('.pin.draft')).length, 1, 'letting go starts the note on those words');
      await page.keyboard.type('on these words'); await key('Enter'); await page.waitForTimeout(600);
      await key('Escape'); await key('Escape'); await page.mouse.move(600, 600); await page.waitForTimeout(400);
      const kept = (await q('.pin:not(.draft)', '(r => [Math.round(r.left), Math.round(r.bottom), el.getAttribute("aria-label")])(el.getBoundingClientRect())')).find(p => /^Note \d+ by/.test(p[2] || ''));
      if (!kept) throw new Error('no saved pin found among: ' + JSON.stringify(await q('.pin', 'el.className + "|" + el.getAttribute("aria-label")')));
      assert(kept && Math.abs(kept[0] - (words.x + 90)) <= 3 && Math.abs(kept[1] - (words.y + 8)) <= 3, 'the saved pin sits where it was dropped among the words, not at their start: ' + JSON.stringify(kept) + ' want ' + [words.x + 90, words.y + 8]);
      await page.evaluate(() => { document.body.style.paddingTop = '80px'; }); await page.waitForTimeout(300);
      const moved = (await q('.pin:not(.draft)', '(r => [Math.round(r.left), Math.round(r.bottom), el.getAttribute("aria-label")])(el.getBoundingClientRect())')).find(p => p[2] === kept[2]);
      assert(moved && moved[0] === kept[0] && moved[1] > kept[1], 'and it moves with the words when the page does');
    });
    await scene('the launcher keeps its corner: bottom right, clear of the panel, and under the pointer in a drag', {}, null, async ({ page, q }) => {
      const at = async () => (await q('.dock button', '(r => [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)])(el.getBoundingClientRect())'))[0];
      let b = await at();
      assert.deepStrictEqual([1200 - b[2], 760 - b[3]], [16, 16], 'it starts in the bottom right corner');
      await page.mouse.click(b[0] + 22, b[1] + 22); await page.waitForTimeout(600);
      b = await at();
      assert.deepStrictEqual([1200 - 320 - b[2], 760 - b[3]], [16, 16], 'with the panel open it sits the same distance from the panel edge');
      await page.setViewportSize({ width: 1000, height: 700 }); await page.waitForTimeout(200);
      b = await at();
      assert.deepStrictEqual([1000 - 320 - b[2], 700 - b[3]], [16, 16], 'a resize keeps it in its corner, and does not walk it');
      await page.setViewportSize({ width: 1200, height: 760 }); await page.waitForTimeout(200);
      b = await at();
      await page.mouse.move(b[0] + 22, b[1] + 22); await page.mouse.down(); await page.mouse.move(500, 400, { steps: 6 }); await page.waitForTimeout(60);
      let d = await at();
      assert(Math.abs(d[0] + 22 - 500) <= 1 && Math.abs(d[1] + 22 - 400) <= 1, 'dragged with the panel open, it stays under the pointer: ' + d);
      await page.mouse.move(60, 80, { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(100);
      d = await at();
      assert(Math.abs(d[0] + 22 - 60) <= 1 && Math.abs(d[1] + 22 - 80) <= 3, 'and it stays where it is dropped (it lifts 2px under the pointer): ' + d);
      assert((await q('aside', 'el.classList.contains("shut")'))[0] === false, 'a drag is not a click: the panel stays open');
      await page.reload(); await page.waitForTimeout(700);
      const back = await at(); assert(back[0] === d[0] && Math.abs(back[1] - d[1]) <= 2, 'and it is there after a reload: ' + back);
    });
    await scene('the last level: Escape shuts the panel from the page, never from the page\'s own controls; the comment key gets in and out', {}, null, async ({ page, q, key }) => {
      const shut = async () => (await q('aside', 'el.classList.contains("shut")'))[0];
      await page.locator('.dock button').click(); await page.waitForTimeout(500);
      await page.evaluate(() => { const b = document.createElement('button'); b.id = 'host-own'; b.textContent = 'host'; document.body.prepend(b); b.focus(); });
      await key('Escape');
      assert.strictEqual(await shut(), false, 'with focus on one of the page\'s own controls, Escape is the page\'s');
      await page.evaluate(() => document.activeElement.blur());
      await key('c'); assert(await aiming(page), 'the comment key starts placing');
      await key('c'); await page.waitForTimeout(400); assert(!(await aiming(page)), 'and the same key again stops it');
      assert.strictEqual(await shut(), true, 'and shuts the panel');
      await page.locator('.dock button').click(); await page.waitForTimeout(500);
      await key('c'); await key('Escape');
      assert(!(await aiming(page)) && (await shut()) === false, 'Escape stops placing before it touches the panel');
      await key('Escape'); await page.waitForTimeout(400);
      assert.strictEqual(await shut(), true, 'then Escape, with nothing else open, shuts the panel');
    });
    await scene('a setting keeps its menu open; an action closes it', {}, null, async ({ page, q }) => {
      await page.locator('.dock button').click(); await page.waitForTimeout(500);
      const openMenus = async () => (await q('.menu:not([hidden])')).length;
      await page.locator('aside [aria-label="Sort and filter"]').first().click(); await page.waitForTimeout(200);
      await page.locator('.menu:not([hidden]) label', { hasText: 'Unread first' }).click(); await page.waitForTimeout(200);
      assert.strictEqual(await openMenus(), 1, 'a sort choice leaves the menu open');
      assert.deepStrictEqual(await q('.menu:not([hidden]) [role=menuitemradio]', 'el.getAttribute("aria-checked")'), ['false', 'true'], 'and the choice shows as taken');
      await page.locator('.menu:not([hidden]) label', { hasText: 'Newest first' }).click(); await page.waitForTimeout(200);
      assert.strictEqual(await openMenus(), 1, 'so it can be changed straight back');
      const mark = page.locator('.menu:not([hidden]) button', { hasText: 'Mark all as read' });
      if (await mark.isEnabled()) { await mark.click(); await page.waitForTimeout(200); assert.strictEqual(await openMenus(), 0, 'an action closes it'); }
    });
    await scene('one launcher: opens the panel; Add note places; the launcher cancels', {}, null, async ({ page, q, key }) => {
      assert.strictEqual((await q('.dock button')).length, 1, 'one button on the host page');
      await page.locator('.dock button').click(); await page.waitForTimeout(600);
      assert(!(await q('aside', 'el.className'))[0].includes('shut'), 'the launcher opens the panel'); assert(!(await aiming(page)), 'and does not start placing');
      await page.locator('aside .empty button:text("Add note")').click(); await page.waitForTimeout(300);
      assert(await aiming(page), 'the empty state offers Add note'); await key('Escape');
      await page.locator('aside .tools .add').click(); await page.waitForTimeout(300);
      assert(await aiming(page), 'Add note starts placing'); assert((await q('.dock button', 'el.className'))[0].includes('on'), 'the launcher shows the way out');
      assert(!(await q('aside', 'el.className'))[0].includes('shut'), 'the panel stays open while placing');
      await page.locator('.dock button').click(); await page.waitForTimeout(300);
      assert(!(await aiming(page)), 'the launcher cancels placing'); assert(!(await q('aside', 'el.className'))[0].includes('shut'), 'and leaves the panel as it was');
    });
    await scene('panel: row focus, menus', {}, null, async ({ page, q, focus, place, key }) => {
      await place('row note'); await key('Escape'); await key('Escape');
      await page.locator('.dock button').first().click(); await page.waitForTimeout(600);
      await page.locator('aside .pick').first().click(); await page.waitForTimeout(800);
      assert.strictEqual((await q('.thread')).length, 1, 'row opens the note');
      await key('Escape', 600); assert(/^panel:/.test(await focus()), 'closing a note opened from its row returns focus to the row, got ' + await focus());
      await page.locator('aside header button[aria-label^="Sort and filter"]').click(); await page.waitForTimeout(300);
      await key('ArrowDown', 150); assert.strictEqual((await q('.menu', 'el.hidden ? 0 : 1')).filter(Boolean).length, 1, 'an arrow key does not choose or close');
      await key('Enter'); assert.strictEqual((await q('.menu', 'el.hidden ? 0 : 1')).filter(Boolean).length, 1, 'Enter chooses a setting and the menu stays open');
      await key('Escape', 300); assert.strictEqual((await q('.menu', 'el.hidden ? 0 : 1')).filter(Boolean).length, 0, 'Escape closes the menu'); assert(/Sort and filter/.test(await focus()), 'focus returns to the menu button');
      await key('Escape', 500); assert.strictEqual((await q('aside', 'el.className'))[0].includes('shut'), true, 'Escape with focus in the panel closes it');
    });
    await scene('phone: sheet, panel steps aside, nothing off screen', { viewport: { width: 390, height: 760 }, hasTouch: true, isMobile: true }, null, async ({ page, q, place }) => {
      await place('phone note', true);
      assert.strictEqual((await q('.bubble')).length, 0, 'no hover preview on a phone');
      await page.keyboard.press('Escape'); await page.keyboard.press('Escape'); await page.touchscreen.tap(20, 500); await page.waitForTimeout(300);
      await page.locator('.dock button').first().tap(); await page.waitForTimeout(700);
      await page.locator('aside .pick').first().tap(); await page.waitForTimeout(900);
      assert((await q('aside', 'el.className'))[0].includes('shut'), 'a row tap closes the full-width panel');
      const box = (await q('.thread', '(r => [r.left, r.right, r.bottom])(el.getBoundingClientRect())'))[0];
      assert(box && box[0] >= 0 && box[1] <= 390 && box[2] <= 760, 'the note is a sheet inside the viewport');
    });
    await scene('failures are said in the card', {}, seeded(true), async ({ page, q, pinOf, key }) => {
      const pin = await pinOf(); await page.mouse.click(pin[0], pin[1]); await page.waitForTimeout(700);
      await page.locator('.thread .compose textarea').fill('will fail'); await key('Enter', 600);
      assert(/not saved/i.test((await q('.thread .card-err', 'el.textContent'))[0] || ''), 'the card says the reply was not saved');
      assert.strictEqual((await q('.thread .compose textarea', 'el.value'))[0], 'will fail', 'the words stay in the field');
      assert.strictEqual((await q('.note-banner')).length, 0, 'no page banner');
    });
    await scene('missing pin dialog, and why an item is disabled', {}, seeded(false), async ({ page, q, focus, pinOf, key }) => {
      await page.locator('.dock button').first().click(); await page.waitForTimeout(600);
      await page.locator('aside li.lost .pick').click(); await page.waitForTimeout(800);
      assert((await q('.thread', 'el.className'))[0].includes('adrift'), 'a note with no pin opens as the dialog');
      assert.strictEqual((await q('aside', 'el.inert'))[0], true, 'the panel cannot be used while the dialog is open');
      for (let i = 0; i < 6; i++) { await key('Tab', 60); assert(/^card:/.test(await focus()), 'Tab stays in the dialog, got ' + await focus()); }
      await key('Escape', 600); assert(/^panel:/.test(await focus()), 'closing the dialog returns focus to its row, got ' + await focus());
      assert.strictEqual((await q('aside', 'el.inert'))[0], false, 'and can be used again once it closes');
      const theirs = (await q('.pin', '(r => [r.left + r.width / 2, r.top + r.height / 2, el.getAttribute("aria-label")])(el.getBoundingClientRect())')).find(p => /Ada Vale/.test(p[2]));
      await page.mouse.click(theirs[0], theirs[1]); await page.waitForTimeout(700);
      await page.locator('.thread button[aria-label="More options"]').click(); await page.waitForTimeout(300);
      assert(/Only Ada Vale can edit or delete/.test((await q('.thread .menu .why', 'el.textContent'))[0] || ''), 'the menu says why Edit and Delete are off');
    });
    await scene('a pin moves from its menu by keyboard; the letter keys can be turned off and stay out of the page\'s own widgets', {}, null, async ({ page, q, focus, pinOf, place, key }) => {
      await place('to be moved'); await key('Escape'); await key('Escape');
      const inBox = async (pt, text) => { const b = await page.locator('text=' + text).first().boundingBox(); return pt[0] >= b.x - 20 && pt[0] <= b.x + b.width + 20 && pt[1] >= b.y - 30 && pt[1] <= b.y + b.height + 20; };
      const menuMove = async () => { const pin = await pinOf(); await page.mouse.click(pin[0], pin[1]); await page.waitForTimeout(700);
        await page.locator('.thread button[aria-label="More options"]').click(); await page.waitForTimeout(300);
        await page.locator('.thread .menu button:text("Move pin")').click(); await page.waitForTimeout(300); };
      await menuMove();
      assert(await aiming(page), 'Move pin asks for a spot'); assert.strictEqual((await q('.thread')).length, 0, 'and the note steps aside');
      await key('Escape'); assert(!(await aiming(page)), 'Escape cancels the move'); assert(await inBox(await pinOf(), 'Reserve a crate'), 'and the pin is where it was');
      await menuMove();
      await page.locator('text=Order a bunch').first().focus(); await key('Enter', 900);
      assert(!(await aiming(page)), 'Enter on a focused element ends the move'); assert(await inBox(await pinOf(), 'Order a bunch'), 'and the pin sits on that element');
      assert(/^Note 1/.test(await focus()), 'focus goes to the moved pin, got ' + await focus());
      assert.strictEqual((await q('.composer')).length, 0, 'no new note was started');
      await page.reload(); await page.waitForTimeout(900); assert(await inBox(await pinOf(), 'Order a bunch'), 'the new place was saved');
      /* the page's own widgets keep their letters */
      await page.evaluate(() => { const d = document.createElement('div'); d.setAttribute('role', 'textbox'); d.tabIndex = 0; d.id = 'own-box'; document.body.prepend(d);
        const x = document.createElement('x-field'); x.tabIndex = 0; x.id = 'own-el'; document.body.prepend(x); });
      for (const id of ['own-box', 'own-el']) { await page.focus('#' + id); await key('c', 250); assert(!(await aiming(page)), 'the add key is left to #' + id); await key('j', 250); assert.strictEqual((await q('.thread')).length, 0, 'and so is the next key'); }
      await page.evaluate(() => document.activeElement.blur()); await key('c', 250); assert(await aiming(page), 'with focus on nothing the add key works'); await key('Escape');
      await key('c', 250); await page.focus('#own-el'); await key('Enter', 500); assert.strictEqual((await q('.composer')).length, 1, 'Enter places a note on a custom element');
      await key('Escape', 300); await page.focus('#own-el'); await key('Escape', 300); assert(!(await aiming(page)), 'and Escape there still leaves placing');
      /* and the reader can turn the letter keys off */
      if ((await q('aside', 'el.classList.contains("shut")'))[0]) { await page.locator('.dock button').first().click(); await page.waitForTimeout(600); }
      await page.locator('aside header button[aria-label="More options"]').click(); await page.waitForTimeout(300);
      await page.locator('aside .menu label:has-text("Keyboard shortcuts")').click(); await page.waitForTimeout(200);
      await key('Escape', 300); await key('Escape', 500); await page.evaluate(() => document.activeElement && document.activeElement.blur());
      await key('c', 250); assert(!(await aiming(page)), 'the add key does nothing once shortcuts are off');
      await key('j', 400); assert.strictEqual((await q('.thread')).length, 0, 'nor does the next key');
      await page.reload(); await page.waitForTimeout(900); await key('c', 250); assert(!(await aiming(page)), 'and that is remembered');
    });
    await scene('the add key opens the panel, and the page is told how much room the panel takes', {}, null, async ({ page, q, key }) => {
      const shut = async () => (await q('aside', 'el.classList.contains("shut")'))[0];
      const room = () => page.evaluate(() => { const st = document.documentElement.style; return [st.getPropertyValue('--crittable-inset-left'), st.getPropertyValue('--crittable-inset-right'), st.paddingLeft, st.paddingRight].join(' '); });
      await page.evaluate(() => { window.__resizes = 0; addEventListener('resize', () => { window.__resizes++; }); });
      assert.strictEqual(await shut(), true, 'the panel starts shut'); assert.strictEqual(await room(), '0px 0px  ', 'and takes no room');
      await key('c', 500);
      assert.strictEqual(await shut(), false, 'the add key opens the panel'); assert(await aiming(page), 'and starts placing');
      assert.strictEqual(await room(), '0px 320px  320px', 'the page is told the room taken on the right');
      assert.strictEqual(await page.evaluate(() => window.__resizes), 1, 'and hears one resize');
      await page.locator('aside header button[aria-label="More options"]').click(); await page.waitForTimeout(300);
      await page.locator('aside .menu button:text("Move list to other side")').click(); await page.waitForTimeout(500);
      assert.strictEqual(await room(), '320px 0px 320px ', 'on the left when the panel is moved there');
      assert.strictEqual(await page.evaluate(() => window.__resizes), 2, 'with one more resize');
      await key('c', 500);
      assert.strictEqual(await shut(), true, 'the same key again shuts it'); assert.strictEqual(await room(), '0px 0px  ', 'and the room is given back');
      assert.strictEqual(await page.evaluate(() => window.__resizes), 3, 'with a resize for that too');
    });
    await scene('a field grows with its words, then scrolls; the card it is in is fitted to it', {}, null, async ({ page, q, key }) => {
      const long = 'A note long enough to wrap onto a second and a third line, to see that the field grows as it is typed into.';
      const size = sel => q(sel, '[Math.round(el.getBoundingClientRect().height), el.scrollHeight > el.clientHeight + 1, el.getBoundingClientRect().bottom <= el.closest(".card").getBoundingClientRect().bottom + 1]').then(a => a[0]);
      await key('c', 300); for (let i = 0; i < 3; i++) await page.keyboard.press('Escape'); await page.waitForTimeout(300);   // the panel the key opened is shut again
      await key('c', 300); await page.keyboard.press('Escape'); await page.waitForTimeout(200);
      await page.evaluate(() => 0); await key('c', 300); await page.mouse.click(430, 300); await page.waitForTimeout(600);
      const empty = await size('.composer textarea'); assert(empty, 'the new-note field is there');
      await page.keyboard.type(long); await page.waitForTimeout(300);
      const some = await size('.composer textarea');
      assert(some[0] > empty[0] + 20 && !some[1] && some[2], 'three lines of words: taller, nothing scrolled away, still inside its card: ' + JSON.stringify([empty, some]));
      await page.keyboard.type(' ' + long + ' ' + long + ' ' + long); await page.waitForTimeout(300);
      const lots = await size('.composer textarea');
      assert(lots[0] <= 121 && lots[1] && lots[2], 'a great many words: no taller than its limit, and it scrolls: ' + JSON.stringify(lots));
      await page.keyboard.press('Enter'); await page.waitForTimeout(1200); for (let i = 0; i < 3; i++) await page.keyboard.press('Escape'); await page.waitForTimeout(400);
      await page.locator('.pin').first().click(); await page.waitForTimeout(900);
      const fits = () => q('.bubble', '[Math.round(el.getBoundingClientRect().height), Math.round(el.querySelector(".card").getBoundingClientRect().height)]').then(a => a[0]);
      const r0 = await size('.thread .compose textarea'), s0 = await fits();
      await page.locator('.thread .compose textarea').click(); await page.keyboard.type(long); await page.waitForTimeout(800);
      const r1 = await size('.thread .compose textarea'), s1 = await fits();
      assert(r1[0] > r0[0] + 20 && r1[2], 'the reply field grows too: ' + JSON.stringify([r0, r1]));
      assert(s1 && Math.abs(s1[0] - s1[1]) <= 3 && s1[1] > s0[1], 'and the note\'s shell is fitted to the taller card: ' + JSON.stringify([s0, s1]));
    });
    await scene('on a phone what is typed is 16px, in a field as tall as the button beside it', { viewport: { width: 390, height: 760 }, hasTouch: true, isMobile: true }, null, async ({ page, q, key }) => {
      await key('c', 400); await page.touchscreen.tap(120, 300); await page.waitForTimeout(700);
      const m = (await q('.composer textarea', '[parseFloat(getComputedStyle(el).fontSize), Math.round(el.getBoundingClientRect().height)]'))[0];
      assert(m, 'the note field is there');
      assert(m[0] >= 16, 'text under 16px makes a phone zoom the page when the field is touched: it is ' + m[0] + 'px');
      assert(m[1] >= 40, 'the field is as tall as the send button: it is ' + m[1] + 'px');
      /* the same for the other two fields a thumb types in, and the search field keeps its icon clear of its words */
      for (let i = 0; i < 3; i++) await page.keyboard.press('Escape'); await page.waitForTimeout(300);
      await page.locator('.dock button').first().tap(); await page.waitForTimeout(600);
      const find = (await q('aside input[type=search]', '[parseFloat(getComputedStyle(el).fontSize), parseFloat(getComputedStyle(el).paddingLeft), el.parentNode.querySelector(".ic").getBoundingClientRect().right - el.getBoundingClientRect().left]'))[0];
      assert(find && find[0] >= 16, 'the search field is 16px too');
      assert(find[1] >= find[2], 'the search field\'s words start after its icon: padding ' + find[1] + 'px, icon ends at ' + Math.round(find[2]) + 'px');
      await page.locator('.you .edit').tap(); await page.waitForTimeout(400);
      const nm = (await q('.you .namefield', '[parseFloat(getComputedStyle(el).fontSize), Math.round(el.getBoundingClientRect().height)]'))[0];
      assert(nm && nm[0] >= 16 && nm[1] >= 40, 'the name field is 16px and 40px tall: ' + JSON.stringify(nm));
    });
    await scene('on a phone the add key leaves the panel shut', { viewport: { width: 390, height: 760 }, hasTouch: true, isMobile: true }, null, async ({ page, q, key }) => {
      await key('c', 500);
      assert(await aiming(page), 'placing starts'); assert.strictEqual((await q('aside', 'el.classList.contains("shut")'))[0], true, 'and the panel does not cover the page being aimed at');
      assert.strictEqual(await page.evaluate(() => document.documentElement.style.getPropertyValue('--crittable-inset-right')), '0px', 'no room is taken');
    });
    await scene('a board that is not shared names its reader too: a made-up name to start, the reader\'s own once given, kept for the tab', {}, 'window.CRITTABLE_CONFIG = { storage: "session" };', async ({ page, q, place, key }) => {
      const labels = async () => (await q('.pin:not(.draft)', 'el.getAttribute("aria-label")')).sort();
      const foot = async () => (await q('footer.you:not(.reading)', '[el.hidden, el.querySelector(".as b").textContent]'))[0];
      const open = async () => { if ((await q('aside', 'el.classList.contains("shut")'))[0]) { await page.locator('.dock button').first().click(); await page.waitForTimeout(500); } };
      await open();
      const first = await foot();
      assert(first && first[0] === false && /^\S+ \S+$/.test(first[1]) && first[1] !== 'Guest', 'the panel\'s foot offers a made-up name, got ' + JSON.stringify(first));
      await page.locator('aside button[aria-label="Close list"]').click(); await page.waitForTimeout(400);
      await place('written under the made-up name'); await key('Escape'); await key('Escape');
      assert((await labels())[0].includes(' by ' + first[1] + ','), 'a note is written under it: ' + await labels());
      await open(); await page.locator('footer.you .edit').click(); await page.locator('footer.you .namefield').fill('Ada Vale'); await page.keyboard.press('Enter'); await page.waitForTimeout(300);
      await page.locator('aside button[aria-label="Close list"]').click(); await page.waitForTimeout(400);
      await page.keyboard.press('c'); await page.waitForTimeout(200); await page.locator('aside button[aria-label="Close list"]').click(); await page.waitForTimeout(400);
      const b = await page.locator('text=Order a bunch').first().boundingBox(); await page.mouse.click(b.x + 20, b.y + 8); await page.waitForTimeout(450);
      await page.keyboard.type('written under my own'); await page.keyboard.press('Enter'); await page.waitForTimeout(750); await key('Escape'); await key('Escape');
      const both = await labels();
      assert(both.some(l => l.includes(' by Ada Vale,')) && both.some(l => l.includes(' by ' + first[1] + ',')), 'the new note carries the new name and the old note keeps its own: ' + both);
      await page.reload(); await page.waitForTimeout(3700); await open();
      assert.strictEqual((await foot())[1], 'Ada Vale', 'the name is kept when the tab reloads');
      assert.strictEqual((await labels()).length, 2, 'and so are the notes');
      const pinOfAda = (await q('.pin:not(.draft)', '(r => [r.left + r.width / 2, r.top + r.height / 2, el.getAttribute("aria-label")])(el.getBoundingClientRect())')).find(p => p[2].includes(first[1]));
      await page.locator('aside button[aria-label="Close list"]').click(); await page.waitForTimeout(400);
      const again = (await q('.pin:not(.draft)', '(r => [r.left + r.width / 2, r.top + r.height / 2, el.getAttribute("aria-label")])(el.getBoundingClientRect())')).find(p => p[2].includes(first[1]));
      await page.mouse.click(again[0], again[1]); await page.waitForTimeout(700);
      await page.locator('.thread button[aria-label="More options"]').click(); await page.waitForTimeout(300);
      assert.strictEqual((await q('.thread .menu button', '[el.textContent, el.disabled]')).filter(x => x[0] === 'Edit')[0][1], false, 'the note written under the earlier name is still its writer\'s to edit');
    });
    {
      /* a store that pushes, slow enough to be caught mid-load */
      const PUSHING = `window.__rows = []; window.__wait = 0; window.__saveWait = 0; window.__push = null;
        const nap = ms => new Promise(r => setTimeout(r, ms));
        window.__row = (id, label) => ({ id, text: 'pushed ' + id, authorName: 'Ada Vale', authorId: 'u9', created: Date.now(), updated: Date.now(), route: '/sample/', resolved: false, replies: [], anchor: { k: 'text', tag: 'BUTTON', v: label, dx: 20, dy: 8 } });
        window.CRITTABLE_CONFIG = { backend: { shared: true,
          async load() { const snap = JSON.parse(JSON.stringify(window.__rows)); await nap(window.__wait); return snap; },
          async create(t) { await nap(window.__saveWait); window.__rows.push(JSON.parse(JSON.stringify(t))); },
          async update(id, p) { Object.assign(window.__rows.find(r => r.id === id), p); }, async remove(id) { window.__rows.splice(window.__rows.findIndex(r => r.id === id), 1); },
          watch(fn) { window.__push = fn; } } };`;
      await scene('sync: nothing pushed is missed, and a load under way does not undo what was just written', {}, PUSHING, async ({ page, q, pinOf, place, key }) => {
        const pins = async () => (await q('.pin:not(.draft)', 'getComputedStyle(el).visibility')).filter(v => v === 'visible').length;
        await page.evaluate(async () => { window.__wait = 400; window.__rows.push(window.__row('a', 'Reserve a crate')); window.__push();
          await new Promise(r => setTimeout(r, 150)); window.__rows.push(window.__row('b', 'Order a bunch')); window.__push(); });
        await page.waitForTimeout(2200);
        assert.strictEqual(await pins(), 2, 'a change pushed while a load was under way is shown once that load is in');
        /* a note made here while an older load is still on its way */
        await page.evaluate(() => { window.__wait = 2500; window.__push(); });
        await place('written during a load'); await key('Escape');
        assert.strictEqual(await pins(), 3, 'the new note has its pin');
        await page.waitForTimeout(2600);
        assert.strictEqual(await pins(), 3, 'and keeps it when the older load lands without it');
        await page.evaluate(() => { window.__wait = 0; }); await key('Escape');
        /* a second spot chosen while the first note is still saving */
        await page.evaluate(() => { window.__saveWait = 900; });
        await page.keyboard.press('c'); const one = await page.locator('h1').first().boundingBox(); await page.mouse.click(one.x + 10, one.y + 10); await page.waitForTimeout(450);
        await page.keyboard.type('saving slowly'); await page.keyboard.press('Enter'); await page.waitForTimeout(150);
        const two = await page.locator('text=Order a bunch').first().boundingBox(); await page.mouse.click(two.x + 30, two.y + 10); await page.waitForTimeout(1500);
        assert.strictEqual((await q('.composer')).length, 1, 'the second box is still up after the first note saved');
        assert.strictEqual(await pins(), 4, 'and the first note took its place');
        await key('Escape', 400); assert.strictEqual((await q('.composer')).length, 0, 'Escape closes the second box');
        assert.strictEqual((await q('.pin.draft')).length, 0, 'and its draft pin');
      });
      const HOSTILE = `(() => { const now = Date.now(), far = now + 1e10;
        const row = (id, anchor, more) => Object.assign({ id, text: 'note ' + id, authorName: 'Ada Vale', authorId: 'u9', created: now - 6e4, updated: now - 6e4, route: '/sample/', resolved: false, replies: [], anchor }, more || {});
        const rows = [row('same', { k: 'css', v: 'h2:nth-of-type(1)', was: 'Fish counter', dx: 5, dy: 5 }, { updated: far, replies: [{ authorName: 'Ada Vale', authorId: 'u9', text: 'later', at: far }] }),
          row('changed', { k: 'css', v: 'h2:nth-of-type(1)', was: 'Something that was here once', dx: 5, dy: 5 })];
        for (let i = 0; i < 300; i++) rows.push(row('lost' + i, { k: 'css', v: 'section.nowhere-' + i + ' > div > span', dx: 0, dy: 0, alt: Array.from({ length: 8 }, (_, n) => ({ k: 'text', tag: 'SPAN', v: 'never on the page ' + i + ' ' + n })) }));
        window.CRITTABLE_CONFIG = { backend: { shared: true, poll: 700, async load() { return JSON.parse(JSON.stringify(rows)); }, async create(t) { rows.push(t); }, async update(id, p) { Object.assign(rows.find(r => r.id === id), p); }, async remove() {} } }; })();`;
      await scene('notes from strangers: a counted place is not believed once its words differ, a time in the future is not either, and hundreds of lost pins leave the page its frames', {}, HOSTILE, async ({ page, q, pinOf, key }) => {
        const seen = (await q('.pin', '[getComputedStyle(el).visibility, el.getAttribute("aria-label")]')).filter(p => p[0] === 'visible');
        assert.strictEqual(seen.length, 1, 'only the note whose words still match has a pin, got ' + JSON.stringify(seen));
        assert(/unread/.test(seen[0][1]), 'it starts unread');
        const pin = await pinOf(); await page.mouse.click(pin[0], pin[1]); await page.waitForTimeout(700); await key('Escape', 600);
        assert(!/unread/.test((await pinOf())[3]), 'a note dated far in the future is read once it has been opened, got ' + (await pinOf())[3]);
        await page.waitForTimeout(1800); assert(!/unread/.test((await pinOf())[3]), 'and stays read when the store is asked again');
        /* a page that changes all the time, as one with a clock does: every lost pin may be looked for again */
        const fps = await page.evaluate(() => new Promise(done => { const t = document.createElement('p'); document.body.append(t); const tick = setInterval(() => { t.textContent = String(Date.now()); }, 1000);
          let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 4000) requestAnimationFrame(f); else { clearInterval(tick); done(n / 4); } }; requestAnimationFrame(f); }));
        assert(fps > 20, 'the page keeps its frames with 300 lost pins on it, got ' + fps + ' a second');
      });
    }
    /* two people, one shared store: what one writes, the other sees without reloading */
    {
      const open = async more => { const ctx = await browser.newContext({ viewport: { width: 1200, height: 760 } }); const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(String(e)));
        await page.addInitScript(SHARED_STORE + (typeof more === 'string' ? more : '')); await page.goto(url); await page.waitForTimeout(700);
        const q = (sel, f) => page.evaluate(([sel, f]) => { const o = []; for (const h of [...document.body.children].filter(e => e.shadowRoot)) for (const el of h.shadowRoot.querySelectorAll(sel)) o.push(new Function('el', 'return ' + f)(el)); return o; }, [sel, f || '1']);
        return { ctx, page, q, errs }; };
      const A = await open(), B = await open();
      try {
        await A.page.keyboard.press('c'); const b = await A.page.locator('text=Reserve a crate').first().boundingBox();
        await A.page.mouse.click(b.x + 20, b.y + 8); await A.page.waitForTimeout(450);
        assert.strictEqual((await A.q('.composer .namefield')).length, 0, 'nothing stands between a person and their first note: no name is asked for there');
        await A.page.keyboard.type('first note from Ada'); await A.page.keyboard.press('Enter'); await A.page.waitForTimeout(700);
        assert.strictEqual(shared.length, 1, 'the note reaches the shared store');
        assert(/^[A-Z][a-z-]+ [A-Z][a-z]+$/.test(shared[0].authorName), 'under a made-up name: ' + shared[0].authorName);
        await A.page.keyboard.press('Escape'); await A.page.keyboard.press('Escape'); await A.page.waitForTimeout(300);   // out of the note, out of placing
        if ((await A.q('aside', 'el.classList.contains("shut")'))[0]) { await A.page.locator('.dock button').click(); await A.page.waitForTimeout(500); }   // the add key has opened it already
        assert.strictEqual((await A.q('footer.you .as b', 'el.textContent'))[0], shared[0].authorName, 'the foot of the panel says who they are to everyone else');
        await A.page.locator('footer.you .edit').click(); await A.page.keyboard.press('Escape'); await A.page.waitForTimeout(100);
        assert.deepStrictEqual(await A.q('footer.you:not(.reading)', '[el.classList.contains("naming"), el.hidden]'), [[false, false]], 'Escape backs out of naming, and no further');
        assert.strictEqual((await A.q('aside', 'el.classList.contains("shut")'))[0], false, 'the panel stays open');
        await A.page.locator('footer.you .edit').click(); await A.page.locator('footer.you .namefield').fill('Ada Vale'); await A.page.keyboard.press('Enter'); await A.page.waitForTimeout(200);
        assert.deepStrictEqual(await A.q('footer.you:not(.reading)', '[el.hidden, el.classList.contains("naming"), el.querySelector(".as b").textContent, el.querySelector(".face").textContent]'), [[false, false, 'Ada Vale', 'AV']], 'the foot now says their own name');
        await A.page.locator('footer.you .edit').click(); await A.page.waitForTimeout(100);
        assert.strictEqual((await A.q('footer.you .namefield', 'el.value'))[0], 'Ada Vale', 'and the name can be changed again, starting from what it is');
        await A.page.keyboard.press('Escape'); await A.page.waitForTimeout(100);
        await A.page.keyboard.press('Escape'); await A.page.waitForTimeout(400);
        await B.page.waitForTimeout(900);
        const pinB = (await B.q('.pin', '(r => [r.left + r.width / 2, r.top + r.height / 2, getComputedStyle(el).visibility, el.hasAttribute("data-unread")])(el.getBoundingClientRect())')).find(p => p[2] === 'visible');
        assert(pinB, 'the other person sees the pin without reloading'); assert.strictEqual(pinB[3], true, 'and it is marked unread for them');
        await B.page.mouse.click(pinB[0], pinB[1]); await B.page.waitForTimeout(700);
        await B.page.locator('.thread button[aria-label="More options"]').click(); await B.page.waitForTimeout(200);
        assert.strictEqual((await B.q('.thread .menu button', 'el.textContent + ":" + el.disabled')).filter(x => /^(Edit|Delete):true/.test(x)).length, 2, 'they cannot edit or delete a note that is not theirs');
        await B.page.keyboard.press('Escape');
        await B.page.locator('.thread .compose textarea').fill('reply from Ben'); await B.page.locator('.thread .compose textarea').press('Enter'); await B.page.waitForTimeout(500);
        assert.strictEqual(shared[0].replies.length, 1, 'the reply reaches the store'); assert.notStrictEqual(shared[0].replies[0].authorId, shared[0].authorId, 'the two people have different ids');
        await A.page.keyboard.press('Escape'); await A.page.keyboard.press('Escape'); await A.page.waitForTimeout(900);
        const pinA = (await A.q('.pin', '[el.hasAttribute("data-unread"), el.getAttribute("aria-label")]'))[0];
        assert.strictEqual(pinA[0], true, 'the author sees the reply arrive as unread'); assert(/1 reply/.test(pinA[1]), 'with the reply counted');
        await A.page.reload(); await A.page.waitForTimeout(900);
        assert.strictEqual((await A.q('footer.you .as b', 'el.textContent'))[0], 'Ada Vale', 'the name is remembered after a reload');
        /* the tool tells the host page when the store stops and starts answering, and leaves the rest to the page */
        await A.page.evaluate(() => { window.__store = []; addEventListener('crittable:store', e => window.__store.push(e.detail.up)); });
        await A.page.route('**/__store', route => route.abort()); await A.page.waitForTimeout(1300);
        assert.deepStrictEqual(await A.page.evaluate(() => window.__store), [false], 'two missed reloads in a row: the page is told the store is down');
        await A.page.unroute('**/__store'); await A.page.waitForTimeout(1000);
        assert.deepStrictEqual(await A.page.evaluate(() => window.__store), [false, true], 'and told when it is back');
        /* a third person, whom the store lets read and nothing else */
        const R = await open('window.CRITTABLE_CONFIG.backend.readOnly = true;');
        try {
          await R.page.waitForTimeout(600);
          assert.strictEqual((await R.q('.pin')).length >= 1, true, 'a reader sees the notes');
          assert.strictEqual((await R.q('aside .add')).length, 0, 'and is offered no Add note');
          await R.page.keyboard.press('c'); await R.page.waitForTimeout(200);
          assert.strictEqual(await R.page.evaluate(() => document.documentElement.classList.contains('pw-aim')), false, 'the comment key places nothing');
          const pinR = (await R.q('.pin', '(r => [r.left + r.width / 2, r.top + r.height / 2])(el.getBoundingClientRect())'))[0];
          await R.page.mouse.click(pinR[0], pinR[1]); await R.page.waitForTimeout(700);
          assert.strictEqual((await R.q('.thread')).length, 1, 'a reader can open a note');
          assert.deepStrictEqual([(await R.q('.thread .compose')).length, (await R.q('.thread .resolve')).length], [0, 0], 'with no reply row and no Resolve');
          await R.page.keyboard.press('Escape'); await R.page.locator('.dock button').click(); await R.page.waitForTimeout(500);
          assert.deepStrictEqual([(await R.q('footer.you.reading', 'el.hidden'))[0], (await R.q('footer.you:not(.reading)', 'el.hidden'))[0], (await R.q('.scroll .tick[aria-pressed]')).length], [false, true, 0], 'the foot says they are reading, and rows have no resolve tick');
          assert.deepStrictEqual(R.errs, [], 'page errors (reader)');
        } finally { await R.ctx.close(); }
        assert.deepStrictEqual(B.errs, [], 'page errors'); done.push('two people share a store: notes and replies arrive live; the page hears when the store goes down and comes back; a reader can look and not write');
      } catch (e) { e.message = 'shared store: ' + e.message; throw e; }
      finally { await A.ctx.close(); await B.ctx.close(); }
    }
    /* each store adapter, through the loader's script tag, against its stand-in on this server */
    const origin = 'http://127.0.0.1:' + server.address().port, PLACEHOLDER = 'mock-key';
    for (const [label, attrs] of [['persistable on supabase', 'data-backend="persistable" data-store="supabase" data-url="' + origin + '" data-api-key="' + PLACEHOLDER + '"'], ['persistable', 'data-backend="persistable" data-url="' + origin + '"'], ['persistable with a key in the link', 'data-backend="persistable" data-url="' + origin + '" data-key="link"']]) {
      const keyed = /data-key="link"/.test(attrs);
      const open = async (at) => { const ctx = await browser.newContext({ viewport: { width: 1200, height: 760 } }); const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(String(e)));
        await page.route('**/sample/index.html', async route => { const r = await route.fetch(); await route.fulfill({ response: r, body: (await r.text()).replace('<script src="../crittable/crittable.js">', '<script src="../crittable/crittable.js" ' + attrs + ' data-poll="300">') }); });
        await page.goto(at || url); await page.waitForTimeout(900);
        const q = (sel, f) => page.evaluate(([sel, f]) => { const o = []; for (const h of [...document.body.children].filter(e => e.shadowRoot)) for (const el of h.shadowRoot.querySelectorAll(sel)) o.push(new Function('el', 'return ' + f)(el)); return o; }, [sel, f || '1']);
        return { ctx, page, q, errs }; };
      /* with a key, the first person's address bar becomes the link, and the second person opens that */
      const A = await open();
      if (keyed) assert(/#k=[0-9a-f]{48}$/.test(A.page.url()), 'the first visitor\'s address bar becomes the link to share');
      const B = await open(keyed ? A.page.url() : undefined);
      let C = null;
      try {
        /* a store with a link to share: the tool offers to copy it, in the More menu and under the empty panel; other stores show neither */
        await A.ctx.grantPermissions(['clipboard-read', 'clipboard-write']);
        await A.page.locator('.dock button').first().click(); await A.page.waitForTimeout(400);
        assert.strictEqual((await A.q('.empty .share', 'getComputedStyle(el).display !== "none"'))[0] === true, keyed, 'the empty panel offers the link only when there is one');
        await A.page.locator('aside header button[aria-label="More options"]').click(); await A.page.waitForTimeout(200);
        assert.strictEqual((await A.q('.menu:not([hidden]) [data-share]')).length, keyed ? 1 : 0, '"Copy link to share" leads the More menu only when there is a link');
        if (keyed) {
          await A.page.locator('.menu [data-share]').click(); await A.page.waitForTimeout(250);
          assert.strictEqual((await A.q('.menu [data-share]', 'el.textContent'))[0], 'Link copied', 'the item says the link was copied');
          assert.strictEqual(await A.page.evaluate(() => navigator.clipboard.readText()), A.page.url(), 'what was copied is the address with the key');
          assert.strictEqual((await A.q('.menu:not([hidden])')).length, 1, 'the menu stays open so the words can be read');
        }
        await A.page.keyboard.press('Escape'); await A.page.keyboard.press('Escape'); await A.page.waitForTimeout(300);
        await A.page.keyboard.press('c'); const b = await A.page.locator('text=Order a bunch').first().boundingBox();
        await A.page.mouse.click(b.x + 20, b.y + 8); await A.page.waitForTimeout(450);
        await A.page.locator('.composer textarea').fill('through ' + label); await A.page.locator('.composer textarea').press('Enter'); await A.page.waitForTimeout(900);
        await B.page.waitForTimeout(900);
        const pinB = (await B.q('.pin', '(r => [r.left + r.width / 2, r.top + r.height / 2, getComputedStyle(el).visibility, el.getAttribute("aria-label")])(el.getBoundingClientRect())')).find(p => p[2] === 'visible');
        assert(pinB && /through|[A-Z][a-z-]+ [A-Z][a-z]+/.test(pinB[3]), 'a note written through the adapter reaches the other person');
        await B.page.mouse.click(pinB[0], pinB[1]); await B.page.waitForTimeout(700);
        await B.page.locator('.thread button[aria-label="More options"]').click(); await B.page.waitForTimeout(200);
        assert.strictEqual((await B.q('.thread .menu button', 'el.textContent + ":" + el.disabled')).filter(x => /^(Edit|Delete):true/.test(x)).length, 2, 'the signed-in id from the store decides whose note it is');
        await B.page.keyboard.press('Escape');
        await B.page.locator('.thread .compose textarea').fill('reply through ' + label); await B.page.locator('.thread .compose textarea').press('Enter'); await B.page.waitForTimeout(500);
        await A.page.keyboard.press('Escape'); await A.page.keyboard.press('Escape'); await A.page.waitForTimeout(1000);
        assert(/1 reply/.test((await A.q('.pin', 'el.getAttribute("aria-label")'))[0]), 'the reply comes back to the author');
        if (keyed) {
          C = await open();   // the same page without the link: a circle of their own, so none of these notes
          assert.strictEqual((await C.q('.pin')).length, 0, 'someone without the link sees none of the notes');
          assert.deepStrictEqual(C.errs, [], 'page errors');
        }
        assert.deepStrictEqual(A.errs.concat(B.errs), [], 'page errors'); done.push(label + ' adapter: script tag to shared notes, against a stand-in');
      } catch (e) { e.message = label + ' adapter: ' + e.message; throw e; }
      finally { await A.ctx.close(); await B.ctx.close(); if (C) await C.ctx.close(); }
    }
    /* by token: the page's own site says who each visitor is, which notes they share, and who only reads */
    {
      const said = [];
      const open = async (who) => { const ctx = await browser.newContext({ viewport: { width: 1200, height: 760 } }); if (who) await ctx.addCookies([{ name: 'who', value: who, url: origin }]);
        const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(String(e))); page.on('console', m => { if (m.type() === 'warning' || m.type() === 'error') said.push((who || 'nobody') + ': ' + m.text()); });
        await page.route('**/sample/index.html', async route => { const r = await route.fetch(); await route.fulfill({ response: r, body: (await r.text()).replace('<script src="../crittable/crittable.js">', '<script src="../crittable/crittable.js" data-backend="persistable" data-url="' + origin + '" data-token-url="/__token" data-poll="300">') }); });
        await page.goto(url); await page.waitForTimeout(1100);
        const q = (sel, f) => page.evaluate(([sel, f]) => { const o = []; for (const h of [...document.body.children].filter(e => e.shadowRoot)) for (const el of h.shadowRoot.querySelectorAll(sel)) o.push(new Function('el', 'return ' + f)(el)); return o; }, [sel, f || '1']);
        return { ctx, page, q, errs }; };
      const A = await open('ada'), B = await open('ben'), R = await open('rita'), N = await open(null);
      try {
        await A.page.keyboard.press('c'); const b = await A.page.locator('text=Order a bunch').first().boundingBox();
        await A.page.mouse.click(b.x + 20, b.y + 8); await A.page.waitForTimeout(450);
        await A.page.locator('.composer textarea').fill('through a token'); await A.page.locator('.composer textarea').press('Enter'); await A.page.waitForTimeout(900);
        await A.page.locator('.dock button').first().click(); await A.page.waitForTimeout(400);
        assert.deepStrictEqual(await A.q('footer.you:not(.reading)', 'el.hidden'), [true], 'a visitor the site names is offered no name to change, as when the page names them');
        await A.page.keyboard.press('Escape'); await A.page.waitForTimeout(300);
        await B.page.waitForTimeout(900);
        const pinB = (await B.q('.pin', '(r => [r.left + r.width / 2, r.top + r.height / 2, getComputedStyle(el).visibility, el.getAttribute("aria-label")])(el.getBoundingClientRect())')).find(p => p[2] === 'visible');
        assert(pinB && /Ada of Harbour/.test(pinB[3]), 'the note reaches someone else in the group, under the name the site gave: ' + JSON.stringify(pinB));
        await B.page.mouse.click(pinB[0], pinB[1]); await B.page.waitForTimeout(700);
        await B.page.locator('.thread button[aria-label="More options"]').click(); await B.page.waitForTimeout(200);
        assert.strictEqual((await B.q('.thread .menu button', 'el.textContent + ":" + el.disabled')).filter(x => /^(Edit|Delete):true/.test(x)).length, 2, 'the person in the token decides whose note it is');
        await B.page.keyboard.press('Escape');
        assert.deepStrictEqual(await B.q('footer.you:not(.reading)', 'el.hidden'), [false], 'a visitor the site did not name can still give a name');
        assert.strictEqual((await R.q('.pin')).length, 1, 'a visitor whose token only reads sees the note');
        await R.page.locator('.dock button').first().click(); await R.page.waitForTimeout(400);
        assert.deepStrictEqual([(await R.q('aside .add')).length, (await R.q('footer.you.reading', 'el.hidden'))[0]], [0, false], 'and is offered nothing that writes');
        assert.deepStrictEqual([(await N.q('.pin')).length, (await N.q('.dock button')).length > 0], [0, true], 'a visitor the site turns away still has the tool, and none of the group\'s notes');
        await N.page.keyboard.press('c'); const n = await N.page.locator('text=Order a bunch').first().boundingBox();
        await N.page.mouse.click(n.x + 20, n.y + 8); await N.page.waitForTimeout(450);
        await N.page.locator('.composer textarea').fill('kept here'); await N.page.locator('.composer textarea').press('Enter'); await N.page.waitForTimeout(900);
        assert.deepStrictEqual([(await N.q('.pin')).length, (await A.q('.pin')).length], [1, 1], 'what they write stays in their own browser');
        assert.deepStrictEqual(said.filter(s => !/Failed to load resource|WebSocket connection/.test(s))   /* the browser's own lines: the turned-away visitor's 401, and this server has no live line */, [], 'nothing is said in the console, to the visitor let in or the one turned away');
        assert.deepStrictEqual(A.errs.concat(B.errs, R.errs, N.errs), [], 'page errors'); done.push('by token: the site names the visitor, groups share notes, a reader only reads, and a visitor turned away keeps notes locally with no error');
      } catch (e) { e.message = 'by token: ' + e.message; throw e; }
      finally { for (const x of [A, B, R, N]) await x.ctx.close(); }
    }
    console.log('browser tests passed: ' + done.join('; '));
  } catch (e) { console.error('browser test FAILED after [' + done.join('; ') + ']\n' + e.message); process.exitCode = 1; }
  finally { await browser.close(); server.close(); }
})();
