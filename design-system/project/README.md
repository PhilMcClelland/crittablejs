A look for tools that sit on top of someone else's page: pin a note to a spot, read it later. Two materials do all the work. Ink carries every word and every line. Highlighter yellow marks what is live. Everything else stays out of the way of the page underneath.

## The four rules

1. **Yellow is a fill; on a light surface it is never a line or a word.** Use `cm-accent` only behind ink: pins, the launcher, Send, a checked box. For a link, a dot or a checked mark use `cm-accent-ink`. For a focus ring use `cm-focus`. Both are ink in light, because yellow has no contrast on paper, and yellow in dark, where it reads well.
2. **One sharp corner, and it points at the anchor.** Pins, cards and the launcher round three corners (`cm-r-lg`, or a half circle on pins) and keep one at `cm-r-tip`. Put that corner on the side of the thing the part belongs to: a pin's on its spot, a card's on its pin. Nothing else gets a sharp corner.
3. **What sits on the host page does not theme.** Pins, the launcher, the toast, the storage banner and the wash on a target use `cm-pin-ink`, `cm-pin-paper`, `cm-pin-ring`, `cm-pin-drop` and `cm-pin-wash` in both themes. The viewer's theme says nothing about how bright the page underneath is. Cards, menus and the panel do theme.
4. **Working motion is quiet; only the mark may act.**
   - *Working motion* answers something the reader did and nothing else: `cm-fast` for hover, press and fades, `cm-medium` for a card, menu or panel opening, `cm-ease` for all of it. It never loops, except to say "working".
   - *The mark* (the pin with two eyes) is a character, and it alone has motion of its own: it blinks, winks, bobs and crosses its eyes into the way out. Once per trigger, on its own timing (`cm-mark-blink`, `cm-mark-nod`, `cm-mark-shut`, `cm-mark-open`). Never give this to content, a control or a note.
   - *One signature*: a draft pin dropping onto its spot (`cm-plant`).
   - Change one shape; never swap two. A swap reads as flicker at this size.
   - Nothing tracks the pointer: no following eyes, no parallax.
   - A change of state moves straight (down and up, or across), not round. A turning sign looks like it fell over.
   - What belongs together moves together: the launcher rides the panel's edge.
   - A change to a whole surface (the theme) fades; it does not flash.
   - No glow, no spring. Under reduced motion everything is instant.

## Colour

- Ground the panel in `cm-base`; lift cards, rows and menus onto `cm-raised`; fill fields with `cm-input`; tint the new-note strip with `cm-strip`.
- Set text down the ladder: `cm-text` for titles, `cm-text-author` for names, `cm-text-body` for notes, `cm-text-meta` for times and counts, `cm-text-hint` for placeholders.
- Divide with `cm-border-hair`, edge containers with `cm-border`, and edge every floating card with `cm-card-edge`. Edge anything you type in or press with `cm-control-edge`: ink in light, to match the edge under a yellow button. What you can act on has an ink edge; structure stays pale.
- Under any `cm-accent` fill put a 1px `cm-accent-edge`, and set its label in `cm-on-accent`. Hover it with `cm-accent-deep`.
- Show selection with the `cm-selected` wash, an active choice with `cm-accent-wash`, and a focused field with a `cm-focus` border plus a 3px `cm-halo`.
- Keep meaning out of the accent. Success is `cm-ok`, warning is `cm-warn` (orange, so it cannot be read as the highlighter), failure is `cm-err`, resolved is `cm-done`.
- Give each person one of six colours by a hash of the name shown. A face is a pale wash of that colour with initials in its deep shade: `cm-face-N` under `cm-face-N-ink` in a card or the panel (reversed in dark), `cm-av-N` under `cm-av-N-ink` in a pin (never themed). A photo covers the initials; the initials stay underneath as the fallback.
- Pair every colour cue with a glyph or a word: a check for resolved, a dot plus hidden "Unread" text, a reason line on a muted row.

## Type

One family, the system stack (`font-sans`), so the tool looks native on every machine and loads nothing. Two sizes: `body` at 14px for everything, `meta` at 12px for times, counts and hints. Weight does the rest: `author` and `head` are body size at 600. Line height is 1.45 throughout. Initials inside a face are the one exception, at `cm-fs-face`. Never add another size; if something needs to stand out, give it weight or put it on a wash.

## Space, shape and depth

- Space in steps of four: `cm-s1` to `cm-s6`. Card padding is `cm-s3`; controls sit `cm-s2` apart.
- Radii: `cm-r-sm` for icon buttons, `cm-r-md` for fields, rows and buttons, so a field and the button beside it share a corner, `cm-r-lg` for cards and menus, `cm-r-full` for avatars, `cm-r-tip` for the one sharp corner.
- Depth: `cm-pin-drop` and `cm-pin-lift` for parts on the host page (pins, the launcher, the toast), which never deepen with the theme; `cm-elev-2` for the preview, `cm-elev-3` for cards, menus and anything being dragged, `cm-elev-edge` for the panel's inner edge. Shadows are neutral, never tinted by a person's colour.
- Layers: `cm-z-dock` under `cm-z-card` under `cm-z-panel` under `cm-z-banner`.

## Words

Sentence case, plain verbs, no exclamation marks, no emoji. A control says what it does and the confirmation uses the same word:

- The button reads "Resolve"; the toast reads "Note 1 resolved" and offers "Undo". Resolved notes offer "Reopen".
- A thread is titled by the words it is pinned to, in quotes, or "Note #2" when it is pinned to a spot.
- The reply field's placeholder is "Reply…". The panel is titled with the mark and the product name, and its spoken name is "All notes". The launcher is labelled "Notes"; the panel's filled button is "Add note".
- Errors say what happened and what it costs, without apology: "Reply not saved." "Saved notes are unavailable. Notes made now will be lost on reload."

Address nobody; describe the thing. Counts are numerals: "2 replies", "1 reply".

## Icons

Eleven line glyphs on a 24 grid, drawn at 1.7 stroke with round caps and joins, no fills, coloured by the text around them (`currentColor`). They are inline SVG, never an icon font and never emoji. See the Icon card for the set. Size an icon with the font size of its button: it is 1.25em square.

## Building with it

Load the tokens, then `components/bundle.css`. The stylesheet is the tool's own, generated from its source, and was written to live inside a shadow root: its selectors are short (`.pin`, `.card`, `aside`), so on an open page wrap it in a shadow root or a frame. Every hover, press and focus style has a class twin (`.is-hover`, `.is-pressed`, `.is-focus`) so a state can be shown without a pointer.
