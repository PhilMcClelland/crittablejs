/* Crittable.js store: a tiny key/value storage layer.
   window.CrittableStore.open(prefix[, medium]) -> { get, set, remove, keys, clear, persistent }
   Values are JSON-encoded under "<prefix>.<key>". `medium` is any object with
   getItem/setItem/removeItem/key/length (defaults to localStorage); if it is missing or
   throws, data is kept in memory for the page's lifetime and persistent is false.
   See spec/STORAGE.md. */
(function (root) {
  'use strict';
  function probe(m, p) {
    try { m.setItem(p + '.probe', '1'); m.removeItem(p + '.probe'); return true; } catch (_) { return false; }
  }
  function open(prefix, medium) {
    var pre = String(prefix || 'crittable') + '.', mem = {}, m = medium;
    if (m === undefined) { try { m = root.localStorage; } catch (_) { m = null; } }
    var live = !!m && probe(m, pre.slice(0, -1));
    function names() {
      var out = [], i, n;
      if (!live) { for (n in mem) out.push(n); return out; }
      for (i = 0; i < m.length; i++) { n = m.key(i); if (n && n.indexOf(pre) === 0) out.push(n.slice(pre.length)); }
      return out;
    }
    return {
      persistent: live,
      get: function (k, dflt) {
        var raw = live ? m.getItem(pre + k) : mem[k];
        if (raw == null) return dflt;
        try { return JSON.parse(raw); } catch (_) { return dflt; }
      },
      set: function (k, v) {
        var raw = JSON.stringify(v);
        if (live) { try { m.setItem(pre + k, raw); return; } catch (_) { live = false; } }
        mem[k] = raw;
      },
      remove: function (k) { if (live) m.removeItem(pre + k); delete mem[k]; },
      keys: names,
      clear: function () { var self = this; names().forEach(function (k) { self.remove(k); }); }
    };
  }
  var api = { open: open };
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.CrittableStore = api;
})(typeof window !== 'undefined' ? window : globalThis);
