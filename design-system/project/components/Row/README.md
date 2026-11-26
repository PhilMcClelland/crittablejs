One note in the panel: face, author, time, the first lines, the reply count, and a resolve toggle.

**Use it** inside the panel's list only. **You provide** the note, whether it is unread, resolved or selected, and, when it has no visible pin, the reason.

- Markup: `li.pick` inside `.scroll`. States: `.sel` for the open note, `.unread` with a `.dot`, `.off`, `.other` or `.lost` when there is no pin to show.
- Selected is the `cm-selected` wash alone. Do not add a side strip.
- At rest a row shows only the note: its number sits at the end of the first line. The unread and resolve toggles take the number's place on hover, focus or when the row is selected, so the text keeps the full width. A resolved row keeps its filled check.
- The unread dot follows the time. A note pinned to selected words shows them on a wash above the text, as the card's title does.
- Hovering a row marks its pin on the page (`.hot` on both), so add that link wherever both are visible.
- Show the page name only when the note is on another page.
- A muted row always says why in words. Mute means the note is elsewhere or its target is missing; a note that is only off screen is not muted, it just says "Off screen".
