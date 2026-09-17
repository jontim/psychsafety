export interface MeterSpec {
  id: string;
  label: string;
  /** What the meter means in the fiction, in words the player can check. */
  description: string;
  start: number;
  /** Axis contributions: each utterance drifts the meter by weight * axis * driftScale. */
  axes: Array<{ axis: string; weight: number }>;
  /** Points moved per utterance when an axis is fully saturated. */
  driftScale?: number;
}

export type MeterValues = Record<string, number>;

export const METER_MIN = 0;
export const METER_MAX = 100;

export function clampMeter(n: number): number {
  return Math.max(METER_MIN, Math.min(METER_MAX, n));
}

export function initMeters(specs: MeterSpec[]): MeterValues {
  const out: MeterValues = {};
  for (const s of specs) out[s.id] = clampMeter(s.start);
  return out;
}

/** Apply the affect-driven drift for one utterance. Returns the deltas applied. */
export function applyDrift(values: MeterValues, specs: MeterSpec[], axes: Record<string, number>): MeterValues {
  const deltas: MeterValues = {};
  for (const spec of specs) {
    const scale = spec.driftScale ?? 6;
    let delta = 0;
    for (const { axis, weight } of spec.axes) delta += (axes[axis] ?? 0) * weight * scale;
    delta = Math.round(delta * 10) / 10;
    values[spec.id] = clampMeter((values[spec.id] ?? spec.start) + delta);
    deltas[spec.id] = delta;
  }
  return deltas;
}

/** Apply explicit deltas from the director. Unknown meters are ignored. */
export function applyDeltas(values: MeterValues, specs: MeterSpec[], deltas: Record<string, number>): MeterValues {
  const applied: MeterValues = {};
  const known = new Set(specs.map((s) => s.id));
  for (const [id, delta] of Object.entries(deltas)) {
    if (!known.has(id) || !Number.isFinite(delta)) continue;
    const bounded = Math.max(-25, Math.min(25, delta));
    values[id] = clampMeter((values[id] ?? 0) + bounded);
    applied[id] = bounded;
  }
  return applied;
}
