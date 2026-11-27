/* Crittable.js store adapter: Persistable.js.
   Notes are shared between everyone who opens the prototype, through a Persistable.js store the host has set up
   (see backends/persistable/SETUP.md): a Cloudflare Worker, or a Supabase project. No sign-in to do: each browser is
   its own person, with a made-up name it can change. The loader loads the Persistable.js client
   (crittable/vendor/persistable.js, an unchanged copy from the persistablejs repo) before this file, and for a store
   other than the Worker that store's file after the client.

   Options (from the loader's script tag, or window.CRITTABLE_BACKEND before this file runs):
     url    the store's address
     store  which of Persistable.js's stores: "worker" unless set. "supabase" takes apiKey (the publishable key) too,
            and has no key or read: notes there are open to anyone who has the page.
     space  which set of notes this page belongs to. Defaults to the page's origin.
     key    "link": only people who open the page's link reach the notes (the key rides after the # in it; the first
            visitor's address bar becomes the link). Or a fixed key, for a page that is itself behind a sign-in.
            Without one, anyone who finds the store can read and add. See docs/access.md in the persistablejs repository.
     read   a read key, for a public page: everyone who opens it sees the notes, and only people whose link carries the
            key (use key: "link" with it) can add or change them. `node readkey.mjs --new` in the persistablejs repo makes a pair.
     poll   how often to ask while the live connection is down, in ms (default 4000)
     tokenUrl  an address on the page's own site that answers with a Persistable.js token for the visitor it has let
            in (docs/access.md in the persistablejs repository). The token says which space they are in, who they
            are, and whether they may write, so it goes with no key, read or space. The Worker only. It is asked with
            the site's own cookies. A visitor the site turns away (401 or 403) keeps their notes in their own
            browser, and nothing is said about it. Or `token`, a function that returns one, for a page that sets
            the backend up itself: then use CrittablePersistable(opt).ready(), which resolves to the backend. */
(function (root) {
  'use strict';
  /* notes and replies are objects in one collection; a reply's parent is its note. Each person's name is one object
     in a second collection, so a name changed once shows on everything they have written */
  var PEOPLE = 'crittable-people';
  var nameOf = function (v) { return typeof v === 'string' ? v.trim().slice(0, 80) : ''; };
  /* a place says how to find its element: a kind and a value, both words. Anything less is not a place */
  var isPlace = function (a) { return !!a && typeof a === 'object' && !Array.isArray(a) && typeof a.k === 'string' && typeof a.v === 'string' && !!a.k && !!a.v; };
  function backend(opt) {
    if (typeof root.Persistable !== 'function') throw new Error('crittable persistable: the Persistable.js client is not loaded');
    /* the attribute with nothing in it (a template whose value came out empty) still says a token was meant */
    if (opt.tokenUrl != null && !opt.token) { if (!String(opt.tokenUrl).trim()) throw new Error('crittable persistable: data-token-url is empty'); opt = Object.assign({}, opt, { token: tokenFrom(String(opt.tokenUrl).trim()) }); }
    /* the loader hands over every attribute, set or not: with a token, the ones it replaces must be absent, not empty */
    if (opt.token) { opt = Object.assign({}, opt); ['key', 'read', 'space'].forEach(function (k) { if (opt[k] == null || opt[k] === '') delete opt[k]; }); }
    var db = root.Persistable(opt), notes = db.collection('crittable'), people = db.collection(PEOPLE);
    /* an older client would not know the option, and would quietly use the open space named after the page */
    if (opt.token && typeof db.ready !== 'function') throw new Error('crittable persistable: this copy of the Persistable.js client is too old for tokens');
    /* Names, by the store's `owner`: the one thing about an object its writer cannot choose. A person object only ever
       names whoever created it, so nobody can rename someone else; a note's own copy of the name is kept, and shown
       when its writer has no person object (a note from before 0.3.0, say). Two objects for one person (two tabs made
       one each at once) is not an error: the newer says. `mine` is this browser's id once the store has said it, and
       `pending` a name it is saving just now, shown at once so a reload in between does not put the old one back. */
    var named = Object.create(null), mine = null, pending = null;
    function learn(rows) {
      var seen = Object.create(null);
      rows.forEach(function (o) {
        try {
          var n = nameOf(o.data.name), was = seen[o.owner];
          if (!n || typeof o.owner !== 'string' || typeof o.id !== 'string') return;
          var at = Number(o.updated) || 0;
          if (!was || at > was.at || (at === was.at && o.id > was.id)) seen[o.owner] = { id: o.id, name: n, at: at };
        } catch (_) { /* not a person: left out */ }
      });
      named = seen;
    }
    function person(o) {
      var p = { authorId: o.owner, authorName: o.data.authorName }, n = pending !== null && o.owner === mine ? pending : named[o.owner] && named[o.owner].name;
      if (n) p.authorName = n;
      if (o.data.authorAvatar) p.authorAvatar = o.data.authorAvatar;
      return p;
    }
    var whoAmI = function () { return mine ? Promise.resolve({ id: mine }) : db.me().then(function (me) { if (me && typeof me.id === 'string') mine = me.id; return me; }); };
    function threads(rows) {
      /* Rows are whatever other people stored, so nothing about them is taken on trust. byId has no prototype: an id such as
         "constructor" finds only what was put there. A reply is attached only to a note (one whose parent is a reply, or is
         missing, is left out). Each row is read on its own, so a bad one costs only itself, never the load. */
      var byId = Object.create(null), list = [], found = [];
      rows.forEach(function (o) {
        try {
          if (!o || o.parent) return;
          var th = Object.assign({ v: o.data.v || 1, id: o.id, text: o.data.text, created: o.data.created, updated: o.open.updated || o.data.created, route: o.data.route, anchor: isPlace(o.open.anchor) ? o.open.anchor : o.data.anchor,   /* the place anyone may move; if someone has blanked it, the place the author gave */ resolved: !!o.open.resolved, replies: [] }, person(o));
          if (o.data.edited != null) th.edited = o.data.edited;
          byId[o.id] = th; list.push(th);
        } catch (_) { /* not a note: left out */ }
      });
      rows.forEach(function (o) {
        try {
          var th = o && o.parent ? byId[o.parent] : null;
          if (!th) return;
          var rep = Object.assign({ v: o.data.v || 1, id: o.id, text: o.data.text, at: o.data.at }, person(o));
          if (o.data.edited != null) rep.edited = o.data.edited;
          found.push({ th: th, rep: rep });
        } catch (_) { /* not a reply: left out */ }
      });
      found.sort(function (a, b) { return a.rep.at - b.rep.at; }).forEach(function (f) {
        f.th.replies.push(f.rep);
        f.th.updated = Math.max(f.th.updated, f.rep.at, f.rep.edited || 0);   // a reply is news: it makes the note unread for everyone else
      });
      return list.sort(function (a, b) { return a.created - b.created; });
    }
    /* the words are the author's; resolved, the pin's place and the "newer" stamp are anyone's */
    function split(p) {
      var data = {}, open = {}, parts = {};
      if ('text' in p) data.text = p.text;
      if ('edited' in p) data.edited = p.edited;
      if ('resolved' in p) open.resolved = !!p.resolved;
      if ('anchor' in p) { if (!isPlace(p.anchor)) throw new Error('crittable persistable: a note keeps a place'); open.anchor = p.anchor; }
      open.updated = p.updated || Date.now();
      if (Object.keys(data).length) parts.data = data;
      parts.open = open;
      return parts;
    }
    var who = function (x) { var d = { v: x.v || 1, text: x.text, authorName: x.authorName }; if (x.authorAvatar) d.authorAvatar = x.authorAvatar; return d; };
    var out = {
      shared: true,
      /* the page carries a read key and this visitor's link carries no key: they may look, and nothing else */
      readOnly: !!db.readOnly,
      poll: Number(opt.poll) || 4000,
      space: db.space,
      /* who the store says this is. The id is the store's. A name comes only with a token, and is passed on only when it
         is the name the page already has for the visitor (set below from the token, or by the page itself): otherwise
         it would replace, at every load, a name the visitor chose or the page gave */
      whoami: function () { return db.me().then(function (me) { if (me && typeof me.id === 'string') mine = me.id; if (me && 'name' in me && !(root.CRITTABLE_USER && root.CRITTABLE_USER.name === me.name)) { me = Object.assign({}, me); delete me.name; } return me; }); },
      /* is the store answering? Passed straight on from the client, when the client is new enough to say */
      status: function (fn) { return typeof db.onStatus === 'function' ? db.onStatus(fn) : function () {}; },
      /* with a key, the address to send people so they reach these notes; null without one */
      link: function () { return db.link(); },
      /* the client says when something changed (pushed by the Worker; asked for, every `poll` ms, on a store that cannot push); while its line is down, ask every `poll` ms instead */
      watch: function (onChange) {
        var up = false, ask = setInterval(function () { if (!up) onChange(); }, Number(opt.poll) || 4000);
        var stop = db.watch(function (name) { if (name === null || name === 'crittable' || name === PEOPLE) onChange(); }, function (state) { up = state; });
        return function () { clearInterval(ask); stop(); };
      },
      /* names are asked for beside the notes; a store that cannot say them still shows the notes, under the names they carry */
      load: function () {
        return Promise.all([notes.list(), people.list().then(null, function () { return null; })]).then(function (got) {
          if (Array.isArray(got[1])) learn(got[1]);
          return threads(Array.isArray(got[0]) ? got[0] : []);
        });
      },
      /* this person's name, on everything they have written: their one person object changed, or made if they have none.
         Nothing is sent when the store already has it. Call it after a load, which is how the adapter knows what is there. */
      setName: function (name) {
        var n = nameOf(name);
        if (!n) return Promise.resolve();
        return whoAmI().then(function () {
          if (!mine) return;
          var had = named[mine];
          if (had && had.name === n && pending === null) return;
          pending = n;
          var done = function (o) {
            if (pending === n) pending = null;
            if (o && typeof o.id === 'string') named[mine] = { id: o.id, name: n, at: Number(o.updated) || Date.now() };
          };
          return (had ? people.update(had.id, { v: 1, name: n }) : people.create({ v: 1, name: n })).then(done, function (e) { if (pending === n) pending = null; throw e; });
        });
      },
      create: function (th) { return notes.create(Object.assign(who(th), { route: th.route, created: th.created, anchor: th.anchor }),   /* the author's own copy of the place, which only they can change */ { id: th.id, open: { anchor: th.anchor, resolved: false, updated: th.updated } }); },
      update: function (id, patch) { return notes.patch(id, split(patch)); },
      remove: function (id) { return notes.remove(id); },
      addReply: function (id, r) { return notes.create(Object.assign(who(r), { at: r.at }), { id: r.id, parent: id }); },
      updateReply: function (id, rid, patch) { return notes.patch(rid, split(patch)); },
      removeReply: function (id, rid) { return notes.remove(rid); }
    };
    /* With a token, what the visitor may do and what the site calls them are known only once the first token is in.
       ready() waits for that and resolves to this backend; it rejects if the site hands over no token. All of it is
       in the token, so the store is not asked: one that is slow or down just now does not hold the tool up.
       `named` is the site's name for the visitor, or null: a page that sets the backend up itself puts it in
       CRITTABLE_USER.name before the tool loads. */
    out.ready = function () {
      if (typeof db.ready !== 'function') return Promise.resolve(out);
      return db.ready().then(function () {
        out.readOnly = !!db.readOnly; out.space = db.space;
        out.named = (typeof db.name === 'string' && db.name.trim()) || null;
        return out;
      });
    };
    return out;
  }
  /* a token from the page's own site: asked with its cookies, and never from a cache */
  function tokenFrom(address) {
    /* the page's own site and no other: the visitor's cookies are what the answer depends on, and another site would be
       handed nothing to go on and trusted with which notes this visitor sees */
    var loc = root.location, mine = function (u) { try { var a = new root.URL(u, (root.document && root.document.baseURI) || loc.href); return /^https?:$/.test(a.protocol) && a.origin === loc.origin; } catch (_) { return false; } };
    if (!loc || typeof root.URL !== 'function' || !mine(address)) throw new Error('crittable persistable: data-token-url is an address on the page\'s own site');
    return function () {
      return root.fetch(address, { credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'text/plain' } }).then(function (r) {
        /* and it has to have stayed there: an answer that came from somewhere else, by a redirect, is not the site's */
        if (r.url && !mine(r.url)) throw new Error('crittable persistable: the token address sent the browser to another site');
        if (!r.ok) { var e = new Error('crittable persistable: the token address answered ' + r.status); e.status = r.status; throw e; }
        return r.text();
      });
    };
  }
  root.CrittablePersistable = backend;
  /* in a page: build the backend from the loader's options and hand it to the tool */
  var opt = root.CRITTABLE_BACKEND;
  if (opt && opt.name === 'persistable') {
    var use = function (b) { root.CRITTABLE_CONFIG = Object.assign(root.CRITTABLE_CONFIG || {}, { backend: b }); };
    var local = function (e) { if (root.console) root.console.warn(((e && e.message) || 'crittable persistable: the store could not be set up') + '. Notes will stay in this browser.'); };
    /* The tag itself is asked as well as the loader: a loader from before tokens (an older copy, kept by a cache) passes
       no token address on, and would have these notes shared in the open space named after the page. */
    var tag = null;
    try { tag = root.document && root.document.querySelector ? root.document.querySelector('script[data-token-url]') : null; } catch (_) { tag = null; }
    try {
      if (opt.tokenUrl == null && tag) throw new Error('crittable persistable: the page asks for data-token-url and crittable.js is an older copy that does not know it (load the page again without the cache)');
      var made = backend(opt);
      if (opt.tokenUrl == null) use(made);
      else {
        /* The loader waits for this before it starts the tool, so the tool starts knowing who the visitor is and what
           they may do. It always resolves: a site that does not answer in time must not keep the tool off the page. */
        var timer = null, late = new Promise(function (_, fail) { timer = setTimeout(function () { fail(new Error('crittable persistable: the token address did not answer in time')); }, 8000); });
        var first = made.ready(), tidy = function () { clearTimeout(timer); };
        first.then(tidy, tidy);
        root.CRITTABLE_BACKEND_READY = Promise.race([first, late]).then(function (b) {
          /* the site's name for the visitor, unless the page has given one itself. Set the way a page sets it, so the
             tool does not offer a name field for a name that is not the visitor's to choose. */
          use(b);
          var given = root.CRITTABLE_USER && typeof root.CRITTABLE_USER.name === 'string' && root.CRITTABLE_USER.name.trim();
          if (b.named && !given) root.CRITTABLE_USER = Object.assign({}, root.CRITTABLE_USER, { name: b.named });
        }, function (e) {
          /* the site let this visitor in to the page and not to the notes: that is its answer, not a fault */
          if (!(e && (e.status === 401 || e.status === 403))) local(e);
        });
      }
    } catch (e) {
      local(e);
      if (opt.tokenUrl != null) root.CRITTABLE_BACKEND_READY = Promise.resolve();   // said already: the loader has nothing to add
    }
  }
})(typeof window !== 'undefined' ? window : globalThis);
