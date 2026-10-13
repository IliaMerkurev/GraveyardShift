#!/usr/bin/env node
/** Production-only smoke checks. No app hooks, installs, browser flags or profile reuse. */
import { mkdir, writeFile, stat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const DEFAULT_URL = 'https://rocksnake-playable-test.pearly-haven-3558.chatgpt.site';
const HELP = `RockSnake production smoke (ordinary Playwright API, no @playwright/test)

node scripts/production-smoke.mjs --playwright-module <existing module file or directory> --executable <installed Chrome or Edge executable> [--url <https URL>] [--output <directory>]

Required paths are supplied by the executor. No packages/browsers are installed.
A fresh headless browser is launched with no custom browser arguments or profile.
Both 360x640 and 1280x720 use real mouse input, not touch emulation.
The report records individual passes/failures/blocks and screenshot paths.
A failed WebGL2 check blocks gameplay; no success is fabricated.
Exit codes: 0 all included checks pass; 1 failed/blocked checks; 2 setup error.
`;

function parseArgs(args) {
  const options = { url: DEFAULT_URL, output: resolve('rocksnake-smoke-results') };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--help' || args[i] === '-h') return { help: true };
    const key = { '--playwright-module': 'module', '--executable': 'executable', '--url': 'url', '--output': 'output' }[args[i]];
    if (!key || !args[i + 1] || args[i + 1].startsWith('--')) throw new Error(`Unknown option or missing value: ${args[i]}`);
    options[key] = args[++i];
  }
  if (!options.module || !options.executable) throw new Error('Supply --playwright-module and --executable. Use --help for details.');
  const url = new URL(options.url);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('URL must be HTTP or HTTPS.');
  options.module = resolve(options.module);
  options.executable = resolve(options.executable);
  options.output = resolve(options.output);
  return options;
}

const pause = ms => new Promise(resolvePause => setTimeout(resolvePause, ms));
async function until(predicate, description, timeout = 8000) {
  const deadline = Date.now() + timeout;
  let lastError;
  while (Date.now() < deadline) {
    try { if (await predicate()) return; } catch (error) { lastError = error; }
    await pause(120);
  }
  throw new Error(`${description} did not become true within ${timeout} ms${lastError ? `: ${lastError.message}` : ''}`);
}
function assert(condition, description) { if (!condition) throw new Error(description); }

async function center(locator) {
  await locator.waitFor({ state: 'visible', timeout: 8000 });
  const bounds = await locator.boundingBox();
  assert(bounds && bounds.width > 0 && bounds.height > 0, 'Target has no visible bounds');
  return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
}
async function tap(page, locator) {
  const point = await center(locator);
  await page.mouse.click(point.x, point.y);
}
async function drag(page, source, target) {
  const start = await center(source);
  const end = await center(target);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  try {
    await page.mouse.move(start.x, start.y - 14, { steps: 3 });
    await page.mouse.move(end.x, end.y, { steps: 18 });
  } finally { await page.mouse.up(); }
}
const entity = (page, id) => page.locator(`[data-entity="${id}"]`);
async function coins(page) {
  const value = Number(await page.locator('[data-coins]').textContent());
  assert(Number.isFinite(value) && value >= 0, 'Visible coin count is invalid');
  return value;
}
async function freshRun(page) {
  await page.locator('button[aria-label="Restart"]').click();
  await until(async () =>
    await page.locator('[data-entity][data-kind="barrel"]').count() === 6 &&
    await page.locator('[data-entity][data-kind="worker"]').count() === 1 &&
    await page.locator('[data-entity][data-kind="worker"]').first().getAttribute('data-level') === '1',
  'Restart restores six barrels and one level-one worker');
}

async function inspectViewport(browser, options, viewport, name) {
  const result = { name, viewport, input: 'Playwright mouse (not touch)', checks: [], console: [], pageErrors: [], requests: [], screenshots: [], status: 'running' };
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, hasTouch: false });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.on('console', message => result.console.push({ type: message.type(), text: message.text() }));
  page.on('pageerror', error => result.pageErrors.push(error.message));
  page.on('requestfailed', request => result.requests.push({ url: request.url(), error: request.failure()?.errorText }));
  async function screenshot(label) {
    const path = join(options.output, `${name}-${label}.png`);
    await page.screenshot({ path, fullPage: true });
    result.screenshots.push({ label, path });
  }
  async function check(label, action) {
    const start = Date.now();
    try {
      const details = await action();
      result.checks.push({ label, status: 'passed', durationMs: Date.now() - start, ...(details ? { details } : {}) });
      console.log(`${name}: PASS ${label}`);
      return true;
    } catch (error) {
      result.checks.push({ label, status: 'failed', durationMs: Date.now() - start, error: error.message });
      console.log(`${name}: FAIL ${label}: ${error.message}`);
      return false;
    }
  }
  try {
    const loaded = await check('Production document loads', async () => {
      const response = await page.goto(options.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      assert(response && response.ok(), `HTTP response is ${response?.status() ?? 'missing'}`);
      const document = await response.body();
      result.document = { url: page.url(), bytes: document.length, sha256: createHash('sha256').update(document).digest('hex') };
      await until(async () => await page.locator('[data-entity]').count() > 0 || await page.locator('[role="alert"]').count() > 0, 'Game scene or explanatory fallback', 15000);
      await screenshot('initial');
    });
    if (!loaded) { result.status = 'blocked'; return result; }
    const graphics = await check('WebGL2 game scene is present', async () => {
      const alert = page.locator('[role="alert"]');
      if (await alert.count()) throw new Error((await alert.innerText()).trim());
      await page.locator('canvas').waitFor({ state: 'visible' });
      assert(await page.locator('[data-entity][data-kind="barrel"]').count() === 6, 'Expected six initial barrel markers');
      assert(await page.locator('[data-entity][data-kind="worker"]').count() === 1, 'Expected one initial worker marker');
      assert(result.pageErrors.length === 0, `Page error: ${result.pageErrors.join('; ')}`);
    });
    if (!graphics) { result.status = 'blocked'; return result; }

    await check('Starting worker earns coins without opening a bonus', async () => {
      const before = await coins(page);
      await until(async () => await coins(page) > before, 'Automatic mining increases the visible coin count', 30000);
      return { before, after: await coins(page) };
    });
    await check('Restart resets visible gameplay', () => freshRun(page));
    const ids = await page.locator('[data-entity][data-kind="barrel"]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-entity')));
    const starterId = await page.locator('[data-entity][data-kind="worker"]').first().getAttribute('data-entity');
    assert(ids.length === 6 && starterId, 'Cannot resolve initial visible actors after restart');

    const opened = await check('Mouse tap opens a worker barrel once', async () => {
      await tap(page, entity(page, ids[0]));
      await until(async () => await entity(page, ids[0]).getAttribute('data-kind') === 'worker', 'Barrel becomes a worker');
    });
    if (opened) {
      await check('Real mouse drag merges into the occupied worker pad', async () => {
        await drag(page, entity(page, ids[0]), entity(page, starterId));
        await until(async () => await entity(page, ids[0]).count() === 0 && await entity(page, starterId).getAttribute('data-level') === '2', 'Source is removed and target becomes level two');
      });
    } else result.checks.push({ label: 'Real mouse drag merge', status: 'blocked', reason: 'Worker barrel did not open' });

    const bonus = await check('Coin barrel awards its visible bonus', async () => {
      const before = await coins(page);
      await tap(page, entity(page, ids[2]));
      await until(async () => await entity(page, ids[2]).count() === 0 && await coins(page) >= before + 50, 'Bonus barrel disappears and at least 50 coins are added');
      return { before, after: await coins(page) };
    });
    const pad = page.locator('[data-pad="pad-1"]');
    const purchased = bonus && await check('Affordable pad can be purchased through its visible price', async () => {
      await tap(page, pad);
      await until(async () => await pad.getAttribute('data-unlocked') === 'true', 'Pad is unlocked');
    });
    if (purchased) {
      await check('Real mouse drag places another worker on the new pad', async () => {
        await tap(page, entity(page, ids[1]));
        await until(async () => await entity(page, ids[1]).getAttribute('data-kind') === 'worker', 'Second barrel becomes a worker');
        const destination = await center(pad);
        await drag(page, entity(page, ids[1]), pad);
        await until(async () => !await pad.isVisible(), 'Open-pad marker disappears when occupied');
        const actor = await center(entity(page, ids[1]));
        assert(Math.hypot(actor.x - destination.x, actor.y - destination.y) < 44, 'Worker did not reach the visible pad');
      });
    } else result.checks.push({ label: 'Worker placement', status: 'blocked', reason: 'Purchase precondition failed' });

    await check('Help pauses and returns to the visible game', async () => {
      await page.locator('button[aria-label="Help"]').click();
      await page.getByRole('heading', { name: 'A little mining lab' }).waitFor({ state: 'visible' });
      const value = await coins(page);
      await pause(1400);
      assert(await coins(page) === value, 'Coin count changed while Help was open');
      await page.locator('[data-continue]').click();
      await page.locator('.overlay').waitFor({ state: 'hidden' });
    });
    await screenshot('gameplay');
    await check('Repeated restart preserves visible object counts', async () => {
      await freshRun(page);
      await freshRun(page);
    });
    await screenshot('restart');
    await check('No uncaught application errors', async () => {
      assert(result.pageErrors.length === 0, result.pageErrors.join('; '));
      const errors = result.console.filter(message => message.type === 'error');
      assert(errors.length === 0, errors.map(message => message.text).join('; '));
    });
    result.status = result.checks.some(item => item.status !== 'passed') ? 'failed' : 'passed';
  } catch (error) {
    result.status = 'failed';
    result.unexpectedError = error.stack || error.message;
    try { await screenshot('failure'); } catch (captureError) { result.screenshotError = captureError.message; }
  } finally { await context.close(); }
  return result;
}

async function main() {
  let options;
  try { options = parseArgs(process.argv.slice(2)); } catch (error) { console.error(error.message); console.error(HELP); process.exitCode = 2; return; }
  if (options.help) { console.log(HELP); return; }
  await mkdir(options.output, { recursive: true });
  const report = {
    startedAt: new Date().toISOString(), url: options.url, node: process.version,
    mode: 'Fresh headless installed Chromium-family browser; no custom launch arguments',
    limitations: ['Mouse only; portrait viewport is not a touch-device test.', 'No five-minute soak, bomb targeting, offline interception or performance benchmark.', 'A screenshot and DOM presence do not alone prove visually correct geometry; inspect the image files.', 'No app debug hooks or game-state mutations are used.'],
    results: [], status: 'running',
  };
  let browser;
  try {
    const moduleInfo = await stat(options.module);
    const moduleFile = moduleInfo.isDirectory() ? join(options.module, 'index.js') : options.module;
    assert((await stat(options.executable)).isFile(), 'Browser executable must be an existing file');
    const runtime = await import(pathToFileURL(moduleFile).href);
    const chromium = runtime.chromium || runtime.default?.chromium;
    assert(chromium && typeof chromium.launch === 'function', 'Supplied module does not expose Playwright chromium.launch');
    browser = await chromium.launch({ executablePath: options.executable, headless: true, chromiumSandbox: true, ignoreDefaultArgs: ['--enable-unsafe-swiftshader'] });
    report.browserVersion = browser.version();
    for (const [name, viewport] of [['portrait-360x640', { width: 360, height: 640 }], ['landscape-1280x720', { width: 1280, height: 720 }]]) {
      report.results.push(await inspectViewport(browser, options, viewport, name));
    }
    report.status = report.results.every(result => result.status === 'passed') ? 'passed' : 'failed_or_blocked';
    process.exitCode = report.status === 'passed' ? 0 : 1;
  } catch (error) {
    report.status = 'setup_blocked'; report.setupError = error.stack || error.message; process.exitCode = 2;
  } finally {
    if (browser) await browser.close();
    report.finishedAt = new Date().toISOString();
    const output = join(options.output, 'report.json');
    await writeFile(output, JSON.stringify(report, null, 2));
    console.log(`Smoke status: ${report.status}\nReport: ${output}`);
  }
}
await main();
