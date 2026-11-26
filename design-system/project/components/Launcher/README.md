The tool's one button on the host page. It opens the notes; while a note is being placed, it is the way out.

**Use it** as the only permanent part of the tool on the page. **You provide** an accessible label and where it docks.

- Markup: `.dock` holding one `button` with the mark's eyes (`.eyes`, two `i` boxes sized in parts of the mark). No glyph, ever. It carries the sharp lower-left corner.
- At rest it is the mark itself: a `cm-accent` pin with a `cm-pin-ink` edge and two ink eyes: upright pills, set a little right of centre. Do not put a glyph in it; the critter is the logo. On hover the eyes blink once: the pills flatten straight down, rest shut for a beat and open again. No shape is swapped for another, nothing turns, and the eyes do not follow the pointer. The pin itself never scales or turns.
- At rest a click opens or closes the panel. Adding a note starts from "Add note" in the panel, or the comment key. The two are not tied: the panel can be open or shut while placing.
- While placing, add `.on`: it turns to `cm-pin-ink` and the eyes, now `cm-pin-paper`, slide together, stretch and cross into the way out (`cm-medium`). It is the same two eyes in a different look; never swap them for an icon. A click stops placing. The yellow has moved to the pointer.
- Colours are fixed (`cm-accent`, `cm-pin-ink`, `cm-pin-paper`, `cm-pin-ring`); it does not follow the theme.
- Hover lifts it 2px onto `cm-pin-lift`. Do not scale it.
- One button only. A second call to action on someone else's page is one too many; anything else belongs in the panel.
