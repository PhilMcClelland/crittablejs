# Crittable.js

Make any coded prototype crittable. Add one script tag and people can pin a note to any spot on the page, reply, and resolve.

**[Try it at crittablejs.philmcclelland.com](https://crittablejs.philmcclelland.com).** What you write there stays in your own browser tab.

## Quick start

Add one tag to your page:

```html
<script src="https://cdn.jsdelivr.net/gh/PhilMcClelland/crittablejs@v0.3.0/crittable/crittable.js"></script>
```

A round button appears in the corner. Press `C`, click anything on the page, and write a note.

There is no build step, no package and no account. To host it yourself, copy the [`crittable/`](crittable) folder next to your page and point the tag at it.

Working with an agent? Tell it "Add github.com/PhilMcClelland/crittablejs to this prototype". [AGENTS.md](AGENTS.md) tells it the rest, including what to do in Vite, Next and other frameworks.

## What you get

- Notes pinned to an element, or to a few words inside it. Pins find their place again when the page redraws, and follow a single-page app's routes.
- Replies, resolve, edit, delete and "Move pin", plus a panel that lists and searches every note.
- The whole thing works from the keyboard: `C` to add, `J` / `K` to step through notes, `Esc` to back out. Every key can be changed or turned off.
- Light and dark themes, and a phone layout.
- It draws itself in a shadow root, so its styles and your page's never meet. Everything it does outside that is listed in [docs/page-footprint.md](docs/page-footprint.md).

## Sharing notes

By default notes stay in the browser that wrote them. To share them between everyone who opens the prototype, add a store. Crittable.js runs no service of its own: it shares notes through [Persistable.js](https://persistablejs.philmcclelland.com), which keeps them in a backend you own and set up once.

```html
<script src="https://cdn.jsdelivr.net/gh/PhilMcClelland/crittablejs@v0.3.0/crittable/crittable.js"
        data-backend="persistable" data-key="link"
        data-url="https://persistable.YOUR-SUBDOMAIN.workers.dev"></script>
```

Two stores are ready, and an agent can follow the [setup](backends/persistable/SETUP.md) for either end to end:

- **A Cloudflare Worker** (the tag above): deployed once to your own free account, with no API keys, and changes pushed live.
- **A Supabase project**: for when you already have one, or want the notes in Postgres. The tag is then `data-backend="persistable" data-store="supabase" data-url="https://<ref>.supabase.co" data-api-key="<publishable key>"`, with no `data-key`.

With the Worker and `data-key="link"` the notes stay among the people you send the prototype's link to; without it, anyone who finds the store's address can read and add notes. Add `data-read="<read key>"` for a page everyone can read but only invited people can write on. The setup guide says how to make the pair.

On a site that already signs people in, its server can decide which notes each visitor shares and what to call them, so several clients or teams can review one prototype without seeing each other's notes: add `data-token-url`. It is the one option that needs code on the site's server; the setup guide has it under "By token".

To keep notes anywhere else, write a Persistable.js store ([how](https://github.com/PhilMcClelland/persistablejs/blob/main/docs/stores.md)), or an adapter for the tool itself: that contract is in [spec/STORAGE.md](spec/STORAGE.md).

## Docs

- [Reference](docs/reference.md): options, keys, who is commenting, where notes are kept, events.
- [What it does to your page](docs/page-footprint.md): every element, listener, global and storage key, and the browsers it needs (2023 or later).
- [AGENTS.md](AGENTS.md): directions for an agent adding it to a prototype.
- [CHANGELOG.md](CHANGELOG.md): what changed between versions.

## Contributing

Issues and small pull requests are welcome; see [CONTRIBUTING.md](CONTRIBUTING.md). Report a security problem privately, as [SECURITY.md](SECURITY.md) describes.

## License

[MIT](LICENSE)

If it saved you time, you can [leave a tip](https://github.com/sponsors/PhilMcClelland). Nothing comes with it.
