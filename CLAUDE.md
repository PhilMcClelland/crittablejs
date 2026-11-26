# Crittable.js

Make any coded prototype crittable: pin notes on any web page. (The main file is `crittable/pinwall.js` and some class names start `pw-`; do not rename those.) The tool is `crittable/` (vanilla JS, shadow DOM, one file: `crittable/pinwall.js`). Specs are in `spec/`. Shared stores are adapters in `crittable/backends/`, with agent setup files in `backends/<name>/` and the contract in `spec/STORAGE.md` (Persistable.js, our own store, lives in the `persistablejs` repo; everything in `crittable/vendor/` and `tests/vendor/` is an unchanged copy that arrives as a pull request whenever it changes there, so change them there, never here); `AGENTS.md` is written for an adopter's agent, not for you. `index.html` is the docs page: a host page that runs the tool and takes its tokens from the generated `site/tokens.css`; never write a colour or motion value into it by hand.

Do not copy another project's source, copy or assets into this repository. Where `spec/DECISIONS.md` records a decision, it wins over older behaviour of the code (for example Escape, and the missing-pin dialog); do not undo one without new evidence.

## Designing UI here

**Read first, every time you touch UI; don't work from memory:** `spec/PRODUCT-MODEL.md` (the objects), `spec/GLOSSARY.md` (state names; section 12 has the surface rules and the Motion table, 13 the known drift, 14 the open questions), `spec/CANONICAL.md` (proven solutions; only `##` entries are approved, `###` are candidates), `spec/DECISIONS.md` (questions already settled, with the reasons; do not reopen without new evidence), and the four rules in `design-system/project/README.md`, plus the card for the component you are touching in `design-system/project/components/<Name>/README.md`. Tokens live only in the `TOKENS` and `SCALE` objects in `crittable/pinwall.js`, so look them up there and use roles, never hues. `spec/DESIGN.md` maps each state to its tokens. If these files and your memory disagree, the files win. Where two files disagree, check GLOSSARY section 13 before picking one.

1. Name the primitive, the reader's task, and how often they do it. There are no roles; only authorship changes what someone can do.
2. Classify the surface (On the page / Note card / Panel / Menu) and follow its rules in GLOSSARY section 12.
3. Give each element a role (recognition marker, status, control, structural container, content). If it carries colour, a container or an icon without a role, cut it. No AI tells (monospace caps labels, coloured edge stripes, gradients, glass, emoji) unless GLOSSARY section 12 gives them a role.
4. Reuse the matching canonical solution. If you diverge, say why. If nothing matches, flag a candidate.
5. One detail presentation per note (the thread card); the same kind of edit opens the same way everywhere (in place, inside the card).
6. A new state needs a name in `spec/GLOSSARY.md`, a row in `spec/DESIGN.md` and a specimen in `sample/states.js`. A specimen is the product's own builder (`kit.parts`, defined at the end of `crittable/pinwall.js`) fed a made-up note; never write specimen markup by hand, and add a builder to `parts` if one is missing. After changing a token or the stylesheet run `node scripts/export_design_system.js`.
7. Verify before calling it done:
   - behaviour in a real browser (focus, Escape levels, phone layout, failures): `PLAYWRIGHT_CORE=<path to playwright-core> node tests/browser_test.js`. It drives the Chrome installed on the machine, so Chrome is needed, and `playwright-core` (no browser download) from `npm install --no-save --no-audit --no-fund playwright-core@1.49.1`, which puts it at `$PWD/node_modules/playwright-core`. Add a scenario there for any new behaviour; the static checks cannot see it
   - deterministic checks: `python3 smoke_test.py` (Python 3 and Node 22 or later). It also runs `node tests/runtime_test.js`, which loads the tool in Node against a stand-in page, and both adapters against stand-in stores; run that file by itself for a quicker answer while working. Say which checks you ran and which you did not
   - look at `sample/states.html` (`?theme=light`, `?theme=dark`) and `sample/index.html` in a browser
   - then a review by someone, or an agent started with nothing else in front of it, who has seen only the change, GLOSSARY section 12 and CANONICAL. Fix what they find and ask again, three times at most
   - report pass / fail / not checked
8. These go to the maintainer: interaction feel (hover, drag, motion, timing), screen-reader experience, canonical promotion, changes to how an object behaves.
9. After approval, harvest: add the canonical candidate and any new rule *with its reasoning*.

## Republishing the design system

Maintainer only. The published copy is made from `design-system/project/`; it falls behind whenever the stylesheet, a builder or a component card changes. To bring it up to date:

1. `node scripts/export_design_system.js` (tokens, bundle, `site/tokens.css`).
2. `PLAYWRIGHT_CORE=<path> node scripts/dump_specimens.js <tmp>/specimens.json`, then `node scripts/build_ds_previews.js <tmp>/specimens.json`. A new state only appears in a preview once it is listed in `CARDS` in `build_ds_previews.js`.
3. Update the matching `components/<Name>/README.md` and `lastChange` in `design-system.json`.
4. Publish the changed files to the existing published copy (ask the maintainer for the link; never create a second one). Each file keeps its path below `design-system/`, and the index page goes up last.
