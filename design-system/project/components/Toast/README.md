A one-line confirmation with a single way back, shown for five seconds after a note is resolved.

**Use it** only for an action that can be undone. **You provide** the sentence and the undo action.

- Markup: `.toast` with the message and one `button`.
- The message repeats the control's word: "Resolve" produces "Note 1 resolved".
- Fixed colours: `cm-pin-ink` ground, `cm-pin-paper` text, a `cm-pin-ring` and the `cm-pin-lift` shadow. It sits on the host page, so it does not theme.
- One at a time. A new one replaces the old. Never stack them, and never use one for an error.
