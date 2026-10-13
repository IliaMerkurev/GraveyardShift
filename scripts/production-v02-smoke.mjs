#!/usr/bin/env node
/** v0.2 delta checks only. Real input, public DOM, fresh installed browser, no state hooks. */
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const DEFAULT_URL = 'https://rocksnake-playable-test.pearly-haven-3558.chatgpt.site';
const TOTAL_BUDGET_MS = 115_000;
// Focused default-config simulator run reaches idle defeat in 42.35 active seconds.
// A slow/throttled renderer is reported as a timeout, never a fabricated defeat.
const DEFEAT_WAIT_MS = 65_000;
const HELP = `RockSnake v0.2 production delta smoke (ordinary Playwright API)

node scripts/production-v02-smoke.mjs --playwright-module <existing module file or directory> --executable <installed Chrome or Edge executable> [--url <HTTP(S) URL>] [--output <directory>]

No installs, downloads, personal profile, custom browser flags, app hooks, or state mutation.
Fresh headless browser with the existing production smoke's safe launch options.
1280x720 real-mouse behavior checks; 360x640 screenshot/marker checks only.
Approximately two-minute overall bound; 65-second idle defeat observation bound.
Geometry screenshots require human review; DOM assertions do not certify chain geometry.
Exit codes: 0 automated checks passed (visual review still needed), 1 failed/blocked, 2 setup error.
`;
function parseArgs(args) {
  const options = { url: DEFAULT_URL, output: resolve('rocksnake-v02-smoke-results') };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--help' || args[i] === '-h') return { help: true };
    const key = { '--playwright-module': 'module', '--executable': 'executable', '--url': 'url', '--output': 'output' }[args[i]];
    if (!key || !args[i + 1] || args[i + 1].startsWith('--')) throw new Error(`Unknown option or missing value: ${args[i]}`);
    options[key] = args[++i];
  }
  if (!options.module || !options.executable) throw new Error('Supply --playwright-module and --executable.');
  if (!['http:', 'https:'].includes(new URL(options.url).protocol)) throw new Error('URL must be HTTP(S).');
  for (const key of ['module', 'executable', 'output']) options[key] = resolve(options[key]);
  return options;
}
const assert = (ok, message) => { if (!ok) throw new Error(message); };
const pause = ms => new Promise(done => setTimeout(done, ms));
let deadline = Infinity;
function remaining(max = 4000) {
  const time = deadline - Date.now();
  assert(time > 0, 'Overall 115-second observation budget exhausted');
  return Math.max(1, Math.min(max, time));
}
async function until(predicate, label, timeout = 4000) {
  const end = Date.now() + remaining(timeout);
  let lastError;
  while (Date.now() < end) {
    try { if (await predicate()) return; } catch (error) { lastError = error; }
    await pause(Math.min(100, Math.max(1, end - Date.now())));
  }
  throw new Error(`${label}: timed out after at most ${timeout} ms${lastError ? ` (${lastError.message})` : ''}`);
}
const actor = (page, id) => page.locator(`[data-entity="${id}"]`);
async function center(locator) {
  await locator.waitFor({ state: 'visible', timeout: remaining() });
  const bounds = await locator.boundingBox();
  assert(bounds?.width > 0 && bounds.height > 0, 'Target has no visible bounds');
  return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
}
async function click(page, locator) { const p = await center(locator); await page.mouse.click(p.x, p.y); }
async function drag(page, from, to) {
  const start = await center(from), end = await center(to);
  await page.mouse.move(start.x, start.y); await page.mouse.down();
  try { await page.mouse.move(start.x, start.y - 16, { steps: 2 }); await page.mouse.move(end.x, end.y, { steps: 8 }); }
  finally { await page.mouse.up(); }
}
async function coinCount(page) {
  const value = Number(await page.locator('[data-coins]').textContent());
  assert(Number.isFinite(value) && value >= 0, 'Invalid visible coin counter'); return value;
}
async function barrelsLeftToRight(page) {
  // Inspect rendered public markers only, not application objects.
  return page.locator('[data-entity][data-kind="barrel"]').evaluateAll(nodes => nodes
    .map(node => ({ id: node.getAttribute('data-entity'), x: node.getBoundingClientRect().left }))
    .sort((a, b) => a.x - b.x).map(item => item.id));
}
async function reset(page) {
  const previous = await page.locator('[data-entity][data-kind="worker"]').first().getAttribute('data-entity');
  await click(page, page.locator('button[aria-label="Restart"]'));
  await until(async () => await page.locator('.overlay').isHidden()
    && await page.locator('[data-entity][data-kind="barrel"]').count() === 6
    && await page.locator('[data-entity][data-kind="worker"]').count() === 1
    && await page.locator('[data-entity][data-kind="worker"]').first().getAttribute('data-entity') !== previous,
  'Fresh run restores v0.2 setup');
}

async function inspect(browser, options, viewport, name, behaviors) {
  const result = { name, viewport, input: behaviors ? 'Real Playwright mouse' : 'No gameplay input; portrait screenshot only', checks: [], screenshots: [], visualReview: 'required', console: [], pageErrors: [], failedRequests: [], status: 'running' };
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, hasTouch: false });
  const page = await context.newPage();
  page.setDefaultTimeout(4000); page.setDefaultNavigationTimeout(15000);
  page.on('console', m => result.console.push({ type: m.type(), text: m.text() }));
  page.on('pageerror', e => result.pageErrors.push(e.message));
  page.on('requestfailed', r => result.failedRequests.push({ url: r.url(), error: r.failure()?.errorText }));
  async function shot(label, review) {
    const path = join(options.output, `${name}-${label}.png`);
    await page.screenshot({ path, fullPage: true, timeout: remaining() });
    result.screenshots.push({ label, path, ...(review ? { manualReview: review } : {}) });
  }
  async function check(label, action) {
    const start = Date.now();
    try {
      remaining();
      const details = await action();
      result.checks.push({ label, status: 'passed', durationMs: Date.now() - start, ...(details ? { details } : {}) });
      console.log(`${name}: PASS ${label}`); return true;
    } catch (error) {
      result.checks.push({ label, status: 'failed', durationMs: Date.now() - start, error: error.message });
      console.log(`${name}: FAIL ${label}: ${error.message}`);
      try { await shot(`failure-${result.checks.length}`); } catch { /* Keep original failure. */ }
      return false;
    }
  }
  try {
    const ready = await check('Production v0.2 scene and public head/finish markers', async () => {
      const response = await page.goto(options.url, { waitUntil: 'domcontentloaded', timeout: remaining(15000) });
      assert(response?.ok(), `HTTP response ${response?.status() ?? 'missing'}`);
      const html = await response.body();
      result.document = { url: page.url(), bytes: html.length, sha256: createHash('sha256').update(html).digest('hex') };
      await until(async () => await page.locator('[data-entity]').count() > 0 || await page.locator('[role="alert"]').count() > 0, 'Game or graphics fallback', 8000);
      const fallback = page.locator('[role="alert"]');
      assert(await fallback.count() === 0, await fallback.count() ? await fallback.innerText() : 'Graphics fallback');
      assert(await page.locator('canvas').isVisible(), 'Visible game canvas missing');
      // Read-only production safety check. Do not invoke or install a hook.
      assert(await page.evaluate(() => !('__rocksnake' in window)), 'Production unexpectedly exposes __rocksnake');
      assert(await page.locator('[data-entity][data-kind="barrel"]').count() === 6, 'Expected six starting barrels');
      await center(page.locator('[data-marker="head"]')); await center(page.locator('[data-marker="finish"]'));
      await shot('initial-half-route', 'Confirm rigid separate low-poly stones, head around route midpoint, clear route ahead, visible FINISH, and no visual overlap/clipping. DOM markers alone cannot prove this.');
    });
    if (!ready) { result.status = 'blocked'; return result; }
    if (behaviors) {
      const full = await check('Full belt moves left and original exit barrel is removed', async () => {
        await reset(page);
        const ids = await barrelsLeftToRight(page); assert(ids.length === 6, 'Fresh full belt missing');
        result.initialBarrelIds = ids;
        const before = await center(actor(page, ids[0])), headBefore = await center(page.locator('[data-marker="head"]'));
        await pause(450);
        const after = await center(actor(page, ids[0])), headAfter = await center(page.locator('[data-marker="head"]'));
        assert(after.x < before.x - 0.5, 'Full belt marker did not move left');
        assert(Math.hypot(headAfter.x - headBefore.x, headAfter.y - headBefore.y) > 0.1, 'Head marker did not move between frames');
        assert(await page.locator('[data-entity][data-kind="barrel"]').count() === 6, 'Full-belt observation did not stay full');
        await until(async () => await actor(page, ids[0]).count() === 0, 'Original leftmost barrel expires', 5000);
        assert(await page.locator('[data-entity][data-kind="worker"]').count() === 1, 'An unopened expired worker barrel created a worker');
        await until(async () => (await barrelsLeftToRight(page)).some(id => !ids.includes(id)), 'Seventh starter barrel enters from right');
        const newcomers = (await barrelsLeftToRight(page)).filter(id => !ids.includes(id));
        assert(newcomers.length === 1, 'Unable to unambiguously resolve seventh starter barrel');
        result.rewindBarrelId = newcomers[0];
        await shot('first-exit-and-refill');
        return { before, after, headBefore, headAfter, expiredId: ids[0], enteringId: newcomers[0], headEvidence: 'Projected marker movement only, not exact arc distance or acceleration.' };
      });
      if (full) {
        await check('Seventh barrel reveals a visible cyan rewind token and real tap consumes it', async () => {
          const id = result.rewindBarrelId;
          await click(page, actor(page, id));
          await until(async () => await actor(page, id).getAttribute('data-kind') === 'rewind', 'Rewind reward is revealed');
          await center(page.locator('[aria-label="Rewind bonus. Tap to use."]'));
          await shot('rewind-visible', 'Check cyan rewind model and readable rewind glyph.');
          const before = await center(page.locator('[data-marker="head"]'));
          await click(page, actor(page, id));
          await until(async () => await actor(page, id).count() === 0 && /rewind/i.test(await page.locator('.toast').textContent() ?? ''), 'Rewind consumed and feedback shown');
          const after = await center(page.locator('[data-marker="head"]'));
          await shot('rewind-used', 'Compare with rewind-visible; confirm head moves backward. Exact midpoint/near-first-miner branches are simulator assertions, not DOM claims.');
          return { id, headBefore: before, headAfter: after, proofLimit: 'Token reveal/activation/consumption verified; exact rewind distance and both branches require focused simulation tests.' };
        });
        await check('Eighth barrel reveals slow token; tap starts visible five-second countdown and it clears', async () => {
          const known = new Set([...result.initialBarrelIds, result.rewindBarrelId]);
          await until(async () => (await barrelsLeftToRight(page)).some(id => !known.has(id)), 'Eighth starter barrel enters', 6000);
          const newcomers = (await barrelsLeftToRight(page)).filter(id => !known.has(id));
          assert(newcomers.length === 1, 'Unable to unambiguously resolve eighth starter barrel');
          const id = newcomers[0];
          await click(page, actor(page, id));
          await until(async () => await actor(page, id).getAttribute('data-kind') === 'slow', 'Slow reward is revealed');
          await shot('slow-visible', 'Confirm a distinct purple clock token, visually different from cyan rewind.');
          await click(page, actor(page, id));
          const activatedAt = Date.now();
          const status = page.locator('.belt-status');
          await until(async () => await actor(page, id).count() === 0 && await status.getAttribute('data-slow') === 'true', 'Slow token consumed and countdown visible');
          const earlyText = await status.innerText();
          const earlyRemaining = Number(await status.getAttribute('data-remaining'));
          assert(earlyRemaining > 0 && earlyRemaining <= 5, 'Slow remaining time is outside the five-second effect');
          assert(/SNAKE SLOW/.test(earlyText) && /[0-5]\.[0-9]s/.test(earlyText), 'Slow countdown text is missing');
          const movingId = result.initialBarrelIds[4];
          const before = await center(actor(page, movingId));
          await pause(400);
          const after = await center(actor(page, movingId));
          assert(after.x < before.x - 0.5, 'Conveyor stopped during snake slow effect');
          const laterText = await status.innerText();
          const laterRemaining = Number(await status.getAttribute('data-remaining'));
          assert(laterRemaining < earlyRemaining && laterRemaining > 0 && laterText !== earlyText, 'Visible slow countdown did not decrease');
          await shot('slow-active', 'Confirm visible timer and readable purple clock feedback. Actual 0.5 multiplier and smooth final 0.5-second recovery require focused simulator evidence.');
          await until(async () => await status.getAttribute('data-slow') === 'false', 'Slow countdown ends naturally', 6500);
          assert(!/SNAKE SLOW/.test(await status.innerText()) && Number(await status.getAttribute('data-remaining')) === 0, 'Expired slow feedback remains visible');
          await shot('slow-expired');
          return { id, earlyText, laterText, earlyRemaining, laterRemaining, observedUntilClearMs: Date.now() - activatedAt, beltBefore: before, beltAfter: after, proofLimit: 'Timer lifecycle and continuing conveyor verified; exact snake-only factor, timer refresh and smooth recovery are simulator checks.' };
        });
      } else result.checks.push({ label: 'Rewind and slow reveal/activation', status: 'blocked', reason: 'Starter sequence could not be resolved.' });

      await check('Belt continues during drag; exited source disappears; late release grants no reward or merge', async () => {
        await reset(page);
        const ids = await barrelsLeftToRight(page);
        const starterId = await page.locator('[data-entity][data-kind="worker"]').getAttribute('data-entity');
        assert(ids.length === 6 && starterId, 'Cannot resolve drag test setup');
        // Put the sole miner on the belt first. With no pad miner, an unchanged
        // coin counter is exact evidence of no reward from the late pointerup.
        await click(page, actor(page, ids[2]));
        await until(async () => await actor(page, ids[2]).count() === 0, 'Coin-barrel slot clears');
        await drag(page, actor(page, starterId), page.locator('[data-slot="slot-2"]'));
        await until(async () => await page.locator('[data-pad="pad-0"]').isVisible(), 'Sole mining pad is visibly empty');
        const sourceId = ids[1]; // Second starter exits at approximately 4.5 s.
        await click(page, actor(page, sourceId));
        await until(async () => await actor(page, sourceId).getAttribute('data-kind') === 'worker', 'Drag source worker is revealed');
        const start = await center(actor(page, sourceId));
        const target = await center(actor(page, starterId));
        const coinsBefore = await coinCount(page);
        await page.mouse.move(start.x, start.y); await page.mouse.down();
        try {
          await page.mouse.move(start.x, start.y - 30, { steps: 3 });
          await page.mouse.move(target.x, target.y, { steps: 8 });
          await until(async () => /DROP BEFORE EXIT/.test(await page.locator('.belt-status').textContent() ?? ''), 'Drag-specific moving-belt message');
          const beltBefore = await center(actor(page, ids[4]));
          await pause(400);
          const beltAfter = await center(actor(page, ids[4]));
          assert(beltAfter.x < beltBefore.x - 0.5, 'Belt stopped during the held drag');
          await shot('held-drag', 'Check visible dragged worker and target feedback while remaining items continue moving.');
          await until(async () => await actor(page, sourceId).count() === 0, 'Held source expires with its moving carrier', 6000);
          assert(!/DROP BEFORE EXIT/.test(await page.locator('.belt-status').textContent() ?? ''), 'Drag UI remained active after source expiry');
          await shot('expired-while-held', 'Confirm no ghost worker or drop/target ring remains after expiry while the mouse is still down.');
          // Re-target the still-live matching worker after expiry, then release.
          const lateTarget = await center(actor(page, starterId));
          await page.mouse.move(lateTarget.x, lateTarget.y); await page.mouse.up();
          await pause(250);
          assert(await actor(page, sourceId).count() === 0, 'Late release restored an expired worker');
          assert(await actor(page, starterId).getAttribute('data-level') === '1', 'Late release merged an expired worker');
          assert(await page.locator('[data-entity][data-kind="worker"]').count() === 1, 'Late release changed the surviving worker count');
          assert(await coinCount(page) === coinsBefore, 'Coins changed with no pad miner after the expired drag/late release');
          await shot('late-release');
          return { expiredId: sourceId, targetId: starterId, coinsBefore, coinsAfter: await coinCount(page), beltBefore, beltAfter, graphicsLimit: 'DOM ghost marker absence is asserted; WebGL mesh/ring cleanup needs screenshot review.' };
        } finally { await page.mouse.up(); }
      });

      await check('Untouched run reaches defeat; only Restart is offered; Restart begins a new run', async () => {
        await reset(page);
        const started = Date.now();
        await shot('idle-start', 'New untouched run: midpoint start, no artificially advanced clock or state.');
        await until(async () => await page.getByRole('heading', { name: 'Game over', exact: true }).isVisible(), 'Idle run reaches Game over', DEFEAT_WAIT_MS);
        const overlay = page.locator('.overlay');
        assert(await overlay.isVisible(), 'Defeat overlay is not visible');
        assert(await overlay.locator('[data-continue]').isHidden(), 'Defeat incorrectly offers Continue');
        const buttons = overlay.locator('button:visible');
        assert(await buttons.count() === 1 && /restart/i.test(await buttons.first().innerText()), 'Defeat must offer only Restart');
        const finalCoins = await coinCount(page), finalHead = await center(page.locator('[data-marker="head"]'));
        await shot('game-over', 'Confirm head at finish, complete non-disappearing chain, readable defeat dialog with only Restart.');
        await pause(450);
        assert(await coinCount(page) === finalCoins, 'Coins changed after defeat');
        const stoppedHead = await center(page.locator('[data-marker="head"]'));
        assert(Math.hypot(stoppedHead.x - finalHead.x, stoppedHead.y - finalHead.y) < 0.1, 'Head marker moved after defeat');
        const oldId = await page.locator('[data-entity][data-kind="worker"]').first().getAttribute('data-entity');
        await click(page, overlay.locator('[data-restart]'));
        await until(async () => await overlay.isHidden() && await page.locator('[data-entity][data-kind="barrel"]').count() === 6 && await page.locator('[data-entity][data-kind="worker"]').first().getAttribute('data-entity') !== oldId, 'Defeat Restart starts new run');
        await shot('defeat-restart', 'Confirm fresh midpoint start after the defeat Restart button.');
        return { observationMs: Date.now() - started, defeatBoundMs: DEFEAT_WAIT_MS, finalCoins, finalHead };
      });
    }
    await check('No uncaught application errors during this v0.2 check', async () => {
      assert(result.pageErrors.length === 0, result.pageErrors.join('; '));
      // Keep host-injected console diagnostics raw rather than hiding them or
      // treating every third-party CSP warning as an application exception.
      return { consoleErrors: result.console.filter(m => m.type === 'error') };
    });
    result.status = result.checks.every(c => c.status === 'passed') ? 'automated_pass_visual_review_required' : 'failed_or_blocked';
  } catch (error) { result.status = 'failed_or_blocked'; result.unexpectedError = error.stack || error.message; }
  finally { await context.close().catch(() => {}); }
  return result;
}

async function main() {
  let options;
  try { options = parseArgs(process.argv.slice(2)); } catch (error) { console.error(error.message); console.error(HELP); process.exitCode = 2; return; }
  if (options.help) { console.log(HELP); return; }
  await mkdir(options.output, { recursive: true });
  const report = { startedAt: new Date().toISOString(), url: options.url, node: process.version, overallBudgetMs: TOTAL_BUDGET_MS, idleDefeatBoundMs: DEFEAT_WAIT_MS, mode: 'v0.2 changed functionality only; real mouse; no app hooks/state mutation', limitations: [
    'Screenshots require human inspection. Public head/entity markers do not prove exact path distance, rigid geometry, gap closure, complete chain preservation, or absence of a WebGL ghost.',
    'Exact gap closure, both rewind branches, time-based capped acceleration, snake-only slow multiplier/refresh and smooth recovery belong to focused simulator tests; this script does not claim those proofs.',
    'Portrait is screenshot/marker coverage only. Mouse is not touch; no physical-device, performance, offline, old broad-regression, or soak coverage.',
    'No game clock acceleration. A slow or throttled browser can exhaust the bounded defeat observation; report it as inconclusive/failed.',
    'Raw console errors and failed requests are retained for review; uncaught page errors fail the automated checks.',
  ], results: [], status: 'running' };
  let browser, watchdog;
  try {
    const moduleInfo = await stat(options.module);
    const moduleFile = moduleInfo.isDirectory() ? join(options.module, 'index.js') : options.module;
    assert((await stat(options.executable)).isFile(), 'Browser executable must be an existing file');
    const runtime = await import(pathToFileURL(moduleFile).href);
    const chromium = runtime.chromium || runtime.default?.chromium;
    assert(typeof chromium?.launch === 'function', 'Supplied module does not expose chromium.launch');
    deadline = Date.now() + TOTAL_BUDGET_MS;
    watchdog = setTimeout(() => { report.budgetExceeded = true; browser?.close().catch(() => {}); }, TOTAL_BUDGET_MS);
    browser = await chromium.launch({ executablePath: options.executable, headless: true, chromiumSandbox: true, ignoreDefaultArgs: ['--enable-unsafe-swiftshader'], timeout: remaining(15000) });
    report.browserVersion = browser.version();
    report.results.push(await inspect(browser, options, { width: 1280, height: 720 }, 'landscape', true));
    if (!report.budgetExceeded && deadline - Date.now() > 5000) report.results.push(await inspect(browser, options, { width: 360, height: 640 }, 'portrait', false));
    else report.results.push({ name: 'portrait', status: 'blocked', reason: 'Overall observation budget exhausted.' });
    report.status = report.results.every(r => r.status === 'automated_pass_visual_review_required') ? 'automated_pass_visual_review_required' : 'failed_or_blocked';
    process.exitCode = report.status === 'automated_pass_visual_review_required' ? 0 : 1;
  } catch (error) { report.status = 'setup_or_runtime_blocked'; report.error = error.stack || error.message; process.exitCode = 2; }
  finally {
    if (watchdog) clearTimeout(watchdog);
    if (browser) await browser.close().catch(() => {});
    report.finishedAt = new Date().toISOString();
    const path = join(options.output, 'report.json');
    await writeFile(path, JSON.stringify(report, null, 2));
    console.log(`v0.2 smoke: ${report.status}\nReport: ${path}`);
  }
}
await main();
