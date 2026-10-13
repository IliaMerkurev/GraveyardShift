#!/usr/bin/env node
/** One portrait, emulated-touch production check. No app hooks or state mutation. */
import { mkdir, writeFile, stat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const HELP = `node scripts/production-touch-bomb-smoke.mjs PLAYWRIGHT_MODULE_FILE BROWSER_EXECUTABLE OUTPUT_DIRECTORY [BOMB_X,BOMB_Y] [URL]
The optional bomb point must be chosen from an inspected 360x640 production screenshot.
Without it, bomb detonation is skipped, never guessed. Touch is browser emulation, not a physical device.
No packages, browser downloads, personal profiles, app hooks or custom browser flags.
`;
if (process.argv.includes('--help')) { console.log(HELP); process.exit(0); }
const [modulePath, executable, outputPath, bombCoordinate, url = 'https://rocksnake-playable-test.pearly-haven-3558.chatgpt.site'] = process.argv.slice(2);
if (!modulePath || !executable || !outputPath) { console.error(HELP); process.exit(2); }
const output = resolve(outputPath);
const point = bombCoordinate ? bombCoordinate.split(',').map(Number) : null;
if (point && (point.length !== 2 || !point.every(Number.isFinite) || point[0] <= 0 || point[0] >= 360 || point[1] <= 0 || point[1] >= 640)) throw new Error('Bomb point must be an inspected point inside the 360x640 viewport.');
if (!['http:', 'https:'].includes(new URL(url).protocol)) throw new Error('URL must be HTTP(S).');
await mkdir(output, { recursive: true });
const report = { startedAt: new Date().toISOString(), url, viewport: { width: 360, height: 640 }, input: 'CDP dispatchTouchEvent emulation; NOT a physical touchscreen', bombPoint: point, checks: [], console: [], pageErrors: [], screenshots: [], limitations: ['One portrait only; no physical device, offline test, performance benchmark or soak.', 'Bomb point is supplied only after visual inspection; no state/debug hooks.', 'Console errors remain raw, including any hosting-injected CSP errors.'], status: 'running' };
const wait = ms => new Promise(done => setTimeout(done, ms));
const assert = (ok, message) => { if (!ok) throw new Error(message); };
async function until(predicate, label, timeout = 7000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { if (await predicate()) return; await wait(100); }
  throw new Error(`Timed out: ${label}`);
}
async function center(locator) {
  await locator.waitFor({ state: 'visible', timeout: 8000 });
  const b = await locator.boundingBox();
  assert(b && b.width > 0 && b.height > 0, 'Missing visible target bounds');
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}
async function check(label, fn) {
  try { const detail = await fn(); report.checks.push({ label, status: 'passed', ...(detail ? { detail } : {}) }); console.log(`PASS ${label}`); }
  catch (error) { report.checks.push({ label, status: 'failed', error: error.message }); throw error; }
}
let browser;
try {
  assert((await stat(executable)).isFile(), 'Supplied browser executable does not exist');
  const runtime = await import(pathToFileURL(resolve(modulePath)).href);
  const chromium = runtime.chromium || runtime.default?.chromium;
  browser = await chromium.launch({ executablePath: resolve(executable), headless: true, chromiumSandbox: true, ignoreDefaultArgs: ['--enable-unsafe-swiftshader'] });
  report.browserVersion = browser.version();
  const context = await browser.newContext({ viewport: report.viewport, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  page.on('console', message => report.console.push({ type: message.type(), text: message.text() }));
  page.on('pageerror', error => report.pageErrors.push(error.message));
  const cdp = await context.newCDPSession(page);
  let active = null;
  async function touch(type, position) {
    const touchPoints = position ? [{ ...position, id: 1, radiusX: 6, radiusY: 6, force: 1 }] : [];
    await cdp.send('Input.dispatchTouchEvent', { type, touchPoints });
    active = position || null;
  }
  async function move(end, steps = 12) {
    assert(active, 'No active emulated touch');
    const start = active;
    for (let step = 1; step <= steps; step++) {
      await touch('touchMove', { x: start.x + (end.x - start.x) * step / steps, y: start.y + (end.y - start.y) * step / steps });
      await wait(16);
    }
  }
  async function tap(position) { await touch('touchStart', position); await touch('touchEnd'); }
  async function drag(from, to) {
    await touch('touchStart', from);
    try { await move(to); await touch('touchEnd'); }
    finally { if (active) await touch('touchCancel'); }
  }
  async function shot(label) { const path = join(output, `${label}.png`); await page.screenshot({ path, fullPage: true }); report.screenshots.push({ label, path }); }
  const entity = id => page.locator(`[data-entity="${id}"]`);
  const coins = async () => { const n = Number(await page.locator('[data-coins]').textContent()); assert(Number.isFinite(n), 'Invalid visible coins'); return n; };
  await check('Portrait production scene starts with touch enabled', async () => {
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    assert(response?.ok(), `HTTP ${response?.status()}`);
    await until(async () => await page.locator('[data-entity]').count() > 0 || await page.locator('[role="alert"]').count() > 0, 'scene or fallback', 15000);
    assert(await page.locator('[role="alert"]').count() === 0, 'Browser shows fallback');
    assert(await page.locator('canvas').isVisible(), 'Canvas not visible');
    assert(await page.locator('[data-kind="barrel"]').count() === 6, 'Six starting barrels required');
    await shot('touch-initial');
  });
  const ids = await page.locator('[data-kind="barrel"]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-entity')));
  const starter = await page.locator('[data-kind="worker"]').getAttribute('data-entity');
  await check('Touch tap opens worker barrel once', async () => {
    await tap(await center(entity(ids[0])));
    await until(async () => await entity(ids[0]).getAttribute('data-kind') === 'worker', 'worker barrel opens');
    assert(await page.locator('[data-kind="worker"]').count() === 2, 'Expected exactly two workers');
  });
  await check('Emulated touchCancel restores a visibly dragged worker', async () => {
    const start = await center(entity(ids[0]));
    await touch('touchStart', start);
    try {
      await move({ x: start.x, y: start.y - 65 });
      await until(async () => { const p = await center(entity(ids[0])); return Math.hypot(p.x - start.x, p.y - start.y) > 35; }, 'worker visibly leaves source');
      await shot('touch-drag-before-cancel');
    } finally { await touch('touchCancel'); }
    await until(async () => { const p = await center(entity(ids[0])); return Math.hypot(p.x - start.x, p.y - start.y) < 15; }, 'cancel returns source');
    assert(await page.locator('[data-kind="worker"]').count() === 2, 'Cancel changed worker count');
    assert(await entity(starter).getAttribute('data-level') === '1', 'Cancel unexpectedly merged');
  });
  await check('Emulated touch drag merges matching workers', async () => {
    await drag(await center(entity(ids[0])), await center(entity(starter)));
    await until(async () => await entity(ids[0]).count() === 0 && await entity(starter).getAttribute('data-level') === '2', 'touch merge produces level two');
  });
  await check('Touch returns miner to free belt carrier, isolating bomb reward', async () => {
    const slot = page.locator('[data-slot]:not([hidden])').first();
    const destination = await center(slot);
    await drag(await center(entity(starter)), destination);
    await until(async () => await page.locator('[data-pad="pad-0"]').isVisible(), 'starter pad is empty');
    const moved = await center(entity(starter));
    assert(Math.hypot(moved.x - destination.x, moved.y - destination.y) < 25, 'Worker did not reach free carrier');
    const before = await coins(); await wait(900); assert(await coins() === before, 'Coins still increasing with no pad miner');
  });
  await check('Touch tap opens bomb barrel', async () => {
    await tap(await center(entity(ids[3])));
    await until(async () => await entity(ids[3]).getAttribute('data-kind') === 'bomb', 'bomb appears');
  });
  if (point) {
    await check('Emulated touch bomb drag detonates on visually inspected rocks', async () => {
      const before = await coins(), from = await center(entity(ids[3]));
      await touch('touchStart', from);
      try {
        await move({ x: point[0], y: point[1] });
        await shot('bomb-preview');
        await touch('touchEnd');
      } finally { if (active) await touch('touchCancel'); }
      await until(async () => await entity(ids[3]).count() === 0 && await coins() > before, 'bomb consumed and coin reward increases');
      const after = await coins();
      await shot('bomb-after');
      await tap(from); await tap(from); await wait(900);
      assert(await coins() === after, 'Empty source taps added an unexpected reward');
      return { before, after, emptySourceRetapsDoNotReward: true };
    });
  } else report.checks.push({ label: 'Bomb detonation', status: 'skipped', reason: 'No visually inspected bomb target supplied' });
  await check('Touch restart restores one miner and six barrels', async () => {
    await tap(await center(page.locator('button[aria-label="Restart"]')));
    await until(async () => await page.locator('[data-kind="barrel"]').count() === 6 && await page.locator('[data-kind="worker"]').count() === 1 && await page.locator('[data-kind="bomb"]').count() === 0, 'restart counts');
    assert(await page.locator('[data-kind="worker"]').getAttribute('data-level') === '1', 'Restart worker level');
    await shot('touch-restart');
  });
  await check('No uncaught page errors', async () => assert(report.pageErrors.length === 0, report.pageErrors.join('; ')));
  report.consoleErrors = report.console.filter(message => message.type === 'error');
  report.status = !point ? 'partial_bomb_skipped' : report.consoleErrors.length ? 'gameplay_passed_with_console_errors' : 'passed';
} catch (error) { report.status = 'failed_or_blocked'; report.error = error.stack || error.message; }
finally {
  if (browser) await browser.close();
  report.finishedAt = new Date().toISOString();
  await writeFile(join(output, 'touch-bomb-report.json'), JSON.stringify(report, null, 2));
  console.log(`Status: ${report.status}\nReport: ${join(output, 'touch-bomb-report.json')}`);
  process.exitCode = report.status === 'passed' ? 0 : 1;
}
