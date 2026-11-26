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
     poll   how often to ask while the live connection is down, in ms (default 4000) */
(function (root) {
  'use strict';
  /* notes and replies are objects in one collection; a reply's parent is its note */
  /* a place says how to find its element: a kind and a value, both words. Anything less is not a place */
  var isPlace = function (a) { return !!a && typeof a === 'object' && !Array.isArray(a) && typeof a.k === 'string' && typeof a.v === 'string' && !!a.k && !!a.v; };
  function backend(opt) {
    if (typeof root.Persistable !== 'function') throw new Error('crittable persistable: the Persistable.js client is not loaded');
    var db = root.Persistable(opt), notes = db.collection('crittable');
    function person(o) { var p = { authorId: o.owner, authorName: o.data.authorName }; if (o.data.authorAvatar) p.authorAvatar = o.data.authorAvatar; return p; }
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
    return {
      shared: true,
      /* the page carries a read key and this visitor's link carries no key: they may look, and nothing else */
      readOnly: !!db.readOnly,
      poll: Number(opt.poll) || 4000,
      space: db.space,
      whoami: function () { return db.me(); },
      /* is the store answering? Passed straight on from the client, when the client is new enough to say */
      status: function (fn) { return typeof db.onStatus === 'function' ? db.onStatus(fn) : function () {}; },
      /* with a key, the address to send people so they reach these notes; null without one */
      link: function () { return db.link(); },
      /* the client says when something changed (pushed by the Worker; asked for, every `poll` ms, on a store that cannot push); while its line is down, ask every `poll` ms instead */
      watch: function (onChange) {
        var up = false, ask = setInterval(function () { if (!up) onChange(); }, Number(opt.poll) || 4000);
        var stop = db.watch(function (name) { if (name === null || name === 'crittable') onChange(); }, function (state) { up = state; });
        return function () { clearInterval(ask); stop(); };
      },
      load: function () { return notes.list().then(function (rows) { return threads(Array.isArray(rows) ? rows : []); }); },
      create: function (th) { return notes.create(Object.assign(who(th), { route: th.route, created: th.created, anchor: th.anchor }),   /* the author's own copy of the place, which only they can change */ { id: th.id, open: { anchor: th.anchor, resolved: false, updated: th.updated } }); },
      update: function (id, patch) { return notes.patch(id, split(patch)); },
      remove: function (id) { return notes.remove(id); },
      addReply: function (id, r) { return notes.create(Object.assign(who(r), { at: r.at }), { id: r.id, parent: id }); },
      updateReply: function (id, rid, patch) { return notes.patch(rid, split(patch)); },
      removeReply: function (id, rid) { return notes.remove(rid); }
    };
  }
  root.CrittablePersistable = backend;
  /* in a page: build the backend from the loader's options and hand it to the tool */
  var opt = root.CRITTABLE_BACKEND;
  if (opt && opt.name === 'persistable') {
    try { root.CRITTABLE_CONFIG = Object.assign(root.CRITTABLE_CONFIG || {}, { backend: backend(opt) }); }
    catch (e) { if (root.console) root.console.warn(e.message + '. Notes will stay in this browser.'); }
  }
})(typeof window !== 'undefined' ? window : globalThis);
