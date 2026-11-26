#!/usr/bin/env node
/* Writes design-system/project/components/<Name>/preview.html from the state sheet's own specimens,
   so every preview is the real markup drawn by the real stylesheet.
   Input: a JSON dump of sample/states.html?theme=light, one entry per surface:
     [{ title, specs: [{ code, note, cls, w, h, html }] }]   (html = innerHTML of the specimen's .stage)
   Run: node scripts/build_ds_previews.js <specimens.json> */
'use strict';
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const out = path.join(root, 'design-system', 'project', 'components');
let dump = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
if (!Array.isArray(dump)) dump = dump.result;
const spec = {};
for (const s of dump) for (const x of s.specs) spec[x.code] = x;

/* the state sheet's rules that freeze fixed-position parts into the flow */
const freeze = fs.readFileSync(path.join(root, 'sample', 'states.js'), 'utf8').split('\n')
  .map(l => /^\s*'((?:\.stage|\.spec>\.stage)[^']*)',?\s*$/.exec(l)).filter(Boolean).map(m => m[1].replace('.spec>.stage', '.stage')).join('\n');

const W = 880, PAD = 16, GAP = 16, CAP = 26;
/* measured heights, where the specimen widths from the state sheet overestimate the wrap */
const FIT = { Pin: 236 };
const CARDS = [
  ['Launcher', 'Page', [['LAUNCHER.Rest', 'Rest'], ['LAUNCHER.Hover', 'Hover'], ['LAUNCHER.Armed', 'Placing'], ['LAUNCHER.Focus', 'Focus']]],
  ['Pin', 'Page', [['PIN.Draft', 'Draft'], ['PIN.Rest', 'Rest'], ['PIN.RestUnread', 'Unread'], ['PIN.Open', 'Open'], ['PIN.Pointed', 'Pointed from its row'], ['PIN.Lifted', 'Dragging'], ['PIN.Muted', 'Resolved'], ['PIN.Quoted', 'Quoted words'], ['PLACING.TargetHint', 'Target band']]],
  ['PreviewCard', 'Page', [['PIN.Preview', 'Hover preview']]],
  ['Toast', 'Page', [['CARD.UndoOffered', 'Undo offered']]],
  ['ThreadCard', 'Cards', [['CARD.Reading', 'Reading'], ['CARD.ReadingResolved', 'Resolved'], ['CARD.MenuOpen', 'More menu'], ['PLACING.Moving', 'Move pin, in the More menu'], ['CARD.ConfirmDelete', 'Confirm delete'], ['CARD.Adrift', 'No pin to open from']]],
  ['Composer', 'Cards', [['COMPOSER.NewOpen', 'New note'], ['COMPOSER.Focused', 'Focused'], ['COMPOSER.Ready', 'Ready to send'], ['COMPOSER.TooLong', 'Too long'], ['COMPOSER.SaveFailed', 'Save failed']]],
  ['Menu', 'Cards', [['MENU.Open', 'Open'], ['MENU.ItemHover', 'Item hover'], ['MENU.ItemChecked', 'Checked'], ['MENU.ItemDisabled', 'Disabled'], ['MENU.ShareLink', 'Copy link to share'], ['MENU.ShareCopied', 'Link copied'], ['MENU.Shortcuts', 'Keyboard shortcuts']]],
  ['Sidebar', 'Panel', [['SIDEBAR.Open', 'Open'], ['SIDEBAR.Searching', 'Searching']]],
  ['Row', 'Panel', [['ROW.Rest', 'Rest'], ['ROW.Hover', 'Hover'], ['ROW.Selected', 'Selected'], ['ROW.Unread', 'Unread'], ['ROW.Resolved', 'Resolved'], ['ROW.Lost', 'Target missing']]],
  ['Notice', 'Panel', [['EMPTY.NoThreads', 'No notes yet'], ['EMPTY.NoThreadsShare', 'No notes yet, with a link to share'], ['EMPTY.NoMatch', 'No match'], ['EMPTY.StorageFailed', 'Storage failed']]]
];

const page = (group, height, body) => `<!-- @dsCard group="${group}" height=${height} width=${W} -->
<!doctype html>
<meta charset="utf-8">
<style>
html,body{margin:0;background:var(--cm-base);color:var(--cm-text)}
.ds{display:flex;flex-wrap:wrap;gap:${GAP}px;padding:${PAD}px;align-items:flex-start}
.ds figure{margin:0;display:flex;flex-direction:column;gap:var(--cm-s2)}
.ds figcaption{font-size:var(--cm-fs-meta);color:var(--cm-text-meta)}
.stage{padding:var(--cm-s4);border:1px dashed var(--cm-border);border-radius:var(--cm-r-md);display:flex;align-items:flex-start;justify-content:center;min-height:64px;position:relative}
${freeze}
</style>
<div class="ds">
${body}
</div>
`;

for (const [name, group, items] of CARDS) {
  let x = PAD, rowH = 0, total = PAD; const figs = [];
  for (const [code, label] of items) {
    const s = spec[code];
    if (!s) { console.error('no specimen named ' + code); process.exit(1); }
    if (x > PAD && x + s.w > W - PAD) { total += rowH + GAP; x = PAD; rowH = 0; }
    x += s.w + GAP; rowH = Math.max(rowH, s.h + CAP);
    figs.push(`<figure><div class="${s.cls}">${s.html}</div><figcaption>${label}</figcaption></figure>`);
  }
  total += rowH + PAD;
  if (FIT[name]) total = FIT[name];
  const dir = path.join(out, name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'preview.html'), page(group, total, figs.join('\n')));
  console.log(name, total + 'px', items.length + ' states');
}

/* the icon set, straight from the ICON map */
const src = fs.readFileSync(path.join(root, 'crittable', 'pinwall.js'), 'utf8');
const ICON = new Function(src.slice(src.indexOf('const ICON = {'), src.indexOf('const icon = name')) + '\nreturn ICON;')();
const tiles = Object.entries(ICON).map(([n, svg]) => `<figure><div class="tile"><span class="ic">${svg}</span></div><figcaption>${n}</figcaption></figure>`).join('\n');
fs.mkdirSync(path.join(out, 'Icon'), { recursive: true });
fs.writeFileSync(path.join(out, 'Icon', 'preview.html'), page('Foundations', 108, tiles)
  .replace('</style>', '.tile{width:48px;height:48px;display:grid;place-items:center;border:1px solid var(--cm-border-hair);border-radius:var(--cm-r-md);background:var(--cm-raised);color:var(--cm-text);font-size:20px}\n.ds figure{align-items:center}\n</style>'));
console.log('Icon', Object.keys(ICON).length + ' glyphs');
