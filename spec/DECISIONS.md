# Decisions: Crittable.js

Open questions that the maintainer has settled, kept so the reasoning is not lost. An agent that wants to reopen one needs new evidence (a measurement, a user report), not a different taste. Entries marked "general go-ahead" were accepted as a batch, on recommendation; they are in force, and are the first to revisit if they prove wrong in use.

## Where does the look of a state live?
- **Asked**: 2026-11-17
- **Options**: (a) colour and motion columns in both `GLOSSARY.md` and `DESIGN.md`; (b) `GLOSSARY.md` holds names, meanings and transitions only; (c) as (b), with the `DESIGN.md` tables generated
- **Recommendation**: (b) now, (c) later, because two hand-kept descriptions of one state had already drifted
- **Decided**: 2026-11-17 → (b)
- **Why**: an agent reads whichever file it opens first, so a state's look must be written once.

## "Note" or "thread"?
- **Asked**: 2026-11-17
- **Options**: (a) "note" wherever people read, "thread" kept as the internal word; (b) rename states, specs and code to "note"
- **Recommendation**: (a), because renaming touches three files and every test for no gain to the reader
- **Decided**: 2026-11-17 → (a)
- **Why**: the reader's word is what matters; "thread" must never reach the interface.

## What opens when a note's pin is missing?
- **Asked**: 2026-11-17
- **Options**: (a) a drill-in inside the panel; (b) a loose card; (c) a centred dialog
- **Recommendation**: none settled before the answer
- **Decided**: 2026-11-17 → (c)
- **Why**: with no spot on the page there is nothing to open from, and a card at an arbitrary place implies a location it does not have. "Never open a dialog over the page" therefore applies only while a note has a pin.

## How does a note on another page open?
- **Asked**: 2026-11-17
- **Options**: (a) show it here without a pin; (b) go to its page, then open it from its pin
- **Decided**: 2026-11-17 → (b)
- **Carried out in**: already built
- **Why**: a note is read where it lives, which keeps one presentation of a note.

## Are a pin, its preview and its thread one object?
- **Asked**: 2026-11-17
- **Decided**: 2026-11-17 → one shell that grows, corner fixed, the pin riding as the face
- **Why**: the point marks a spot on someone else's page; if it travels, the note no longer says where it is.

## Do replies indent?
- **Asked**: 2026-11-17
- **Decided**: 2026-11-17 → no indent
- **Why**: an indent promises nesting that does not exist.

## Is the red side stripe the error channel?
- **Asked**: 2026-11-17
- **Options**: (a) cut it; (b) keep it and use it on every error
- **Recommendation**: (a), because the words already say it and a side stripe is banned on rows
- **Decided**: 2026-11-17 → (a)
- **Why**: an error is said in words, in `err`; a coloured edge adds nothing and reads as machine-made.

## Does the type scale get a size for initials?
- **Asked**: 2026-11-17
- **Options**: (a) one token, `fs-face`; (b) keep literals
- **Decided**: 2026-11-17 → (a)
- **Why**: initials in a 22px face cannot be 12px, and a named exception is better than scattered literals.

## Retire the first demo?
- **Asked**: 2026-11-17
- **Decided**: 2026-11-17 → deleted `demo/`
- **Why**: two implementations give an agent a second, wrong source to copy.

## Should off-scale type, radius and timing literals fail the smoke test?
- **Asked**: 2026-11-17
- **Decided**: 2026-11-17 → yes, with the existing ones baselined
- **Why**: every drift item of that kind had got in unnoticed.

## Should a row for an off-screen note be muted?
- **Asked**: 2026-11-17
- **Options**: (a) keep the mute; (b) full strength with only the "Off screen" line
- **Recommendation**: (b), because mute should mean something is wrong or elsewhere
- **Decided**: 2026-11-17 → (b)
- **Why**: scrolling is neither wrong nor elsewhere.

## Yellow words in dark
- **Asked**: 2026-11-17
- **Options**: (a) scope brand rule 1 to light surfaces; (b) make those words plain text in dark
- **Decided**: 2026-11-17 → (a)
- **Why**: the rule's reason is contrast on paper; yellow on dark reads well.

## The storage banner's colours
- **Asked**: 2026-11-17
- **Options**: (a) the fixed page colours; (b) themed, as an exception
- **Decided**: 2026-11-17 → (a)
- **Why**: it sits on the host page, and the viewer's theme says nothing about that page.

## Can a reply be edited or deleted by its author?
- **Asked**: 2026-11-17
- **Options**: (a) leave it; (b) the same in-place edit and delete as a note
- **Decided**: 2026-11-17 → (b)
- **Why**: the same kind of edit opens the same way everywhere. The entry point is two text links beside the reply's time, not a menu, because a menu inside the scrolling message list would be clipped; the maintainer kept the links on 2026-11-18.

## Do spare anchors ever guess?
- **Asked**: 2026-11-17, after the independent review
- **Options**: (a) keep positional spares; (b) never store or use a position among siblings
- **Recommendation**: (b)
- **Decided**: 2026-11-17 → (b)
- **Why**: once the target is gone a positional path matches its neighbour; a pin on the wrong thing is worse than a row that says why there is none.

## Escape and menus
- **Asked**: 2026-11-17, after the independent review
- **Recommendation**: Escape backs out one level, including not leaving placing mode when a note closes; menus close on a choice and stay open on a checkbox
- **Decided**: 2026-11-17 → as recommended
- **Why**: one key and one menu pattern should each behave one way.

## Is the row's resolve control a word or an icon?
- **Asked**: 2026-11-18
- **Options**: (a) keep the icon in rows and say so in the canonical entry and the Icon card; (b) a small "Resolve" / "Reopen" text button
- **Recommendation**: (a), because the row is for scanning and the word is one click away in the card
- **Decided**: 2026-11-18 → (a)
- **Why**: a labelled word is right where Resolve is the main secondary action (the card); in a dense list it would crowd the first line.

## How does the phone sheet arrive?
- **Asked**: 2026-11-18
- **Options**: (a) slide up from the bottom edge; (b) fade only; (c) keep the scale from 0.6
- **Recommendation**: (a)
- **Decided**: 2026-11-18 → (a)
- **Why**: a sheet comes from an edge, and brand rule 4 rules out the scale. How it feels on a real phone is still his to try.

## Retune the baselined contrast misses?
- **Asked**: 2026-11-18
- **Options**: (a) retune; (b) keep them as "never the only cue"
- **Recommendation**: (a) for `border-emph`, because it edges fields
- **Decided**: 2026-11-18 → (a), and `text-hint` with it
- **Why**: a checkbox whose edge is under 3:1 cannot be seen by everyone. The smallest change that clears the floor was used.

## Should the state sheet build its own markup?
- **Asked**: 2026-11-18
- **Options**: (a) call the product's own builders; (b) keep its copy and add a comparison check
- **Recommendation**: (a)
- **Decided**: 2026-11-18 → (a)
- **Why**: a specimen that cannot differ from the product needs no check.

## Is the missing-pin dialog modal in fact?
- **Asked**: 2026-11-18, by the second independent review: the dialog said `aria-modal` while the panel stayed bright and usable beside it
- **Options**: (a) make it truly modal: above the panel, everything else dimmed and inert; (b) drop the modal claim and the Tab trap
- **Recommendation**: (a), since the original call was to treat a truly missing pin like a modal
- **Decided**: 2026-11-18 → (a)
- **Why**: a dialog that claims to be modal and is not misleads a screen reader. This reverses the earlier detail that the panel stayed bright with its row selected; the row is still visible, dimmed, and focus returns to it on close.

## One call to action on the host page?
- **Asked**: 2026-11-18
- **Options**: (a) one launcher that opens the panel, with "Add note" in the panel head, and placing kept independent of the panel; (b) one launcher that starts placing, with the panel behind a count badge; (c) tie the two: opening the panel turns placing on
- **Recommendation**: (a), because notes are read far more often than written, so the single entry point should lead to reading; and (c) would make every page click drop a pin whenever the list is open
- **Decided**: 2026-11-18 → (a)
- **Why**: one button on someone else's page. The cost is that adding a note by mouse takes two clicks; the comment key is still one. While placing, the launcher is the way out, and Escape stops placing before it closes the panel.

## What is it called?
- **Asked**: 2026-11-18
- **Options**: about two hundred names were checked against npm, GitHub and four domains. The serious ones: Commenteer (says "comment" where the interface says "note"), Inkpin, Pincrit, Critready, Crit Anywhere, Crittable, Crittable.js
- **Recommendation**: Crittable.js: a namespace that is entirely free (`crittablejs` on npm, GitHub, .com, .dev, .app, .io)
- **Decided**: 2026-11-18 → as recommended
- **Why**: "make your prototype crittable" is the pitch in four words. The ".js" marks it as a library and gives it its own search query.
- **What was renamed**: the brand, the loader (`crittable.js`), the globals (`CRITTABLE_CONFIG`, `CRITTABLE_USER`), the store (`CrittableStore`) and the default storage prefix. The old names were kept working as aliases until 2026-11-25 and then removed, before the first public release: nobody outside the project had used them, and an alias nobody needs is one more thing to read, test and explain. Not renamed: `crittable/pinwall.js`, the `pin-note-board` tag, the `--cm-` token prefix and internal class names, because nobody embedding the tool types them. The design system keeps its own name, Ink and Highlighter.

## Where do notes live when people share a prototype?
- **Asked**: 2026-11-18
- **The workflow it must serve**: I share a prototype link with you, you open it and comment, I see that at once and can reply. No redeploying, no passing files.
- **Options**: (a) a file in the repo; (b) a relay the maintainer runs; (c) a hosted "cloud" the maintainer operates; (d) the adopter brings a backend their host or a service already provides, behind one small contract, with setup an agent can follow
- **Recommendation**: first (b), which was rejected: the author runs none of this, and it has to be portable.
- **Decided**: 2026-11-18 → (d)
- **Carried out in**: the contract, syncing and names; Supabase adapter, agent setup file and verify script. Since 2026-11-25 the Supabase adapter is a store of Persistable.js and not of this tool: see "Is Persistable.js a store, or the interface to stores?"
- **Why**: the tool should depend on no service of ours. Whoever builds the prototype already has an agent and a host; the agent wires that host's database to the contract. Reviewers do nothing but open the link and, once, type a name. Sign-in is acceptable where the store offers it. GitHub sign-in cannot be done from a static page alone (checked 2026-11-18), so it comes through a store that hosts it.

## Do we offer a store of our own?
- **Asked**: 2026-11-19
- **Options**: (a) adapters for other people's services only; (b) also a general JSON object store the host deploys to their own account, with Crittable.js as one user of it; (c) a service we run
- **Recommendation**: (b), as one Cloudflare Worker file, because it needs no keys in the page, pushes changes, sleeps when idle and leaves nobody a server to keep up
- **Decided**: 2026-11-19 → (b)
- **Carried out in**: the `persistablejs` repo; here, `crittable/backends/persistable.js` and `backends/persistable/`
- **Why**: inside a company a prototype often gets a JSON store for free; outside one nobody provides that, so the host deploys it once and every later prototype needs only a script tag. Its own repo: the maintainer made `PhilMcClelland/persistablejs` on 2026-11-19.

## What is the store called?
- **Asked**: 2026-11-19
- **Options**: Persistable, Deebeeable, Deebee, Debby, Dataplace, HoldThis
- **Recommendation**: Persistable.js, with HoldThis as runner-up
- **Decided**: 2026-11-19 → Persistable.js
- **Carried out in**: the `persistablejs` repo (global `Persistable`); here, `data-backend="persistable"`
- **Why**: it does for the store what "Crittable" does for notes, so the two read as a pair. Known and accepted: "persistable" is an ordinary programming word (Spring Data has an interface by that name) and the bare npm name is held by an unrelated 2021 package, so searches need the ".js"; `persistablejs` was free on npm and GitHub when checked.

## What licence, and do we charge?
- **Asked**: 2026-11-19
- **Options**: (a) PolyForm Small Business plus a paid commercial licence, which requires larger companies to buy; (b) AGPL plus a commercial licence; (c) MIT plus a request for money
- **Recommendation**: (a) if payment should be required, (c) if it should only be asked for
- **Decided**: 2026-11-20 → (c), for this repo and `persistablejs`
- **Narrowed**: 2026-11-20 → nothing is sold, because nothing should be owed. Any payment is a tip with nothing promised in return: no "licence", no tiers, no support, no logo placement, no wording that implies upkeep.
- **Carried out in**: `LICENSE` and the README's "License" section in both repos. Tips go through GitHub Sponsors (the maintainer enabled it 2026-11-20): `.github/FUNDING.yml`, one README line in both repos. (A once-only note for the human in `AGENTS.md` was removed on 2026-11-23: a file that tells someone else's agent to pass on a message about money reads as an instruction it should not follow.)
- **Why**: the aim is exposure, so the licence should remove every reason not to try the tool, and MIT is the one nobody needs to clear with a legal team. Asking, not requiring, costs no adoption. It is also why nothing here may need hosting by us.

## Who can reach shared notes, and how much are they trusted?
- **Asked**: 2026-11-20
- **Options**: (a) as it was: anyone who finds the store can read and add, and the store enforces authorship; (b) a key in the prototype's link makes a circle, and inside it the store still enforces authorship; (c) the same key, with full trust inside: anyone who has the link may change or delete anything
- **Recommendation**: (c)
- **Decided**: 2026-11-20 → (c), as an option on the store; (a) stays the behaviour without a key
- **Carried out in**: `persistablejs` (the key, trust inside, the change feed); here, `data-key="link"` on the script tag
- **Why**: without a company sign-in in front of the prototype, the link is the only thing that says who is in. The store models access, since it holds the notes and is the only place a rule can be enforced; Crittable.js only passes the key along. Inside the circle authorship becomes the interface's rule, which also lets the owner or an agent tidy up. Known and accepted: a link can be passed on, and nobody can be removed without starting a new one.

## Where does "copy the link" live?
- **Asked**: 2026-11-20
- **Options**: (a) first item in the panel's More menu, plus a line under the empty panel; (b) a button beside "Add note"; (c) the empty panel only
- **Recommendation**: (a)
- **Decided**: 2026-11-20 → (a)
- **Carried out in**: `crittable/pinwall.js` (`MENU.ShareLink`, `MENU.ShareCopied`, `EMPTY.NoThreadsShare`), shown only when the store answers `link()`
- **Why**: it is used once or twice per prototype, and rarely used things live in a menu; the empty panel is when sharing is the next thing to do. Differs from the sketch in one way: the empty panel keeps its "Add note" line and adds the link line under it, where the sketch showed the link line alone.

## Withdrawn
None yet.

## Does Escape shut the panel, and does the comment key toggle?
- **Asked**: 2026-11-23, once the panel opened by default on the landing page
- **Options**: (a) as it was: Escape shuts the panel only with focus inside it, and the comment key only starts placing; (b) the panel is the last level of Escape from anywhere; (c) the last level, but only when the key is ours to take
- **Recommendation**: (c), and the comment key again stops placing and shuts the panel
- **Decided**: 2026-11-23 → (c), and the comment key again stops placing and shuts the panel
- **Why**: a panel that starts open needs a way out from the keyboard. Escape still backs out one level, most specific first (menu, confirm, search, draft, preview, open note, placing), and the panel comes last. With focus on one of the host page's own controls the key is the page's (its dialog, its menu), so the panel stays. The comment key again stops placing and shuts the panel, unless focus is in a field, where it types a letter . All four keys are set in `keys` in the config.

## Where does the launcher sit?
- **Asked**: 2026-11-23
- **Decided**: 2026-11-23 → as described under Why
- **Why**: the launcher now keeps a distance from the nearest corner of the part of the view the panel leaves free, placed by one transform. It slides with the panel instead of jumping, a resize cannot walk it, and a drag starts from where it is drawn (the old shift was a second transform the drag did not know about, which put the button a panel's width from the pointer).

## How does a shared prototype learn someone's name?
- **Asked**: 2026-11-23, on seeing the name field in the new-note box on the landing page
- **Options**: (a) as it was: a name field in the note box the first time someone writes, and no note without it; (b) everyone starts under a made-up name, and the panel offers to use their own
- **Recommendation**: (b)
- **Decided**: 2026-11-23. This replaces the 2026-11-18 rule that a name is asked for at the first note.
- **Why**: the first note is the moment that matters, and a form in front of it is the wrong thing to meet. A made-up name (a word from the desk and a small animal, picked by the browser's id, our own lists) lets someone write at once and still be told apart. The foot of the panel reads "Critting as …" with a pencil; naming happens there, in place. The wording is "Critting as"; "Commenting as" would be the only place the interface says "comment", against the 2026-11-17 word rule. Known limit: notes already left keep the made-up name, because a store only lets an author change a note's words.

## What does the system say about motion, now that the mark moves?
- **Asked**: 2026-11-23
- **Options**: (a) keep rule 4 as written ("the only flourish is a draft pin dropping") and treat today's animations as exceptions; (b) rewrite it as two tiers, working motion and the mark's own, with the principles settled by trial that day
- **Recommendation**: (b)
- **Decided**: 2026-11-23 → as recommended
- **Why**: the rule had become false: the mark now blinks, winks, bobs and crosses its eyes. Working motion stays quiet and on the shared tokens; the mark alone may act, on tokens of its own (`mark-blink`, `mark-nod`, `mark-shut`, `mark-open`), so the landing page no longer copies values by hand; the pin drop stays the one signature (`plant`). The principles come from what was tried and dropped that day: swapping shapes flickered, following eyes and parallax were too busy, a turning sign "fell over", a jumping launcher lost the pointer, a snapping theme was too hard.

## Does picking something in a menu close it?
- **Asked**: 2026-11-23
- **Options**: (a) as decided 2026-11-17: a choice closes, a checkbox stays open; (b) decide it per item; (c) one rule by kind: a setting keeps the menu open, an action closes it
- **Recommendation**: (c)
- **Decided**: 2026-11-23 → as recommended
- **Why**: the theme row, added the same day, is a choice that has to stay open to be stepped through, which left sort choices closing and the theme not. A setting shows its effect while the menu is open and can be changed again at once; an action is finished when it is pressed. Two exceptions, both older: "Move list to other side" closes because the menu is attached to the panel that moved, and "Copy link to share" stays for two seconds to say it worked.

## Does the landing page share what visitors write?
- **Asked**: 2026-11-23, after an outside review found that anyone could deface or fill the landing page's shared store
- **Options**: (a) keep it on the shared store with limits and a sign-in check; (b) canned notes, and what a visitor adds is kept for their tab only
- **Recommendation**: (b)
- **Decided**: 2026-11-23 → as recommended
- **Why**: the page exists to let someone try the tool, not to host a public wall. With `storage: 'session'` nothing a visitor writes is sent anywhere or shown to anyone else, so there is nothing to abuse and nothing to moderate. Shared stores stay for prototypes sent to people the owner knows.

## What does the tool do with what a shared store hands back?
- **Asked**: 2026-11-23, by the same review: a note's stored page address went straight into navigation, and a malformed note could stop the list loading
- **Decided**: 2026-11-23 → as described under Why
- **Why**: without a key anyone can write to a store, so every note is checked before use: the right kinds of value, and a page address on this site (same scheme and host, so a prototype opened from a file still works). One that fails is left out and left alone. Another person's image address is not loaded unless the host page says so (`sharedAvatars`), because loading it tells that address who is looking. The Supabase functions refuse a note without a place, a place that is not a small object, over-long fields, times set ahead, and more than 5000 rows in a space.

## How is a public prototype open to its circle and closed to everyone else?
- **Asked**: 2026-11-23
- **Options**: (a) trying only: canned notes, a visitor's notes kept in their tab (the landing page); (b) read for everyone, write for the circle: a read key in the page, the key in the link; (c) real sign-in through Supabase
- **Recommendation**: (a) for the landing page, (b) for a public prototype reviewed in the open, the key in the link alone for anything sent privately; (c) only if someone must be removable
- **Decided**: 2026-11-23 → as recommended
- **Carried out in**: persistablejs: the read key; here: `backend.readOnly`, `data-read`, `SIDEBAR.ReadOnly`
- **Why**: on a public page anything in the page is public, so a circle needs something the page does not carry. The read key is a one-way hash of the key (a capability link, the pattern Tahoe-LAFS and CryptPad use), so the store keeps no list and a reader cannot become a writer. Accepted limits: reads stay open, a forwarded link is a leaked key, and nothing can be revoked without a new link. Two calls made with it: existing keyed spaces were broken rather than carrying two schemes (nothing was public), and a reader gets plain read-only, not a private scratch copy.


## Can a pin be moved without dragging, and can the letter keys be turned off?
- **Asked**: 2026-11-24, by an accessibility review before the first public version: moving a pin was drag-only (WCAG 2.1.1, 2.5.7), and the single-letter shortcuts could be changed only by the page's author, not by the reader (WCAG 2.1.4)
- **Options**: (a) leave both and make no accessibility claim; (b) "Move pin" in the note's menu, and "Keyboard shortcuts" as a checkbox in the More menu
- **Recommendation**: (b)
- **Decided**: 2026-11-24 → (b)
- **Carried out in**: `PLACING.Moving`, `MENU.Shortcuts`
- **Why**: "Move pin" reuses placing (click a spot, or Enter on a focused element), so there is one way to choose a place and no second surface. The letter keys also stay out of the page's own widgets (custom elements, and roles that type or steer with keys), because a key the tool takes there is a key the page never receives.

## Are the muted rows and the soft field edges in dark retuned to the contrast minimums?
- **Asked**: 2026-11-24, by the same review: read and resolved rows at reduced opacity, and field edges in dark, measure under 4.5:1 and 3:1
- **Options**: (a) retune; (b) keep
- **Decided**: 2026-11-24 → (b)
- **Why**: these are the quiet states on purpose: what is muted is what has been dealt with, and the edge of a field is decoration around a control that is found by its label and placeholder. The parts a reader must find and operate (text at rest, controls, pins) meet the minimums.

## What does a place that counts among siblings keep?
- **Asked**: 2026-11-24, by a review: "never store or use a position among siblings" held for spares, but the first description of an element with no id, class or label could still be a counted path, and once that element was gone the pin sat on its neighbour
- **Decided**: 2026-11-24 → such a place also keeps the first words of the element it was put on (`was`), and is believed only while they match
- **Why**: some elements can be described no other way, so refusing them would refuse the note. Checking the words keeps the rule's point: a row that says the pin cannot be located beats a pin on the wrong thing. A note saved before this has no `was` and behaves as it did.

## Does the add key open the panel, and how does a host page make room for it?
- **Asked**: 2026-11-24, from a host page that embeds the tool: the key armed the pin cursor with the panel shut, so a new note landed in a list nobody could see; and a fixed left column sized in `vw` ran into the page when the panel opened, because padding on `<html>` moves only what is in the flow
- **Decided**: 2026-11-24 → the add key opens the panel and then starts placing, except on a phone; the tool sets `--crittable-inset-left` and `--crittable-inset-right` on `<html>` and fires one `resize` when they change; the padding stays
- **Why**: the key should do what "Add note" does, and the same key already shuts the panel on the way out. A host page needs something it is meant to read: watching our padding works until we change how we make room. Cost, accepted: the page reflows as the key is pressed, under a pointer that may already be on its target.

## What is the empty panel's mark?
- **Asked**: 2026-11-24: it was a square speech bubble, a shape used nowhere else in the tool
- **Decided**: 2026-11-24 → the pin itself, drawn in line: round with its one sharp corner, and the two eyes
- **Why**: one shape means "a note" everywhere.

## Can a reader name themselves on a board that is not shared?
- **Asked**: 2026-11-24, from a host page that embeds the tool with notes kept in the tab: every note said "Guest", and passing `CRITTABLE_USER` fixes the name where the reader cannot change it
- **Options**: (a) an option, off by default, that gives such a board the naming a shared one has; (b) naming everywhere, with no option
- **Recommendation**: (a) was built first; (b) is simpler
- **Decided**: 2026-11-24 → (b)
- **Why**: one way of being someone, whatever the store. Where notes stay in one browser the name matters less, and costs nothing; an option would be one more thing to explain for a difference nobody needs. `CRITTABLE_USER`, when given, still wins and there is no footer. Notes written before the browser had an id stay its own to edit and keep the name they were written under.

## Is Persistable.js a store, or the interface to stores?
- **Asked**: 2026-11-25
- **Options**: (a) as built: Persistable.js is one store (a Cloudflare Worker), and this tool has an adapter for it and another for Supabase; (b) Persistable.js is the interface, with stores behind it, and this tool talks only to Persistable.js; (c) ship without Supabase and bring it back later as a store
- **Recommendation**: (a) for the first release, (b) after
- **Decided**: 2026-11-25 → (b), before the first release, with two stores ready
- **Why**: a project that integrates with Persistable.js should get every backend it supports, and bring its own, without each project writing adapters. Done after release, the Supabase adapter would have had to move, breaking whoever used it.
- **Carried out in**: `persistablejs` (`stores/supabase.js`, `stores/supabase.sql`, `docs/stores.md`, one verify script for both stores); here, `crittable/backends/supabase.js` and `backends/supabase/` are gone, `data-store="supabase"` on the `persistable` adapter replaces them, and `crittable/vendor/persistable-supabase.js` is the copy of the store. This tool's own adapter contract stays, for a store that is not Persistable.js.
- **What it cost**: on Supabase the database no longer knows what a note is, so it no longer refuses a note with no place or an over-long name; the adapter already reads every row as a stranger's words, as it does with the Worker. Notes kept by the old adapter (table `crittable_notes`) are not carried over.

## How big is a field on a phone?
- **Asked**: 2026-11-25
- **Options**: (a) as on a desktop: 14px text in a 34px field; (b) on a touch device, 16px text in a field as tall as the button beside it (40px)
- **Recommendation**: (b)
- **Decided**: 2026-11-25 → (b), from the maintainer's note that the phone's note field needed its size tuned
- **Why**: a phone zooms the whole page in when a field with text under 16px is touched, and does not zoom back out, which moves the page the note is about. The field was also shorter than the send button next to it.
- **Carried out in**: the `fs-type` token and the `(pointer:coarse)` rule in `crittable/pinwall.js`; it covers the note field, the reply field, the name field and the search field. Desktop is unchanged.
