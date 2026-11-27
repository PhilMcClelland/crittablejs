# Crittable.js reference

Settings, keys and behaviour in full. For what the tool adds to a host page, see [page-footprint.md](page-footprint.md).

## Including it

Copy `crittable/` next to your page and add one tag: `<script src="crittable/crittable.js"></script>`. The loader finds its own folder, loads `config.js`, `store.js` and `pinwall.js` from it, and the note tool attaches to the host page. Set `window.CRITTABLE_CONFIG` first to skip `config.js`, or use `data-config="url"` / `data-no-config` on the tag.

## Where it starts

The launcher starts in the bottom right corner and can be dragged anywhere; it remembers the corner it was left nearest and keeps clear of the panel. The panel starts shut. Set `panelOpen: true` in `CRITTABLE_CONFIG` to start with it open (not on a phone, where it would cover the page); after that the reader's own choice is remembered. `panelOpen: 'always'` opens it on every load, for a page whose point is to show the panel.

## Keys

The launcher opens the panel; "Add note" there starts placing. `C` opens the panel and starts placing (on a phone it only starts placing, since the panel would cover the page) and `C` again stops and shuts the panel, `Shift+C` hides the pins or shows them again, `J` / `K` step to the next / previous open note on the page, `Esc` backs out one level: a menu, a draft, an open note, placing, and last the panel. `Esc` only shuts the panel when focus is in the tool or on nothing, so it never takes the key from the page's own dialog or menu.

Everything can be done from the keyboard. To place a note, press `C`, move focus to the element with Tab, and press Enter. To move a pin, open its note, choose "Move pin" in the note's menu, and choose the new spot the same way (or click it). The single-letter keys can be turned off by the reader, with "Keyboard shortcuts" in the panel's More menu; they are also left alone while focus is in a field, a custom element, or a widget of the page's own that takes keys.

### Your own button

A page can open and shut the panel from a button of its own by sending an event on `window`:

```js
window.dispatchEvent(new Event('crittable:toggle-panel'));   // opens it when shut, closes it when open
window.dispatchEvent(new Event('crittable:open-panel'));
window.dispatchEvent(new Event('crittable:close-panel'));    // also stops placing a note
```

To hear when it opens or shuts (to keep the button's state), take `panel-opened` and `panel-closed` in `onEvent`. With a button of its own a page will usually want the launcher hidden: set `showLauncher: false`. "Show launcher" in the panel's menu shows or hides the launcher and nothing else: the add key and these events still open the panel. One case would leave a reader no way in, the launcher hidden and the keys turned off on a page with no button of its own, so then the launcher shows anyway. A page counts as having its own button once it sets `showLauncher: false` or sends one of these events.

Each key can be changed: `keys: { add: 'c', next: 'j', previous: 'k', back: 'Escape' }` in `CRITTABLE_CONFIG`. `Shift` with the `add` key is always the one that hides and shows the pins.

## Options

Every option is a key of `window.CRITTABLE_CONFIG` (set it before the script tag, or edit `crittable/config.js`). All are optional.

| Option | Default | What it does |
| --- | --- | --- |
| `productName` | `'Crittable.js'` | The name shown in the panel. |
| `sidebarTitle` | `'All notes'` | The panel's name for a screen reader. |
| `launcherLabel` | `'Notes'` | The launcher's label and tooltip. |
| `anonymousName` | `'Guest'` | The name shown for a stored note that has none. (A reader the page has not named writes under a made-up name, and can give their own at the foot of the panel.) |
| `maxNote` | `1000` | The most characters in a note. |
| `maxReply` | `500` | The most characters in a reply. |
| `keys` | `{ add: 'c', next: 'j', previous: 'k', back: 'Escape' }` | The keys ("Keys"). |
| `theme` | `'auto'` | `'light'`, `'dark'` or `'auto'` (follow the system). The reader can change it in the panel, and their choice is remembered and wins. |
| `panelOpen` | `false` | `true` or `'always'` ("Where it starts"). |
| `showLauncher` | `true` | `false` starts the launcher hidden, for a page with its own button ("Your own button"). The reader can turn it on in the panel, and their choice is remembered and wins. |
| `storagePrefix` | `'crittable'` | The start of every storage key the tool writes. |
| `storage` | not set | `'session'` keeps notes and settings for the tab only. |
| `tagName` | `'pin-note-board'` | The name of the tool's element. The element for a note being written is `<tagName>-editor`, and the flag on `window` is `'__'` and this name. |
| `gravatar` | `false` | Look up the person's Gravatar ("Who is commenting"). |
| `sharedAvatars` | `false` | On a shared store, show other people's avatar images too ("Who is commenting"). |
| `backend` | not set | A shared store (the README, "Sharing notes"). `data-backend` on the script tag sets it for you. |
| `onEvent` | does nothing | A function the tool calls with `{ type, … }` when something happens: `type` is `created`, `edited`, `replied`, `resolved`, `deleted`, `store`, or `panel-opened` / `panel-closed` (with `side` and `inset`, the px the panel takes). An error it throws is ignored. |

`stateSheet` is also read: it is how `sample/states.html` draws the tool's states, and is not meant for a host page.

## Script tag attributes

All optional, all on the tool's own `<script>` tag.

| Attribute | What it does |
| --- | --- |
| `data-config="url"` | Load settings from this file in place of `config.js`. |
| `data-no-config` | Load no settings file. |
| `data-backend="persistable"` | Share notes through a store (the README, "Sharing notes"). The rest of this table only counts with it. |
| `data-url` | The store's address: the Worker's, or the Supabase project's. |
| `data-store` | Which Persistable.js store: the Worker unless set; `supabase` for a Supabase project. |
| `data-api-key` | With `data-store="supabase"`, the project's publishable key. |
| `data-key` | Worker only. `link` keeps the notes among people who have the page's link; or a fixed key, for a page behind a sign-in. |
| `data-read` | Worker only. A read key: everyone reads, people whose link has the key write. |
| `data-token-url` | Worker only. An address on the page's own site that vouches for the visitor: it decides which notes they share, their name, and whether they may write. Not with `data-key`, `data-read` or `data-space`. |
| `data-space` | Which set of notes. The page's origin unless set. |
| `data-poll` | Milliseconds between asks: on Supabase always, on the Worker only while its live connection is down. 4000 unless set. |

## Who is commenting

Set `window.CRITTABLE_USER = { id, name, avatar }` before the script tag. With a shared store that signs people in or gives each browser an identity (both shipped adapters do), the person's `id` comes from the store and replaces `CRITTABLE_USER.id`: the store decides who may edit a note, so its id is the one that counts. With the two shipped adapters the name and avatar stay yours. The one exception is `data-token-url`: when the site's token names the visitor and the page has not, that name is used, and the panel offers no field to change it. `avatar` is optional: an image URL the host page supplies (`https:`, `data:image/` or a relative path). Pins and threads show it in place of initials, and fall back to initials if it fails to load. On a shared store only your own image shows by default, because another person's image address is theirs to choose and loading it tells that address who is looking; set `sharedAvatars: true` only when the page itself supplies everyone's image, because with it on every reader's browser fetches whatever address each writer stored, including an address on your own site. The tool does not look avatars up anywhere itself unless you turn Gravatar on.

**Gravatar (off by default).** Set `gravatar: true` in `CRITTABLE_CONFIG` and give the person an `emailHash` (the SHA-256 hex of their trimmed, lower-cased address) or an `email`, which is hashed in the browser. Only the hash is kept with the note, never the address. It is opt-in because a browser that shows the image requests it from gravatar.com, which tells a third party that the hash was seen on your page. On a shared store that is your own image only, unless `sharedAvatars` is on too. An explicit `avatar` always wins, and a person with no Gravatar keeps their initials. The hash is not a secret: on a shared store it is kept with each note that person writes, every reader can read it, and anyone can hash a list of known addresses and see which one matches. Leave Gravatar off where the people commenting should not be identifiable by their address.

## Where notes are kept

Without a shared store, notes are kept in the browser's `localStorage` under the `storagePrefix` from `crittable/config.js`: there is no server and nothing is sent out. Set `storage: 'session'` to keep them for the tab only, which is what the landing page does. With a shared store they are sent to that store and to nowhere else. If `localStorage` is unavailable, the tool falls back to an in-memory copy for the session.

A note belongs to the page it was written on, and a page is its path and its query string (plus a hash route such as `#/settings`). So `/plan?tab=a` and `/plan?tab=b` are two pages, each with its own pins; a link with a tracking parameter added is a different page too. A trailing `index.html` is ignored.

## When the shared store is down

The tool tells the page, and the page decides. Listen for `crittable:store` on `window` (`event.detail.up` is `true` or `false`), or take `{ type: 'store', up }` in `onEvent`. It fires each time the answer changes; the tool reloads by itself when the store comes back. A page can show a line while it is down, wait, or do something else.
