#!/usr/bin/env node
/** Feedback delta only. Real public input and read-only rendered DOM; no game hooks. */
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const DEFAULT_URL = 'https://rocksnake-playable-test.pearly-haven-3558.chatgpt.site';
const BUDGET_MS = 115_000;
const SPACING = 0.245;
const HELP = `RockSnake feedback-only public production smoke
node scripts/production-feedback-smoke.mjs --playwright-module <existing module file or directory> --executable <installed Chrome or Edge executable> [--url <HTTP(S) URL>] [--output <directory>]

Six changed behaviors only. No installs, downloads, personal profile, custom launch
flags, debug hooks, injected app commands, state mutation, or clock acceleration.
One fresh browser, 1280x720 mouse and a short 360x640 emulated-touch placement.
Requires read-only production DOM motion/ownership markers documented in QA_FEEDBACK.md.
115-second browser/runtime budget; all gameplay and screenshots stay inside it.
Exit 0 = automated pass with visual review still required; 1 = failed/inconclusive;
2 = setup/runtime blocked. Run once on the updated existing Site.
`;
const assert = (ok, message) => { if (!ok) throw new Error(message); };
const pause = ms => new Promise(done => setTimeout(done, ms));
let deadline = Infinity;
function remaining(max = 4000) {
  const left = deadline - Date.now();
  assert(left > 0, 'Overall 115-second observation budget exhausted');
  return Math.max(1, Math.min(max, left));
}
function parseArgs(args) {
  const options = { url: DEFAULT_URL, output: resolve('test-results/feedback-smoke') };
  for (let i = 0; i < args.length; i++) {
    if (['--help', '-h'].includes(args[i])) return { help: true };
    const key = { '--playwright-module': 'module', '--executable': 'executable', '--url': 'url', '--output': 'output' }[args[i]];
    assert(key && args[i + 1] && !args[i + 1].startsWith('--'), `Unknown option or missing value: ${args[i]}`);
    options[key] = args[++i];
  }
  assert(options.module && options.executable, 'Supply --playwright-module and --executable.');
  assert(['http:', 'https:'].includes(new URL(options.url).protocol), 'URL must be HTTP(S).');
  for (const key of ['module', 'executable', 'output']) options[key] = resolve(options[key]);
  return options;
}
async function until(predicate, label, timeout = 4000) {
  const end = Date.now() + remaining(timeout);
  let lastError;
  while (Date.now() < end) {
    try { const value = await predicate(); if (value) return value; } catch (error) { lastError = error; }
    await pause(Math.min(70, Math.max(1, end - Date.now())));
  }
  throw new Error(`${label}: timed out/inconclusive (${timeout} ms maximum)${lastError ? `; ${lastError.message}` : ''}`);
}
const entity = (page, id) => page.locator(`[data-entity="${id}"]`);
async function center(locator) {
  await locator.waitFor({ state: 'visible', timeout: remaining() });
  const b = await locator.boundingBox();
  assert(b?.width > 0 && b.height > 0, 'Target has no visible bounds');
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

/** Only reads public DOM. Promise/RAF bookkeeping is local to this call. */
async function sample(page, { duration = 0, interval = 33, geometry = true, ownership = true, untilTime = null } = {}) {
  return page.evaluate(async options => {
    const rows = [], started = performance.now();
    let last = -Infinity;
    function read(wall) {
      const canvas = document.querySelector('canvas'), head = document.querySelector('[data-marker="head"]');
      if (!canvas || !head) throw new Error('Public canvas/head marker unavailable');
      const bounds = canvas.getBoundingClientRect();
      const row = { wall, time: Number(canvas.dataset.time), motion: canvas.dataset.motion,
        speed: Number(canvas.dataset.speed), head: Number(head.dataset.distance),
        coins: Number(document.querySelector('[data-coins]')?.textContent),
        canvas: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height } };
      if (options.geometry) row.stones = JSON.parse(canvas.dataset.stones || 'null');
      if (options.ownership) {
        row.entities = [...document.querySelectorAll('[data-entity]')].map(n => ({ id: n.dataset.entity, kind: n.dataset.kind,
          level: Number(n.dataset.level), locationKind: n.dataset.locationKind, locationId: n.dataset.locationId || null }));
        row.pads = [...document.querySelectorAll('[data-pad]')].map(n => ({ id: n.dataset.pad, unlocked: n.dataset.unlocked === 'true',
          entityId: n.dataset.entityId || null, reserved: n.dataset.reserved === 'true' }));
        row.slots = [...document.querySelectorAll('[data-slot]')].map(n => ({ id: n.dataset.slot,
          entityId: n.dataset.entityId || null, reserved: n.dataset.reserved === 'true', x: parseFloat(n.style.left), y: parseFloat(n.style.top) }));
      }
      return row;
    }
    return new Promise((done, reject) => {
      function frame(wall) {
        try {
          if (wall - last >= options.interval || !rows.length || wall - started >= options.duration) {
            rows.push(read(wall)); last = wall;
          }
          const finished = options.untilTime !== null && rows.at(-1).time >= options.untilTime;
          if (finished || wall - started >= options.duration) done(rows);
          else requestAnimationFrame(frame);
        } catch (error) { reject(error); }
      }
      requestAnimationFrame(frame);
    });
  }, { duration: Math.min(duration, remaining(30_000)), interval, geometry, ownership, untilTime });
}
async function snapshot(page) { return (await sample(page))[0]; }
function stoneMap(row) { return new Map(row.stones.map(stone => [stone.id, stone])); }
function owner(row, id) { return row.entities.find(e => e.id === id); }
function slot(row, id) { return row.slots.find(s => s.id === id); }
function biggestGap(row) {
  const stones = [...row.stones].sort((a, b) => a.distance - b.distance);
  return stones.slice(1).map((front, i) => ({ rear: stones[i], front, width: front.distance - stones[i].distance }))
    .sort((a, b) => b.width - a.width)[0];
}
function pairGap(row, rearId, frontId) {
  const map = stoneMap(row);
  assert(map.has(rearId) && map.has(frontId), 'Observed gap endpoint disappeared');
  return map.get(frontId).distance - map.get(rearId).distance;
}
function coverage(rows, label, maxStep = 0.14) {
  assert(rows.length >= 8, `${label}: insufficient distinct sampled frames`);
  const unique = rows.filter((r, i) => i === 0 || r.time > rows[i - 1].time + 0.0001);
  assert(unique.length >= 8, `${label}: simulation did not advance through enough frames`);
  const maxGap = Math.max(...unique.slice(1).map((r, i) => r.time - unique[i].time));
  assert(maxGap <= maxStep, `${label}: sampling gap ${maxGap.toFixed(3)} s cannot establish smoothness`);
  return { frames: rows.length, distinctSimulationFrames: unique.length, maxSimulationSampleGap: maxGap };
}
async function makeInput(page, context, touch) {
  if (!touch) return {
    label: 'Real Playwright mouse',
    tap: p => page.mouse.click(p.x, p.y),
    start: async p => { await page.mouse.move(p.x, p.y); await page.mouse.down(); },
    move: p => page.mouse.move(p.x, p.y, { steps: 8 }),
    end: () => page.mouse.up(), cancel: () => page.mouse.up(),
  };
  const cdp = await context.newCDPSession(page);
  let active = null;
  async function send(type, p) {
    await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: p ? [{ ...p, id: 1, radiusX: 6, radiusY: 6, force: 1 }] : [] });
    active = p || null;
  }
  return {
    label: 'CDP Input.dispatchTouchEvent browser emulation; not a physical touchscreen',
    tap: async p => { await send('touchStart', p); await send('touchEnd'); },
    start: p => send('touchStart', p),
    move: async p => {
      assert(active, 'No active emulated touch'); const start = active;
      for (let i = 1; i <= 8; i++) { await send('touchMove', { x: start.x + (p.x - start.x) * i / 8, y: start.y + (p.y - start.y) * i / 8 }); await pause(16); }
    },
    end: () => send('touchEnd'), cancel: async () => { if (active) await send('touchCancel'); },
  };
}
async function tap(input, target) { await input.tap(await center(target)); }
async function begin(input, target) {
  const start = await center(target);
  await input.start(start); await input.move({ x: start.x, y: start.y - 36 });
}
async function drag(input, from, target) {
  await begin(input, from);
  try { await input.move(await center(target)); await input.end(); }
  finally { await input.cancel(); }
}
async function fresh(page, input) {
  const workers = page.locator('[data-kind="worker"]');
  const old = await workers.count() ? await workers.first().getAttribute('data-entity') : null;
  await tap(input, page.locator('button[aria-label="Restart"]'));
  return until(async () => {
    const row = await snapshot(page);
    const workers = row.entities.filter(e => e.kind === 'worker');
    if (row.entities.filter(e => e.kind === 'barrel').length !== 6 || workers.length !== 1 || workers[0].id === old) return false;
    const barrels = row.slots.slice().sort((a, b) => a.x - b.x).map(s => s.entityId);
    return { row, barrels, starterId: workers[0].id };
  }, 'Fresh deterministic starter setup');
}
async function isolateMiner(page, input, setup) {
  await tap(input, entity(page, setup.barrels[2]));
  await until(async () => await entity(page, setup.barrels[2]).count() === 0, 'Coin barrel consumed for miner isolation');
  // Empty slot affordances intentionally appear only after a real drag starts.
  await drag(input, entity(page, setup.starterId), page.locator('[data-slot="slot-2"]'));
  await until(async () => owner(await snapshot(page), setup.starterId)?.locationKind === 'slot', 'Miner visibly moved to empty belt slot');
  assert((await snapshot(page)).pads.every(p => !p.entityId), 'Mining must be isolated from motion/coin assertions');
}

async function inspect(browser, options, touch = false) {
  const name = touch ? 'portrait-touch' : 'landscape';
  const viewport = touch ? { width: 360, height: 640 } : { width: 1280, height: 720 };
  const result = { name, viewport, checks: [], screenshots: [], evidenceFiles: [], console: [], pageErrors: [], failedRequests: [], status: 'running' };
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, hasTouch: touch, ...(touch ? { isMobile: true } : {}) });
  const page = await context.newPage();
  page.setDefaultTimeout(4000); page.setDefaultNavigationTimeout(15000);
  page.on('console', m => result.console.push({ type: m.type(), text: m.text() }));
  page.on('pageerror', e => result.pageErrors.push(e.message));
  page.on('requestfailed', r => result.failedRequests.push({ url: r.url(), error: r.failure()?.errorText }));
  let input;
  async function shot(label, manualReview) {
    const path = join(options.output, `${name}-${label}.png`);
    await page.screenshot({ path, fullPage: true, timeout: remaining() });
    result.screenshots.push({ label, path, ...(manualReview ? { manualReview } : {}) });
  }
  async function evidence(label, rows) {
    const path = join(options.output, `${name}-${label}.json`);
    await writeFile(path, JSON.stringify(rows, null, 2)); result.evidenceFiles.push({ label, path });
  }
  async function check(label, action) {
    const started = Date.now();
    try {
      remaining(); const details = await action();
      result.checks.push({ label, status: 'passed', durationMs: Date.now() - started, details });
      console.log(`${name}: PASS ${label}`); return true;
    } catch (error) {
      result.checks.push({ label, status: 'failed_or_inconclusive', durationMs: Date.now() - started, error: error.message });
      console.log(`${name}: FAIL/INCONCLUSIVE ${label}: ${error.message}`);
      try { await input?.cancel(); await shot(`failure-${result.checks.length}`); } catch { /* Preserve original error. */ }
      return false;
    }
  }
  async function lockedPadDrop() {
    const setup = await fresh(page, input); await isolateMiner(page, input, setup);
    const id = setup.barrels[1]; await tap(input, entity(page, id));
    await until(async () => await entity(page, id).getAttribute('data-kind') === 'worker', 'Worker revealed');
    const pad = page.locator('[data-pad="pad-1"]');
    assert(await pad.getAttribute('data-unlocked') === 'false', 'Target must still be locked before drag');
    await begin(input, entity(page, id)); await input.move(await center(pad));
    const before = await snapshot(page);
    assert(before.coins >= 50 && before.pads.find(p => p.id === 'pad-1')?.unlocked === false, 'Affordable locked pad setup missing');
    await shot('affordable-pad-before-release', 'A real held worker should show a valid target on the still-locked 50-coin pad.');
    const pending = sample(page, { duration: 700, geometry: false, interval: 16 });
    void pending.catch(() => {}); // Prevent a later close from masking an earlier input failure.
    await pause(70); await input.end(); const rows = await pending;
    await evidence('atomic-pad-drop-frames', [before, ...rows]);
    const after = rows.at(-1), worker = owner(after, id), padAfter = after.pads.find(p => p.id === 'pad-1');
    assert(padAfter?.unlocked && padAfter.entityId === id && worker?.locationKind === 'pad' && worker.locationId === 'pad-1', 'One drop did not both purchase and place');
    assert(after.coins === before.coins - 50, 'Pad did not charge exactly 50 coins');
    assert(after.entities.filter(e => e.id === id).length === 1 && after.entities.filter(e => e.kind === 'worker').length === 2, 'Drop lost or duplicated a worker');
    for (const row of rows) {
      const p = row.pads.find(p => p.id === 'pad-1');
      assert(p.unlocked ? p.entityId === id && row.coins === before.coins - 50 : !p.entityId && row.coins === before.coins,
        'Rendered frame exposed partial purchase/placement or inconsistent debit');
    }
    await shot('affordable-pad-placed', 'Worker occupies the newly bought pad; price tag and drag ring are gone.');
    return { id, coinsBefore: before.coins, coinsAfter: after.coins, observedFrames: rows.length, atomicityLimit: 'All sampled rendered frames agree; model tests cover command-level transaction atomicity.' };
  }
  try {
    const response = await page.goto(options.url, { waitUntil: 'domcontentloaded', timeout: remaining(15000) });
    assert(response?.ok(), `HTTP response ${response?.status() ?? 'missing'}`);
    const html = await response.body();
    result.document = { url: page.url(), bytes: html.length, sha256: createHash('sha256').update(html).digest('hex') };
    await until(async () => await page.locator('[data-entity]').count() > 0 || await page.locator('[role="alert"]').count() > 0, 'Game or graphics fallback', 8000);
    const fallback = page.locator('[role="alert"]');
    assert(await fallback.count() === 0, await fallback.count() ? await fallback.innerText() : 'Graphics fallback');
    assert(await page.evaluate(() => !('__rocksnake' in window)), 'Production unexpectedly exposes __rocksnake');
    input = await makeInput(page, context, touch); result.input = input.label;
    const initial = await snapshot(page);
    assert(Number.isFinite(initial.time) && Number.isFinite(initial.head) && Number.isFinite(initial.speed) && initial.motion,
      'Required public motion markers are absent: deploy the updated feedback build first');
    assert(Array.isArray(initial.stones) && initial.stones.length > 0 && initial.stones.every(s => s.id && [s.distance, s.x, s.y].every(Number.isFinite)), 'Public read-only stone projections are absent/malformed');
    assert(initial.entities.every(e => e.locationKind), 'Public entity ownership markers are absent');
    await shot('initial');
    if (touch) {
      await check('Affordable locked-pad worker drop with emulated touch', lockedPadDrop);
    } else {
      await check('Coin reward clears the opened barrel and empty carrier', async () => {
        const setup = await fresh(page, input), before = await snapshot(page), id = setup.barrels[2];
        await tap(input, entity(page, id));
        const after = await until(async () => {
          const row = await snapshot(page); return !owner(row, id) && row.coins >= before.coins + 50 ? row : false;
        }, 'Coin reward and consumed-barrel cleanup');
        assert(after.coins === before.coins + 50, 'Coin barrel did not grant exactly +50');
        assert(!slot(after, 'slot-2').entityId && !slot(after, 'slot-2').reserved, 'Consumed barrel retains slot ownership');
        assert(await page.locator('[data-slot="slot-2"]').isHidden(), 'Empty-slot affordance remains visible while idle');
        await shot('coin-barrel-cleared', 'The rewarded barrel and its empty moving carrier must be visually gone. Coin particles are allowed; no empty barrel model or persistent plus marker.');
        return { consumedId: id, beforeCoins: before.coins, afterCoins: after.coins, graphicsLimit: 'DOM removal/empty ownership asserted; carrier mesh disappearance requires screenshot review.' };
      });
      await check('Elapsed acceleration is approximately 2× initial speed at 20 seconds', async () => {
        const setup = await fresh(page, input); await isolateMiner(page, input, setup);
        const rows = await sample(page, { duration: 28_000, untilTime: 20.8, interval: 100, geometry: false, ownership: false });
        await evidence('acceleration-frames', rows);
        assert(rows.at(-1).time >= 20.5, '20 active seconds were not reached within the bounded observation');
        assert(rows.every(r => r.motion === 'forward'), 'A pause, gap, rewind or defeat confounded acceleration');
        const nearest = t => rows.reduce((a, b) => Math.abs(a.time - t) < Math.abs(b.time - t) ? a : b);
        const a = nearest(1), b = nearest(10), c = nearest(20);
        const v1 = (b.head - a.head) / (b.time - a.time), v2 = (c.head - b.head) / (c.time - b.time);
        const acceleration = (v2 - v1) / ((c.time - a.time) / 2), initialSpeed = v1 - acceleration * (a.time + b.time) / 2;
        const speedAt20 = initialSpeed + 20 * acceleration, ratio = speedAt20 / initialSpeed;
        assert(Math.abs(acceleration - 0.017) < 0.0007, `Measured acceleration ${acceleration} differs from 0.017`);
        assert(Math.abs(initialSpeed - 0.34) < 0.004 && ratio > 1.95 && ratio < 2.05, `Unexpected initial/20-second velocity: ${initialSpeed}, ${speedAt20}`);
        assert(rows.every(r => r.speed <= 0.851 && Math.abs(r.speed - Math.min(0.85, 0.34 + 0.017 * r.time)) < 0.003), 'Public base speed does not follow the capped formula');
        await shot('acceleration-at-20-seconds');
        return { observedUntil: rows.at(-1).time, measuredInitialSpeed: initialSpeed, measuredAcceleration: acceleration, measuredSpeedAt20: speedAt20, ratioAt20: ratio,
          capLimit: 'No-miner run reaches finish before the cap; exact sustained 0.85 cap is a focused model-test claim, not a naturally reached browser claim.' };
      });
      await check('Held worker survives source exit and invalid release returns it safely', async () => {
        const setup = await fresh(page, input); await isolateMiner(page, input, setup);
        const id = setup.barrels[1]; await tap(input, entity(page, id));
        await until(async () => await entity(page, id).getAttribute('data-kind') === 'worker', 'Held source worker revealed');
        const before = await snapshot(page), source = owner(before, id).locationId;
        await begin(input, entity(page, id));
        await input.move({ x: before.canvas.x + before.canvas.width * 0.5, y: before.canvas.y + before.canvas.height * 0.42 });
        const held = await snapshot(page); assert(owner(held, id)?.locationKind === 'drag', 'Worker did not enter a held drag');
        const sourceX = slot(held, source).x, movingId = setup.barrels[4], beltBefore = await center(entity(page, movingId));
        await pause(320); const beltAfter = await center(entity(page, movingId));
        assert(beltAfter.x < beltBefore.x - 0.5, 'Other belt content stopped while a worker was held');
        await shot('worker-held-before-exit');
        const wrapped = await until(async () => { const row = await snapshot(page); return slot(row, source).x > sourceX + row.canvas.width * 0.15 ? row : false; }, 'Held source carrier wraps past exit', 6000);
        assert(owner(wrapped, id)?.locationKind === 'drag' && slot(wrapped, source).reserved && !slot(wrapped, source).entityId, 'Belt exit deleted the held worker or its safe-return reservation');
        assert(wrapped.coins === held.coins, 'Held-worker source wrap changed coins with mining isolated');
        await shot('worker-held-after-exit', 'Worker must remain visibly held after its source crosses the left exit; no disappearing dragged model.');
        await input.move({ x: 2, y: 2 }); await input.end();
        const returned = await until(async () => { const row = await snapshot(page); return owner(row, id)?.locationKind !== 'drag' ? row : false; }, 'Invalid drop returns held worker');
        assert(owner(returned, id)?.locationKind === 'slot' && owner(returned, id).locationId === source && slot(returned, source).entityId === id && !slot(returned, source).reserved,
          'Invalid drop did not restore exactly the held worker to its reserved source');
        assert(returned.entities.filter(e => e.id === id).length === 1 && owner(returned, id).level === 1 && returned.coins === held.coins, 'Safe return duplicated/lost/merged the worker or altered coins');
        await evidence('held-exit-return', [before, held, wrapped, returned]);
        await shot('worker-returned-after-invalid-drop', 'The same level-one worker is back on the wrapped source, with no ghost or drop ring.');
        return { id, source, beforeSourceX: sourceX, wrappedSourceX: slot(wrapped, source).x, beltBefore, beltAfter, coins: returned.coins };
      });
      await check('Affordable locked-pad worker drop buys and places atomically', lockedPadDrop);
      await check('Rewind moves the whole chain smoothly over approximately 1.2 seconds', async () => {
        const setup = await fresh(page, input); await isolateMiner(page, input, setup);
        const id = await until(async () => {
          const row = await snapshot(page); return row.entities.find(e => e.kind === 'barrel' && !setup.barrels.includes(e.id))?.id;
        }, 'Seventh starter rewind barrel enters', 6000);
        await tap(input, entity(page, id));
        await until(async () => await entity(page, id).getAttribute('data-kind') === 'rewind', 'Cyan rewind revealed');
        await until(async () => (await snapshot(page)).time >= 5, 'Accumulate visible rewind distance', 6000);
        await shot('rewind-before');
        const pending = sample(page, { duration: 2300, ownership: false, interval: 25 });
        void pending.catch(() => {});
        await pause(70); await tap(input, entity(page, id));
        await pause(120); await shot('rewind-early');
        await pause(330); await shot('rewind-middle');
        await pause(330); await shot('rewind-late');
        const rows = await pending; await evidence('rewind-frames', rows);
        const active = rows.filter(r => r.motion === 'rewind'), sampled = coverage(active, 'Rewind');
        const first = active[0], last = active.at(-1), next = rows.find(r => r.time > last.time && r.motion !== 'rewind');
        assert(next, 'Rewind did not finish during observation');
        const observedDuration = next.time - first.time;
        assert(observedDuration >= 1.05 && observedDuration <= 1.35, `Observed rewind duration ${observedDuration} is not approximately 1.2 s`);
        const startMap = stoneMap(first), endMap = stoneMap(last);
        assert(startMap.size === endMap.size && [...startMap.keys()].every(key => endMap.has(key)), 'Rewind removed or replaced stones');
        const shifts = [...startMap].map(([key, stone]) => endMap.get(key).distance - stone.distance);
        assert(Math.max(...shifts) < -0.5 && Math.max(...shifts) - Math.min(...shifts) < 0.005, 'Whole-chain rewind was not a shared backward translation');
        const steps = active.slice(1).map((r, i) => active[i].head - r.head), total = first.head - last.head;
        assert(steps.filter(step => step > 0.0001).length >= 8 && Math.min(...steps) >= -0.005, 'Rewind did not progress backward through intermediate frames');
        assert(Math.max(...steps) < total * 0.3, 'A sampled rewind step resembles a teleport');
        assert(await entity(page, id).count() === 0, 'Rewind token was not consumed');
        await shot('rewind-finished', 'Compare early/middle/late frames: all visible stones translate backward together and keep spacing; no teleport or collapsing segments.');
        return { tokenId: id, observedDuration, totalSampledRewind: total, translatedStoneCount: shifts.length, maxStep: Math.max(...steps), ...sampled };
      });
      await check('Destroyed gap pauses about 0.35 seconds then retracts at 1.2 units/s until contact', async () => {
        const setup = await fresh(page, input); await isolateMiner(page, input, setup);
        const id = setup.barrels[3]; await tap(input, entity(page, id));
        await until(async () => await entity(page, id).getAttribute('data-kind') === 'bomb', 'Bomb revealed for isolated destruction');
        await begin(input, entity(page, id));
        const preview = await snapshot(page), sorted = [...preview.stones].filter(s => s.distance >= 0).sort((a, b) => a.distance - b.distance);
        const target = sorted[Math.floor(sorted.length / 2)];
        assert(target && Number.isFinite(target.x) && Number.isFinite(target.y), 'No public visible stone target');
        const point = { x: preview.canvas.x + target.x, y: preview.canvas.y + target.y };
        await input.move(point); await shot('gap-bomb-preview', 'Bomb radius is centered on an interior stone, with surviving chain ahead and behind.');
        const pending = sample(page, { duration: 7000, ownership: false, interval: 25 });
        void pending.catch(() => {});
        await pause(70); await input.end();
        await pause(90); await shot('gap-pause');
        await until(async () => (await snapshot(page)).motion === 'gap-retract', 'Visible gap retraction begins', 1800);
        await shot('gap-retract-early');
        const gapStart = await snapshot(page), gap = biggestGap(gapStart);
        assert(gap.width > SPACING + 0.15, 'Bomb did not leave a measurable interior gap');
        await until(async () => pairGap(await snapshot(page), gap.rear.id, gap.front.id) <= SPACING + 0.5, 'Gap approaches contact', 5500);
        await shot('gap-near-contact');
        const contact = await until(async () => {
          const row = await snapshot(page); return row.motion === 'forward' && pairGap(row, gap.rear.id, gap.front.id) <= SPACING + 0.01 ? row : false;
        }, 'Front and rear touch and resume forward travel', 3000);
        await shot('gap-contact', 'Gap ends at normal spacing, without overlapping stones or a one-frame snap. Compare with pause/early/near-contact frames.');
        const rows = await pending; await evidence('gap-frames', rows);
        const destroyedIndex = rows.findIndex((r, i) => i > 0 && r.stones.length < rows[i - 1].stones.length);
        assert(destroyedIndex > 0, 'No sampled public stone removal was observed');
        const before = rows[destroyedIndex - 1], destroyed = rows[destroyedIndex], destroyedMap = stoneMap(destroyed), beforeMap = stoneMap(before);
        const survivors = destroyed.stones.filter(s => beforeMap.has(s.id));
        assert(survivors.every(s => Math.abs(s.distance - beforeMap.get(s.id).distance) < 0.10), 'Destruction teleported a surviving stone before the pause');
        const paused = rows.filter(r => r.motion === 'gap-pause'), retracting = rows.filter(r => r.motion === 'gap-retract');
        assert(paused.length >= 4 && retracting.length >= 8, 'Pause or retraction lacks time-sampled evidence');
        const pauseDuration = retracting[0].time - destroyed.time;
        assert(pauseDuration >= 0.25 && pauseDuration <= 0.43, `Pause ${pauseDuration} is not approximately 0.35 s`);
        assert(Math.max(...paused.map(r => r.head)) - Math.min(...paused.map(r => r.head)) < 0.01, 'Head moved during destruction pause');
        const moving = retracting.filter(r => pairGap(r, gap.rear.id, gap.front.id) > SPACING + 0.08), sampled = coverage(moving, 'Gap retraction');
        const a = moving[0], b = moving.at(-1), ma = stoneMap(a), mb = stoneMap(b);
        const speed = (ma.get(gap.front.id).distance - mb.get(gap.front.id).distance) / (b.time - a.time);
        assert(Math.abs(speed - 1.2) < 0.05, `Measured gap retraction speed ${speed} differs from 1.2`);
        assert(Math.abs(ma.get(gap.rear.id).distance - mb.get(gap.rear.id).distance) < 0.01, 'Rear segment drifted during isolated gap retraction');
        const gapWidths = rows.slice(destroyedIndex).map(r => pairGap(r, gap.rear.id, gap.front.id));
        assert(Math.min(...gapWidths) >= SPACING - 0.01 && Math.abs(pairGap(contact, gap.rear.id, gap.front.id) - SPACING) < 0.01, 'Gap overshot or failed to reach normal contact spacing');
        assert(rows.at(-1).head > contact.head, 'Normal forward movement did not resume after contact');
        assert(await entity(page, id).count() === 0, 'Bomb not consumed');
        return { bombId: id, targetedStoneId: target.id, targetPoint: point, removedStoneCount: before.stones.length - destroyedMap.size,
          gapRearId: gap.rear.id, gapFrontId: gap.front.id, observedPause: pauseDuration, measuredRetractionSpeed: speed,
          contactGap: pairGap(contact, gap.rear.id, gap.front.id), ...sampled };
      });
    }
    result.consoleErrors = result.console.filter(m => m.type === 'error');
    result.status = result.checks.every(c => c.status === 'passed') && result.pageErrors.length === 0
      ? 'automated_pass_visual_review_required' : 'failed_or_inconclusive';
  } catch (error) { result.status = 'blocked'; result.error = error.stack || error.message; }
  finally { await input?.cancel().catch(() => {}); await context.close().catch(() => {}); }
  return result;
}

async function main() {
  let options;
  try { options = parseArgs(process.argv.slice(2)); } catch (error) { console.error(error.message); console.error(HELP); process.exitCode = 2; return; }
  if (options.help) { console.log(HELP); return; }
  await mkdir(options.output, { recursive: true });
  const report = { startedAt: new Date().toISOString(), url: options.url, node: process.version, overallBudgetMs: BUDGET_MS,
    mode: 'Feedback delta only; public mouse/touch input; read-only rendered DOM motion/ownership evidence',
    limitations: [
      'Screenshots require human inspection. Read-only DOM projections report renderer inputs and do not certify the pixels or absence of a stale WebGL mesh.',
      'Motion evidence uses simulation seconds plus wall timestamps. Throttled/incomplete sampling is inconclusive, never a fabricated timing pass.',
      'The 20-second acceleration fit is observed naturally. Sustained capped 0.85 speed and other rewind branch require focused model tests.',
      'Touch is official CDP browser emulation for one changed placement scenario, not a physical-device test or full touch regression.',
      'No broad legacy suite, debug hooks, clock acceleration, offline test, performance benchmark or soak. Raw console/request errors remain in the report.',
    ], results: [], status: 'running' };
  let browser, watchdog;
  try {
    const moduleInfo = await stat(options.module), moduleFile = moduleInfo.isDirectory() ? join(options.module, 'index.js') : options.module;
    assert((await stat(options.executable)).isFile(), 'Browser executable must be an existing file');
    const runtime = await import(pathToFileURL(moduleFile).href), chromium = runtime.chromium || runtime.default?.chromium;
    assert(typeof chromium?.launch === 'function', 'Supplied module does not expose chromium.launch');
    deadline = Date.now() + BUDGET_MS;
    watchdog = setTimeout(() => { report.budgetExceeded = true; browser?.close().catch(() => {}); }, BUDGET_MS);
    browser = await chromium.launch({ executablePath: options.executable, headless: true, chromiumSandbox: true, ignoreDefaultArgs: ['--enable-unsafe-swiftshader'], timeout: remaining(15000) });
    report.browserVersion = browser.version();
    report.results.push(await inspect(browser, options));
    if (!report.budgetExceeded && deadline - Date.now() > 10_000) report.results.push(await inspect(browser, options, true));
    else report.results.push({ name: 'portrait-touch', status: 'blocked', reason: 'Insufficient remaining observation budget; touch not claimed.' });
    report.status = report.results.every(r => r.status === 'automated_pass_visual_review_required') ? 'automated_pass_visual_review_required' : 'failed_or_inconclusive';
    process.exitCode = report.status === 'automated_pass_visual_review_required' ? 0 : 1;
  } catch (error) { report.status = 'setup_or_runtime_blocked'; report.error = error.stack || error.message; process.exitCode = 2; }
  finally {
    if (watchdog) clearTimeout(watchdog);
    if (browser) await browser.close().catch(() => {});
    report.finishedAt = new Date().toISOString();
    await writeFile(join(options.output, 'report.json'), JSON.stringify(report, null, 2));
    console.log(`Feedback smoke: ${report.status}\nReport: ${join(options.output, 'report.json')}`);
  }
}
await main();
