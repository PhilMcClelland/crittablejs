#!/usr/bin/env node
/* Writes the generated half of design-system/project/ from crittable/pinwall.js, so the published
   design system never drifts from the code:
     tokens.json            every TOKENS / SCALE value, with the usage notes below
     components/bundle.css  the widget stylesheet, token declarations removed
     ../../site/tokens.css  the tokens as :root custom properties, for our own pages (index.html)
   The hand-written half (README.md, components/<Name>/README.md and preview.html) is not touched.
   Run: node scripts/export_design_system.js   (--check exits 1 if the files on disk are stale) */
'use strict';
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const out = path.join(root, 'design-system', 'project');
const src = fs.readFileSync(path.join(root, 'crittable', 'pinwall.js'), 'utf8');

const num = name => Number(new RegExp('\\b' + name + ' = (\\d+)').exec(src)[1]);
const slice = src.slice(src.indexOf('const TOKENS = {'), src.indexOf('const makeHost'));
const { TOKENS, SCALE, SKIN } = new Function('PIN_SZ', 'PANEL_W', 'document',
  slice + '\nreturn { TOKENS, SCALE, SKIN };')(num('PIN_SZ'), num('PANEL_W'), null);

const USE = {
  base: 'Panel ground: the sidebar and the state sheet.',
  raised: 'Cards, menus and rows that sit above `cm-base`.',
  hover: 'Wash under a hovered row, icon button or menu item.',
  overlay: 'Menus and the new-note bar.',
  input: 'Fill of text fields.',
  strip: 'Tinted bands: the new-note strip and the delete confirmation.',
  selected: 'Wash on the selected row and on quoted words. Ink (`cm-text`) reads on it over `cm-raised`.',
  'accent-wash': 'Active menu choice and an open trigger. Ink reads on it over `cm-raised`.',
  halo: '3px halo outside a focused field; also the quoted-text highlight on the host page.',
  text: 'Headings, names and primary text on `cm-base`, `cm-raised`, `cm-strip`.',
  'text-author': 'Author names on `cm-raised` and `cm-base`.',
  'text-body': 'Note and reply text on `cm-raised` and `cm-base`.',
  'text-meta': 'Times, counts and secondary lines on `cm-raised` and `cm-base`.',
  'text-hint': 'Placeholders and hints on `cm-input`, `cm-raised` and `cm-strip`.',
  'border-hair': 'Dividers inside a surface.',
  border: 'Edges of fields, menus and banners.',
  'border-emph': 'The edge of a control that must be seen to be used: checkboxes, radios, the new-note bar. Clears 3:1 on `cm-raised` and `cm-base`.',
  accent: 'The highlighter. A fill behind ink only: pins, the active launcher, Send, checked boxes. On a light surface never text and never a thin line.',
  'accent-ink': 'The accent as a foreground: links, the unread dot, checked marks. Ink in light, highlighter in dark.',
  'accent-deep': 'Hover and pressed fill of an accent button.',
  'on-accent': 'Glyphs and text on `cm-accent` and `cm-accent-deep`.',
  'accent-edge': '1px edge under an accent fill, so yellow holds its shape on paper. Clear in dark.',
  focus: 'Focus ring and the border of a focused field, on every surface.',
  'control-edge': 'The edge of anything you type in or press that is not yellow: fields, the Resolve button. Ink in light, so it matches the edge under a yellow button beside it; soft in dark, where a yellow button has no edge either.',
  'card-edge': 'Hairline round every floating card.',
  ok: 'Success text and marks on `cm-raised`.',
  warn: 'Warnings on `cm-raised`. Orange, so it is never read as the accent.',
  err: 'Error text on `cm-raised`; also an error fill under `cm-on-err`.',
  'on-err': 'Text on an `cm-err` fill.',
  info: 'Informational marks on `cm-raised`.',
  neutral: 'Neutral status marks on `cm-raised`.',
  done: 'Fill of the Resolved control.',
  'on-done': 'The check on `cm-done`.',
  'send-off': 'Fill of a disabled Send.',
  'send-off-ink': 'Glyph on `cm-send-off`. Deliberately faint: disabled.',
  'dock-edge': 'Edge of the launcher group in light. Clear in dark.',
  'av-0': 'Face in a pin, colour 1 of 6 (teal): a pale wash. Picked by a hash of the name shown. On the host page, so the same in both themes.', 'av-0-ink': 'Initials on `cm-av-0`: the deep shade of the same colour.',
  'face-0': 'Face in a card or the panel, colour 1 of 6 (teal): the pale wash in light, a dusk of the colour in dark.', 'face-0-ink': 'Initials on `cm-face-0`: the deep shade in light, the pale wash in dark.',
  'av-1': 'Face in a pin, colour 2 of 6 (pink): a pale wash. Picked by a hash of the name shown. On the host page, so the same in both themes.', 'av-1-ink': 'Initials on `cm-av-1`: the deep shade of the same colour.',
  'face-1': 'Face in a card or the panel, colour 2 of 6 (pink): the pale wash in light, a dusk of the colour in dark.', 'face-1-ink': 'Initials on `cm-face-1`: the deep shade in light, the pale wash in dark.',
  'av-2': 'Face in a pin, colour 3 of 6 (blue): a pale wash. Picked by a hash of the name shown. On the host page, so the same in both themes.', 'av-2-ink': 'Initials on `cm-av-2`: the deep shade of the same colour.',
  'face-2': 'Face in a card or the panel, colour 3 of 6 (blue): the pale wash in light, a dusk of the colour in dark.', 'face-2-ink': 'Initials on `cm-face-2`: the deep shade in light, the pale wash in dark.',
  'av-3': 'Face in a pin, colour 4 of 6 (green): a pale wash. Picked by a hash of the name shown. On the host page, so the same in both themes.', 'av-3-ink': 'Initials on `cm-av-3`: the deep shade of the same colour.',
  'face-3': 'Face in a card or the panel, colour 4 of 6 (green): the pale wash in light, a dusk of the colour in dark.', 'face-3-ink': 'Initials on `cm-face-3`: the deep shade in light, the pale wash in dark.',
  'av-4': 'Face in a pin, colour 5 of 6 (plum): a pale wash. Picked by a hash of the name shown. On the host page, so the same in both themes.', 'av-4-ink': 'Initials on `cm-av-4`: the deep shade of the same colour.',
  'face-4': 'Face in a card or the panel, colour 5 of 6 (plum): the pale wash in light, a dusk of the colour in dark.', 'face-4-ink': 'Initials on `cm-face-4`: the deep shade in light, the pale wash in dark.',
  'av-5': 'Face in a pin, colour 6 of 6 (red): a pale wash. Picked by a hash of the name shown. On the host page, so the same in both themes.', 'av-5-ink': 'Initials on `cm-av-5`: the deep shade of the same colour.',
  'face-5': 'Face in a card or the panel, colour 6 of 6 (red): the pale wash in light, a dusk of the colour in dark.', 'face-5-ink': 'Initials on `cm-face-5`: the deep shade in light, the pale wash in dark.',
  'pin-ink': 'Fixed in both themes. Edge and glyph of pins, launcher fill, toast ground.',
  'pin-paper': 'Fixed in both themes. Launcher glyph, toast text, the ground of a draft or resolved pin.',
  'pin-ring': 'Fixed. Thin light ring outside a pin or launcher so it separates from a dark host page.',
  'pin-wash': 'Fixed. The highlighter laid over the element a note is, or would be, pinned to. A fill only, never a line.',
  'pin-drop': 'Fixed drop shadow under a pin and the launcher. Does not deepen in dark, because the host page did not change.',
  'pin-lift': 'Fixed deeper shadow for an on-page part that is hovered, dragged or floating: the launcher, a lifted pin, the toast.',
  s1: 'Tight gaps: icon to label, lines inside a row.', s2: 'Gaps between controls; row padding.', s3: 'Card padding; gaps between blocks in a card.',
  s4: 'Panel padding.', s5: 'Space between groups in the panel.', s6: 'Outer margins of the state sheet.',
  'r-sm': 'Fields and icon buttons.', 'r-md': 'Rows, menu items and buttons.', 'r-lg': 'Cards, menus and panels: three of the four corners.',
  'r-tip': 'The one sharp corner of a pin or card. It points at the anchor.', 'r-full': 'Avatars and the list button.',
  'elev-1': 'Rows and small raised parts.', 'elev-2': 'Launcher, preview card, banner.', 'elev-3': 'Thread card, menus, composer, anything being dragged.',
  'elev-edge': 'The inner edge of the sidebar.',
  'z-dock': 'Launcher.', 'z-card': 'Cards and menus.', 'z-panel': 'Sidebar.', 'z-banner': 'Storage warning; above everything.',
  fast: 'Hover, press, fades.', medium: 'Cards, panel and menus opening.', linger: 'Only the warning fading out.', instant: 'Reduced motion, and anything that tracks the pointer.',
  ease: 'The one curve for working motion. No spring.',
  'mark-blink': 'The mark blinking, once, when the pointer reaches the launcher.', 'mark-nod': 'The mark in the panel bobbing and winking, once.',
  'mark-shut': 'The curve an eye closes on: it drops fast.', 'mark-open': 'The curve an eye opens on: hard, then settling.',
  plant: 'A draft pin dropping onto its spot: the one signature.',
  'fs-face': 'Initials inside a face. Never running text.', 'fs-meta': 'Times, counts, labels.', 'fs-body': 'Everything else.', 'fs-head': 'Card and panel titles: body size, strong weight.', 'fs-type': 'Text typed into a field on a touch device, and only there: below 16px a phone zooms the page when the field is touched.',
  'fw-regular': 'Running text.', 'fw-strong': 'Names, titles, button labels.', lh: 'Line height everywhere.'
};
const missing = [];
const tok = (name, value) => { if (!USE[name]) missing.push(name); return { name: 'cm-' + name, value, usage: USE[name] || '' }; };
const clear = v => v === 'transparent' ? 'rgba(0,0,0,0)' : v;   // the page cannot read named colours

/* elevations are recipes over shade / shade-a; resolve them per theme so each is a plain shadow */
const elev = (name, theme) => SCALE[name]
  .replace(/calc\(var\(--cm-shade-a\)\*([\d.]+)\)/g, (_, k) => String(+(parseFloat(TOKENS[theme]['shade-a']) * +k).toFixed(3)))
  .replace(/var\(--cm-shade-a\)/g, TOKENS[theme]['shade-a'])
  .replace(/var\(--cm-shade\)/g, TOKENS[theme].shade)
  .replace(/,(?=0 )/g, ', ');

const colourNames = Object.keys(TOKENS.light).filter(k => k !== 'shade' && k !== 'shade-a');
const fixed = Object.keys(SCALE).filter(k => /^(av-\d(-ink)?|pin-ink|pin-paper|pin-ring|pin-wash)$/.test(k));
const pick = re => Object.keys(SCALE).filter(k => re.test(k)).map(k => tok(k, SCALE[k]));

const tokens = {
  name: 'Ink and Highlighter', version: 1,
  color: {
    themes: [{ id: 'light', name: 'Light' }, { id: 'dark', name: 'Dark' }],
    tokens: colourNames.map(k => tok(k, { light: clear(TOKENS.light[k]), dark: clear(TOKENS.dark[k]) }))
      .concat(fixed.map(k => tok(k, SCALE[k])))
  },
  type: {
    fonts: [],
    families: { sans: SCALE.font },
    groups: [{ name: 'Text', family: 'sans', styles: [
      { name: 'head', fontSize: SCALE['fs-head'], lineHeight: +SCALE.lh, fontWeight: +SCALE['fw-strong'], sample: 'Note #4', usage: 'Card and panel titles.' },
      { name: 'author', fontSize: SCALE['fs-body'], lineHeight: +SCALE.lh, fontWeight: +SCALE['fw-strong'], sample: 'Ada Vale', usage: 'Names and button labels.' },
      { name: 'body', fontSize: SCALE['fs-body'], lineHeight: +SCALE.lh, fontWeight: +SCALE['fw-regular'], sample: 'Is the catch list current?', usage: 'Notes, replies, fields, menus.' },
      { name: 'meta', fontSize: SCALE['fs-meta'], lineHeight: +SCALE.lh, fontWeight: +SCALE['fw-regular'], sample: '2 replies, just now', usage: 'Times, counts, hints.' }
    ] }]
  },
  spacing: { tokens: pick(/^s\d$/) },
  radius: { tokens: pick(/^r-/) },
  shadow: { tokens: ['elev-1', 'elev-2', 'elev-3', 'elev-edge'].map(k => tok(k, { light: elev(k, 'light'), dark: elev(k, 'dark') })).concat([tok('pin-drop', SCALE['pin-drop']), tok('pin-lift', SCALE['pin-lift'])]) },
  text: { tokens: pick(/^(fs-|fw-|lh$)/) },
  timing: { tokens: pick(/^(fast|medium|linger|instant|ease|mark-blink|mark-nod|mark-shut|mark-open|plant)$/) },
  zIndex: { tokens: pick(/^z-/) },
  meta: { source: 'code', file: 'crittable/pinwall.js', generator: 'scripts/export_design_system.js' }
};
if (missing.length) { console.error('no usage note for: ' + missing.join(', ')); process.exit(1); }
const covered = new Set(Object.values(tokens).flatMap(f => (f && f.tokens) || []).map(t => t.name.slice(3)));
const dropped = Object.keys(SCALE).filter(k => !covered.has(k) && k !== 'font');
if (dropped.length) { console.error('SCALE entries not exported: ' + dropped.join(', ')); process.exit(1); }

/* stylesheet: the three :host blocks only declare tokens, which tokens.json now owns */
const hostEnd = SKIN.indexOf('\n*{');
const metrics = /--pin-half:[^;]+;--pin-d:[^;]+;--panel:[^;]+;/.exec(SKIN)[0];
const css = '/* Ink and Highlighter: component styles. Generated from crittable/pinwall.js by scripts/export_design_system.js; do not edit. */\n' +
  ':root{' + metrics + '--cm-font:var(--font-sans)}\n' +
  SKIN.slice(hostEnd + 1).replace(/:host\{/g, ':root{').trimEnd() + '\n';
if (/:host|var\(--cm-shade/.test(css)) { console.error('stylesheet still depends on the shadow host or the shade recipe'); process.exit(1); }

/* site/tokens.css: the same tokens as page-level custom properties, for pages of our own (the docs page) that sit outside the tool's shadow root */
const decl = obj => Object.entries(obj).map(([k, v]) => '--cm-' + k + ':' + v + ';').join('');
const siteCss = '/* Ink and Highlighter tokens for our own pages. Generated from crittable/pinwall.js by scripts/export_design_system.js; do not edit. */\n' +
  ':root{' + decl(TOKENS.light) + decl(SCALE) + 'color-scheme:light}\n' +
  '@media (prefers-color-scheme:dark){:root:not([data-theme=light]){' + decl(TOKENS.dark) + 'color-scheme:dark}}\n';
const files = { 'tokens.json': JSON.stringify(tokens, null, 1) + '\n', 'components/bundle.css': css, '../../site/tokens.css': siteCss };
let stale = 0;
for (const [rel, text] of Object.entries(files)) {
  const p = path.join(out, rel);
  if (process.argv.includes('--check')) { if (!fs.existsSync(p) || fs.readFileSync(p, 'utf8') !== text) { console.error('stale: design-system/project/' + rel); stale = 1; } continue; }
  fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, text);
  console.log('wrote design-system/project/' + rel + ' (' + text.length + ' bytes)');
}
process.exit(stale);
