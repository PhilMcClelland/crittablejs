# Security

Crittable.js runs on other people's pages and, with a shared store, shows what other people wrote. If you find a way for a note, a store or a link to do something it should not (run script, follow an address off the site, load something that tracks the reader, change or hide someone else's note, write when only reading is allowed), please report it privately: open a draft security advisory on this repository (Security, then "Report a vulnerability"). Do not open a public issue for it.

There is no bounty and no promised response time. To see which version a page is running, look at `data-version` on the tool's element (`<pin-note-board>` by default).

What it does and does not protect is in the README ("Sharing notes") and `docs/page-footprint.md` and in each store's setup guide under "What to tell the person".
