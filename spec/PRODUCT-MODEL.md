# Product model: Crittable.js

The objects people work with, and what the interface has to make understandable about them. Tokens live in the `TOKENS` and `SCALE` objects in `crittable/pinwall.js` (published as `design-system/project/tokens.json`); state names live in `GLOSSARY.md`; state styles live in `DESIGN.md`. This file is about meaning, not looks, and repeats none of those.

Status: drafted 2026-11-17 from the specs, the code on `main` at f4314a8 and the merged PRs. A reason marked *(inferred)* could not be traced to a spec, PR or commit.

Context that shapes every object: the tool is a guest on someone else's page. The reader came for the page, not for us. Two kinds of visit matter: leaving a note (seconds, often a first-time user) and working through a backlog of notes (many in a row, keyboard-heavy). There are no roles: anyone on the page can read, reply and resolve; only the author can edit or delete.

## Note
- **What it is**: something a person wrote about one spot on a page. The interface always says "note". "Thread" is the internal word, in specs, state names and code, for a note plus its replies; it never reaches a reader (the maintainer, 2026-11-17).
- **Anatomy**: the text (**identifies it**, together with the author's face), author, time written, the spot it is pinned to, its number in creation order ("Note #2"), replies, resolved flag. When it is pinned to selected words, those words are its title and replace the number.
- **States**: draft (not saved, never listed) → open → resolved → open again (Reopen). Deleted by its author only. Unread is not a state of the note; it belongs to the reader (see Read mark).
- **Relationships**: belongs to one page; has one anchor and at most one pin; has an ordered, flat list of replies; has one author.
- **Rules**:
  - Resolving is undoable for five seconds and reversible for ever (Reopen), because it hides the note by default and a mis-click would lose it from view (893237c).
  - Resolved notes are hidden from the page and the list unless "Show resolved" is on. A way back is always offered where they would otherwise leave an empty list.
  - A note with no text does not exist: it is never saved, loaded or listed.
  - Author-only edit and delete. Others see the items disabled with the reason, not hidden, so the menu has the same shape for everyone *(reason inferred)*.
  - Text is always inserted as plain text.
- **Representations**:
  - *List row*: `ROW.*`. Face, author, time, first lines, reply count, resolve toggle, unread dot. Primary action: open it where it lives.
  - *Summary*: `PIN.Preview`, on hover or focus of its pin. Read-only; clicking opens the detail.
  - *Detail*: `CARD.*`, the thread card beside its pin. This is the one canonical presentation. Reply, resolve, edit and delete all happen here, in place. On a narrow viewport the same card docks as a sheet (`CARD.Sheet`).
- **Context signals**: read far more often than written. Whoever resolves is often not the author.
- **Canonical examples**: Resolve with a matching Undo; A note is titled by what it is pinned to; Delete is confirmed inside the card (all in `CANONICAL.md`).

## Reply
- **What it is**: a later message under a note.
- **Anatomy**: text (**identifies it**), author, time.
- **States**: sending (shown at once) → saved, or removed again if saving fails. Edited or deleted by its author only.
- **Relationships**: belongs to exactly one note. Replies do not nest and cannot be resolved on their own.
- **Rules**:
  - Flat and chronological, oldest first, because a note is about one spot and a second level would be a second conversation *(inferred)*.
  - A reply that fails to save must not look saved: it is taken back out and the text stays in the field (`COMPOSER.SaveFailed`).
  - Replying marks the note read.
- **Representations**:
  - *List row*: none. A reply shows in the panel only as the note's reply count.
  - *Summary*: the reply count on the preview and the pin's accessible label.
  - *Detail*: a message in the thread card, under the note. Its author edits or deletes it in place, exactly as for a note. The two links show only on your own replies; unlike the note's menu there is no shape to keep the same for everyone.
- **Context signals**: written from the reply field at the foot of the card; Enter sends.
- **Canonical examples**: A failed save keeps the words.

## Pin
- **What it is**: the note's marker on the page. Its sharp corner sits on the exact spot.
- **Anatomy**: the author's face (**identifies it**), the highlighter frame, the sharp corner, an unread dot, a resolved check.
- **States**: `PIN.*` in `GLOSSARY.md`. In short: draft, rest, unread, open, pointed (its row is hovered), lifted (being dragged), muted (resolved), and three ways of not being drawn (off screen, target missing or hidden, concealed by a setting).
- **Relationships**: one per note, and only on the note's own page. Its position comes from the anchor; it never has a position of its own.
- **Rules**:
  - The pin is the note's face on the page, so it says who, never what kind: no colour coding by author or status beyond muted and the unread dot (Pin card: "Never tint a pin with the author's colour; the face already says who").
  - Pins, like everything that sits on the host page, keep fixed colours in both themes, because the viewer's theme says nothing about how bright the page underneath is (brand rule 3, 893237c).
  - Move a pin with translate only; scaling or rotating would move the point it marks (Pin card).
  - Dragging a pin re-anchors the note; a drop on nothing valid glides it back.
  - A pin that cannot be placed is not drawn. The row carries the reason instead.
- **Representations**:
  - *List row*: none of its own; hovering a note's row marks its pin, and the reverse (`PIN.Pointed`, `ROW.Pointed`).
  - *Summary*: the pin is itself the smallest summary of a note: who wrote it, read or not, resolved or not.
  - *Detail*: none. Opening a pin opens the note.
- **Context signals**: reachable by Tab, opened by Enter or Space; `J` / `K` step through open notes on the page.
- **Canonical examples**: One sharp corner, pointing at the anchor; What sits on the page does not theme; Row and pin point at each other.

## Anchor
- **What it is**: how a note finds its spot again: the element (or the selected words) it was pinned to, and where inside it. A pin on selected words keeps its distance from the start of those words (`sel.ox`, `sel.oy`), so it sits where it was dropped and moves with them.
- **Anatomy**: never shown as data. People see its effects: where the pin sits, the wash on the target, the wash on quoted words, and one of four reasons when it fails.
- **States**: found and visible; found but off screen; found but hidden; looking (a few retries); not found; on another page.
- **Relationships**: owned by one note. Replaced, not edited, when the pin is dragged.
- **Rules**:
  - Whenever a note has no pin, say why in words, because a missing pin otherwise reads as a missing note (Row card).
  - Never leave residue on the host page: the wash on a target is the tool's own box and the wash on quoted words is a CSS highlight, so nothing is written to the host page.
  - The wash thins as its target grows, and a target that fills three tenths of the view or more gets none: a large patch of colour coming and going under a moving pointer flickers. The pin still sits exactly where it was dropped; such a note is pinned to a spot, and tinting most of the page would say nothing about where.
  - Anchor quality never blocks placing a note.
  - A note remembers up to three other ways to find its target, and tries them in order when the first stops matching, because a renamed id should not cost the reader the pin. The first description always wins while it matches. A spare is never a position among siblings, because once the target is gone that matches its neighbour, and a pin on the wrong thing is worse than a row that says why there is none.
- **Representations**:
  - *List row*: the reason line on a muted row (`ROW.Offscreen`, `ROW.Lost`, `ROW.OtherPage`).
  - *Summary*: the wash on the target while placing, dragging, previewing or reading (`PLACING.TargetHint`); the wash on quoted words (`PIN.Quoted`).
  - *Detail*: none. There is no anchor inspector, on purpose *(inferred)*.
- **Context signals**: invisible when it works. It is only ever noticed when it fails.
- **Canonical examples**: A muted row says why.

## Page
- **What it is**: the place a note lives: one route of the host site.
- **Anatomy**: the route (**identifies it**). Shown only for notes that live somewhere else.
- **States**: this page, or another page.
- **Relationships**: has many notes.
- **Rules**:
  - Show the page name only when it is not this page, because on this page it is noise (Row card).
  - A note on another page is opened by going there, then opening it from its pin, so a note is always read where it lives.
- **Representations**:
  - *List row*: the two sections, "This page" and "Other pages", each with a count; a section with nothing in it is left out.
  - *Summary*: the route in a row's meta line.
  - *Detail*: the host page itself. We do not draw pages.
- **Context signals**: the host decides what a page is; single-page apps change it without a load.
- **Canonical examples**: none yet.

## Person
- **What it is**: whoever wrote a note or reply, and the person reading now.
- **Anatomy**: face (photo, or initials on one of six grounds; **identifies them**), display name.
- **States**: known (the host page supplied a profile, or the store signed them in), named (they gave a name at the foot of the panel), or under a made-up name (until they do).
- **Relationships**: writes notes and replies; owns a set of read marks and a set of preferences.
- **Rules**:
  - The same name always gets the same colour, chosen by a hash of the name shown (the maintainer, 2026-11-23; this departs from the first design, which hashed the id).
  - The tool never looks a person up anywhere unless the host turns that on, and then only by hash (c147fe7).
  - Only the author edits or deletes.
  - "Guest" is not an identity: each browser gets its own id and a made-up name (a word from the desk and a small animal, such as "Bookish Tapir"), so a person can write at once, whatever the store. The foot of the panel says who they are and lets them put in their own name, or change it again, at any time; notes already left keep the name they were written under. Nothing is asked for in the note box itself: a name field there stood between a person and their first note.
- **Representations**:
  - *List row*: a face and a name inside a note's row. People are not listed on their own.
  - *Summary*: the face in a pin.
  - *Detail*: none. There is no profile.
- **Context signals**: identity comes from the host page; we have no sign-in.
- **Canonical examples**: none yet.

## Read mark
- **What it is**: whether this reader, on this device, has seen a note.
- **Anatomy**: a dot on the pin and on the row, plus hidden "Unread" text.
- **States**: unread → read (on opening or replying) → unread again (Mark as unread).
- **Relationships**: per person and per note. Not part of the note; nobody else sees it.
- **Rules**:
  - Reading means opening. The pin's dot clears when the card opens, not when the preview shows, because a glance at two lines is not reading the thread (`GLOSSARY.md` section 3).
  - The dot is never the only cue: it is paired with text for screen readers.
- **Representations**:
  - *List row*: the dot at the far end of the row; "Unread first" in the sort menu; "Mark all as read".
  - *Summary*: the dot on the pin.
  - *Detail*: "Mark as unread" in the card's More menu.
- **Context signals**: matters most on a return visit with a backlog.
- **Canonical examples**: none yet.

## Preferences
- **What it is**: how this reader has set the tool up: which side the panel docks, sort order, whether resolved notes, pins and the launcher show, theme.
- **Anatomy**: a handful of switches and one-of-several choices.
- **States**: each is default or changed. A changed filter marks its button (`SIDEBAR.Filtered`).
- **Relationships**: per person and per device.
- **Rules**:
  - A setting takes effect at once and is remembered; there is no Save.
  - No setting may strand the reader: hiding the launcher leaves the shortcut and the panel menu as ways back.
  - Settings live in a menu, never on a page of their own, because there are few of them and they are rarely changed *(inferred)*.
- **Representations**:
  - *List row*: an item in the Filter or More menu (`MENU.*`).
  - *Summary*: the dot on the filter button.
  - *Detail*: none.
- **Context signals**: set once, then forgotten.
- **Canonical examples**: none yet.
