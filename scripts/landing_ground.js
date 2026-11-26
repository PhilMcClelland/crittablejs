#!/usr/bin/env node
/* The landing page's ground: a plain half-drop array of the mark, each with its own look on its face (wide awake, glancing
   aside, mid-blink, winking, pleased), so the repeat reads as a crowd and not as one stamp. Seeded, so a rerun gives the same tile.
   Writes the tile into index.html as a mask image, between the two "ground" markers. Usage: node scripts/landing_ground.js */
const fs = require('fs'), path = require('path');
const FILE = path.join(__dirname, '..', 'index.html'), CELL = 132, N = 4, T = CELL * N;
let seed = 20261123;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const n = v => +v.toFixed(1), R = 14, L = -2.3, RT = 4.7;   // on whole pixels at rest, so the page's blinking pair sits exactly over them   // the eyes sit a little right of centre, as on the mark
const up = (x, y, h) => 'M' + n(x) + ' ' + n(y - h / 2) + 'v' + n(h), flat = (x, y) => 'M' + n(x - 1.5) + ' ' + n(y) + 'h3', arc = (x, y) => 'M' + n(x - 2.3) + ' ' + n(y + 1.5) + 'q2.3 -5 4.6 0';
const both = (f, dx, dy, a) => f(L + dx, dy, a) + f(RT + dx, dy, a);
/* [share of the crowd, eyes] */
const looks = [
  [34, () => 'OPEN' + both(up, 0, 0, 2.6)],  // the plain look, and the only one that blinks on the page
  [9, () => both(up, 0, 0, 5.2)],            // wide awake
  [9, () => both(up, -2.6, 0, 3.4)],         // glancing left
  [9, () => both(up, 2, 0, 3.4)],            // glancing right
  [7, () => both(up, 0, -2.4, 3.4)],         // looking up
  [7, () => both(up, 0, 2.2, 3.4)],          // looking down
  [9, () => both(flat, 0, .4)],              // mid-blink
  [8, () => up(L, 0, 3.4) + flat(RT, .4)],   // winking
  [8, () => 'FINE' + both(arc, 0, 0)]        // pleased: a finer line, so the two arcs keep their shape
];
const pick = () => { let at = rnd() * looks.reduce((t, l) => t + l[0], 0); for (const l of looks) { if ((at -= l[0]) < 0) return l[1](); } return looks[0][1](); };
let out = '', count = 0, look;
const open = [];   // where the plain faces are, so the page can make one blink now and then
for (let row = 0; row < N * 2; row++) for (let col = 0; col < N; col++) {
  const x = col * CELL + (row % 2 ? CELL * .75 : CELL * .25), y = row * CELL / 2 + CELL * .25; count++;
  out += '<g transform="translate(' + n(x) + ' ' + n(y) + ')"><path d="M' + -R + ' ' + R + 'V0a' + R + ' ' + R + ' 0 1 1 ' + R + ' ' + R + 'z"/><path class="b' + ((look = pick()).startsWith('FINE') ? ' fine' : '') + '" d="' + look.replace(/^(FINE|OPEN)/, '') + '"/></g>';
  if (look.startsWith('OPEN')) open.push([n(x), n(y)]);
}
const placed = { length: count }, order = placed;
const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + T + ' ' + T + '"><style>*{fill:none;stroke:black;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}.b{stroke-width:3.4}.fine{stroke-width:1.9}</style>' + out + '</svg>';
const uri = 'url("data:image/svg+xml,' + svg.replace(/"/g, "'").replace(/</g, '%3C').replace(/>/g, '%3E').replace(/#/g, '%23') + '")';
const page = fs.readFileSync(FILE, 'utf8'), A = '/* ground:start */', B = '/* ground:end */';
if (!page.includes(A) || !page.includes(B)) { console.error('markers missing in index.html'); process.exit(1); }
let next = page.slice(0, page.indexOf(A) + A.length) + ':root{--crowd:' + uri + ';--crowd-size:' + T + 'px}' + page.slice(page.indexOf(B));
const C = '/* crowd:start */', D = '/* crowd:end */';
if (!next.includes(C) || !next.includes(D)) { console.error('crowd markers missing in index.html'); process.exit(1); }
next = next.slice(0, next.indexOf(C) + C.length) + 'var CROWD = ' + JSON.stringify({ tile: T, left: L, right: RT, open }) + ';' + next.slice(next.indexOf(D));
fs.writeFileSync(FILE, next);
console.log('ground: ' + placed.length + ' of ' + order.length + ' things placed, ' + uri.length + ' bytes');
