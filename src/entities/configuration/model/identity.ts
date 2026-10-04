import type { CabinetDimensions, CabinetEntry, StableCabinetKey } from "./types";

/**
 * Stable identity and order of the products in a composition.
 *
 * Today restore matches saved products to new ones by array index, and the real order
 * comes from the scene's composition manager while Redux keeps only a fallback list.
 * These helpers give C one addressable key per product so a value can be saved as
 * `cab-1:Handle` instead of depending on position.
 *
 * Boundary: I owns the runtime id and the actual order; C records what the scene reports
 * and never invents an order of its own.
 */

export const createStableKey = (seq: number): StableCabinetKey => `cab-${seq}`;

export const findByRuntimeId = (entries: readonly CabinetEntry[], runtimeId: string): CabinetEntry | null =>
  entries.find((entry) => entry.runtimeId === runtimeId) ?? null;

export const findByStableKey = (entries: readonly CabinetEntry[], stableKey: StableCabinetKey): CabinetEntry | null =>
  entries.find((entry) => entry.stableKey === stableKey) ?? null;

export const resolveStableKey = (entries: readonly CabinetEntry[], runtimeId: string): StableCabinetKey | null =>
  findByRuntimeId(entries, runtimeId)?.stableKey ?? null;

/**
 * The recorded actual size of the product with this runtime id. Null when the product is
 * unknown or has not been read yet: a caller falls back to that product's own data, never
 * to another product's size.
 */
export const resolveCabinetDimensions = (
  entries: readonly CabinetEntry[],
  dimensionsByCabinet: Readonly<Record<StableCabinetKey, CabinetDimensions>>,
  runtimeId: string | null | undefined,
): CabinetDimensions | null => {
  if (!runtimeId) return null;

  const stableKey = resolveStableKey(entries, runtimeId);
  return stableKey ? (dimensionsByCabinet[stableKey] ?? null) : null;
};

export type RegisterCabinetsResult = {
  entries: CabinetEntry[];
  nextSeq: number;
};

/**
 * Registers runtime ids, keeping the stable key of products that are already known.
 * Ids absent from `runtimeIds` are dropped; new ids get a fresh key.
 *
 * Order follows `runtimeIds`, which the caller reads from the scene.
 */
export const registerCabinets = (
  entries: readonly CabinetEntry[],
  runtimeIds: readonly string[],
  nextSeq: number,
): RegisterCabinetsResult => {
  let seq = nextSeq;

  const next = runtimeIds.map((runtimeId, index) => {
    const existing = findByRuntimeId(entries, runtimeId);

    if (existing) {
      return { ...existing, index };
    }

    const entry: CabinetEntry = { stableKey: createStableKey(seq), runtimeId, index };
    seq += 1;
    return entry;
  });

  return { entries: next, nextSeq: seq };
};

/**
 * Re-indexes known products against the order reported by the scene.
 *
 * An empty or unusable scene answer keeps the previous order instead of clearing it —
 * `getOrderedProductIds` returns its fallback argument when the composition manager
 * is not reachable, and a transient miss must not look like "no products".
 */
export const reconcileOrder = (
  entries: readonly CabinetEntry[],
  runtimeOrder: readonly string[],
): CabinetEntry[] => {
  if (runtimeOrder.length === 0) return [...entries];

  const known = new Map(entries.map((entry) => [entry.runtimeId, entry]));
  const ordered: CabinetEntry[] = [];

  for (const runtimeId of runtimeOrder) {
    const entry = known.get(runtimeId);
    if (!entry) continue;

    ordered.push({ ...entry, index: ordered.length });
    known.delete(runtimeId);
  }

  // Products the scene did not report keep their relative order after the reported ones,
  // so an incomplete answer never silently deletes state.
  for (const entry of entries) {
    if (!known.has(entry.runtimeId)) continue;
    ordered.push({ ...entry, index: ordered.length });
  }

  return ordered;
};

/**
 * Re-binds saved stable keys to the runtime ids produced while replaying a configuration.
 * Both lists are in composition order; extra entries on either side are ignored rather
 * than silently paired with the wrong product.
 */
export const rebindSavedCabinets = (
  savedKeys: readonly StableCabinetKey[],
  runtimeIds: readonly string[],
): CabinetEntry[] => {
  const pairs = Math.min(savedKeys.length, runtimeIds.length);
  const entries: CabinetEntry[] = [];

  for (let index = 0; index < pairs; index += 1) {
    entries.push({ stableKey: savedKeys[index], runtimeId: runtimeIds[index], index });
  }

  return entries;
};

/** Highest sequence number used by the given keys, so restore never reissues a key. */
export const maxSeqFromKeys = (keys: readonly StableCabinetKey[]): number =>
  keys.reduce((max, key) => {
    const parsed = Number(key.replace(/^cab-/, ""));
    return Number.isFinite(parsed) && parsed > max ? parsed : max;
  }, 0);
