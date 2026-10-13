#!/usr/bin/env node
// Existing Playwright + installed Chromium-family browser only. No installs or custom flags.
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const [modulePath, executablePath, outputPath, url = 'https://rocksnake-playable-test.pearly-haven-3558.chatgpt.site'] = process.argv.slice(2);
if (!modulePath || !executablePath || !outputPath) {
  console.error('Usage: node production-boot-smoke.mjs <existing Playwright module file> <installed Edge/Chrome executable> <output directory> [URL]');
  process.exitCode = 2;
} else {
  const output = resolve(outputPath);
  await mkdir(output, { recursive: true });
  const report = { startedAt: new Date().toISOString(), node: process.version, url, status: 'running', results: [], limitations: ['Boot and screenshots only; no gameplay, touch, performance or offline validation.'] };
  let browser;
  try {
    const runtime = await import(pathToFileURL(resolve(modulePath)).href);
    const chromium = runtime.chromium || runtime.default?.chromium;
    if (!chromium) throw new Error('Supplied module has no chromium API');
    browser = await chromium.launch({ executablePath: resolve(executablePath), headless: true, chromiumSandbox: true, ignoreDefaultArgs: ['--enable-unsafe-swiftshader'] });
    report.browserVersion = browser.version();
    for (const viewport of [{ width: 360, height: 640 }, { width: 1280, height: 720 }]) {
      const result = { viewport, status: 'running', pageErrors: [], consoleErrors: [] };
      const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
      const page = await context.newPage();
      page.on('pageerror', error => result.pageErrors.push(error.message));
      page.on('console', message => { if (message.type() === 'error') result.consoleErrors.push(message.text()); });
      try {
        const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
        result.httpStatus = response?.status();
        if (response) { const body = await response.body(); result.documentBytes = body.length; result.documentSha256 = createHash('sha256').update(body).digest('hex'); }
        try { await page.locator('[data-entity], [role="alert"]').first().waitFor({ state: 'visible', timeout: 15000 }); }
        catch { result.bootTimeout = true; }
        result.canvasCount = await page.locator('canvas').count();
        result.entityCount = await page.locator('[data-entity]').count();
        result.visibleText = (await page.locator('body').innerText()).slice(0, 1600);
        result.fallback = await page.locator('[role="alert"]').count() ? await page.locator('[role="alert"]').innerText() : null;
        result.screenshot = join(output, `${viewport.width}x${viewport.height}-boot.png`);
        await page.screenshot({ path: result.screenshot, fullPage: true });
        result.status = result.httpStatus === 200 && result.canvasCount === 1 && result.entityCount >= 7 && !result.fallback && !result.pageErrors.length && !result.consoleErrors.length ? 'scene_present_needs_visual_review' : 'blocked_or_failed';
      } catch (error) { result.status = 'blocked_or_failed'; result.error = error.stack || error.message; }
      finally { await context.close(); }
      report.results.push(result);
      console.log(`${viewport.width}x${viewport.height}: ${result.status}`);
    }
    report.status = report.results.every(result => result.status === 'scene_present_needs_visual_review') ? 'boot_passed_gameplay_unverified' : 'blocked_or_failed';
    process.exitCode = report.status === 'boot_passed_gameplay_unverified' ? 0 : 1;
  } catch (error) { report.status = 'setup_blocked'; report.error = error.stack || error.message; process.exitCode = 2; }
  finally {
    if (browser) await browser.close();
    report.finishedAt = new Date().toISOString();
    await writeFile(join(output, 'boot-report.json'), JSON.stringify(report, null, 2));
    console.log(`Report: ${join(output, 'boot-report.json')}`);
  }
}
