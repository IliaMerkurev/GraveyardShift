import {
  test, expect, PointerDriver, assertInvariants, assertTrustedInput, dragEntity,
  entityInSlot, openEntity, openGame, saveEvidence, screenFor, snapshot, waitForState,
  workerPower, worldPoint,
} from './helpers';

test('complete real-pointer cycle: barrels, both merges, mining, purchase, movement and bomb', async ({ page, hasTouch }, testInfo) => {
  const input = new PointerDriver(page, !!hasTouch);
  const initial = await openGame(page);
  const starters = initial.slots.map((_, index) => entityInSlot(initial, index).id);
  const originalWorker = initial.pads[0]!.entityId!;

  await test.step('Open a barrel once and merge into the working pad', async () => {
    await openEntity(page, input, starters[0]!);
    await dragEntity(page, input, starters[0]!, 'pad-0');
    const state = await waitForState(page, state => state.stats.merged === 1, 'Equal workers merge on the occupied pad');
    expect(state.entities[originalWorker]).toMatchObject({ kind: 'worker', level: 2 });
    expect(state.entities[starters[0]!]).toBeUndefined();
    expect(workerPower(state)).toBe(2);
  });

  await test.step('Coin barrel pays once and repeated purchase only spends once', async () => {
    await openEntity(page, input, starters[1]!);
    const before = await snapshot(page);
    await openEntity(page, input, starters[2]!);
    let state = await snapshot(page);
    expect(state.entities[starters[2]!]).toBeUndefined();
    expect(state.stats.coinsEarned - before.stats.coinsEarned).toBeGreaterThanOrEqual(50);
    const pad = await screenFor(page, 'pad-1');
    await input.tap(pad);
    await input.tap(pad);
    state = await waitForState(page, state => state.pads[1]!.unlocked, 'Affordable pad unlocks');
    expect(state.stats.purchased).toBe(1);
    expect(state.coins).toBe(state.stats.coinsEarned - 50);
  });

  await test.step('Merge on the belt, reach level 3, and continue playing', async () => {
    await openEntity(page, input, starters[4]!);
    await dragEntity(page, input, starters[4]!, starters[1]!);
    let state = await waitForState(page, state => state.stats.merged === 2, 'Equal workers merge on the belt');
    expect(state.entities[starters[1]!]).toMatchObject({ kind: 'worker', level: 2 });
    expect(state.entities[starters[4]!]).toBeUndefined();
    await dragEntity(page, input, starters[1]!, 'pad-0');
    state = await waitForState(page, state => state.goalReached && state.paused, 'Real progression reaches the prototype goal');
    expect(state.entities[originalWorker]).toMatchObject({ kind: 'worker', level: 3 });
    expect(state.stats.merged).toBe(3);
    expect(workerPower(state)).toBe(4);
    await expect(page.getByRole('heading', { name: 'A rock-solid start!' })).toBeVisible();
    await input.clickButton('Keep mining');
    await waitForState(page, state => !state.paused, 'Continue resumes the simulation');
  });

  await test.step('Place, mine, return to the belt, and move between pads', async () => {
    await openEntity(page, input, starters[5]!);
    await dragEntity(page, input, starters[5]!, 'pad-1');
    let state = await waitForState(page, state => state.pads[1]!.entityId === starters[5], 'Worker starts on the newly bought pad');
    expect(state.tutorial.placed).toBe(true);
    const destroyed = state.stats.destroyed;
    await waitForState(page, state => state.stats.destroyed > destroyed, 'Actual mining destroys a stone and earns coins', 20_000);
    state = await snapshot(page);
    const emptySlot = state.slots.find(slot => !slot.entityId && !slot.reserved);
    expect(emptySlot, 'A freed belt position remains available').toBeDefined();
    await dragEntity(page, input, starters[5]!, emptySlot!.id);
    expect((await snapshot(page)).entities[starters[5]!]?.location.kind).toBe('slot');
    await dragEntity(page, input, starters[5]!, 'pad-1');
    // Move level 3 onto the now-empty pad 1, then put level 1 on pad 0.
    await dragEntity(page, input, starters[5]!, emptySlot!.id);
    await dragEntity(page, input, originalWorker, 'pad-1');
    await dragEntity(page, input, starters[5]!, 'pad-0');
    state = await snapshot(page);
    expect(state.pads[1]!.entityId).toBe(originalWorker);
    expect(state.pads[0]!.entityId).toBe(starters[5]);
  });

  await test.step('Invalid bomb drop returns it, valid track drop awards once', async () => {
    await openEntity(page, input, starters[3]!);
    const originalLocation = (await snapshot(page)).entities[starters[3]!]!.location;
    await input.drag(await screenFor(page, starters[3]!), await worldPoint(page, 4.6, 5.8));
    let state = await snapshot(page);
    expect(state.entities[starters[3]!]!.location).toEqual(originalLocation);
    expect(state.stats.bombsUsed).toBe(0);
    const beforeDestroyed = state.stats.destroyed;
    const beforeCoins = state.coins;
    await input.drag(await screenFor(page, starters[3]!), await worldPoint(page, -1, 2));
    state = await waitForState(page, state => state.stats.bombsUsed === 1, 'Bomb detonates on the live stone stream');
    expect(state.entities[starters[3]!]).toBeUndefined();
    expect(state.stats.destroyed).toBeGreaterThan(beforeDestroyed);
    expect(state.coins).toBeGreaterThan(beforeCoins);
    assertInvariants(state);
  });

  await assertTrustedInput(page, !!hasTouch);
  await expect(page.locator('.diagnostics')).toHaveCount(0);
  expect(await page.evaluate(() => ({ x: scrollX, y: scrollY, selection: getSelection()?.toString() }))).toEqual({ x: 0, y: 0, selection: '' });
  await saveEvidence(page, testInfo, hasTouch ? 'final-portrait' : 'final-landscape');
});

test('tap threshold, repeated taps, insufficient balance and mismatched levels preserve state', async ({ page, hasTouch }) => {
  const input = new PointerDriver(page, !!hasTouch);
  const initial = await openGame(page);
  const first = entityInSlot(initial, 0).id;
  const second = entityInSlot(initial, 1).id;
  await input.tap(await screenFor(page, 'pad-3'));
  expect((await snapshot(page)).pads[3]!.unlocked).toBe(false);
  expect((await snapshot(page)).stats.purchased).toBe(0);
  const point = await screenFor(page, first);
  await input.down(point);
  await input.move({ x: point.x + 3, y: point.y + 2 }, 2);
  await input.up();
  await waitForState(page, state => state.stats.opened === 1, 'Small motion remains one tap');
  await input.tap(await screenFor(page, first));
  await input.tap(await screenFor(page, first));
  expect((await snapshot(page)).stats.opened).toBe(1);
  await dragEntity(page, input, first, 'pad-0');
  await openEntity(page, input, second);
  const before = await snapshot(page);
  const power = workerPower(before);
  await dragEntity(page, input, second, 'pad-0');
  const after = await snapshot(page);
  expect(after.entities[second]!.location).toEqual(before.entities[second]!.location);
  expect(after.stats.merged).toBe(before.stats.merged);
  expect(workerPower(after)).toBe(power);
  assertInvariants(after);
});

test('restart repeatedly resets gameplay without reloading or duplicating listeners', async ({ page, hasTouch }) => {
  const input = new PointerDriver(page, !!hasTouch);
  await openGame(page);
  const timeOrigin = await page.evaluate(() => performance.timeOrigin);
  for (let restart = 0; restart < 4; restart++) {
    const state = await snapshot(page);
    await openEntity(page, input, entityInSlot(state, 0).id);
    await input.clickButton('Restart');
    const reset = await waitForState(page, state => state.stats.opened === 0, 'Restart clears progression');
    expect(reset.stats).toEqual({ opened: 0, merged: 0, purchased: 0, destroyed: 0, bombsUsed: 0, coinsEarned: 0 });
    expect(reset.coins).toBe(0);
    expect(reset.drag).toBeNull();
    expect(reset.goalReached).toBe(false);
    expect(reset.pads.filter(pad => pad.unlocked)).toHaveLength(1);
    expect(reset.slots.every(slot => reset.entities[slot.entityId!]!.kind === 'barrel')).toBe(true);
    expect(workerPower(reset)).toBe(1);
    assertInvariants(reset);
  }
  const after = await snapshot(page);
  await openEntity(page, input, entityInSlot(after, 0).id);
  expect((await snapshot(page)).stats.opened).toBe(1);
  expect(await page.evaluate(() => performance.timeOrigin)).toBe(timeOrigin);
});
