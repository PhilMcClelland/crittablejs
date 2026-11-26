// Runs the real Persistable.js Worker (tests/vendor/persistable_worker.js, an unchanged copy from the persistablejs repo) in Node with a stand-in for Cloudflare's storage, for tests.
// It exercises the Worker's own rules; what it cannot check is Cloudflare itself (deploying, the WebSocket).
import worker, { Space } from './vendor/persistable_worker.js';
const spaces = new Map();
function storage() {
  const m = new Map(), copy = v => (v === undefined ? undefined : structuredClone(v));
  return {
    get: async k => copy(m.get(k)),
    put: async (k, v) => { m.set(k, copy(v)); },
    delete: async k => { for (const x of [].concat(k)) m.delete(x); },
    list: async ({ prefix = '' } = {}) => new Map([...m].filter(([k]) => k.startsWith(prefix)).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => [k, copy(v)]))
  };
}
const env = {
  SPACES: {
    idFromName: name => name,
    get: name => { if (!spaces.has(name)) spaces.set(name, new Space({ storage: storage() })); return spaces.get(name); }
  }
};
export default function mockFetch(url, init = {}) { return worker.fetch(new Request(url, init), env); }
