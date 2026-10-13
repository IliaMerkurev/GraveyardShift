export type ContentKind = 'worker' | 'coins' | 'bomb' | 'rewind' | 'slow' | 'brake';
export type PlaceRef = { kind: 'slot' | 'pad' | 'storage'; id: string };
export type EntityLocation = PlaceRef | { kind: 'drag' };
export type DropTarget = PlaceRef | { kind: 'discard' } | { kind: 'track'; x: number; z: number } | { kind: 'field'; x: number; z: number } | null;
export interface Point { x: number; z: number }
export interface MiningState { phase: number; targetId: string | null; hit: boolean }
interface EntityBase { id: string; location: EntityLocation }
export interface Barrel extends EntityBase { kind: 'barrel'; content: ContentKind }
export interface Worker extends EntityBase { kind: 'worker'; level: number; mining: MiningState }
export interface Bomb extends EntityBase { kind: 'bomb' }
export interface Rewind extends EntityBase { kind: 'rewind' }
export interface Slow extends EntityBase { kind: 'slow' }
export interface Brake extends EntityBase { kind: 'brake' }
export type Entity = Barrel | Worker | Bomb | Rewind | Slow | Brake;
export interface Slot extends Point { id: string; entityId: string | null; reserved: boolean }
export interface Pad extends Slot { price: number; unlocked: boolean }
export interface Stone {
  id: string; distance: number; resource: number; hp: number; maxHp: number;
  reward: number; variant: number; bounceRemaining?: number; frozenRenderDistance?: number;
}
export interface DragState { entityId: string; source: PlaceRef }
export interface GameEvent extends Point {
  type: 'hit' | 'destroy' | 'coins' | 'merge' | 'bomb' | 'open' | 'purchase' | 'goal' | 'gameover' | 'rewind' | 'slow' | 'brake' | 'discard' | 'expired';
  entityId?: string; stoneId?: string; amount?: number; level?: number;
}
export interface GameState {
  time: number;
  coins: number;
  workerDropBoost: number;
  entities: Record<string, Entity>;
  slots: Slot[];
  pads: Pad[];
  storage: Pad[];
  stones: Stone[];
  drag: DragState | null;
  events: GameEvent[];
  paused: boolean;
  conveyorPaused: boolean;
  goalReached: boolean;
  gameOver: boolean;
  slowRemaining: number;
  headSpeed: number;
  permanentSpeedReduction: number;
  gapRecoveryRemaining: number;
  gapReadyAt: Record<string, number>;
  rewindTarget: number | null;
  rewindSpeed: number;
  tutorial: { opened: boolean; placed: boolean; merged: boolean; bought: boolean; bombed: boolean };
  stats: { opened: number; merged: number; purchased: number; destroyed: number; bombsUsed: number; coinsEarned: number };
}
export const createMiningState = (): MiningState => ({ phase: 0, targetId: null, hit: false });
