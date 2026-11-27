# Crittable.js: directions for agents

Crittable.js lets people pin notes on a coded prototype. This file is for an agent adding it to someone's prototype. If you are changing Crittable.js itself, read `CLAUDE.md` instead.

The repository is https://github.com/PhilMcClelland/crittablejs. The `crittable/` folder in it is the whole tool.

## Add it to a prototype

1. Add one tag to each page: `<script src="https://cdn.jsdelivr.net/gh/PhilMcClelland/crittablejs@v0.3.4/crittable/crittable.js"></script>`.
2. Or, if the person wants nothing loaded from another site, copy the `crittable/` folder into the prototype (any name, anywhere it is served) and use `<script src="path/to/crittable/crittable.js"></script>`. The rest of this file writes the tag that way; the hosted address works in its place everywhere.
3. Open the page. A round button appears in a corner; `C` starts a note.

That is the whole install. There is no build step and no package to add (the loader fetches `config.js`, `store.js` and `pinwall.js` from its own folder, wherever that is). Notes are kept in the browser that wrote them.

## A prototype built with a bundler or a framework (Vite, Next and the like)

The tool is a set of plain files that load each other by address, so it is served, never imported or bundled.

1. Copy the `crittable/` folder into the folder the framework serves as it is: `public/` in Vite and Next, `static/` in some others. Keep the file names: the loader finds its folder from its own address.
2. Add the one tag to the HTML shell every page shares, with the address the folder is served at: `index.html` in Vite, the root layout or `_document` in Next. `<script src="/crittable/crittable.js"></script>`.
3. Do not `import` it, and do not let the build rename `crittable.js` (a hashed name is fine for the page's own code, not for this file).

If the framework's script component drops `data-` attributes, set the same things on `window` in a plain script that runs before the tag:

- Settings: `window.CRITTABLE_CONFIG = { … }`. The loader then skips `config.js`, so `data-no-config` and `data-config` are not needed.
- A shared store: set `window.CRITTABLE_BACKEND = { name: 'persistable', url: '…', key: 'link' }` (the same names as the attributes, without `data-`; `data-api-key` is `apiKey`), then load the adapter yourself before the loader, in this order and not `async`: `crittable/vendor/persistable.js`, then `crittable/vendor/persistable-<store>.js` when `store` is set (`persistable-supabase.js` for `store: 'supabase'`), then `crittable/backends/persistable.js`, then `crittable/crittable.js`. The loader only loads an adapter when it sees `data-backend` on its own tag.

A single-page app needs nothing more: the tool follows `history.pushState` and hash routes by itself.

## Share notes between people

For "I send you the link, you comment, I see it straight away", the notes need a store everyone can reach. Crittable.js runs no service of its own. It shares notes through Persistable.js, which keeps them in a backend the person owns; follow `backends/persistable/SETUP.md`.

- **Persistable.js on a Cloudflare Worker** (ready, and the one to pick unless there is a reason not to): a small store the person deploys once to their own free Cloudflare account, no API keys, changes pushed live. Ask the person who should get in: `data-key="link"` keeps the notes among people who are sent the prototype's link. Follow `backends/persistable/SETUP.md`; the store itself is in the `PhilMcClelland/persistablejs` repo. The prototype can use the same store for its own data.
- **By token, on a site that signs people in** (ready, Worker only): when separate groups review one prototype and must not see each other's notes, or reviewers should appear under the names the site has for them. Ask the person two things first: who should see the notes, and whether the site already knows who a visitor is. Only a yes to the second makes this possible: it needs one address on the site's server, so it cannot be done on a static host (offer `data-key="link"` there). `backends/persistable/SETUP.md`, "By token". Put `data-token-url` only where it belongs: never keep groups apart with `data-space`, which a visitor can change.
- **Persistable.js on Supabase** (ready): the same adapter with `data-store="supabase"`. Pick it when the person already has a project, or wants the notes in Postgres. It has no link keys or read keys, so notes there are open to anyone who has the page, and changes arrive within a few seconds, not at once.

- **Something else** (the host's own database, Firebase, a spreadsheet, an API): the better way is a Persistable.js store, which then works for every project built on Persistable.js and needs nothing changed here: `docs/stores.md` in the `persistablejs` repo has the contract and `stores/supabase.js` there is the worked example. The other way is an adapter for this tool alone. Its contract is in `spec/STORAGE.md` under "Shared stores": an object with `load`, `create`, `update`, `remove`, and ideally `addReply`. Put it in `crittable/backends/<name>.js`, modelled on `crittable/backends/persistable.js`, and load it with `data-backend="<name>"` on the script tag. Add a `backends/<name>/SETUP.md` and a verify script like the one in `backends/persistable/`.

  How the loader and an adapter meet:
  - `data-backend="<name>"` must be lower-case letters, digits and `-`; anything else is ignored with a warning in the console, and notes stay in the browser.
  - Before it loads `crittable/backends/<name>.js`, the loader sets `window.CRITTABLE_BACKEND = { name, url, key, space, poll, read, store, apiKey, tokenUrl }` from `data-backend`, `data-url`, `data-key`, `data-space`, `data-poll`, `data-read`, `data-store`, `data-api-key` and `data-token-url`. Each is the attribute's text, or `null` when it is absent (`read`, `store`, `apiKey` and `tokenUrl` are `undefined`). No other attribute is passed on.
  - The adapter file runs before `store.js` and `pinwall.js`. If `CRITTABLE_BACKEND.name` is its own name, it builds the object and merges it into the settings, keeping what is there: `window.CRITTABLE_CONFIG = Object.assign(window.CRITTABLE_CONFIG || {}, { backend })`. It must do this while the file runs, not later: the tool reads its settings once, when `pinwall.js` loads. An adapter that has to ask something first (who the visitor is, say) sets `window.CRITTABLE_BACKEND_READY` to a promise while the file runs, and merges its backend in before that promise resolves; the loader waits for it. The promise must always settle, and soon: the tool is not on the page until it does.
  - If it cannot build the object (a missing address, say), it warns in the console and leaves the settings alone, so notes stay in the browser.
  - What other people stored is not to be trusted. `load` must never throw because of one bad row: leave the row out.

Both setup guides include a verify script; do not skip it. It needs Node 22 or later and a checkout of this repository (the prototype only carries the `crittable/` folder), and nothing else: it runs on the copies in `crittable/vendor/`. (The `persistablejs` repo is needed to deploy a store or run its SQL, not to verify.) To try the script with no store at all, `CRITTABLE_VERIFY_MOCK=1 node backends/persistable/verify.mjs https://mock.invalid` runs it against a stand-in, and `CRITTABLE_VERIFY_MOCK=1 node backends/persistable/verify.mjs --store supabase https://mock.supabase.co mock-key` does the same for Supabase.

Rules that keep it trivial for the people commenting:
- They must not need an account unless the person asks for sign-in. Without one, each person gets a made-up name to write under at once, and the panel offers to swap it for their own.
- Ship only public values in the page. Never a secret or service key.
- Check it in two browsers before you say it works: a note written in one must appear in the other.

## Tell it who is commenting (optional)

If the prototype already knows the person, set `window.CRITTABLE_USER = { id, name, avatar }` before the script tag and nobody is given a made-up name.
