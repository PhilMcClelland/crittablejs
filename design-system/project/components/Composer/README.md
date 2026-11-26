The field and Send button for a new note or a reply.

**Use it** wherever someone writes. **You provide** the current person's face, a placeholder, a length limit and the send handler.

- Markup: a `.face`, a `textarea`, and `button.send`. A new note uses `.card.composer`; a reply uses `.compose` inside a thread.
- Send is disabled (`cm-send-off`) until there is non-blank text, then fills with `cm-accent` over a `cm-accent-edge`.
- Focus shows a `cm-focus` border and a `cm-halo`. Enter sends; Escape backs out.
- Near the limit a counter appears; at the limit add `.toolong`.
- If saving fails, keep the text in the field and show one `.err` line under it.
- On a shared store, someone with no name yet gets one `.namefield` above the note field, asked once; Send stays disabled until it is filled.
- The field is one line tall until it needs more, then grows with the words up to about five lines (`max-height`) and scrolls past that. The card grows with it, away from the pin: the corner on the anchor does not move.
