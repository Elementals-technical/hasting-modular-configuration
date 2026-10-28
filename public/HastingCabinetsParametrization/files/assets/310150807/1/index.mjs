// Placement kernel: engine-free facts -> checks -> validator. Collection packs are data (../collections).
export { buildPlacementFacts, buildPlacementFact, matchesSelector } from './placement-facts.mjs';
export { CHECKS, isAbove } from './placement-checks.mjs';
export { createPlacementValidator, violationKeys } from './placement-validator.mjs';
export { assertPack, SEVERITIES, PHASES } from './pack-schema.mjs';
