import { test, expect, PointerDriver, assertInvariants, entityInSlot, metrics, openEntity, openGame, saveEvidence, snapshot, waitForState } from './helpers';

test('five-minute live simulation and repeated restarts stay bounded @soak', async ({ page, hasTouch }, testInfo) => {
  test.setTimeout(370_000);
  const input = new PointerDriver(page, !!hasTouch);
  await openGame(page);
  const baseline = await metrics(page);
  const started = Date.now();
  const stopAt = started + 300_000;
  let nextRestart = started + 60_000;
  let previousWall = started;
  let previousSimulation = (await snapshot(page)).time;
  let restartCount = 0;
  const samples: { elapsedSeconds: number; simulationTime: number; entities: number; stones: number; metrics: Record<string, number> }[] = [];
  while (Date.now() < stopAt) {
    // A one-second sampling interval is intentional for the five-minute soak,
    // rather than a timeout used in place of waiting for gameplay progress.
    await page.waitForTimeout(1_000);
    const now = Date.now();
    let state = await snapshot(page);
    assertInvariants(state);
    expect(state.paused).toBe(false);
    expect(state.time).toBeGreaterThan(previousSimulation);
    expect(state.time - previousSimulation).toBeLessThanOrEqual((now - previousWall) / 1000 * 1.2 + 0.3);
    const render = await metrics(page);
    expect(render.calls).toBeLessThanOrEqual(120);
    expect(render.triangles).toBeLessThanOrEqual(80_000);
    expect(render.effects).toBeLessThanOrEqual(120);
    expect(render.geometries).toBeLessThanOrEqual(baseline.geometries! + 4);
    expect(render.textures).toBeLessThanOrEqual(baseline.textures!);
    samples.push({ elapsedSeconds: (now - started) / 1000, simulationTime: state.time, entities: Object.keys(state.entities).length, stones: state.stones.length, metrics: render });
    if (now >= nextRestart && nextRestart < stopAt) {
      await openEntity(page, input, entityInSlot(state, 0).id);
      await input.clickButton('Restart');
      state = await waitForState(page, state => state.stats.opened === 0 && state.time < 1, 'Soak restart creates a clean initial state');
      assertInvariants(state);
      restartCount++;
      nextRestart += 60_000;
    }
    previousWall = Date.now();
    previousSimulation = state.time;
  }
  expect(restartCount).toBe(4);
  expect(Date.now() - started).toBeGreaterThanOrEqual(300_000);
  await testInfo.attach('five-minute-soak-samples', { body: JSON.stringify({ durationMs: Date.now() - started, restartCount, baseline, samples }, null, 2), contentType: 'application/json' });
  await saveEvidence(page, testInfo, 'five-minute-stability-landscape');
});
