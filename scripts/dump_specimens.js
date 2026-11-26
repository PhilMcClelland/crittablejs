/* Dumps every specimen on sample/states.html to JSON, the input of build_ds_previews.js.
   Run: PLAYWRIGHT_CORE=<path to playwright-core> node scripts/dump_specimens.js <out.json> */
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
(async () => {
  const b = await chromium.launch({ channel: 'chrome', headless: true });
  const c = await b.newContext({ viewport: { width: 1400, height: 900 }, colorScheme: 'light' }); const p = await c.newPage();
  await p.goto('file://' + require('path').join(__dirname, '..') + '/sample/states.html?theme=light'); await p.waitForTimeout(700);
  const dump = await p.evaluate(() => { const roots = []; const walk = r => { roots.push(r); for (const e of r.querySelectorAll('*')) if (e.shadowRoot) walk(e.shadowRoot); }; walk(document);
    const out = []; for (const r of roots) for (const s of r.querySelectorAll('section.surface')) out.push({ title: s.querySelector('h2').textContent, specs: [...s.querySelectorAll('.spec')].map(x => { const st = x.querySelector('.stage'), q = st.getBoundingClientRect(); return { code: x.querySelector('code').textContent, note: (x.querySelector('small') || {}).textContent || '', cls: st.className, w: Math.ceil(q.width), h: Math.ceil(q.height), html: st.innerHTML }; }) });
    return out; });
  require('fs').writeFileSync(process.argv[2], JSON.stringify(dump));
  console.log(dump.length, 'surfaces,', dump.reduce((n, s) => n + s.specs.length, 0), 'specs'); await c.close(); await b.close();
})();
