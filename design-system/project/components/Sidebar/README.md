The panel that lists every note: one head block (title, filter, more and close on a line; search and "Add note" under it) and the scrolling list.

**Use it** as the one place to find a note that is not in view. **You provide** the notes, grouped as "This page" and "Other pages", plus search and sort state.

- Markup: `aside` with a `header` (title, the two menu buttons, close), `.tools` holding the search field, and `.scroll` holding the rows. The head is one block: no tinted band, one rule under it.
- The title is the lockup: the mark (`.brand`, 22px, a `cm-accent` pin with a `cm-pin-ink` edge and its two eyes), a 6px gap, then the name in `cm-text` at strong weight with ".js" in `cm-text-meta` at regular weight. The gap is tighter than between controls and the name is set a hair tight, so mark and word read as one unit; this is the only place letter-spacing is used. "All notes" stays as the panel's spoken name.
- It grounds on `cm-base` with `cm-elev-edge` on its inner side, and pushes the page aside instead of covering it.
- Under 520px wide it covers the page; there is no room to push the page aside.
- Omit a section that has no notes; do not show an empty heading.
- A filter that is not the default marks its button with `.filtered`.
