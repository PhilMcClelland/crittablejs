/* State sheet for Crittable.js (crittable): renders every state named in spec/GLOSSARY.md as a static
   specimen, using the tool's own stylesheet and tokens (handed over by pinwall.js through the
   stateSheet hook). Layout rules below use only the tool's tokens; there are no colours here.
   ?theme=light or ?theme=dark shows one theme; no parameter shows both side by side. */
(function () {
  'use strict';
  var page = new URLSearchParams(location.search).get('theme');

  var SHEET_CSS = [
    ':host{display:block}',
    '.sheet{background:var(--cm-base);color:var(--cm-text);padding:var(--cm-s6);min-height:100%}',
    '.sheet>h1{margin:0 0 var(--cm-s1);font-size:18px;font-weight:var(--cm-fw-strong)}',
    '.sheet>p{margin:0 0 var(--cm-s4);color:var(--cm-text-meta)}',
    '.surface{margin:var(--cm-s6) 0 0}',
    '.surface>h2{margin:0 0 var(--cm-s3);font-size:var(--cm-fs-head);color:var(--cm-accent-ink)}',
    '.grid{display:flex;flex-wrap:wrap;gap:var(--cm-s4)}',
    '.spec{display:flex;flex-direction:column;gap:var(--cm-s2);min-width:120px}',
    '.spec>.stage{padding:var(--cm-s4);border:1px dashed var(--cm-border);border-radius:var(--cm-r-md);display:flex;align-items:flex-start;justify-content:center;min-height:64px;position:relative}',
    '.spec>.stage.page{background:var(--cm-strip)}',
    '.spec>code{font:var(--cm-fs-meta)/1.3 ui-monospace,Menlo,monospace;color:var(--cm-text)}',
    '.spec>small{font-size:var(--cm-fs-meta);color:var(--cm-text-meta);max-width:330px}',
    /* specimens: freeze the fixed-position components into the flow */
    '.stage .pin,.stage .card,.stage aside,.stage .dock,.stage .note-banner{position:relative;left:auto;top:auto;right:auto;bottom:auto;transform:none}',
    '.stage .pin{margin:0}',
    '.stage .toast{position:relative;left:auto;bottom:auto;translate:none}',
    '.stage .quoted{background:var(--cm-selected);color:var(--cm-text)}',
    '.stage .menu{position:relative;top:auto;right:auto}',
    '.stage .thread .menu{position:absolute;top:40px;right:8px}',
    '.stage .dock{transform:none!important}',
    '.stage aside{height:300px;width:300px;transition:none}',
    '.stage aside.half{transform:translateX(35%);opacity:.9}',
    '.stage:has(aside.half){overflow:hidden}',
    '.stage .pin{flex:none}',
    '.stage .scroll{padding:0;flex:none;overflow:visible;width:290px}',
    '.stage .frozen{animation-play-state:paused!important;animation-delay:-.12s!important}',
    '.stage .leaving.frozen{animation-delay:-.05s!important}',
    '.stage .thread.short{max-height:250px}',
    '.stage .thread.adrift{margin:0;height:auto;box-shadow:var(--cm-elev-3)}',
    '.stage .ghostnote{color:var(--cm-text-hint);font-size:var(--cm-fs-meta);align-self:center}',
    '.stage .target{position:relative;padding:var(--cm-s2) var(--cm-s3);color:var(--cm-text-body)}',
    '.stage .target .wash{position:absolute;inset:0;transition:none}',
    '.stage .plain{padding:var(--cm-s2) var(--cm-s3);color:var(--cm-text-body)}',
    '.both{display:grid;grid-template-columns:1fr 1fr}'
  ].join('\n');

  function render(kit) {
    var mountAt = document.getElementById('sheet');
    /* the live tool also boots on this page; keep its launcher off the sheet (the live demo is index.html) */
    var live = document.querySelector(window.CRITTABLE_CONFIG.tagName || 'pin-note-board');
    if (live) live.style.display = 'none';
    var themes = page === 'light' || page === 'dark' ? [page] : ['light', 'dark'];
    if (themes.length === 2) mountAt.className = 'both';
    themes.forEach(function (theme) {
      var host = document.createElement('div');
      mountAt.appendChild(host);
      var root = kit.mount(host, theme);
      var css = document.createElement('style'); css.textContent = SHEET_CSS; root.appendChild(css);
      root.appendChild(sheet(kit, theme));
    });
  }

  function sheet(kit, theme) {
    var b = kit.build, ic = kit.icon;
    var who = function (id, name) { return { authorId: id, authorName: name }; };
    var A = who('u1', 'Rowan Vale'), B = who('u2', 'Ash Moor'), C = who('u3', 'Kit Lowe'), ME;
    var face = function (p) { return kit.badge(p); };
    var spec = function (name, node, note, onPage) {
      return b('div', { class: 'spec' }, b('div', { class: 'stage' + (onPage ? ' page' : '') }, node), b('code', { text: name }), note ? b('small', { text: note }) : null);
    };
    var surface = function (title) { var kids = [].slice.call(arguments, 1); return b('section', { class: 'surface' }, b('h2', { text: title }), b('div', { class: 'grid' }, kids)); };
    var none = function (t) { return b('span', { class: 'ghostnote', text: t }); };
    var withIcon = function (node, name) { node.append(ic(name)); return node; };

    /* Every specimen below is made by the product's own builders (kit.parts in pinwall.js), fed a made-up note.
       This file only chooses the note, the state, and which forced-state class to add. It builds no markup of its own. */
    var P = kit.parts, now = Date.now(), seq = 0;
    ME = who(P.me.id, P.me.name);
    var TEXT = 'Ice trays look full; add a price card near the scales.';
    var rep = function (p, text) { return { authorName: p.authorName, authorId: p.authorId, text: text, at: now - 18e5 }; };
    var note = function (o) {
      o = o || {}; var p = o.p || A;
      return { id: 'spec-' + (++seq), text: o.text || TEXT, authorName: p.authorName, authorId: p.authorId, created: now - 36e5, updated: now - 36e5,
        route: o.route || '/crittable/', resolved: !!o.resolved, replies: o.replies || [], anchor: o.quote ? { sel: { text: o.quote } } : {} };
    };
    var add = function (el, cls) { (cls || '').split(' ').filter(Boolean).forEach(function (c) { el.classList.add(c); }); return el; };

    /* LAUNCHER */
    var dock = function (cls, extra) { var d = add(P.dock(), extra); add(d.firstElementChild, cls); return d; };
    /* PIN */
    var pin = function (p, cls, unread) { return add(P.pin(note({ p: p, resolved: /\bdone\b/.test(cls || '') }), { unread: !!unread }), (cls || '').replace(/\bdone\b/, '')); };
    var draftPin = function () { return b('button', { class: 'pin draft', type: 'button', text: '+' }); };
    var openPin = function () { return P.pin(note(), { open: true }); };
    var peek = function () { var el = P.peek(note({ replies: [rep(ME, 'Agreed, will add one.'), rep(B, 'Use the chalkboard style.')] })); el.style.animation = 'none'; return el; };
    /* CARD */
    var card = function (o) {
      o = o || {};
      var own = o.editing || o.askDelete;   // only the author may edit or delete
      var t = note({ p: own ? ME : A, resolved: o.resolved, quote: o.quote, replies: o.replies || [rep(ME, 'Agreed, will add one.')] });
      var el = P.thread(t, { menu: o.menu, editing: o.editing, askDelete: o.askDelete, adrift: o.adrift, phase: o.adrift ? 'lost' : 'shown', replyText: o.replyText, entering: o.animate });
      if (o.replying) add(el.querySelector('.compose textarea'), 'is-focus');
      if (o.editing) add(el.querySelector('.editing textarea'), 'is-focus');
      return add(el, o.cls);
    };
    var icb = function (which, expanded) { var x = P.panel().querySelectorAll('header .icb')[which === 'more' ? 1 : 0]; x.setAttribute('aria-expanded', String(!!expanded)); return x; };
    /* COMPOSER */
    var composer = function (o) {
      o = o || {};
      var c = P.composer();
      add(c.field, [o.focus && 'is-focus', o.warn && 'warn'].filter(Boolean).join(' '));
      if (o.text) c.field.value = o.text;
      c.save.disabled = !o.text || !!o.saving; add(c.save, o.sendHover && 'is-hover');
      c.out.textContent = o.count || ''; c.err.textContent = o.err || '';
      return add(c.card, o.cls);
    };
    var replyField = function (focus) { var r = P.thread(note()).querySelector('.compose'); r.style.width = '280px'; if (focus) add(r.querySelector('textarea'), 'is-focus'); return r; };
    /* ROW */
    var rowLi = function (o) {
      o = o || {};
      var c = ' ' + (o.cls || '') + ' ', has = function (k) { return c.indexOf(' ' + k + ' ') >= 0; };
      var phase = has('other') ? 'other' : has('off') ? 'off' : has('lost') ? 'lost' : 'shown';
      var li = P.row(note({ p: o.p, resolved: o.resolved, quote: o.quote, text: o.text, route: has('other') ? '/crittable/rota' : null, replies: o.replies === 0 ? [] : [rep(B, 'Use the chalkboard style.')] }),
        { unread: !!o.unread, n: o.n, phase: phase, sel: has('sel'), busy: has('resolving') });
      return add(li, c.replace(/ (sel|other|off|lost|resolving) /g, ' '));
    };
    var row = function (o) { return b('div', { class: 'scroll' }, b('ul', {}, rowLi(o))); };
    /* MENU */
    var menuSpec = function (o) {
      var m = P.menu('filter'), labels = m.querySelectorAll('label'), box = m.querySelector('input[type=checkbox]');
      if (o === 'hover') add(labels[1], 'is-hover');
      if (o === 'checked') { box.checked = true; box.closest('label').setAttribute('aria-checked', 'true'); }
      var all = m.querySelector('button'); all.disabled = true; all.setAttribute('aria-disabled', 'true');   // nothing is unread on the sheet
      return m;
    };
    /* SIDEBAR */
    var side = function (o) {
      o = o || {};
      var a = P.panel(), q = a.querySelector('input[type=search]');
      a.className = (o.side || 'right') + (o.query ? ' searching' : '') + (o.loading ? ' loading' : '') + (o.failed ? ' fail' : '') + (o.half ? ' half' : '');
      if (o.query) q.value = o.query; if (o.searchFocus) add(q, 'is-focus');
      if (o.filtered) add(a.querySelector('header .icb'), 'filtered');
      var sec = a.querySelector('.listing section');
      sec.hidden = false; sec.querySelector('h3').textContent = 'This page (2)';
      sec.querySelector('ul').append(rowLi({ unread: true, text: 'Ice trays look full.', replies: 0, n: 4 }), rowLi({ p: B, text: 'Rota link should open in place.', replies: 0, n: 3 }));
      a.querySelector('.empty').hidden = true;
      return a;
    };
    /* EMPTY */
    var empty = function (kind, share) { return b('div', { class: 'scroll' }, P.empty(kind, share)); };

    return b('div', { class: 'sheet' },
      b('h1', { text: 'State sheet: ' + theme }),
      b('p', { text: 'Every state from spec/GLOSSARY.md, drawn with the live stylesheet and tokens (spec/DESIGN.md). Hover, press and focus are forced with is-hover / is-pressed / is-focus; transitions are frozen mid-tween.' }),
      surface('1. Launcher',
        spec('LAUNCHER.Rest', dock()), spec('LAUNCHER.Hover', dock('is-hover'), 'lifts 2px, deeper shadow (fast)'),
        spec('LAUNCHER.Pressed', dock('is-pressed')), spec('LAUNCHER.Armed', dock('on')), spec('LAUNCHER.ArmedHover', dock('on is-hover')),
        spec('LAUNCHER.Dragging', dock('', 'dragging'), 'tweens off, strongest shadow, grabbing cursor'),
        spec('LAUNCHER.Shifted', dock('', ''), 'keeps its distance from the panel edge; slides with the panel'),
        spec('LAUNCHER.Hidden', none('not drawn'), 'hide-launcher setting; shortcut still works'),
        spec('LAUNCHER.Focus', dock('is-focus'))),
      surface('2. Placing mode',
        spec('PLACING.Off', b('span', { class: 'plain', text: 'Host element' }), 'normal cursor', true),
        spec('PLACING.On', dock('on'), 'the cursor is the pin, tip on the hotspot; plus turns to a cancel mark', true),
        spec('PLACING.TargetHint', b('span', { class: 'target', text: 'Host element' }, kit.parts.wash()), 'highlighter wash over the element, in our own layer; fades in, travels to the next (fast)', true),
        spec('PLACING.WideTarget', b('span', { class: 'plain', text: 'Host element' }), 'the wash thins as the target grows; at three tenths of the view there is none, and the note is pinned to the spot', true),
        spec('PLACING.Selecting', b('span', { class: 'plain', text: 'Host element' }), 'no wash: the words being dragged over carry the highlighter, on the host page itself'),
        spec('PLACING.OverOwnUI', dock('on is-hover'), 'normal cursor, no wash', true),
        spec('PLACING.Draft', draftPin(), 'draft pin + COMPOSER.NewOpen', true),
        spec('PLACING.Moving', card({ menu: true }), '"Move pin" in the note\'s menu: then the cursor of PLACING.On, and the next spot chosen is the note\'s place')),
      surface('3. Pin',
        spec('PIN.Draft', draftPin(), 'drops onto the spot and settles', true), spec('PIN.Rest', pin(A), 'avatar in a highlighter frame; the sharp corner is the anchor', true),
        spec('PIN.RestUnread', pin(B, '', true), null, true), spec('PIN.Preview', peek(), 'the pin itself, grown: first message over the reply row a click opens', true),
        spec('PIN.Open', openPin(), 'as drawn when the card is a phone sheet; beside a card the pin rides inside the bubble as the face', true), spec('PIN.Lifted', pin(C, 'lifted'), null, true),
        spec('PIN.Muted', pin(C, 'done'), null, true), spec('PIN.Lost', none('not drawn; the row says why'), null, true),
        spec('PIN.OutOfSight', none('not drawn; drawn while its note is open'), null, true), spec('PIN.Offstage', none('not visible; row shows it'), null, true), spec('PIN.Concealed', none('not drawn'), null, true),
        spec('PIN.Pointed', pin(A, 'hot'), 'its list row is hovered: lifts, highlighter ring', true),
        spec('PIN.Quoted', b('span', { class: 'plain' }, b('span', { text: 'Morning catch, ' }), b('span', { class: 'quoted', text: 'laid out on ice' })), 'the words a note is anchored to keep a highlighter wash', true)),
      surface('4. Thread card',
        spec('CARD.Closed', none('not on screen')),
        spec('CARD.Entering', card({ animate: true, cls: 'frozen' }), 'as the missing-pin dialog arrives: a fade. Beside a pin the bubble grows instead; on a phone the sheet slides up'),
        spec('CARD.Reading', card()), spec('CARD.ReadingResolved', card({ resolved: true })),
        spec('CARD.Replying', card({ replying: true, replyText: 'Price card is up' })),
        spec('CARD.Editing', card({ editing: true, replies: [] }), 'the reply row waits while a note is edited'),
        spec('CARD.MenuOpen', card({ menu: true })),
        spec('CARD.ConfirmDelete', card({ askDelete: true, replies: [] })),
        spec('CARD.Leaving', card({ animate: true, cls: 'leaving frozen' }), 'reverse of Entering, a little quicker'),
        spec('CARD.Overflowing', card({ cls: 'short', replies: [rep(ME, 'Agreed, will add one.'), rep(B, 'Use the chalkboard style.'), rep(C, 'Done before noon.'), rep(ME, 'Thanks all.')] }), 'body scrolls; slim scrollbar on hover'),
        spec('CARD.Repositioning', card(), 'tracks the pin on scroll/resize; no visual change'),
        spec('CARD.Walked', card({ quote: 'laid out on ice' }), 'opened with J or K: focus sits on the card so the keys keep stepping; header quotes the anchored words'),
        spec('CARD.UndoOffered', P.toast(4), 'five seconds, bottom centre, fixed colours', true),
        spec('CARD.Sheet', card({ cls: 'is-sheet' }), 'under 520px wide the card docks to the bottom edge and slides up from it; all corners round, no sharp one'),
        spec('CARD.Adrift', card({ adrift: true }), 'no pin to open from: a centred dialog over a dimmed page, no sharp corner')),
      surface('5. Composer',
        spec('COMPOSER.NewOpen', composer()), spec('COMPOSER.Idle', replyField(false)), spec('COMPOSER.Focused', composer({ focus: true })),
        spec('COMPOSER.Ready', composer({ focus: true, text: 'Price card missing' })),
        spec('COMPOSER.SendHover', composer({ focus: true, text: 'Price card missing', sendHover: true })),
        spec('COMPOSER.Empty-Rejected', composer({ warn: true, err: 'A note cannot be empty.' }), 'warning flash, fast on, slow fade off; the line says why'),
        spec('COMPOSER.TooLong', composer({ cls: 'toolong', text: 'A very long note…', count: '1000 / 1000' })),
        spec('COMPOSER.Saving', composer({ cls: 'saving', text: 'Price card missing', saving: true })),
        spec('COMPOSER.SaveFailed', composer({ cls: 'failed', text: 'Price card missing', err: 'Could not save this note. Try again.' })),
        spec('COMPOSER.Dismissed', none('bar gone'))),
      surface('6. Sidebar panel',
        spec('SIDEBAR.Closed', none('off-screen')), spec('SIDEBAR.Opening', side({ half: true }), 'slides from the docked edge (medium)'),
        spec('SIDEBAR.Open', side()), spec('SIDEBAR.Closing', side({ half: true }), 'slides out; launcher returns'),
        spec('SIDEBAR.OpenLeft / SIDEBAR.OpenRight', side({ side: 'left' }), 'mirror image; right shown under SIDEBAR.Open'),
        spec('SIDEBAR.Searching', side({ query: 'rota', searchFocus: true })), spec('SIDEBAR.Filtered', side({ filtered: true }), 'dot on the filter button'),
        spec('SIDEBAR.Alias', P.you(false), 'foot of the panel while someone writes under a made-up name'), spec('SIDEBAR.Naming', P.you(true), 'the same foot, changed in place'),
        spec('SIDEBAR.ReadOnly', P.reading(), 'foot of the panel for someone who may only read'),
        spec('SIDEBAR.Loading', side({ loading: true })), spec('SIDEBAR.LoadFailed', side({ failed: true }))),
      surface('7. Sidebar row',
        spec('ROW.Rest', row({ unread: false })), spec('ROW.Hover', row({ cls: 'is-hover' })),
        spec('ROW.Selected', row({ cls: 'sel', quote: 'opening rota' }), 'toggles show; a note pinned to selected words is headed by them'), spec('ROW.Unread', row({ unread: true, p: B })),
        spec('ROW.UnreadFading', row({ unread: true, p: B, cls: 'is-hover' }), 'dot fades while hovered or selected'),
        spec('ROW.Resolved', row({ resolved: true, p: C })), spec('ROW.OtherPage', row({ cls: 'other', n: 1 })),
        spec('ROW.Offscreen', row({ cls: 'off' })), spec('ROW.Lost', row({ cls: 'lost' })), spec('ROW.Pointed', row({ cls: 'hot' }), 'its pin is hovered'),
        spec('ROW.Resolving', row({ cls: 'resolving' }), 'toggle inert while the write is in flight'),
        spec('ROW.Focus', (function () { var r = row(); r.querySelector('.pick').classList.add('is-focus'); return r; })()),
        spec('ROW.Entering / ROW.Leaving', b('div', {}, row({ cls: 'entering frozen' }), row({ cls: 'leaving frozen', p: B })), 'fade and slide a few px (fast)')),
      surface('8. Menus',
        spec('MENU.Closed', icb('filter', false)), spec('MENU.Open', b('div', {}, icb('filter', true), menuSpec())),
        spec('MENU.ItemRest', menuSpec()), spec('MENU.ItemHover', menuSpec('hover')),
        spec('MENU.ItemActiveChoice', menuSpec(), '"Newest first": filled dot + wash'),
        spec('MENU.ItemChecked', menuSpec('checked')), spec('MENU.ItemDisabled', menuSpec(), '"Mark all as read" with nothing unread'),
        spec('MENU.Theme', P.menu('more'), 'last row: a sun, a moon or a screen, and the choice named at the trailing edge'),
        spec('MENU.ShareLink', P.menu('share'), 'only when the store keeps notes among people who hold a link'),
        spec('MENU.ShareCopied', P.menu('copied'), 'the item says so for two seconds; the menu stays open'),
        spec('MENU.Shortcuts', P.menu('more'), '"Keyboard shortcuts": off, the single-letter keys do nothing')),
      surface('9. Empty and error states',
        spec('EMPTY.NoThreads', empty('NoThreads')),
        spec('EMPTY.NoThreadsShare', empty('NoThreads', true), 'with a link to share: sending it is the other next step'),
        spec('EMPTY.AllHidden', empty('AllHidden'), 'offers "Show resolved" when resolved notes are the cause'),
        spec('EMPTY.NoMatch', empty('NoMatch')),
        spec('EMPTY.SectionOmitted', none('section heading absent')), spec('EMPTY.NoPageThreads', none('"This page" section absent')),
        spec('EMPTY.NoteBlank', composer({ warn: true, err: 'A note cannot be empty.' }), 'see COMPOSER.Empty-Rejected'),
        spec('EMPTY.StorageFailed', P.banner('Saved notes could not be loaded.'))));
  }

  var base = Object.assign({}, window.CRITTABLE_CONFIG || {});
  window.CRITTABLE_CONFIG = Object.assign(base, { storagePrefix: 'crittable-sheet', productName: base.productName || 'Crittable', stateSheet: render });
  if (page === 'light' || page === 'dark') { try { localStorage.setItem('crittable-sheet.theme', JSON.stringify(page)); } catch (_) { /* ignore */ } }
})();
