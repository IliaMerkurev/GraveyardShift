import { test, expect, PointerDriver, assertInvariants, entityInSlot, openEntity, openGame, releaseNativeCapture, screenFor, snapshot, waitForState, workerPower } from './helpers';

test('invalid, cancelled, capture-lost and resized drags always restore reserved source', async ({ page, hasTouch }) => {
  const input = new PointerDriver(page, !!hasTouch);
  const initial = await openGame(page);
  const worker = entityInSlot(initial, 0).id;
  await openEntity(page, input, worker);
  const location = (await snapshot(page)).entities[worker]!.location;
  const power = workerPower(await snapshot(page));
  const assertRestored = async () => {
    const state = await waitForState(page, state => state.drag === null, 'Interrupted drag is cancelled');
    expect(state.entities[worker]!.location).toEqual(location);
    expect(workerPower(state)).toBe(power);
    assertInvariants(state);
  };
  await test.step('Locked target and outside-canvas release', async () => {
    await input.drag(await screenFor(page, worker), await screenFor(page, 'pad-2'));
    await assertRestored();
    const canvas = await page.locator('canvas').boundingBox();
    await input.drag(await screenFor(page, worker), { x: Math.max(1, canvas!.x - 20), y: canvas!.y + canvas!.height - 2 });
    await assertRestored();
  });
  await test.step('Pointer cancellation', async () => {
    await input.startDrag(await screenFor(page, worker));
    assertInvariants(await snapshot(page));
    await input.cancel();
    await assertRestored();
  });
  await test.step('Native pointer capture loss', async () => {
    await input.startDrag(await screenFor(page, worker));
    await releaseNativeCapture(page);
    // Browsers deliver pending lostpointercapture before their next pointer event.
    await input.move(await screenFor(page, 'pad-2'), 1);
    await assertRestored();
    await input.up();
  });
  await test.step('Orientation change while dragging', async () => {
    const viewport = page.viewportSize()!;
    await input.startDrag(await screenFor(page, worker));
    await page.setViewportSize({ width: viewport.height, height: viewport.width });
    await assertRestored();
    await input.up();
    await page.setViewportSize(viewport);
    await assertRestored();
  });
});

test('help pause and focus interruption stop time, preserve drag and resume without catch-up', async ({ page, hasTouch }) => {
  const input = new PointerDriver(page, !!hasTouch);
  const initial = await openGame(page);
  const worker = entityInSlot(initial, 0).id;
  await openEntity(page, input, worker);
  await input.clickButton('Help');
  const paused = await waitForState(page, state => state.paused, 'Help pauses the simulation');
  await expect(page.getByRole('heading', { name: 'A little mining lab' })).toBeVisible();
  // This measures an explicitly paused interval, rather than waiting for progress.
  await page.waitForTimeout(350);
  const stillPaused = await snapshot(page);
  expect(stillPaused.time).toBe(paused.time);
  expect(stillPaused.coins).toBe(paused.coins);
  expect(stillPaused.stones).toEqual(paused.stones);
  await input.clickButton('Keep mining');
  await waitForState(page, state => !state.paused && state.time > paused.time, 'Continue resumes exactly the existing loop');
  const resumed = await snapshot(page);
  expect(resumed.time - paused.time).toBeLessThan(0.5);

  await input.startDrag(await screenFor(page, worker));
  // Focus/visibility lifecycle events are browser lifecycle fault injection,
  // not game hooks; pointer start and movement above are trusted browser input.
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  const blurred = await waitForState(page, state => state.paused && state.drag === null, 'Blur cancels drag and pauses');
  assertInvariants(blurred);
  await input.up();
  await page.waitForTimeout(250);
  expect((await snapshot(page)).time).toBe(blurred.time);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await waitForState(page, state => !state.paused && state.time > blurred.time, 'Focus resumes without replaying hidden time');
  assertInvariants(await snapshot(page));
});

test('secondary touch cannot replace, release or duplicate the primary drag', async ({ page, hasTouch }) => {
  test.skip(!hasTouch, 'Requires native CDP multitouch; desktop right-click has separate coverage');
  const input = new PointerDriver(page, true);
  const initial = await openGame(page);
  const worker = entityInSlot(initial, 0).id;
  const untouchedBarrel = entityInSlot(initial, 1).id;
  await openEntity(page, input, worker);
  await input.startDrag(await screenFor(page, worker));
  const originalDrag = (await snapshot(page)).drag;
  await input.addSecond(await screenFor(page, untouchedBarrel));
  expect((await snapshot(page)).drag).toEqual(originalDrag);
  expect((await snapshot(page)).stats.opened).toBe(1);
  await input.removeSecond();
  expect((await snapshot(page)).drag).toEqual(originalDrag);
  await input.move(await screenFor(page, 'pad-0'));
  await input.up();
  const merged = await waitForState(page, state => state.stats.merged === 1 && state.drag === null, 'Primary touch completes exactly one merge');
  expect(merged.stats.opened).toBe(1);
  expect(merged.entities[untouchedBarrel]?.kind).toBe('barrel');
  expect(workerPower(merged)).toBe(2);
  assertInvariants(merged);
});

test('right mouse button and repeated pointerup cannot duplicate a command', async ({ page, hasTouch }) => {
  test.skip(!!hasTouch, 'Desktop mouse-specific input');
  const initial = await openGame(page);
  const barrel = entityInSlot(initial, 0).id;
  const point = await screenFor(page, barrel);
  await page.mouse.click(point.x, point.y, { button: 'right' });
  expect((await snapshot(page)).stats.opened).toBe(0);
  const input = new PointerDriver(page, false);
  await openEntity(page, input, barrel);
  await page.mouse.up();
  await page.locator('canvas').dispatchEvent('pointerup', { pointerId: 1, pointerType: 'mouse', clientX: point.x, clientY: point.y, button: 0 });
  const after = await snapshot(page);
  expect(after.stats.opened).toBe(1);
  expect(workerPower(after)).toBe(2);
  assertInvariants(after);
});
