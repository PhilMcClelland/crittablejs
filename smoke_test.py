"""Smoke test: crittable files, design-system mapping, contrast, store and runtime tests."""
import pathlib, re, sys
d2 = pathlib.Path(__file__).parent / "crittable"
pw_src = (pathlib.Path(__file__).parent / "crittable" / "pinwall.js").read_text()
for f in ["pinwall.js", "config.js", "crittable.js", "store.js"]:
    assert (d2 / f).is_file(), f"crittable missing {f}"
h2 = (pathlib.Path(__file__).parent / "sample" / "index.html").read_text()
assert h2.count("<script") == 1 and "crittable.js" in h2, "crittable should use the single loader tag"
ld = (d2 / "crittable.js").read_text()
assert "pinwall.js" in ld and "config.js" in ld and not re.search(r"https?://", ld)
assert not re.search(r"https?://", h2), "crittable must not load remote resources"
for f in (d2 / "backends").glob("*.js"):
    assert not re.search(r"https?://[a-z]", re.sub(r"/\*.*?\*/", "", f.read_text(), flags=re.S)), f"{f.name}: an adapter must talk only to the address it is given"
for f in (d2 / "vendor").glob("*.js"):
    assert not re.search(r"https?://[a-z]", re.sub(r"/\*.*?\*/", "", f.read_text(), flags=re.S)), f"{f.name}: a copied client must talk only to the address it is given"
# the docs page: no remote resources, tokens from the generated file, no colour literals of its own
docs = (pathlib.Path(__file__).parent / "index.html").read_text()
assert "site/tokens.css" in docs and "crittable/crittable.js" in docs and not re.search(r"""(?:src=|url\(|<link[^>]*href=)\s*["']?https?://""", docs), "index.html must use site/tokens.css and load nothing remote (a plain link out is fine)"
assert not re.search(r"#[0-9a-fA-F]{3,8}\b|rgba?\(\d|hsl\(", docs.split("<style>")[1].split("</style>")[0]), "index.html must use --cm-* tokens, not colour literals"
assert "attachShadow" in (d2 / "pinwall.js").read_text()
assert "window.CRITTABLE_CONFIG" in (d2 / "config.js").read_text()
# the old public names are gone for good
assert not re.search(r"PINWALL_|Commenteer", pw_src + ld + (d2 / "store.js").read_text()) and not (d2 / "commenteer.js").exists(), "the old names were dropped before the first release"
assert "CrittableStore" in (d2 / "pinwall.js").read_text() and (pathlib.Path(__file__).parent / "spec" / "STORAGE.md").is_file()
pw = (d2 / "pinwall.js").read_text()
# re-anchor path: slop-gated drag, fresh anchor on release, persisted, click swallowed, glide-back on miss
for needle in ["PIN_SLOP", "dropAnchor(spot", "depot.update(id, { anchor: th.anchor })", "bead.__drop", "classList.add('glide')", "memoEl.set(id, spot)"]:
    assert needle in pw, f"pinwall.js re-anchor path missing: {needle}"
assert "evt.button !== 0" in pw, "drag must be left-button only"
# design system (spec/DESIGN.md): every glossary state is mapped and drawn on the state sheet; no stray colours
spec = pathlib.Path(__file__).parent / "spec"
states = {n for n in re.findall(r"`([A-Z]+\.[A-Za-z-]+)`", (spec / "GLOSSARY.md").read_text()) if not n.endswith(".md") and n != "SURFACE.State"}
design, sheet = (spec / "DESIGN.md").read_text(), (pathlib.Path(__file__).parent / "sample" / "states.js").read_text()
for n in sorted(states):
    assert n in design, f"DESIGN.md does not map {n}"
    assert n in sheet, f"states.js does not draw {n}"
skin = pw[pw.index("const SKIN = `"):pw.index("const makeHost")]
assert not re.search(r"#[0-9a-fA-F]{3,8}\b|rgba?\(\d|hsl\(", skin), "SKIN must use --cm-* tokens, not colour literals"
assert not re.search(r"#[0-9a-fA-F]{3,8}\b|rgba?\(\d|hsl\(", sheet), "states.js must not hard-code colours"
# specimens are made by the product's builders (kit.parts in pinwall.js); the sheet must not grow markup of its own again
own = [n for n in ["class: 'card", "class: 'pick'", "class: 'menu'", "class: 'dock", "b('aside'", "class: 'toast'", "class: 'note-banner'", "class: 'side-tools'", "class: 'compose'", "class: 'msg"] if n in sheet]
assert not own, "states.js builds product markup itself (%s); use kit.parts so a specimen cannot differ from the product" % ", ".join(own)
# every wait goes through the TIME table, whose motion entries are computed from the tokens
loose = re.findall(r"setTimeout\([^\n]*,\s*[1-9]\d*\)", pw)
assert not loose and "const TIME = {" in pw, "literal delay in pinwall.js; name it in TIME: %s" % loose[:3]
assert "parts," in pw and "kit.parts" in sheet, "the state sheet must draw from the product's builders"
# off-scale values (DESIGN.md section 4): type, radius and timing come from --cm-* tokens. Literals already in the
# stylesheet are baselined; a new one fails. Sizes in KNOWN["font-size"] size icons, which the brand book allows.
KNOWN = {
    "font-size": {"13px", "15px", "16px", "20px"},
    "font-weight": set(), "letter-spacing": {"-.01em"},   # the lockup only: mark and name read as one unit
    "border-radius": {"4px"},
    "transition": set(), "transition-delay": {".4s"},
    "animation": {"cm-breathe 1.2s ease-in-out infinite alternate", "cm-spin .7s linear infinite"},
}
stray = []
for prop, known in KNOWN.items():
    for v in set(re.findall(r"(?<![\w-])" + prop + r":([^;}]+)", skin)):
        bare = re.sub(r"calc\([^)]*\)|(?<![\d.])0s\b", "", re.sub(r"var\([^)]*\)", "", v))  # a calc over a token is derived, not a literal
        lit = re.search(r"(?<![\w-])\d*\.?\d+(px|m?s|em)\b", bare) or (prop == "font-weight" and re.fullmatch(r"\d+", v.strip()))
        if lit and v not in known: stray.append(f"{prop}:{v}")
assert not stray, "off-scale literals in SKIN; use a --cm-* token (or baseline with a reason):\n  " + "\n  ".join(sorted(stray))
assert "data-theme" in pw and "prefers-color-scheme:dark" in pw, "theme override + OS default must stay"
# WCAG AA contrast of every text/background --cm-* pair, light and dark (colours are not retuned here)
def parse_tokens(src):
    blk = src[src.index("const TOKENS = {"):src.index("const SCALE")]
    out = {}
    for th in ("light", "dark"):
        part = blk[blk.index(th + ": {"):]
        part = part[:part.index("}")]
        out[th] = {k.strip("'"): v for k, v in re.findall(r"('?[\w-]+'?): '([^']*)'", part)}
    sc = src[src.index("const SCALE = {"):src.index("const vars")]
    out["scale"] = {k.strip("'"): v for k, v in re.findall(r"('?[\w-]+'?): '(#[0-9a-f]{6})'", sc)}
    return out
def rgba(c):
    if c.startswith("#"): return [int(c[i:i+2], 16) for i in (1, 3, 5)] + [1.0]
    m = re.match(r"rgba\((\d+),(\d+),(\d+),([\d.]+)\)", c); return [int(m[1]), int(m[2]), int(m[3]), float(m[4])]
def over(top, bot):
    t, b = rgba(top), rgba(bot)
    return "#%02x%02x%02x" % tuple(round(t[i]*t[3] + b[i]*(1-t[3])) for i in range(3))
def lum(c):
    f = lambda v: v/12.92 if v <= .03928 else ((v+.055)/1.055)**2.4
    r, g, b = (f(v/255) for v in rgba(c)[:3]); return .2126*r + .7152*g + .0722*b
def ratio(a, b):
    x, y = sorted((lum(a), lum(b)), reverse=True); return (x+.05)/(y+.05)
T = parse_tokens(pw)
S = T["scale"]
misses = []
for th in ("light", "dark"):
    t = T[th]; res = []
    surf = ["raised", "base", "overlay", "strip", "input"]
    for fg in ["text", "text-author", "text-body", "text-meta", "text-hint"]:
        for bg in surf: res.append((fg, bg, ratio(t[fg], t[bg]), 4.5))
    for fg in ["text", "text-meta"]:
        res.append((fg, "hover/raised", ratio(t[fg], over(t["hover"], t["raised"])), 4.5))
    res.append(("text", "selected/raised", ratio(t["text"], over(t["selected"], t["raised"])), 4.5))
    for fg in ["accent-ink", "err", "warn"]:
        for bg in ["raised", "base", "strip", "input"]: res.append((fg, bg, ratio(t[fg], t[bg]), 4.5))
    res.append(("accent-ink", "accent-wash/raised", ratio(t["accent-ink"], over(t["accent-wash"], t["raised"])), 4.5))
    res.append(("on-accent", "accent", ratio(t["on-accent"], t["accent"]), 4.5))
    res.append(("on-accent", "accent-deep", ratio(t["on-accent"], t["accent-deep"]), 4.5))
    res.append(("pin-ink", "accent", ratio(S["pin-ink"], t["accent"]), 4.5))
    res.append(("text", "accent-wash/raised", ratio(t["text"], over(t["accent-wash"], t["raised"])), 4.5))
    res.append(("on-err", "err", ratio(t["on-err"], t["err"]), 4.5))
    res.append(("on-done", "done", ratio(t["on-done"], t["done"]), 4.5))
    for bg in ["raised", "base"]:
        # the accent is only ever a fill behind ink; what must stand out against a surface is the focus ring and the edge under an accent fill
        res.append(("done", bg, ratio(t["done"], t[bg]), 3)); res.append(("focus", bg, ratio(t["focus"], t[bg]), 3))
        res.append(("border-emph", bg, ratio(over(t["border-emph"], t[bg]), t[bg]), 3))
    for k, v in S.items():
        if k.startswith("av-") and not k.endswith("-ink"): res.append((k + "-ink", k, ratio(S[k + "-ink"], v), 4.5))
    for k, v in t.items():
        if k.startswith("face-") and not k.endswith("-ink"): res.append((k + "-ink", k, ratio(t[k + "-ink"], v), 4.5))
    for fg, bg, r, m in res:
        if r < m: misses.append((f"{th}: {fg} on {bg}", r, m))
# Known misses: baselined (WARN) until the colours are retuned; value = ratio at baseline time. Any new miss, or a
# baselined pair whose ratio drops below its baseline, still fails.
KNOWN_MISSES = {}   # none: border-emph and text-hint were retuned on 2026-11-18
fails = []
for name, r, m in misses:
    base = KNOWN_MISSES.get(name)
    if base is None: fails.append(f"{name} = {r:.2f}:1 (needs {m}:1) [new]")
    elif round(r, 2) < base: fails.append(f"{name} = {r:.2f}:1 (baseline {base}:1) [worse]")
    else: print(f"WARN known contrast miss: {name} = {r:.2f}:1 (needs {m}:1)")
assert not fails, "AA contrast failures (%d):\n  " % len(fails) + "\n  ".join(fails)
import shutil, subprocess
if shutil.which("node"):
    js = """
const S = require(process.argv[1]);
const data = {}, med = { get length() { return Object.keys(data).length; }, key: i => Object.keys(data)[i],
  getItem: k => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); }, removeItem: k => { delete data[k]; } };
let a = S.open('t', med);
a.set('threads', [{ id: 'x', text: 'hello' }]); a.set('sort', 'old');
let b = S.open('t', med);  // simulated reload: new store, same medium
const eq = (x, y) => { if (JSON.stringify(x) !== JSON.stringify(y)) throw new Error(JSON.stringify(x) + ' != ' + JSON.stringify(y)); };
eq(b.get('threads'), [{ id: 'x', text: 'hello' }]); eq(b.keys().sort(), ['sort', 'threads']);
eq(S.open('other', med).keys(), []); b.remove('sort'); eq(b.get('sort', 'new'), 'new'); b.clear(); eq(b.keys(), []);
const bad = S.open('t', { setItem() { throw new Error('q'); } }); bad.set('k', 1); eq(bad.get('k'), 1); eq(bad.persistent, false);
"""
    r = subprocess.run(["node", "-e", js, str(d2 / "store.js")], capture_output=True, text=True)
    assert r.returncode == 0, "store persistence test failed: " + r.stderr
if shutil.which("node"):
    # notes through Persistable.js on Supabase, against a stand-in project (the SQL itself needs a real one, and is checked in the persistablejs repo)
    import os
    r = subprocess.run(["node", str(pathlib.Path(__file__).parent / "backends" / "persistable" / "verify.mjs"), "--store", "supabase", "https://mock.supabase.co", "mock-key"], capture_output=True, text=True, timeout=60, env=dict(os.environ, CRITTABLE_VERIFY_MOCK="1"))
    assert r.returncode == 0, "persistable on supabase check failed:\n" + r.stdout + r.stderr
    # Persistable.js: the Worker's own code run in Node with stand-in storage, through its verify script (Cloudflare itself needs a deploy)
    r = subprocess.run(["node", str(pathlib.Path(__file__).parent / "backends" / "persistable" / "verify.mjs"), "https://mock.invalid"], capture_output=True, text=True, timeout=60, env=dict(os.environ, CRITTABLE_VERIFY_MOCK="1"))
    assert r.returncode == 0, "persistable check failed:\n" + r.stdout + r.stderr
    # runtime test (no npm deps): anchor round-trip, reply rollback, Esc ladder, against the real crittable/pinwall.js
    r = subprocess.run(["node", str(pathlib.Path(__file__).parent / "tests" / "runtime_test.js")], capture_output=True, text=True, timeout=60)
    assert r.returncode == 0, "pinwall runtime test failed:\n" + r.stdout + r.stderr
    # the published design system's tokens and stylesheet are generated from pinwall.js; fail if they are stale
    r = subprocess.run(["node", str(pathlib.Path(__file__).parent / "scripts" / "export_design_system.js"), "--check"], capture_output=True, text=True, timeout=60)
    assert r.returncode == 0, "design-system files are stale; run: node scripts/export_design_system.js\n" + r.stderr
else:
    print("note: node not found, runtime test skipped")
print("ok")
