# Canonical solutions: Crittable.js

Trusted, shipped solutions. Follow them closely when the problem matches; if you diverge, say why.
Approved entries are `##` sections. Agent proposals are `###` sections under `## Candidates` until the maintainer explicitly approves them. A merged PR is evidence, not approval.

Every source is a state on the state sheet (`sample/states.html`, drawn by `sample/states.js`) plus the code that produces it in `crittable/pinwall.js`. State names are from `GLOSSARY.md`.

## One sharp corner, pointing at the anchor
- **Problem**: a floating part on someone else's page has to say what it belongs to without an arrow, a line or a label.
- **When**: anything that hangs off a spot: a pin on its anchor, a card on its pin, the launcher in its corner.
- **Not when**: parts that belong to the panel (rows, menus, fields), and anything with nothing to point at. Those keep four round corners.
- **Source**: `crittable/pinwall.js` (.pin, .card[data-tip], --cm-r-tip); states `PIN.Rest`, `CARD.Reading`, `PIN.Preview`
- **Why it works**: the shape itself carries the relationship, so no extra element is needed, and it is specific to this product: a generic rounded card could belong to anything.
- **Evidence**: 893237c; brand rule 2 in `design-system/project/README.md`
- **Approved**: 2026-11-18

## What sits on the page does not theme
- **Problem**: the tool's theme follows the viewer, but the page underneath does not, so a themed pin can vanish into the page.
- **When**: anything drawn over host content: pins, the launcher, the undo toast, the wash on a target.
- **Not when**: cards, menus and the panel. They bring their own ground, so they follow the theme.
- **Source**: `crittable/pinwall.js` (pin-ink, pin-paper, pin-ring, pin-drop, pin-wash in SCALE); states `PIN.Rest`, `LAUNCHER.Rest`, `CARD.UndoOffered`
- **Why it works**: it separates "what the viewer prefers" from "what the page looks like", which are different facts. The light ring keeps an ink pin visible on a dark page.
- **Evidence**: 893237c; brand rule 3
- **Approved**: 2026-11-18

## Resolve with a matching Undo
- **Problem**: resolving hides a note by default, so a slip looks like data loss.
- **When**: an action that removes something from view and can be reversed.
- **Not when**: a destructive action (use the inline confirmation), or an error (use the quiet line). Never for plain success. The compact resolve toggle in a panel row is the same tick without the word, with a label and a tooltip: a row is for scanning, and the word is one click away in the card. It must be the same glyph, so the two read as one control.
- **Source**: `crittable/pinwall.js` (toggleDone, offerUndo, .tb.resolve, .toast); states `CARD.ReadingResolved`, `CARD.UndoOffered`
- **Why it works**: the button is a word, not a bare check, so it reads the same to everyone; the toast repeats that word ("Resolve" then "Note 1 resolved", "Undo"), and the resolved note offers "Reopen". One vocabulary across control, confirmation and reversal.
- **Evidence**: 893237c; Words section of the brand book; Toast and ThreadCard cards
- **Approved**: 2026-11-18

## A muted row says why
- **Problem**: a note with no pin in view looks broken unless the reader is told what happened to it.
- **When**: any note that cannot show a pin: off screen, target hidden, target missing, on another page.
- **Not when**: the note is simply resolved (it has its own state) or filtered out (it is not listed).
- **Source**: `crittable/pinwall.js` (REASONS, rowOf); states `ROW.Lost`, `ROW.Offscreen`, `ROW.OtherPage`
- **Why it works**: the mute alone is a colour cue; the reason line turns it into information and tells the reader what a click will do.
- **Evidence**: Row card ("A muted row always says why in words")
- **Approved**: 2026-11-18

## Row and pin point at each other
- **Problem**: the list and the page show the same notes in two places, and the reader has to match them up.
- **When**: wherever one object is visible in two regions at once.
- **Not when**: the other end is not on screen; then the row's reason line does the job.
- **Source**: `crittable/pinwall.js` (point, .pin.hot, li.hot); states `PIN.Pointed`, `ROW.Pointed`
- **Why it works**: it answers "which one is this?" before a click, and costs no extra element: both ends reuse their hover look.
- **Evidence**: 893237c
- **Approved**: 2026-11-18

## Delete is confirmed inside the card
- **Problem**: a destructive action needs a second step, but a dialog over someone else's page is heavy and takes the reader away from the note in question.
- **When**: confirming a destructive action on the thing already open.
- **Not when**: the action can be undone afterwards (use the Undo toast).
- **Source**: `crittable/pinwall.js` (.confirm, askDelete in drawThread); state `CARD.ConfirmDelete`
- **Why it works**: the question replaces the message it is about, so there is no doubt what will be deleted, and nothing new covers the page. The two buttons say what happens ("Keep", "Delete").
- **Evidence**: ThreadCard card
- **Approved**: 2026-11-18

## A failed save keeps the words
- **Problem**: when a write fails, the worst outcome is a note that looked saved, or text the person has to type again.
- **When**: any write: a new note, a reply, an edit, and storage being unavailable at start.
- **Not when**: never suppress it. For storage being down altogether, use the one quiet banner, not a line per field.
- **Source**: `crittable/pinwall.js` (.composer.failed, .err, .card-err and fail for an open card, .note-banner only for storage or when no card or panel is open to say it, postReply rollback); states `COMPOSER.SaveFailed`, `EMPTY.StorageFailed`
- **Why it works**: it says what happened and what it costs ("Reply not saved."), leaves the text in the field for another go, and never blocks the host page.
- **Evidence**: Notice card
- **Approved**: 2026-11-18

## An empty list offers the way out
- **Problem**: a list emptied by a filter or a search looks the same as having no notes.
- **When**: an empty result that the reader's own setting caused.
- **Not when**: there are truly no notes: then say how to add the first one, with no button.
- **Source**: `crittable/pinwall.js` (.empty[data-state], the way map in the list draw); states `EMPTY.NoMatch`, `EMPTY.AllHidden`, `EMPTY.NoThreads`
- **Why it works**: each empty state names its cause and offers the one action that undoes it ("Clear search", "Show resolved").
- **Evidence**: `spec/DESIGN.md` section 3, Empty and error states
- **Approved**: 2026-11-18

## Escape backs out one level
- **Problem**: several things can be open at once (a menu, a draft, a card, placing mode) and one key has to close the right one.
- **When**: any new layer that can be open over another.
- **Not when**: inside a text field with its own Escape meaning; the field gets it first.
- **Source**: `crittable/pinwall.js` (the Escape handler; shutThread); `tests/runtime_test.js` (Esc ladder)
- **Why it works**: most specific first, so the key never throws away more than the reader meant, and focus goes back to whatever opened the layer. The levels are: an open menu, a delete being confirmed, a search with text in it, the panel when focus is in it and no note is being placed, a draft, a preview, an open note, placing mode. Closing a note leaves placing mode on; that is one more press.
- **Evidence**: the shipped behaviour
- **Approved**: 2026-11-18

## A note is titled by what it is pinned to
- **Problem**: a thread needs a heading, and "Note #7" says nothing about what the note is on.
- **When**: the note is anchored to selected words.
- **Not when**: it is pinned to a spot; then "Note #n" is the honest title.
- **Source**: `crittable/pinwall.js` (h2.q, paintQuotes); states `PIN.Quoted`, `CARD.Reading`
- **Why it works**: the quoted words are the subject of the conversation, and the same wash marks them on the page and in the card, so the two read as one thing.
- **Evidence**: 893237c; ThreadCard card
- **Approved**: 2026-11-18

## A note on another page is opened there
- **Problem**: the list holds notes from every page, but a note only makes sense beside the thing it is about.
- **When**: opening a note whose page is not the current one.
- **Not when**: its target is on this page but missing. That case opens as a dialog; the work is in flight.
- **Source**: `crittable/pinwall.js` (jumpTo, handoff)
- **Why it works**: it keeps one presentation of a note (the card beside its pin) by moving the reader, not by inventing a second, pinless view.
- **Evidence**: the browser test "panel: row focus, menus"
- **Approved**: 2026-11-18

## Pin, preview and thread are one object
- **Problem**: a pin, its hover preview and its thread were three parts that swapped in and out, so opening a note felt like something new arriving rather than the same note unfolding.
- **When**: a summary and a detail of the same object that open from the same spot.
- **Not when**: the detail has no spot to grow from (see the next entry), or on a phone, where the card is a bottom sheet.
- **Source**: `crittable/pinwall.js` (.bubble, bubShow, bubFit, raisePeek, .pin.rider); states `PIN.Preview`, `CARD.Reading`
- **Why it works**: one shell really resizes from pin to preview to thread with its sharp corner held on the anchor, so the point never moves. The preview is the thread's first message over a mock reply row, so a click only adds the header and the replies, and the face stays where it was.
- **Evidence**: the maintainer's steer on 2026-11-17: the pin and its card are one continuous object, and the point of the pin does not move; motion accepted the same day
- **Approved**: 2026-11-18

## A note with no pin opens as a dialog that says why
- **Problem**: a note whose target is gone has no spot to open from, and a card floating at an arbitrary place implies a location it does not have.
- **When**: the note is on this page and its pin cannot be drawn (target missing or hidden).
- **Not when**: the note has a pin (open from the pin), is off screen (scroll to it) or is on another page (go there).
- **Source**: `crittable/pinwall.js` (.thread.adrift, .adrift-why, REASONS); state `CARD.Adrift`
- **Why it works**: centred with no sharp corner, it claims no position; the reason line is the same sentence the row shows, so list and dialog agree. It is the one allowed dialog over the page, because there is no place on the page to keep the reader at.
- **Evidence**: the maintainer, 2026-11-17: a pin that is truly missing is treated like a modal
- **Approved**: 2026-11-18

## Candidates

None waiting.
