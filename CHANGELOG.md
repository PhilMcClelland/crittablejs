# Changelog

Crittable.js is installed by copying a folder, so a page runs the version that was copied. `data-version` on the tool's element says which.

## 0.1.0 (first public version)

- Pin a note to any spot or to selected words; reply, resolve, search, sort; a panel of every note on the site.
- Shared notes through Persistable.js, on either of its stores (a Cloudflare Worker, or a Supabase project with `data-store="supabase"`), with a setup guide for a coding agent and a verify script.
- A store may mark a visitor read-only; with Persistable.js a public page carries a read key and invited people's links carry the key.
- What a shared store hands back is checked before use; a note that fails is left out, and one with only a bad place is kept and shown as a note that cannot be located.
- The host page is told when the shared store stops and starts answering (`crittable:store`).
- By keyboard: a note is placed with `C`, Tab to an element, Enter; a pin is moved with "Move pin" in its note's menu. The single-letter keys can be turned off in the More menu, and are left to the page's own widgets.
- The add key opens the panel as well as starting to place. The page is told how much room the panel takes (`--crittable-inset-left`, `--crittable-inset-right`, a `resize`), for layouts that padding cannot move.
- A reader the page has not named writes under a made-up name and can give their own at the foot of the panel, whatever the store.
- Notes written by strangers cannot take the page from its reader: one frame spends a few milliseconds at most looking for pins that have nowhere to sit.
