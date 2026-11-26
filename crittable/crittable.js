/* Crittable.js: one-line loader. Add a single tag to any page:
     <script src="path/to/crittable.js"></script>
   It loads config.js (unless window.CRITTABLE_CONFIG is already set), store.js and pinwall.js from the
   same folder, in order. Optional attributes on the tag: data-config="url" to use another
   config file, data-no-config to skip config loading, data-backend to share notes (see backends/). Nothing is
   fetched from anywhere but this folder, except the settings file when data-config names another. */
(function () {
  'use strict';
  if (window.__crittableLoader) return;
  window.__crittableLoader = true;
  /* A page's own markup can stand in for document.currentScript (an <img name="currentScript">, say), and whatever
     folder that pointed at would be loaded from. So it counts only when it is a script tag; else find the tag by name. */
  var me = document.currentScript;
  if (!(me instanceof HTMLScriptElement)) me = null;
  if (!me || !me.src) {
    var all = Document.prototype.getElementsByTagName.call(document, 'script');   // asked of the prototype, which markup cannot stand in for
    for (var i = all.length - 1; i >= 0; i--) {
      if (/(^|\/)crittable\.js(\?|#|$)/.test(all[i].src)) { me = all[i]; break; }
    }
  }
  if (!me || !me.src) return;
  var base = me.src.replace(/[?#].*$/, '').replace(/[^\/]*$/, '');
  function load(url) {
    return new Promise(function (ok, fail) {
      var s = document.createElement('script');
      s.src = url; s.async = false;
      s.onload = ok;
      s.onerror = function () { fail(new Error('crittable: could not load ' + url)); };
      (document.head || document.documentElement).appendChild(s);
    });
  }
  var cfg = me.getAttribute('data-config') || base + 'config.js';
  var steps = (window.CRITTABLE_CONFIG || me.hasAttribute('data-no-config')) ? [] : [cfg];
  /* data-backend shares notes through a store adapter in backends/. "persistable" is the one that comes with the tool:
     Persistable.js, with data-url, and optionally data-key="link" to keep the notes among people who have the page's
     link. Persistable.js keeps its objects in a Cloudflare Worker unless data-store names another of its stores:
     data-store="supabase" takes data-url and data-api-key (the project's publishable key). data-space is optional.
     The adapter is a file in this same folder tree, like everything else the loader fetches. */
  var be = me.getAttribute('data-backend'), shared = steps.length;   // what is added to steps from here on is the store's
  /* a name that cannot be a file here is said out loud: ignored without a word, notes would stay in this browser and a check
     made in one browser would look like it worked */
  if (be && !/^[a-z0-9-]+$/.test(be) && window.console) console.warn('crittable: data-backend="' + be + '" is not a store name (lower-case letters, digits and "-", such as "persistable"). Notes will stay in this browser.');
  if (be && /^[a-z0-9-]+$/.test(be)) {
    window.CRITTABLE_BACKEND = { name: be, url: me.getAttribute('data-url'), key: me.getAttribute('data-key'), space: me.getAttribute('data-space'), poll: me.getAttribute('data-poll'), read: me.getAttribute('data-read') || undefined, store: me.getAttribute('data-store') || undefined, apiKey: me.getAttribute('data-api-key') || undefined };
    var kind = window.CRITTABLE_BACKEND.store;
    /* a store of Persistable.js's that is not the Worker is a file of its own, loaded after the client */
    if (be === 'persistable' && kind && kind !== 'worker' && !/^[a-z0-9-]+$/.test(kind)) { if (window.console) console.warn('crittable: data-store="' + kind + '" is not a store name. Notes will stay in this browser.'); be = null; }
    if (be === 'persistable') { steps.push(base + 'vendor/persistable.js'); if (kind && kind !== 'worker') steps.push(base + 'vendor/persistable-' + kind + '.js'); }   // the client that adapter is built on, then the store
    if (be) steps.push(base + 'backends/' + be + '.js');
  }
  /* A store's files that will not load (a name with no file here, say) must not take the tool with them: say so, and
     go on with notes kept in this browser. */
  var chain = function (list) { return list.reduce(function (p, u) { return p.then(function () { return load(u); }); }, Promise.resolve()); };
  chain(steps.slice(0, shared)).then(function () {
    return chain(steps.slice(shared)).catch(function (e) { window.CRITTABLE_BACKEND = undefined; if (window.console) console.warn(e.message + '. Notes will stay in this browser.'); });
  }).then(function () { return chain([base + 'store.js', base + 'pinwall.js']); })
    .catch(function (e) { if (window.console) console.warn(e.message); });
})();
