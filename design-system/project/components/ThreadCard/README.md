The open note: its title, the note, the replies, and a reply field. It is the pin's bubble grown to full size, with its sharp corner still on the anchor and the pin as the first avatar.

**Use it** for reading and answering one note. **You provide** the title (the quoted words, or "Note #n"), the messages, and handlers for resolve, the More menu, close and reply.

- Markup: `.card.thread` with a `header` (title, `button.tb.resolve`, More, Close), the message list, and `.compose`.
- Set `data-tip` to the corner facing the pin, so the card's sharp corner points at it.
- Resolve is a labelled button with a check, not a bare icon: "Resolve", or "Reopen" once resolved.
- When the title is quoted text, add `.q` to the `h2`; it sits on the `cm-selected` wash.
- Under 520px wide the card docks to the bottom edge as a sheet.
- You can edit or delete your own reply the same way as a note: "Edit" and "Delete" appear beside its time on hover or focus, the field or the confirmation takes the reply's place, and the reply row waits meanwhile.
- Replies are flat: every message and the reply row share one face column and one text column.
- A note with no pin to open from (its target is missing or hidden) opens centred over a dimmed page, with no sharp corner and one line saying why: add `.adrift` and a `.adrift-why`. It is modal: dim everything else, the panel included, make it inert, and keep Tab inside.
- Delete asks for confirmation inside the card. Never open a dialog over the page while the note has a pin to open from.
- "Move pin" in the note's More menu is the way to move a pin without dragging: the card closes, the cursor becomes the pin, and the next spot chosen is the note's place. For a reader who may only read, it is off and says so.
