# Changelog

A page runs the version its script tag names (the `@v…` in a hosted address), or the version of the folder that was copied. `data-version` on the tool's element says which.

## 0.3.1

- "Show launcher" shows or hides the launcher and nothing else. Before, hiding it also opened the panel and took away its close button; now the add key, and a button of the page's own, still open the panel. If the launcher is hidden and the keys are turned off on a page with no button of its own, the launcher shows anyway, so nobody is left without a way in.
- A page can open and shut the panel from its own button: send `crittable:toggle-panel`, `crittable:open-panel` or `crittable:close-panel` on `window` (`docs/reference.md`, "Your own button").
- `showLauncher: false` starts the launcher hidden, for such a page. A reader can turn it back on in the panel, and their choice wins.

## 0.3.0

- A name is who someone is now. Change yours and every note and reply you have written shows the new one, for everyone, straight away. On Persistable.js each person's name is one object in a new collection, `crittable-people`, matched to notes by the store's own record of who wrote what, so nobody can rename someone else. A name is saved only for someone who has written a note or reply, so a visitor who only reads leaves no name behind, and a made-up name is never saved. Notes written before keep the name they carry until their writer next loads the page. The Persistable.js Worker and its Supabase SQL do not change; the space just holds one more collection. Faces are coloured and lettered by name, so a rename recolours your earlier faces too. A store adapter of your own keeps the old behaviour until it adds `setName` (`spec/STORAGE.md`).
- A pin is no longer drawn over something that covers its element. On a page that stacks scenes in one place and swaps them (by clip-path, overflow or simply laying one over another), a note now shows only while its scene is showing; before, a note on the first scene stayed on screen over every later one. A covered pin's row says "Hidden on this page right now", as for any hidden element. Something see-through on top, such as a link stretched over a whole card to make it clickable, does not count as covering. A note on the page itself, or on an element with `pointer-events: none`, is drawn as before.
- In the list, the time sits on its own line under the writer's name, so a long name is no longer cut short and the time no longer wraps. A face's initials leave out a part of the name in brackets and anything that is not a letter ("Ben (Gavin's space)" is B, not "B(").
- Fixed: with "Show launcher" turned off, the tool failed to start on the next load (it tried to open the panel before the list was set up). It now starts with the launcher hidden, as it was left.

## 0.2.0

- `data-token-url`: on a site that already knows who its visitors are, the site's server can say which notes a visitor shares, what to call them, and whether they may write. Add `data-token-url="/api/token"` (an address on the page's own site) beside `data-backend="persistable"` and `data-url`. Each group the site keeps apart has its own notes, a visitor the site names is not asked for a name, and a visitor the site turns away keeps their notes in their own browser. It needs a Persistable.js 0.2.0 Worker with `TOKEN_SECRET` set; `backends/persistable/SETUP.md`, "By token".
- The Persistable.js client in `crittable/vendor/` is 0.2.0. Nothing changes for a page that does not use a token.

## 0.1.2

- A field grows with what is written in it (the new note, a reply, a note or reply being edited), up to about five lines, and scrolls past that. Before, it stayed one line tall and long words scrolled out of sight.

## 0.1.1

- On a touch device the search field's words no longer start under its magnifying glass, and the name field at the foot of the panel is 16px like the other fields, so a phone does not zoom the page when it is touched. Both came with the touch sizes in 0.1.0.

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
