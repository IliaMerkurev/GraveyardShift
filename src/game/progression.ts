import type { GameConfig } from './config';

/** No gameplay level ceiling. Saturation only protects the numeric representation. */
export function nextWorkerLevel(level: number): number {
  const safe = Number.isFinite(level) ? Math.max(1, Math.min(Number.MAX_SAFE_INTEGER, Math.floor(level))) : 1;
  return Math.min(Number.MAX_SAFE_INTEGER, safe + 1);
}

/** Preserve the tuned first five levels, then grow without undefined/NaN/Infinity. */
export function miningDamage(level: number, mining: GameConfig['mining']): number {
  const safe = Number.isFinite(level) ? Math.max(1, Math.min(Number.MAX_SAFE_INTEGER, Math.floor(level))) : 1;
  const table = mining.damageByLevel;
  if (safe <= table.length) return table[safe - 1]!;
  const last = table[table.length - 1]!;
  const growth = mining.damageGrowth;
  if (growth === 1) return last;
  const maxExponent = Math.ceil(Math.log(Number.MAX_SAFE_INTEGER / last) / Math.log(growth));
  return Math.min(Number.MAX_SAFE_INTEGER, last * growth ** Math.min(safe - table.length, maxExponent));
}

/** First speed gain is level three; bound the exponent before it can overflow. */
export function miningPeriod(level: number, mining: GameConfig['mining']): number {
  const safe = Number.isFinite(level) ? Math.max(1, Math.min(Number.MAX_SAFE_INTEGER, Math.floor(level))) : 1;
  if (safe <= 2 || mining.speedGrowth === 1) return mining.period;
  const maxExponent = Math.log(mining.period / mining.minPeriod) / Math.log(mining.speedGrowth);
  return Math.max(mining.minPeriod, mining.period / mining.speedGrowth ** Math.min(safe - 2, maxExponent));
}
