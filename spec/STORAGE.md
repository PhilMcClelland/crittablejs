# Storage layer (crittable/store.js)

The key/value API behind the tool's persistence. `window.CrittableStore.open(prefix[, medium])` returns:

| Member | Behaviour |
|---|---|
| `get(key, default)` | JSON-decoded value, or `default` if absent/corrupt |
| `set(key, value)` | JSON-encodes and stores under `<prefix>.<key>` |
| `remove(key)` | deletes one key |
| `keys()` | keys under this prefix (prefix stripped) |
| `clear()` | removes every key under this prefix |
| `persistent` | `true` if backed by the medium, `false` if in-memory fallback |

`medium` is any `getItem/setItem/removeItem/key/length` object (default `localStorage`). If it is unavailable or throws (private mode, quota), data stays in memory for the page lifetime. Threads are stored under key `threads`; settings under `seen`, `showPins`, `sort`, etc. Pinwall's `depot` backend (`OPTS.backend`) stays swappable.

## Shared stores

By default notes live in the browser that wrote them. To share them between people, give the tool a `backend` in `CRITTABLE_CONFIG`. The tool never talks to a service itself; the backend is the only thing that does, so any host's database can sit behind it.

```
backend = {
  shared: true,                      // other people read and write these notes: turns on names, per-browser ids and syncing
  load()                    -> Promise<Thread[]>     // every note for this site, each with its replies
  create(thread)            -> Promise
  update(id, patch)         -> Promise               // text, edited, resolved, anchor, updated
  remove(id)                -> Promise
  addReply(id, reply)       -> Promise               // optional but wanted when shared: one reply, so two people replying at once do not overwrite each other
  updateReply(id, rid, patch), removeReply(id, rid)  // optional; without them the whole replies list goes through update
  watch(onChange)                                    // optional: call onChange whenever anything changed; the tool then reloads
  poll: 4000                                         // optional: without watch, how often to reload, in ms
  readOnly: true                                     // optional: this visitor may only read. The tool then offers nothing that writes
  status(fn)                -> stop()                // optional: fn(true | false) whenever the store starts or stops answering, and the last known state at once
  whoami()                  -> Promise<{ id, name, avatar? } | null>   // optional: the signed-in person, if the store signs people in
  link()                    -> string | null         // optional: the address to send people so they reach these notes, when it is more than the page's own. The tool then offers "Copy link to share"
}
```

A thread is `{ id, text, authorId, authorName, authorAvatar?, created, updated, edited?, route, anchor, resolved, replies }`; a reply is `{ id, text, authorId, authorName, authorAvatar?, at, edited? }`. Ids are made by the tool. Both also carry `v`, the note format that wrote them (1 today; a stored note without one is 1). A store keeps `v` and gives it back unchanged. A shared store outlives any one copy of the script, so the tool leaves out, and never writes to, a note or reply whose `v` is higher than it knows. `updated` must change whenever a note or its replies change: it is what marks a note unread for everyone else.

`anchor` is the tool's to write and a store's to keep whole: `{ k, v, dx, dy }`, with `tag`, `alt`, `sel` and `was` when the tool sends them. A store checks only that `k` and `v` are non-empty strings.

What a store holds was written by other people, so `load()` must not fail because of one row: a row it cannot read is left out, and the rest are returned. Keep rows by id in something with no inherited names (`Object.create(null)` or a `Map`), since an id may be `constructor`.

An adapter that is a file in `crittable/backends/` is handed its settings by the loader in `window.CRITTABLE_BACKEND`, and puts its backend into `window.CRITTABLE_CONFIG` itself; `AGENTS.md`, "Share notes between people", has the exact steps.

What the tool does with a shared backend:
- **Identity.** If the host page sets `CRITTABLE_USER`, or `whoami()` answers, that is who the person is. Otherwise the browser gets its own id and a made-up name derived from it; the panel offers to replace that with the person's own, kept in their browser.
- **Is the store up?** The tool keeps one answer and tells the host page each time it changes: `onEvent({ type: 'store', up })` and a `crittable:store` event on `window` with `detail: { up }`. It learns it from the adapter's `status`, and from its own loads when an adapter has none (one failed load at the start, or two missed reloads in a row, is down; any load that works is up). When the store comes back it reloads by itself. The tool only reports: whether to say so, wait, or do something else is the host page's decision.
- **Syncing.** After the first load it reloads on `watch`, or every `poll` ms while the tab is visible, and merges what comes back without disturbing an open card or a half-written reply.
- **Authorship.** Edit and delete are offered only on your own notes and replies. That is the interface's rule; a store that signs people in should enforce it too.

Setup for a particular service belongs in `backends/<name>/`: an adapter file that builds this object, and a `SETUP.md` written for an agent to follow.

### Persistable.js

Persistable.js is a store of our own, in its own repo (`PhilMcClelland/persistablejs`): a general JSON object store that the host deploys to their own Cloudflare account, with Crittable.js as one user of it. Its rule is that each object has a `data` part only its creator can change and an `open` part anyone can. The adapter, `crittable/backends/persistable.js`, puts a note's words, name and route in `data`, and `resolved`, `anchor` and `updated` in `open`; a reply is an object whose `parent` is its note. It pushes changes (`watch`) and asks on a timer only while the socket is down. With `data-key="link"` the notes sit in a keyed space: only people who open the prototype's link reach them, and the store then trusts all of them, so authorship is the interface's rule there, not the store's. With `data-token-url` the page's own site vouches for each visitor: its token says which space they are in and who they are, the store enforces authorship as it does with no key, and the adapter is ready only once the first token is in. It says so with `window.CRITTABLE_BACKEND_READY`, a promise the loader waits for before it starts the tool; a visitor the site turns away (401 or 403) gets no backend and keeps notes in the browser.

Two files here are unchanged copies from that repo: `crittable/vendor/persistable.js` (the browser client, loaded before the adapter, so the script tag still fetches nothing from outside its folder) and `tests/vendor/persistable_worker.js` (the store's code, which the tests run in Node). When either changes in that repo, its "sync crittable" workflow pushes the new copies to the branch `sync/persistable` here, and the "sync persistable" workflow here runs the smoke test and opens the pull request. Never edit them here.
