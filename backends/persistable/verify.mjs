#!/usr/bin/env node
// Proves Crittable.js can share notes through a deployed Persistable.js store, using the real adapter against the real address.
//   node backends/persistable/verify.mjs https://persistable.YOUR-SUBDOMAIN.workers.dev
//   node backends/persistable/verify.mjs --store supabase https://YOUR-PROJECT.supabase.co YOUR_PUBLISHABLE_KEY
// Two made-up people write notes to a throwaway space; it checks who may do what, and cleans up.
// Exit code 0 means the prototype's reviewers will be able to read, write and reply.
// (The store has its own, fuller verify script in the persistablejs repo; run that one after deploying.)
import fs from 'node:fs'; import path from 'node:path'; import vm from 'node:vm'; import { fileURLToPath } from 'node:url';
const args = process.argv.slice(2), store = args[0] === '--store' ? args.splice(0, 2)[1] : 'worker', worker = store === 'worker';
const [url, apiKey] = args;
if (!url || !['worker', 'supabase'].includes(store) || (!worker && !apiKey)) { console.error('usage: node backends/persistable/verify.mjs <store address>\n       node backends/persistable/verify.mjs --store supabase <project url> <publishable key>'); process.exit(2); }
const here = path.dirname(fileURLToPath(import.meta.url));
// CRITTABLE_VERIFY_MOCK=1 runs the same checks against a stand-in for the store, in Node (no account needed)
const mock = !!process.env.CRITTABLE_VERIFY_MOCK;
const fetch = mock ? (await import(path.join(here, '..', '..', 'tests', ...(worker ? ['persistable_mock.mjs'] : ['vendor', 'persistable_supabase_mock.mjs'])))).default : globalThis.fetch;
const read = (...p) => fs.readFileSync(path.join(here, '..', '..', 'crittable', ...p), 'utf8');
const ctx = { fetch, console, atob, crypto: globalThis.crypto, WebSocket: mock ? undefined : globalThis.WebSocket, setTimeout, clearTimeout, setInterval, clearInterval };
ctx.globalThis = ctx; ctx.window = ctx;
vm.runInNewContext(read('vendor', 'persistable.js'), ctx); if (!worker) vm.runInNewContext(read('vendor', 'persistable-' + store + '.js'), ctx); vm.runInNewContext(read('backends', 'persistable.js'), ctx);
const memory = () => { const m = {}; return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); } }; };
const space = 'persistable-verify-' + Date.now().toString(36);
const opts = more => Object.assign({ url, space, storage: memory(), fetch }, worker ? {} : { store, apiKey }, more);
const ada = ctx.CrittablePersistable(opts()), ben = ctx.CrittablePersistable(opts());
let failed = 0;
const step = async (name, fn) => { try { await fn(); console.log('  ok   ' + name); } catch (e) { failed++; console.log('  FAIL ' + name + '\n       ' + (e && e.message)); } };
// a refusal only counts if the store said no; failing to reach it is not a refusal
const refuses = async (what, fn) => { let why = null; try { await fn(); } catch (e) { why = String(e && e.message); } if (why === null) throw new Error(what + ' was allowed, and should not be'); if (!/failed \(403\)/.test(why)) throw new Error(what + ' failed for the wrong reason: ' + why); };
const now = Date.now(), note = { id: 'v-note', text: 'verify: a note', authorName: 'Ada', route: '/', anchor: { k: 'css', v: 'body' }, created: now, updated: now };

console.log('Crittable.js on Persistable.js (' + store + '): ' + url.replace(/^(https:\/\/)[a-z0-9]+(\.supabase\.co).*$/, '$1***$2') + '\nspace: ' + space);
if (worker) await step('the address answers as Persistable.js', async () => { const r = await fetch(url.replace(/\/+$/, '') + '/'); const j = await r.json(); if (j.service !== 'persistable') throw new Error('unexpected answer: ' + JSON.stringify(j)); });
if (failed) { console.log('\nThe address has to answer before anything else can be checked. Is the Worker deployed, and is this its address?'); process.exit(1); }
await step('two browsers are two different people', async () => { const a = await ada.whoami(), b = await ben.whoami(); if (!a.id || !b.id || a.id === b.id) throw new Error('expected two distinct ids'); });

await step('a person can add a note', () => ada.create(note));
await step('someone else can read it', async () => { const got = await ben.load(); if (got.length !== 1 || got[0].text !== note.text || got[0].authorName !== 'Ada' || got[0].anchor.v !== 'body') throw new Error('unexpected notes: ' + JSON.stringify(got)); });
await step('a note keeps the format that wrote it', async () => { await ada.create(Object.assign({}, note, { id: 'v-format', v: 2 })); const th = (await ben.load()).find(t => t.id === 'v-format'); await ada.remove('v-format'); if (!th || th.v !== 2 || (await ben.load()).some(t => t.id === 'v-note' && t.v !== 1)) throw new Error('the format version was not kept.'); });
await step('someone else can reply', () => ben.addReply('v-note', { id: 'v-reply', text: 'verify: a reply', authorName: 'Ben', at: now + 1000 }));
await step('the reply shows, and makes the note newer', async () => { const [th] = await ada.load(); if (!th || th.replies.length !== 1 || th.replies[0].text !== 'verify: a reply' || !(th.updated > now)) throw new Error('unexpected: ' + JSON.stringify(th)); });
await step('a reply cannot be made to break loading for everyone', async () => {
  // a reply named after something every object has, then a reply to that reply: read carelessly, the second one throws
  const raw = ctx.Persistable(Object.assign(opts(), { storage: memory() })).collection('crittable'), made = [], said = { v: 1, text: 'verify: hostile', authorName: 'Cy', at: now + 1500 };
  for (const name of ['constructor', 'toString', 'hasOwnProperty', '__proto__']) {
    try { await raw.create(said, { id: name, parent: 'v-note' }); made.push(name); } catch (_) { /* the store may refuse the name; then there is nothing to survive */ }
    try { await raw.create(said, { id: 'v-under-' + name, parent: name }); made.push('v-under-' + name); } catch (_) { /* as above */ }
  }
  let got, why = null;
  try { got = await ada.load(); } catch (e) { why = e; }
  for (const id of made.reverse()) { try { await raw.remove(id); } catch (_) { /* went with its parent */ } }
  if (why) throw new Error('loading broke: ' + (why && why.message));
  const th = got.find(t => t.id === 'v-note');
  if (got.length !== 1 || !th || !th.replies.some(r => r.id === 'v-reply') || th.replies.some(r => /^v-under-/.test(r.id))) throw new Error('unexpected: ' + JSON.stringify(got));
  const after = (await ada.load())[0]; if (!after || after.replies.length !== 1) throw new Error('the hostile replies were not cleaned up: ' + JSON.stringify(after && after.replies));
});
await step('someone else can resolve it', async () => { await ben.update('v-note', { resolved: true, updated: now + 2000 }); const [th] = await ada.load(); if (!th.resolved) throw new Error('not resolved'); });
await step('someone else cannot take a note\'s place away: it falls back to where its author put it', async () => {
  const raw = ctx.Persistable(Object.assign(opts(), { storage: memory() })).collection('crittable');
  await raw.setOpen('v-note', { anchor: null });   // straight at the store, past the adapter
  const [th] = await ada.load(); if (!th || !th.anchor || th.anchor.v !== note.anchor.v) throw new Error('the note lost its place: ' + JSON.stringify(th && th.anchor));
  for (const junk of [{}, { k: 1 }, { k: 'css' }, []]) {   // nor swap it for something that is not a place
    await raw.setOpen('v-note', { anchor: junk });
    const [again] = await ada.load(); if (!again || !again.anchor || again.anchor.v !== note.anchor.v) throw new Error('the note lost its place to ' + JSON.stringify(junk) + ': ' + JSON.stringify(again && again.anchor));
  }
});
await step('someone else cannot change the words', () => refuses('editing another person\'s note', () => ben.update('v-note', { text: 'hijacked', edited: now, updated: now + 3000 })));
await step('the author can edit', async () => { await ada.update('v-note', { text: 'verify: edited', edited: now + 4000, updated: now + 4000 }); const [th] = await ben.load(); if (th.text !== 'verify: edited') throw new Error('not edited'); });
await step('a different space sees nothing', async () => { const got = await ctx.CrittablePersistable(opts({ space: space + '-other' })).load(); if (got.length) throw new Error('notes leaked between spaces'); });
await step('the author can delete, and the reply goes with it', async () => { await ada.remove('v-note'); const got = await ben.load(); if (got.length) throw new Error('note still there: ' + JSON.stringify(got)); });
// By token: the page's own site vouches for each visitor. Checked against the stand-in, and against a real store when its TOKEN_SECRET is in the environment.
if (worker && (mock || process.env.TOKEN_SECRET)) {
  const { token } = await import(path.join(here, '..', '..', 'tests', 'vendor', 'persistable_token.mjs'));
  if (mock) (await import(path.join(here, '..', '..', 'tests', 'persistable_mock.mjs'))).env.TOKEN_SECRET = process.env.TOKEN_SECRET = 'made-up-for-the-mock-' + 'x'.repeat(24);
  const SECRET = process.env.TOKEN_SECRET, group = 'crittable-verify-token-' + Date.now().toString(36);
  const by = (who, more, where) => ctx.CrittablePersistable({ url, fetch, WebSocket: null, token: () => token(SECRET, Object.assign({ space: where || group, person: who }, more)) }).ready();
  const cy = await by('cy', { name: 'Cy from the site' }), di = await by('di'), ro = await by('ro', { read: true }), mine = Object.assign({}, note, { id: 'v-token', authorName: 'Cy from the site' });
  await step('by token: the site names the visitor, and says who only reads', async () => { const bare = await cy.whoami(); ctx.CRITTABLE_USER = { name: cy.named }; const a = await cy.whoami(), b = await di.whoami(); ctx.CRITTABLE_USER = undefined; if ('name' in bare) throw new Error('the token\'s name was handed to a page that had not taken it'); if (cy.named !== 'Cy from the site' || a.name !== 'Cy from the site' || 'name' in b || a.id === b.id || di.named !== null || cy.readOnly || !ro.readOnly || cy.space !== group || cy.link() !== null) throw new Error(JSON.stringify({ a, b, named: [cy.named, di.named], ro: ro.readOnly, space: cy.space })); });
  await step('by token: a note is shared inside the group, and seen by nobody outside it', async () => { await cy.create(mine); const inside = await di.load(), other = await (await by('cy', {}, group + '-other')).load(), open = await ctx.CrittablePersistable({ url, fetch, space: group, storage: memory() }).load(); if (inside.length !== 1 || inside[0].text !== mine.text || other.length || open.length) throw new Error('inside ' + inside.length + ', another group ' + other.length + ', no token ' + open.length); });
  await step('by token: someone else in the group can reply and resolve, and cannot change the words or delete', async () => { await di.addReply('v-token', { id: 'v-token-reply', text: 'verify: a reply', authorName: 'Di', at: now + 1000 }); await di.update('v-token', { resolved: true, updated: now + 2000 }); await refuses('editing another person\'s note', () => di.update('v-token', { text: 'hijacked', edited: now, updated: now + 3000 })); await refuses('deleting another person\'s note', () => di.remove('v-token')); const [th] = await cy.load(); if (!th.resolved || th.replies.length !== 1 || th.text !== mine.text) throw new Error(JSON.stringify(th)); });
  await step('by token: a reader reads, and the store refuses their writes', async () => { if ((await ro.load()).length !== 1) throw new Error('could not read'); await refuses('a reader resolving', () => ro.update('v-token', { resolved: false, updated: now + 5000 })); });
  await step('by token: a visitor the site turns away gets no backend, and the reason is kept', async () => { let why = null; try { await ctx.CrittablePersistable({ url, fetch, token: () => Promise.reject(Object.assign(new Error('not let in'), { status: 401 })) }).ready(); } catch (e) { why = e; } if (!why || why.status !== 401) throw new Error('expected the site\'s 401'); });
  await step('by token: a key, a read key or a space alongside is refused', async () => { for (const more of [{ key: 'link' }, { space: 'mine' }, { read: 'k'.repeat(24) }]) { let why = null; try { ctx.CrittablePersistable(Object.assign({ url, fetch, token: () => '' }, more)); } catch (e) { why = e; } if (!why) throw new Error(JSON.stringify(more) + ' was accepted'); } });
  await step('by token: an address that is empty, or not on the page\'s own site, sets up nothing', async () => { for (const tokenUrl of ['', '  ', 'https://elsewhere.example/token', '/api/token']) { let why = null; try { ctx.CrittablePersistable({ url, fetch, tokenUrl }); } catch (e) { why = e; } if (!why) throw new Error(JSON.stringify(tokenUrl) + ' was accepted' + (tokenUrl === '/api/token' ? ' with no page to be on the same site as' : '')); } });
  await step('by token: the author can delete', async () => { await cy.remove('v-token'); if ((await di.load()).length) throw new Error('still there'); });
}
console.log(failed ? '\n' + failed + ' check(s) failed. See backends/persistable/SETUP.md.' : '\nAll checks passed. Add the script tag from SETUP.md to the prototype.');
process.exit(failed ? 1 : 0);
