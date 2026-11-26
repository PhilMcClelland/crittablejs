# Contributing

Crittable.js is kept by one person in spare time. Issues are welcome: a bug, a page it breaks on, a store you would like connected, a sentence in the docs that led you wrong. Say what you did, what you saw and which version (`data-version` on the tool's element).

A security problem does not go in an issue. `SECURITY.md` says how to report it privately.

## Pull requests

Small ones are the easiest to take. For anything larger, open an issue first so the work is not wasted. `CLAUDE.md` says how the code and the design are meant to be changed, for people as much as for agents; `spec/DECISIONS.md` lists questions that are already settled.

Run the three checks before you open one, and say in the pull request which you ran:

1. `python3 smoke_test.py` (Python 3 and Node 22 or later): static checks, generated files up to date, and both store adapters against stand-ins.
2. `node tests/runtime_test.js`: the tool loaded in Node against a stand-in page. The smoke test runs it too; by itself it shows what failed.
3. `PLAYWRIGHT_CORE="$PWD/node_modules/playwright-core" node tests/browser_test.js`: the tool driven in headless Chrome. It needs Chrome on the machine and `npm install --no-save --no-audit --no-fund playwright-core@1.49.1` first. Without `playwright-core` it skips and says so, which is not a pass.

Do not change anything in `crittable/vendor/` or `tests/vendor/` here. They are copies; changes go to the `persistablejs` repository.

Do not copy another project's source, words or images into this one.

## Finding your way around

`index.html` at the repository root is the landing page (published at crittablejs.philmcclelland.com), with the tool running on it and two sample notes the first time you visit. Its colours and type come from `site/tokens.css`, which is generated from `crittable/pinwall.js` (the smoke test fails if it is stale). Serve the repository root and open it: `python3 -m http.server`.

The look is published as a design system ("Ink and Highlighter"); its files live in `design-system/project/`. `tokens.json` and `components/bundle.css` there are generated from `crittable/pinwall.js`: after changing a token or the stylesheet run `node scripts/export_design_system.js` (the smoke test fails if they are stale). The component previews are built from the state sheet's specimens with `node scripts/build_ds_previews.js <dump.json>`; the brand book and component guidelines are written by hand.

Notes through each Persistable.js store are checked against a stand-in for that store (`CRITTABLE_VERIFY_MOCK=1 node backends/persistable/verify.mjs …`). The stores themselves, and the SQL behind the Supabase one, are checked in the `persistablejs` repo, against a real project nightly.

Known gaps are in sections 13 and 14 of `spec/GLOSSARY.md`.

## What to expect

There is no promise of a quick review, or of any. A pull request may sit, be changed before it is merged, or be declined, and none of that is a judgement of the work. By sending one you agree it is released under the MIT license in `LICENSE`.
