import { test as base, expect, type CDPSession, type Page, type TestInfo } from '@playwright/test';
import type { Entity, GameState } from '../../src/game/GameState';

export interface ScreenPoint { x: number; y: number }
interface DevHook {
  snapshot(): GameState;
  screenFor(id: string): ScreenPoint | null;
  point(x: number, z: number): ScreenPoint;
  metrics(): Record<string, number>;
}
interface PointerObservation { id: number; type: string; trusted: boolean; target: EventTarget | null }
type ObservedWindow = Window & { __rocksnake?: DevHook; __testPointers?: PointerObservation[] };

export const test = base.extend<{ appErrors: string[] }>({
  appErrors: [async ({ page }, use) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.addInitScript(() => {
      const observed = window as ObservedWindow;
      observed.__testPointers = [];
      document.addEventListener('pointerdown', event => {
        observed.__testPointers!.push({ id: event.pointerId, type: event.pointerType, trusted: event.isTrusted, target: event.target });
        if (observed.__testPointers!.length > 100) observed.__testPointers!.shift();
      }, true);
    });
    await use(errors);
    expect(errors, 'No application exceptions or console errors').toEqual([]);
  }, { auto: true }],
});
export { expect };

export async function snapshot(page: Page): Promise<GameState> {
  return page.evaluate(() => (window as ObservedWindow).__rocksnake!.snapshot());
}
export async function screenFor(page: Page, id: string): Promise<ScreenPoint> {
  const point = await page.evaluate(id => (window as ObservedWindow).__rocksnake!.screenFor(id), id);
  expect(point, `Visible hit target ${id}`).not.toBeNull();
  return point!;
}
export async function worldPoint(page: Page, x: number, z: number): Promise<ScreenPoint> {
  return page.evaluate(({ x, z }) => (window as ObservedWindow).__rocksnake!.point(x, z), { x, z });
}
export async function metrics(page: Page): Promise<Record<string, number>> {
  return page.evaluate(() => (window as ObservedWindow).__rocksnake!.metrics());
}
export async function waitForState(page: Page, condition: (state: GameState) => boolean, message: string, timeout = 10_000): Promise<GameState> {
  await expect.poll(async () => condition(await snapshot(page)), { message, timeout, intervals: [50, 100, 200, 500] }).toBe(true);
  return snapshot(page);
}
export async function openGame(page: Page): Promise<GameState> {
  await page.goto('/');
  await expect(page.locator('canvas')).toBeVisible();
  await page.waitForFunction(() => typeof (window as ObservedWindow).__rocksnake?.snapshot === 'function');
  await expect.poll(async () => (await metrics(page)).calls).toBeGreaterThan(0);
  const state = await snapshot(page);
  assertInvariants(state);
  return state;
}

/** Uses trusted browser input. Mobile paths never call page.mouse. */
export class PointerDriver {
  private session: CDPSession | undefined;
  private primary: ScreenPoint | undefined;
  private secondary: ScreenPoint | undefined;
  constructor(readonly page: Page, readonly touch: boolean) {}
  private async cdp(): Promise<CDPSession> {
    return this.session ??= await this.page.context().newCDPSession(this.page);
  }
  private points() {
    const points: { x: number; y: number; id: number; radiusX: number; radiusY: number; force: number }[] = [];
    if (this.primary) points.push({ ...this.primary, id: 1, radiusX: 8, radiusY: 8, force: 1 });
    if (this.secondary) points.push({ ...this.secondary, id: 2, radiusX: 8, radiusY: 8, force: 1 });
    return points;
  }
  async down(point: ScreenPoint) {
    this.primary = point;
    if (this.touch) await (await this.cdp()).send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: this.points() });
    else { await this.page.mouse.move(point.x, point.y); await this.page.mouse.down(); }
  }
  async move(point: ScreenPoint, steps = 10) {
    const start = this.primary ?? point;
    if (this.touch) {
      for (let step = 1; step <= steps; step++) {
        this.primary = { x: start.x + (point.x - start.x) * step / steps, y: start.y + (point.y - start.y) * step / steps };
        await (await this.cdp()).send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: this.points() });
      }
    } else { await this.page.mouse.move(point.x, point.y, { steps }); this.primary = point; }
  }
  async up() {
    if (this.touch) await (await this.cdp()).send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    else await this.page.mouse.up();
    this.primary = undefined;
    this.secondary = undefined;
  }
  async tap(point: ScreenPoint) { await this.down(point); await this.up(); }
  async drag(from: ScreenPoint, to: ScreenPoint) { await this.down(from); await this.move(to); await this.up(); }
  async startDrag(from: ScreenPoint) {
    await this.down(from);
    await this.move({ x: from.x, y: from.y - 36 }, 4);
    await waitForState(this.page, state => state.drag !== null, 'Pointer movement starts one drag');
  }
  async cancel() {
    if (this.touch) await (await this.cdp()).send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
    else {
      // There is no desktop OS cancellation command in CDP. Exercise that event
      // branch separately from all normal input, which remains browser-trusted.
      await this.page.evaluate(() => {
        const observed = (window as ObservedWindow).__testPointers!.at(-1)!;
        observed.target!.dispatchEvent(new PointerEvent('pointercancel', { pointerId: observed.id, pointerType: 'mouse', bubbles: true }));
      });
      await this.page.mouse.up();
    }
    this.primary = undefined;
    this.secondary = undefined;
  }
  async addSecond(point: ScreenPoint) {
    expect(this.touch).toBe(true);
    this.secondary = point;
    await (await this.cdp()).send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: this.points() });
  }
  async removeSecond() {
    this.secondary = undefined;
    // CDP synthesizes the released contact from the changed active-point set.
    await (await this.cdp()).send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: this.points() });
  }
  async clickButton(name: string) {
    const button = this.page.getByRole('button', { name, exact: true });
    await expect(button).toBeVisible();
    const rect = await button.boundingBox();
    expect(rect).not.toBeNull();
    await this.tap({ x: rect!.x + rect!.width / 2, y: rect!.y + rect!.height / 2 });
  }
}

export function workerPower(state: GameState): number {
  return Object.values(state.entities).reduce((sum, entity) => sum + (entity.kind === 'worker' ? 2 ** (entity.level - 1) : 0), 0);
}
export function assertInvariants(state: GameState) {
  expect(state.coins).toBeGreaterThanOrEqual(0);
  expect(state.stones.length).toBeLessThanOrEqual(200);
  expect(new Set(state.stones.map(stone => stone.id)).size).toBe(state.stones.length);
  for (const stone of state.stones) expect(stone.hp).toBeGreaterThan(0);
  const places = [...state.slots, ...state.pads];
  const occupants = places.map(place => place.entityId).filter((id): id is string => !!id);
  expect(new Set(occupants).size).toBe(occupants.length);
  for (const place of places) {
    if (place.entityId) {
      const entity = state.entities[place.entityId];
      expect(entity, `Existing occupant ${place.entityId}`).toBeDefined();
      expect(entity!.location).toEqual({ kind: state.slots.includes(place) ? 'slot' : 'pad', id: place.id });
    }
    if (place.reserved) {
      expect(place.entityId).toBeNull();
      expect(state.drag?.source.id).toBe(place.id);
    }
  }
  expect(places.filter(place => place.reserved).length).toBe(state.drag ? 1 : 0);
  for (const entity of Object.values(state.entities)) {
    const location = entity.location;
    if (location.kind === 'drag') expect(entity.id).toBe(state.drag?.entityId);
    else expect(places.find(place => place.id === location.id)?.entityId).toBe(entity.id);
  }
  expect(Object.keys(state.entities).length).toBe(occupants.length + (state.drag ? 1 : 0));
}
export function entityInSlot(state: GameState, index: number): Entity {
  const id = state.slots[index]!.entityId;
  expect(id, `Initial slot ${index} has an entity`).not.toBeNull();
  return state.entities[id!]!;
}
export async function openEntity(page: Page, input: PointerDriver, entityId: string): Promise<GameState> {
  const before = await snapshot(page);
  await input.tap(await screenFor(page, entityId));
  return waitForState(page, state => state.stats.opened === before.stats.opened + 1, 'One completed tap opens exactly one barrel');
}
export async function dragEntity(page: Page, input: PointerDriver, entityId: string, targetId: string) {
  await input.drag(await screenFor(page, entityId), await screenFor(page, targetId));
  await waitForState(page, state => state.drag === null, 'Drop releases the drag');
  assertInvariants(await snapshot(page));
}
export async function saveEvidence(page: Page, testInfo: TestInfo, name: string) {
  await page.screenshot({ path: testInfo.outputPath(`${name}.png`), fullPage: true });
  await testInfo.attach(`${name}-metrics`, { body: JSON.stringify({ viewport: page.viewportSize(), metrics: await metrics(page), state: await snapshot(page) }, null, 2), contentType: 'application/json' });
}
export async function assertTrustedInput(page: Page, touch: boolean) {
  const observations = await page.evaluate(() => (window as ObservedWindow).__testPointers!.map(({ type, trusted }) => ({ type, trusted })));
  expect(observations.length).toBeGreaterThan(0);
  expect(observations.every(observation => observation.type === (touch ? 'touch' : 'mouse') && observation.trusted)).toBe(true);
}
export async function releaseNativeCapture(page: Page) {
  await page.evaluate(() => {
    const observed = (window as ObservedWindow).__testPointers!.at(-1)!;
    const target = observed.target as Element;
    if (!target.hasPointerCapture(observed.id)) throw new Error('Canvas never captured the active pointer');
    target.releasePointerCapture(observed.id);
  });
}
