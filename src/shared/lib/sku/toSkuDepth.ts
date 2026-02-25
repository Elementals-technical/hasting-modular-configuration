/**
 * Maps canvas depth values to their SKU counterparts.
 * Canvas may use fractional depths (e.g. 50.5) for physics/rendering,
 * while the SKU must use the nominal integer value (e.g. 50).
 */
const DEPTH_SKU_MAP: Record<number, number> = {
  50.5: 50,
};

export const toSkuDepth = (depth: number): number => DEPTH_SKU_MAP[depth] ?? depth;
