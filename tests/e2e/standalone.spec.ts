import type { Locator } from '@playwright/test';
import { test, expect, PointerDriver, assertTrustedInput, type ScreenPoint } from './helpers';

async function center(locator: Locator): Promise<ScreenPoint> {
  await expect(locator).toBeVisible();
  const rect = await locator.boundingBox();
  expect(rect).not.toBeNull();
  return { x: rect!.x + rect!.width / 2, y: rect!.y + rect!.height / 2 };
}

test('single production document stays playable with every subsequent network request blocked', async ({ page, hasTouch }, testInfo) => {
  let documentAllowed = false;
  const blocked: string[] = [];
  const externalSockets: string[] = [];
  page.on('websocket', socket => externalSockets.push(socket.url()));
  await page.route('**/*', async route => {
    const request = route.request();
    if (!documentAllowed && request.isNavigationRequest() && request.frame() === page.mainFrame()) {
      documentAllowed = true;
      await route.continue();
    } else {
      blocked.push(request.url());
      await route.abort('blockedbyclient');
    }
  });
  await page.goto('/');
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator('[data-entity][data-kind="barrel"]')).toHaveCount(6);
  expect(await page.evaluate(() => '__rocksnake' in window)).toBe(false);
  await expect(page.locator('.diagnostics')).toHaveCount(0);
  const input = new PointerDriver(page, !!hasTouch);
  const barrels = await page.locator('[data-entity][data-kind="barrel"]').evaluateAll(elements => elements.map(element => (element as HTMLElement).dataset.entity!));
  const starterWorker = page.locator('[data-entity][data-kind="worker"]').first();
  const workerId = await starterWorker.getAttribute('data-entity');
  const originalWorker = page.locator(`[data-entity="${workerId}"]`);
  const first = page.locator(`[data-entity="${barrels[0]}"]`);
  await input.tap(await center(first));
  await expect(first).toHaveAttribute('data-kind', 'worker');
  await input.drag(await center(first), await center(originalWorker));
  await expect(originalWorker).toHaveAttribute('data-level', '2');
  await expect(first).toHaveCount(0);

  const coinBarrel = page.locator(`[data-entity="${barrels[2]}"]`);
  await input.tap(await center(coinBarrel));
  await expect(coinBarrel).toHaveCount(0);
  await expect.poll(async () => Number(await page.locator('[data-coins]').textContent())).toBeGreaterThanOrEqual(50);
  const pad = page.locator('[data-pad="pad-1"]');
  await input.tap(await center(pad));
  await expect(pad).toHaveAttribute('data-unlocked', 'true');
  const second = page.locator(`[data-entity="${barrels[1]}"]`);
  await input.tap(await center(second));
  await expect(second).toHaveAttribute('data-kind', 'worker');
  await input.drag(await center(second), await center(pad));
  await expect(pad).toBeHidden();
  await expect(second).toHaveAttribute('data-level', '1');
  const coins = Number(await page.locator('[data-coins]').textContent());
  await expect.poll(async () => Number(await page.locator('[data-coins]').textContent()), { timeout: 20_000 }).toBeGreaterThan(coins);

  await input.clickButton('Help');
  await expect(page.getByRole('heading', { name: 'A little mining lab' })).toBeVisible();
  await input.clickButton('Keep mining');
  await page.screenshot({ path: testInfo.outputPath(hasTouch ? 'standalone-final-portrait.png' : 'standalone-final-landscape.png'), fullPage: true });
  await input.clickButton('Restart');
  await expect(page.locator('[data-entity][data-kind="barrel"]')).toHaveCount(6);
  await expect(page.locator('[data-entity][data-kind="worker"]')).toHaveCount(1);
  await assertTrustedInput(page, !!hasTouch);
  expect(blocked, 'Production requests no JS, CSS, fonts, images, APIs, analytics or favicon after its document').toEqual([]);
  expect(externalSockets, 'Production contains no HMR or runtime socket').toEqual([]);
  await testInfo.attach('offline-request-report', { body: JSON.stringify({ documentAllowed, blocked, externalSockets }), contentType: 'application/json' });
});

test('unavailable WebGL 2 explains the problem instead of a black canvas', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, contextId: string, options?: unknown) {
      if (contextId === 'webgl2') return null;
      return original.call(this, contextId as '2d', options as CanvasRenderingContext2DSettings);
    } as typeof HTMLCanvasElement.prototype.getContext;
  });
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('WebGL 2 is unavailable');
  await expect(page.locator('canvas')).toHaveCount(0);
});
