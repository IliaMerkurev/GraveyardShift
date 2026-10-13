#!/usr/bin/env node
/** One magnetic-motion/difficulty delta. Public mouse input; read-only DOM evidence. */
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const DEFAULT_URL = 'https://rocksnake-playable-test.pearly-haven-3558.chatgpt.site';
const BUDGET_MS = 105_000;
const SPACING = 0.245;
const expectedForward = t => 0.34 + 0.005 * t + 0.00075 * t * t;
const HELP = `RockSnake magnetic-motion production delta (ONE run)
node scripts/production-magnetic-smoke.mjs --playwright-module <existing module file or directory> --executable <installed Chrome or Edge> [--url <HTTP(S) URL>] [--output <directory>]

One fresh sandboxed browser, 1280x720, real mouse input. No installation,
download, personal profile, custom flags, debug hooks, state injection, clock
acceleration, touch rerun, old six-feature suite, or broad regression.
105-second browser budget: one isolated bomb, then ordinary starter mining to
natural defeat within 60 wall seconds. Read docs/QA_MAGNETIC.md before running.
Exit 0 = automated pass, visual review still required; 1 = failed/inconclusive;
2 = setup/runtime blocked. Run once after the updated existing Site is deployed.
`;
const assert = (ok, message) => { if (!ok) throw new Error(message); };
const pause = ms => new Promise(done => setTimeout(done, ms));
const mean = values => values.reduce((sum, value) => sum + value, 0) / values.length;
let deadline = Infinity;
function remaining(max = 4000) {
  const left = deadline - Date.now();
  assert(left > 0, 'Overall 105-second browser budget exhausted');
  return Math.max(1, Math.min(max, left));
}
function parseArgs(args) {
  const options = { url: DEFAULT_URL, output: resolve('test-results/magnetic-smoke') };
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
    await pause(Math.min(35, Math.max(1, end - Date.now())));
  }
  throw new Error(`${label}: failed/inconclusive after ${timeout} ms${lastError ? `; ${lastError.message}` : ''}`);
}
const entity = (page, id) => page.locator(`[data-entity="${id}"]`);
async function center(locator) {
  await locator.waitFor({ state: 'visible', timeout: remaining() });
  const box = await locator.boundingBox();
  assert(box?.width > 0 && box.height > 0, 'Mouse target has no visible bounds');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}
async function tap(page, locator) { const p = await center(locator); await page.mouse.click(p.x, p.y); }
async function begin(page, locator) {
  const p = await center(locator);
  await page.mouse.move(p.x, p.y); await page.mouse.down();
  await page.mouse.move(p.x, p.y - 36, { steps: 6 });
}
async function drag(page, from, target) {
  await begin(page, from);
  try { const p = await center(target); await page.mouse.move(p.x, p.y, { steps: 8 }); }
  finally { await page.mouse.up(); }
}

/** Reads renderer-synchronized DOM only; local arrays/RAF do not control the game. */
async function sample(page, { duration = 0, geometry = true, stopOnDefeat = false } = {}) {
  return page.evaluate(async options => {
    const rows = [], started = performance.now();
    function read(wall) {
      const canvas = document.querySelector('canvas'), headMarker = document.querySelector('[data-marker="head"]');
      if (!canvas || !headMarker) throw new Error('Required public canvas/head marker missing');
      const stones = JSON.parse(canvas.dataset.stones || 'null');
      if (!Array.isArray(stones) || !stones.length) throw new Error('Public stone evidence missing');
      const ordered = stones.slice().sort((a, b) => a.distance - b.distance);
      const rect = canvas.getBoundingClientRect(), dialog = document.querySelector('[role="dialog"]');
      const row = { wall, time: Number(canvas.dataset.time), motion: canvas.dataset.motion,
        speed: Number(canvas.dataset.speed), forwardSpeed: Number(canvas.dataset.forwardSpeed),
        head: Number(headMarker.dataset.distance), headId: ordered.at(-1).id,
        coins: Number(document.querySelector('[data-coins]')?.textContent),
        defeat: !!dialog && !dialog.hidden && dialog.querySelector('h1')?.textContent === 'Game over',
        stoneCount: stones.length, stoneIds: stones.map(s => s.id),
        minSeparation: Math.min(...ordered.slice(1).map((s, i) => s.distance - ordered[i].distance)),
        minRenderSeparation: Math.min(...ordered.slice(1).map((s, i) => s.renderDistance - ordered[i].renderDistance)),
        maxBounce: Math.max(...stones.map(s => s.bounce)),
        entities: [...document.querySelectorAll('[data-entity]')].map(n => ({ id: n.dataset.entity, kind: n.dataset.kind,
          level: Number(n.dataset.level), locationKind: n.dataset.locationKind, locationId: n.dataset.locationId || null })) };
      if (!options.geometry) row.track = ordered.map(s => [s.id, s.distance]);
      if (options.geometry) {
        row.stones = stones;
        row.canvas = { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
        row.pads = [...document.querySelectorAll('[data-pad]')].map(n => ({ id: n.dataset.pad, entityId: n.dataset.entityId || null }));
        row.slots = [...document.querySelectorAll('[data-slot]')].map(n => ({ id: n.dataset.slot, entityId: n.dataset.entityId || null, x: parseFloat(n.style.left) }));
      }
      return row;
    }
    return new Promise((done, reject) => {
      function frame(wall) {
        try {
          rows.push(read(wall));
          if ((options.stopOnDefeat && rows.at(-1).defeat) || wall - started >= options.duration) done(rows);
          else requestAnimationFrame(frame);
        } catch (error) { reject(error); }
      }
      requestAnimationFrame(frame);
    });
  }, { duration: Math.min(duration, remaining(61_000)), geometry, stopOnDefeat });
}
const snapshot = async page => (await sample(page))[0];
const physicalStones = row => row.stones || row.track.map(([id, distance]) => ({ id, distance }));
const mapStones = row => new Map(physicalStones(row).map(s => [s.id, s]));
const owner = (row, id) => row.entities.find(e => e.id === id);
function pairGap(row, rearId, frontId) {
  const map = mapStones(row);
  assert(map.has(rearId) && map.has(frontId), 'Tracked unchanged gap endpoint disappeared');
  return map.get(frontId).distance - map.get(rearId).distance;
}
function gaps(row) {
  const sorted = physicalStones(row).slice().sort((a, b) => a.distance - b.distance);
  return sorted.slice(1).map((front, i) => ({ rear: sorted[i], front, width: front.distance - sorted[i].distance }))
    .filter(gap => gap.width > SPACING + 0.001).sort((a, b) => b.width - a.width);
}
function advancing(rows) { return rows.filter((row, i) => !i || row.time > rows[i - 1].time + 0.00001); }
function frameCoverage(rows, label, minimum = 8) {
  const unique = advancing(rows);
  assert(unique.length >= minimum, `${label}: fewer than ${minimum} distinct active frames`);
  const maxStep = Math.max(...unique.slice(1).map((r, i) => r.time - unique[i].time));
  const maxWallStep = Math.max(...unique.slice(1).map((r, i) => (r.wall - unique[i].wall) / 1000));
  assert(maxStep <= 0.07 && maxWallStep <= 0.14, `${label}: sparse/throttled sampling (${maxStep.toFixed(3)} active, ${maxWallStep.toFixed(3)} wall seconds)`);
  return { sampledFrames: rows.length, distinctActiveFrames: unique.length, maxActiveStep: maxStep, maxWallStep };
}
function measuredPairs(rows) {
  return rows.slice(1).map((b, i) => {
    const a = rows[i], dt = b.time - a.time;
    return { a, b, dt, headVelocity: (b.head - a.head) / dt };
  }).filter(p => p.dt > 0.00001 && p.a.headId === p.b.headId);
}
function signedSpeedEvidence(rows, label) {
  const pairs = measuredPairs(rows).filter(p => Math.abs(p.dt - 1 / 60) < 0.0001 && p.a.motion === p.b.motion && !p.b.defeat);
  assert(pairs.length >= 12, `${label}: insufficient single-step same-head-ID telemetry samples`);
  const errors = pairs.map(p => Math.abs(p.headVelocity - p.b.speed));
  assert(Math.max(...errors) < 0.04, `${label}: data-speed differs from actual head movement (max error ${Math.max(...errors)})`);
  return { pairs: pairs.length, maxError: Math.max(...errors), meanError: mean(errors) };
}
async function fresh(page) {
  const old = await page.locator('[data-kind="worker"]').first().getAttribute('data-entity');
  await tap(page, page.locator('button[aria-label="Restart"]'));
  return until(async () => {
    const row = await snapshot(page), workers = row.entities.filter(e => e.kind === 'worker');
    if (workers.length !== 1 || workers[0].id === old || row.entities.filter(e => e.kind === 'barrel').length !== 6) return false;
    return { row, starterId: workers[0].id, barrels: row.slots.slice().sort((a, b) => a.x - b.x).map(s => s.entityId) };
  }, 'Fresh ordinary starter setup');
}
async function isolateMiner(page, setup) {
  // Setup only: open the coin barrel to make a real, empty slot, then park the miner.
  await tap(page, entity(page, setup.barrels[2]));
  await until(async () => await entity(page, setup.barrels[2]).count() === 0, 'Coin setup leaves a free slot');
  await drag(page, entity(page, setup.starterId), page.locator('[data-slot="slot-2"]'));
  await until(async () => owner(await snapshot(page), setup.starterId)?.locationKind === 'slot', 'Park starter miner with public drag');
  assert((await snapshot(page)).pads.every(p => !p.entityId), 'Miner isolation failed');
}

async function inspect(browser, options) {
  const result = { viewport: { width: 1280, height: 720 }, input: 'Real Playwright mouse', checks: [], screenshots: [], evidenceFiles: [], visualLimitations: [], console: [], pageErrors: [], failedRequests: [], status: 'running' };
  const context = await browser.newContext({ viewport: result.viewport, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.setDefaultTimeout(4000); page.setDefaultNavigationTimeout(15000);
  page.on('console', message => result.console.push({ type: message.type(), text: message.text() }));
  page.on('pageerror', error => result.pageErrors.push(error.message));
  page.on('requestfailed', request => result.failedRequests.push({ url: request.url(), error: request.failure()?.errorText }));
  async function evidence(label, rows) {
    const path = join(options.output, `${label}.json`);
    await writeFile(path, JSON.stringify(rows)); result.evidenceFiles.push({ label, path, frames: rows.length });
  }
  async function shot(label, manualReview) {
    const path = join(options.output, `${label}.png`), observedBeforeCapture = await snapshot(page);
    await page.screenshot({ path, fullPage: true, timeout: remaining() });
    result.screenshots.push({ label, path, manualReview, observedBeforeCapture: { time: observedBeforeCapture.time, motion: observedBeforeCapture.motion, maxBounce: observedBeforeCapture.maxBounce } });
  }
  async function check(label, action) {
    const started = Date.now();
    try {
      remaining(); const details = await action();
      result.checks.push({ label, status: 'passed', durationMs: Date.now() - started, details }); console.log(`PASS ${label}`);
    } catch (error) {
      result.checks.push({ label, status: 'failed_or_inconclusive', durationMs: Date.now() - started, error: error.stack || error.message });
      console.log(`FAIL/INCONCLUSIVE ${label}: ${error.message}`);
      try { await page.mouse.up(); await shot(`failure-${result.checks.length}`, 'Inspect the actual failed/inconclusive state.'); } catch { /* Preserve original failure. */ }
    }
  }
  try {
    const response = await page.goto(options.url, { waitUntil: 'domcontentloaded', timeout: remaining(15000) });
    assert(response?.ok(), `HTTP response ${response?.status() ?? 'missing'}`);
    const html = await response.body();
    result.document = { url: page.url(), bytes: html.length, sha256: createHash('sha256').update(html).digest('hex') };
    await until(async () => await page.locator('[data-entity]').count() > 0 || await page.locator('[role="alert"]').count() > 0, 'Game or graphics fallback', 8000);
    const fallback = page.locator('[role="alert"]');
    assert(await fallback.count() === 0, await fallback.count() ? await fallback.innerText() : 'Graphics fallback');
    assert(await page.evaluate(() => !('__rocksnake' in window)), 'Production exposes a development hook');
    const initial = await snapshot(page);
    assert([initial.time, initial.head, initial.speed, initial.forwardSpeed].every(Number.isFinite), 'Updated public motion/forward-speed evidence missing');
    assert(initial.stones.every(s => s.id && [s.distance, s.renderDistance, s.x, s.y, s.bounce].every(Number.isFinite)), 'Updated public per-stone bounce/projection evidence missing');

    await check('Magnetic closure: moving rear, paused front, gap-dependent pull, small bounce, safe contact', async () => {
      const setup = await fresh(page); await isolateMiner(page, setup);
      const bombId = setup.barrels[3]; await tap(page, entity(page, bombId));
      await until(async () => await entity(page, bombId).getAttribute('data-kind') === 'bomb', 'Starter bomb revealed');
      await begin(page, entity(page, bombId));
      const preview = await snapshot(page), visible = preview.stones.filter(s => s.distance >= 0).sort((a, b) => a.distance - b.distance);
      const target = visible[Math.floor(visible.length / 2)];
      assert(target && target.distance > visible[0].distance + 3 && target.distance < visible.at(-1).distance - 3, 'Bomb target lacks surviving rear/front space');
      const targetPoint = { x: preview.canvas.x + target.x, y: preview.canvas.y + target.y };
      await page.mouse.move(targetPoint.x, targetPoint.y, { steps: 8 });
      await shot('magnetic-before', 'Interior bomb preview: locate the rear/tail, gap target, front section and head.');
      const pending = sample(page, { duration: 4500 });
      void pending.catch(() => {});
      let captureError;
      try {
        await pause(100); await page.mouse.up(); await pause(80);
        await shot('magnetic-pause', 'Front briefly holds while the unchanged rear/tail continues advancing.');
        await until(async () => { const row = await snapshot(page); return row.motion === 'gap-retract' ? row : false; }, 'Magnetic pull', 1800);
        await shot('magnetic-pull-early', 'Front section is pulling backward while the unchanged rear and tail advance.');
        await until(async () => { const row = await snapshot(page); return row.motion === 'forward' && row.maxBounce > 0.005 ? row : false; }, 'Small contact recoil', 1800);
        await shot('magnetic-contact-bounce', 'At contact, front stones recoil slightly forward along the track, with a subtle lift. Inspect rigid shape and minimum spacing.');
      } catch (error) { captureError = error; }
      const rows = await pending; await evidence('magnetic-frames', rows);
      if (captureError) result.visualLimitations.push(`Timed magnetic screenshot coverage: ${captureError.message}. Use saved RAF evidence; do not claim the missed pixels were inspected.`);
      await shot('magnetic-settled', 'Normal separation and forward travel resume; the small bounce settles with no overlap or ghost stones.');
      const destroyedIndex = rows.findIndex((row, i) => i > 0 && rows[i - 1].stoneIds.some(id => !row.stoneIds.includes(id)));
      assert(destroyedIndex > 0, 'No pre/post public stone-removal transition sampled');
      const before = rows[destroyedIndex - 1], destroyed = rows[destroyedIndex], beforeMap = mapStones(before), afterMap = mapStones(destroyed);
      const removedIds = before.stoneIds.filter(id => !afterMap.has(id));
      assert(removedIds.length >= 2, 'Bomb did not create a useful large gap');
      const openGaps = gaps(destroyed);
      assert(openGaps.length === 1, `Expected one isolated interior gap; observed ${openGaps.length}`);
      const gap = openGaps[0], rearId = gap.rear.id, frontId = gap.front.id;
      const tailId = before.stones.slice().sort((a, b) => a.distance - b.distance)[0].id;
      assert(afterMap.has(tailId) && destroyed.headId === before.headId, 'Bomb removed an endpoint required for unchanged-ID motion evidence');
      for (const stone of destroyed.stones.filter(s => beforeMap.has(s.id))) {
        const delta = stone.distance - beforeMap.get(stone.id).distance;
        assert(delta >= -0.005 && delta <= 0.10, 'Damage teleported a surviving stone before magnetic recovery');
      }
      const afterRows = rows.slice(destroyedIndex), paused = afterRows.filter(r => r.motion === 'gap-pause'), pulling = afterRows.filter(r => r.motion === 'gap-retract');
      const pauseCoverage = frameCoverage(paused, 'Front pause'), pullCoverage = frameCoverage(pulling, 'Magnetic pull');
      const pauseDuration = pulling[0].time - destroyed.time;
      assert(pauseDuration >= 0.28 && pauseDuration <= 0.42, `Front pause ${pauseDuration} s differs from approximately 0.35 s`);
      assert(Math.max(...paused.map(r => r.head)) - Math.min(...paused.map(r => r.head)) < 0.005, 'Front/head drifted during its pause');
      const displacement = (phase, id) => mapStones(phase.at(-1)).get(id).distance - mapStones(phase[0]).get(id).distance;
      const pauseRear = displacement(paused, rearId), pauseTail = displacement(paused, tailId);
      assert(pauseRear > 0.05 && pauseTail > 0.05 && Math.abs(pauseRear - pauseTail) < 0.005, 'Unchanged rear and tail IDs did not physically advance during the front pause');
      const pullRear = displacement(pulling, rearId), pullTail = displacement(pulling, tailId);
      assert(pullRear > 0.03 && pullTail > 0.03 && Math.abs(pullRear - pullTail) < 0.005, 'Rear/tail froze or lost rigid spacing during magnetic pull');
      const pullPairs = measuredPairs(pulling).filter(p => p.dt <= 0.035 && pairGap(p.b, rearId, frontId) > SPACING + 0.06).map(p => {
        const ma = mapStones(p.a), mb = mapStones(p.b);
        return { time: p.b.time, dt: p.dt, gap: (pairGap(p.a, rearId, frontId) + pairGap(p.b, rearId, frontId)) / 2 - SPACING,
          pullSpeed: (ma.get(frontId).distance - mb.get(frontId).distance) / p.dt,
          rearSpeed: (mb.get(rearId).distance - ma.get(rearId).distance) / p.dt };
      }).sort((a, b) => a.gap - b.gap);
      assert(pullPairs.length >= 9, 'Insufficient non-contact actual-motion pairs for distance-dependent pull');
      const count = Math.max(3, Math.floor(pullPairs.length / 3)), small = pullPairs.slice(0, count), large = pullPairs.slice(-count);
      const smallGap = mean(small.map(p => p.gap)), largeGap = mean(large.map(p => p.gap));
      const smallSpeed = mean(small.map(p => p.pullSpeed)), largeSpeed = mean(large.map(p => p.pullSpeed));
      assert(largeGap > smallGap + 0.2 && largeSpeed > smallSpeed * 1.2 && smallSpeed > 2.4, `Pull is not fast and gap-dependent: small ${smallGap}/${smallSpeed}, large ${largeGap}/${largeSpeed}`);
      assert(pullPairs.every(p => p.rearSpeed > 0.1), 'Rear was stationary/backward in a non-contact magnetic interval');
      const bounced = afterRows.filter(r => r.maxBounce > 0.005), maxBounce = Math.max(...afterRows.map(r => r.maxBounce));
      assert(bounced.length >= 3 && maxBounce > 0.05 && maxBounce <= 0.10001, `Missing or excessive small bounce (${maxBounce})`);
      assert(afterRows.every(r => r.stones.every(s => Number.isFinite(s.bounce) && s.bounce >= -0.00001 && Math.abs(s.bounce - (s.renderDistance - s.distance)) < 0.00001)), 'Invalid/negative contact-recoil distance');
      const recoilDuration = bounced.at(-1).time - bounced[0].time;
      assert(recoilDuration >= 0.12 && recoilDuration <= 0.27, `Small contact recoil did not settle in approximately 0.24 seconds (${recoilDuration})`);
      const contact = afterRows.find(r => r.time > pulling[0].time && r.motion === 'forward' && pairGap(r, rearId, frontId) <= SPACING + 0.001);
      assert(contact, 'Gap never reached contact and resumed forward movement');
      assert(afterRows.every(r => r.minSeparation >= SPACING - 0.00001 && r.minRenderSeparation >= SPACING - 0.00001), 'Physical or rendered chain compressed through normal contact spacing');
      assert(afterRows.every(r => pairGap(r, rearId, frontId) >= SPACING - 0.00001), 'Tracked boundary crossed or overlapped at contact');
      assert(rows.at(-1).head > contact.head + 0.1 && rows.at(-1).maxBounce < 0.002, 'Forward recovery or settled bounce missing after contact');
      assert(await entity(page, bombId).count() === 0, 'Bomb was not consumed by the public drop');
      const signedSpeed = signedSpeedEvidence(rows, 'Magnetic head-speed evidence');
      assert(measuredPairs(pulling).some(p => p.dt <= 0.035 && p.headVelocity < -2.4 && p.b.speed < -2.4), 'Negative actual head speed was not observed during fast pull');
      return { bombId, targetedStoneId: target.id, targetPoint, removedIds, rearId, frontId, tailId,
        observedPauseSeconds: pauseDuration, observedPauseWallMs: pulling[0].wall - destroyed.wall,
        pauseRearAdvance: pauseRear, pauseTailAdvance: pauseTail, pullRearAdvance: pullRear, pullTailAdvance: pullTail,
        smallGap, smallGapActualPullSpeed: smallSpeed, largeGap, largeGapActualPullSpeed: largeSpeed,
        pullSpeedSamples: pullPairs, maxBounce, recoilDuration, bounceFrames: bounced.length, contactGap: pairGap(contact, rearId, frontId),
        minimumSeparation: Math.min(...afterRows.map(r => r.minSeparation)), minimumRenderedSeparation: Math.min(...afterRows.map(r => r.minRenderSeparation)), pauseCoverage, pullCoverage, signedSpeed };
    });

    await check('Rising actual difficulty reaches natural defeat despite ordinary starter mining', async () => {
      const runStarted = Date.now(), setup = await fresh(page);
      assert(owner(setup.row, setup.starterId)?.locationKind === 'pad', 'Ordinary starter miner is not active on a pad');
      await shot('difficulty-start', 'One unmodified level-one starter miner remains on its original pad. No bonuses or purchases are used.');
      const duration = 60_000 - (Date.now() - runStarted);
      assert(duration > 0, 'Ordinary mining setup exceeded its 60-second window');
      const rows = await sample(page, { duration, geometry: false, stopOnDefeat: true });
      await evidence('difficulty-frames', rows);
      const end = rows.at(-1), wallSeconds = (Date.now() - runStarted) / 1000;
      await shot(end.defeat ? 'difficulty-natural-defeat' : 'difficulty-timeout', 'Inspect the genuine Game over overlay and head at FINISH. A timeout is inconclusive, never a fabricated defeat.');
      assert(end.defeat && wallSeconds <= 60.5, `No natural defeat within 60 wall seconds (observed ${wallSeconds.toFixed(2)} s, active ${end.time.toFixed(2)} s)`);
      assert(rows.every(r => owner(r, setup.starterId)?.locationKind === 'pad' && owner(r, setup.starterId)?.locationId === 'pad-0' && owner(r, setup.starterId)?.level === 1), 'Ordinary starter miner changed ownership or level');
      const minedIds = new Set();
      for (let i = 1; i < rows.length; i++) for (const id of rows[i - 1].stoneIds) if (!rows[i].stoneIds.includes(id)) minedIds.add(id);
      assert(minedIds.size > 0 && end.coins > setup.row.coins, 'No actual mined removal/reward observed during the ordinary-miner run');
      const miningIndex = rows.findIndex((r, i) => i > 0 && rows[i - 1].stoneIds.some(id => !r.stoneIds.includes(id)) && gaps(r).length > 0);
      assert(miningIndex > 0, 'No naturally mined interior gap was sampled');
      const miningStart = rows[miningIndex], miningGap = gaps(miningStart)[0];
      const miningRearId = miningGap.rear.id, miningFrontId = miningGap.front.id, miningTailId = physicalStones(rows[miningIndex - 1]).slice().sort((a, b) => a.distance - b.distance)[0].id;
      const miningContactIndex = rows.findIndex((r, i) => i > miningIndex && r.motion === 'forward' && pairGap(r, miningRearId, miningFrontId) <= SPACING + 0.001);
      assert(miningContactIndex > miningIndex, 'Naturally mined gap did not safely close and resume forward motion');
      const miningRecovery = rows.slice(miningIndex, miningContactIndex + 1), miningPause = miningRecovery.filter(r => r.motion === 'gap-pause');
      assert(advancing(miningPause).length >= 3, 'Insufficient actual mining-pause frames');
      const miningPauseRear = mapStones(miningPause.at(-1)).get(miningRearId).distance - mapStones(miningPause[0]).get(miningRearId).distance;
      const miningPauseTail = mapStones(miningPause.at(-1)).get(miningTailId).distance - mapStones(miningPause[0]).get(miningTailId).distance;
      assert(miningPauseRear > 0.02 && miningPauseTail > 0.02 && Math.abs(miningPauseRear - miningPauseTail) < 0.005, 'Actual mining froze or distorted the advancing rear during its front pause');
      assert(Math.max(...miningPause.map(r => r.head)) - Math.min(...miningPause.map(r => r.head)) < 0.005, 'Actual mining front moved before pull/contact');
      const miningPull = measuredPairs(miningRecovery).map(p => {
        const a = mapStones(p.a), b = mapStones(p.b);
        return { time: p.b.time, dt: p.dt, frontShift: b.get(miningFrontId).distance - a.get(miningFrontId).distance,
          rearShift: b.get(miningRearId).distance - a.get(miningRearId).distance };
      }).filter(p => p.frontShift < -0.0001);
      // A one-link gap may close by rear contact before pull, or pull for only 2–3 steps.
      if (miningPull.length) assert(miningPull.every(p => p.rearShift > 0), 'Observed natural-mining pull anchored or reversed the rear');
      const miningMotion = { removalTime: miningStart.time, rearId: miningRearId, frontId: miningFrontId, tailId: miningTailId,
        pauseFrames: miningPause.length, pauseRearAdvance: miningPauseRear, pauseTailAdvance: miningPauseTail,
        sampledPullIntervals: miningPull, contactTime: rows[miningContactIndex].time,
        contactGap: pairGap(rows[miningContactIndex], miningRearId, miningFrontId),
        pullCoverage: miningPull.length ? 'Actual front retraction and rear advance sampled.' : 'No backward interval sampled; moving rear closed the small gap safely, including the permitted early-contact branch.' };
      assert(rows.every(r => r.minSeparation >= SPACING - 0.00001 && r.minRenderSeparation >= SPACING - 0.00001), 'Repeated ordinary mining caused physical/rendered overlap or compressed spacing');
      assert(rows.every(r => Number.isFinite(r.forwardSpeed) && Math.abs(r.forwardSpeed - expectedForward(r.time)) < 0.003), 'Public forward-speed curve differs from 0.34 + 0.005t + 0.00075t²');
      const forward = measuredPairs(rows).filter(p => Math.abs(p.dt - 1 / 60) < 0.0001 && p.a.motion === 'forward' && p.b.motion === 'forward' && !p.b.defeat);
      assert(forward.length >= 60, 'Insufficient naturally reached actual forward-motion samples');
      const errors = forward.map(p => Math.abs(p.headVelocity - expectedForward(p.b.time)));
      assert(Math.max(...errors) < 0.04, `Actual forward displacement does not follow rising difficulty (max error ${Math.max(...errors)})`);
      const early = forward.filter(p => p.b.time < 3), late = forward.filter(p => p.b.time >= end.time - 3);
      assert(early.length >= 8 && late.length >= 8, 'Insufficient early/late actual-speed coverage');
      const earlySpeed = mean(early.map(p => p.headVelocity)), lateSpeed = mean(late.map(p => p.headVelocity));
      assert(lateSpeed > earlySpeed * 2 && lateSpeed > expectedForward(end.time - 3) * 0.95, `Difficulty did not increase substantially in actual movement: ${earlySpeed} → ${lateSpeed}`);
      const signedSpeed = signedSpeedEvidence(rows, 'Ordinary-run head-speed evidence');
      return { starterId: setup.starterId, wallSeconds, activeSecondsAtDefeat: end.time, minedStoneCount: minedIds.size,
        minedStoneIds: [...minedIds], miningMotion, earnedCoins: end.coins - setup.row.coins, earlyActualSpeed: earlySpeed, lateActualSpeed: lateSpeed,
        actualSpeedRatio: lateSpeed / earlySpeed, forwardMotionPairs: forward.length, maximumActualForwardError: Math.max(...errors),
        peakObservedForwardSpeed: Math.max(...rows.map(r => r.forwardSpeed)), finalHeadDistance: end.head, signedSpeed,
        coverageLimit: 'Natural ordinary-starter run only. This does not prove every strategy loses, nor does it claim naturally observed speeds after defeat.' };
    });
    result.consoleErrors = result.console.filter(entry => entry.type === 'error');
    result.status = result.checks.length === 2 && result.checks.every(c => c.status === 'passed') && result.pageErrors.length === 0
      ? 'automated_pass_visual_review_required' : 'failed_or_inconclusive';
  } catch (error) { result.status = 'blocked'; result.error = error.stack || error.message; }
  finally { await page.mouse.up().catch(() => {}); await context.close().catch(() => {}); }
  return result;
}

async function main() {
  let options;
  try { options = parseArgs(process.argv.slice(2)); } catch (error) { console.error(error.message); console.error(HELP); process.exitCode = 2; return; }
  if (options.help) { console.log(HELP); return; }
  await mkdir(options.output, { recursive: true });
  const report = { startedAt: new Date().toISOString(), url: options.url, node: process.version, overallBudgetMs: BUDGET_MS,
    mode: 'One magnetic-motion/difficulty delta; real mouse input and read-only per-RAF DOM evidence',
    limitations: [
      'Automated DOM evidence is renderer input, not a certification of pixels. Human screenshot review remains required.',
      'Single fixed-step same-ID samples verify actual signed head speed. Sparse or throttled frames are inconclusive, not a timing pass.',
      'Natural defeat is tested once with the default starter miner left working. It does not establish defeat for every possible strategy.',
      'Speeds at 40/60 seconds are not claimed as browser observations if the natural run has already ended.',
      'No old six-feature suite, mobile/touch rerun, broad regression, performance benchmark, soak, injected state or accelerated clock.',
    ], results: [], status: 'running' };
  let browser, watchdog;
  try {
    const moduleInfo = await stat(options.module), moduleFile = moduleInfo.isDirectory() ? join(options.module, 'index.js') : options.module;
    assert((await stat(options.executable)).isFile(), 'Browser executable must already exist');
    const runtime = await import(pathToFileURL(moduleFile).href), chromium = runtime.chromium || runtime.default?.chromium;
    assert(typeof chromium?.launch === 'function', 'Existing module does not expose chromium.launch');
    deadline = Date.now() + BUDGET_MS;
    watchdog = setTimeout(() => { report.budgetExceeded = true; browser?.close().catch(() => {}); }, BUDGET_MS);
    browser = await chromium.launch({ executablePath: options.executable, headless: true, chromiumSandbox: true, ignoreDefaultArgs: ['--enable-unsafe-swiftshader'], timeout: remaining(15000) });
    report.browserVersion = browser.version();
    report.results.push(await inspect(browser, options));
    report.status = !report.budgetExceeded && report.results[0].status === 'automated_pass_visual_review_required' ? 'automated_pass_visual_review_required' : 'failed_or_inconclusive';
    process.exitCode = report.status === 'automated_pass_visual_review_required' ? 0 : 1;
  } catch (error) { report.status = 'setup_or_runtime_blocked'; report.error = error.stack || error.message; process.exitCode = 2; }
  finally {
    if (watchdog) clearTimeout(watchdog);
    if (browser) await browser.close().catch(() => {});
    report.finishedAt = new Date().toISOString();
    await writeFile(join(options.output, 'report.json'), JSON.stringify(report, null, 2));
    console.log(`Magnetic smoke: ${report.status}\nReport: ${join(options.output, 'report.json')}`);
  }
}
await main();
