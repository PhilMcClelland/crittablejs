# Sharing notes through Persistable.js

Written for an agent to follow. The outcome: everyone who opens the prototype sees the same notes, live, with no accounts and no keys. The reviewer's whole job is to open the link and write. They start under a made-up name and can put their own in the panel whenever they like.

Persistable.js is a small JSON store with a choice of where the data is kept. These steps use its default, a Worker the person deploys once to their own free Cloudflare account; "On Supabase instead", below, is the other. It lives in its own repo, `PhilMcClelland/persistablejs`; Crittable.js carries a copy of its browser client, so nothing is added to the prototype beyond the `crittable/` folder it already has.

## Steps

1. **Have a store.** Ask the person for their store address (`https://persistable.<their-subdomain>.workers.dev`). If they have none, check out the `persistablejs` repo and follow its `SETUP.md`: sign in to Cloudflare, `npx wrangler@4 deploy`, run its verify script. That is done once, for all of their prototypes.

2. **Verify notes through it.**

   ```
   node backends/persistable/verify.mjs https://persistable.<their-subdomain>.workers.dev
   ```

   Two made-up people write notes to a throwaway space; it checks who may do what, and cleans up after itself. Go on only when it prints "All checks passed".

3. **Point the prototype at it.** On the existing script tag:

   ```html
   <script src="crittable/crittable.js" data-backend="persistable" data-url="https://persistable.<their-subdomain>.workers.dev"></script>
   ```

   Each deployed prototype gets its own notes automatically, keyed by its origin (`https://my-prototype.example`). To make several addresses share notes (a preview URL and a custom domain, say), add `data-space="any-name-you-choose"` to each.

4. **Decide who gets in.** Ask the person. As written above, anyone who finds the store's address can read the notes and add to them. To keep them among the people the link is sent to, add `data-key="link"` to the script tag. The first person to open the prototype then starts a circle, and their address bar becomes the link to share (it gains `#k=…`); opening the prototype without that link shows none of the notes. If the prototype is already behind a sign-in or a password, `data-key="<16 or more letters and digits>"` does the same job with nothing in the link.

   For a page that anyone can open (a public site), where everyone should see the notes and only invited people should add them, use a read key as well. In the persistablejs folder run `node readkey.mjs --new`; it prints a key and its read key. Put the read key in the page, `data-key="link" data-read="<read key>"`, and give the person the page's address with `#k=<key>` on the end: that is the link to send to the people who should write. Never put the key itself in the page. Everyone else who opens the page reads, and is offered nothing that writes; the store refuses them too.

5. **Close the store to other sites before its address is public.** A fresh store accepts any website that knows its address, and the address is in the page's source once the prototype is shared. Follow "Before the address is public" in the `persistablejs` repo's `SETUP.md` to limit it to the person's own sites. Do this before the link goes to anyone outside, not after.

6. **Check it in two browsers.** Open the prototype in a normal window and a private window (with `data-key="link"`, open the first window's full address in the second). A note added in one should appear in the other within a second, marked unread.

## On Supabase instead

Pick this when the person already has a Supabase project, or wants the notes in Postgres. It does less than the Worker: no link keys or read keys, so anyone who has the page can read the notes and add to them, and changes arrive within about four seconds, not at once.

1. In the `persistablejs` repo, follow `stores/SUPABASE.md` steps 1 to 5: a project, anonymous sign-ins on, `stores/supabase.sql` run in it, and its verify script passing. Read its warning about existing projects to the person before step 2.
2. Verify notes through it: `node backends/persistable/verify.mjs --store supabase https://<ref>.supabase.co <publishable key>`.
3. Point the prototype at it:

   ```html
   <script src="crittable/crittable.js" data-backend="persistable" data-store="supabase"
           data-url="https://<ref>.supabase.co" data-api-key="<publishable key>"></script>
   ```

   Do not add `data-key` or `data-read`: this store refuses them, and the notes would stay in the browser.
4. Check it in two browsers, as in step 6 above. Then tell the person what `stores/SUPABASE.md` lists under "What to tell the person", and that the notes are objects in the `crittable` collection of the `persistable_objects` table.

## What to tell the person

These are for the Worker; for Supabase see the section above.


- Anyone with the prototype's link can read and write its notes. There are no accounts.
- Without `data-key`, so can anyone who finds the store's address. In return the store enforces authorship: only whoever wrote a note or reply can edit or delete it; anyone can resolve a note or move its pin, and if someone blanks a pin's place the note goes back to where its author put it. "Whoever" means that browser: clearing site data makes someone a new person.
- With a read key in the page, anyone who opens the page can read the notes, and can read them as often as they like; only people sent the link can add or change them. Nobody can be removed from the link without starting a new one, which starts an empty set of notes.
- With `data-key="link"`, only people who were sent the link reach the notes, and they are trusted: the tool still offers edit and delete only on your own notes, but that is the interface's rule, and anyone with the link could change or remove any note with a script. That is also how to tidy up. The link can be passed on, and nobody can be removed from it; to start over, clear the key from the address and share the new link, which begins with no notes.
- A name is whatever someone types; nothing checks it. Two people can use the same name and will get the same initials and colour, so a name here is a label, not proof of who wrote a note.
- The notes live in their Cloudflare account, in the `persistable` Worker's storage.
- The key in a link travels in the address of every request to the store (`?k=…`), so it is in the store's request logs on their Cloudflare account. Anyone who can read those logs can reach the notes.
- On a public page with no key, one visitor can fill the store or slow it for everyone: nothing limits who writes. Clearing it needs the store owner's secret (`ADMIN_SECRET`, which the `persistablejs` repo's `SETUP.md` sets up), so the person should have set one, and know where it is kept, before the page is public.
- The store was closed to other websites in step 5. A new site that should use it has to be added to that list.

## How it works, for debugging

- The adapter is `crittable/backends/persistable.js`; the loader loads the store's client, `crittable/vendor/persistable.js`, before it. The prototype's own code can use that client too: `Persistable({ url })` is on the page.
- A note is an object in the store's `crittable` collection: its words, name and route are the author's part, and resolved, the pin's place and the "newer" stamp are the part anyone can change. A reply is an object whose parent is its note.
- With the Worker, changes are pushed over one WebSocket; while that connection is down, the adapter asks every four seconds instead. With Supabase it always asks. `data-poll` changes how often, in milliseconds.
- Everything in `crittable/vendor/` and `tests/vendor/` is an unchanged copy from the `persistablejs` repo, sent here as a pull request whenever it changes there. Never edit those here.
