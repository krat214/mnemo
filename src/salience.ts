/** Half-life based salience decay, applied lazily on read (no background job needed). */

const DEFAULT_HALF_LIFE_DAYS = 90;
const REINFORCE_BOOST = 0.15;

export function halfLifeDays(): number {
  const raw = Number(process.env.MNEMO_SALIENCE_HALF_LIFE_DAYS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_HALF_LIFE_DAYS;
}

/** Decays `salience` from `since` to `now`, clamped to [0, 1]. */
export function decay(salience: number, since: Date, now: Date = new Date()): number {
  const elapsedDays = (now.getTime() - since.getTime()) / 86_400_000;
  if (elapsedDays <= 0) return clamp(salience);
  const halfLife = halfLifeDays();
  const factor = Math.pow(0.5, elapsedDays / halfLife);
  return clamp(salience * factor);
}

/** Hebbian-style reinforcement: recalling a memory nudges its salience back up. */
export function reinforce(salience: number): number {
  return clamp(salience + REINFORCE_BOOST * (1 - salience));
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}
