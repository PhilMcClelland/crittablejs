A note's marker on the page: the author's face in a highlighter frame, with its sharp corner on the exact spot.

**Use it** once per note on the current page. **You provide** the anchor position, the author (initials and one of the `cm-av-*` grounds, or a photo), and an accessible label with the author and reply count.

- Markup: `button.pin` holding a `.face`. Position it by its centre; the stylesheet offsets the box so the sharp corner lands on the anchor.
- States by class or attribute: `.draft` (dashed, not saved), `[data-unread]` (dot), `[aria-expanded=true]` (thread open), `.hot` (its row is hovered), `.lifted` (dragging), `.done` (resolved, greyed with a check).
- Colours are fixed in both themes. Never tint a pin with the author's colour; the face already says who.
- Move a pin with `translate` only. `scale` and `rotate` would distort its position.
- When a note quotes selected words, keep those words washed on the page and lay a `cm-pin-wash` box over a hovered target: a fill with soft corners and no outline, drawn in the tool's own layer. Thin it as the target grows, and leave it off one that fills three tenths of the view or more.
