// Public engine-free entry — spatial-manipulation V2.
// Pure re-exports only: no implementation, never an engine/DOM/product import (the PlayCanvas
// adapters live behind playcanvas/index.mjs).

// V2: describe a manipulable, run it in a world.
export { defineManipulable, isManipulableSpec } from './spec/define.mjs';
export { all, any, envelope, not, tag } from './spec/selectors.mjs';
export { corners, edges, joints } from './spec/extractors.mjs';
export { createSpatialWorld } from './runtime/world.mjs';

// Contracts and pure algorithms (usable standalone).
export {
  SPATIAL_MANIPULATION_EVENT,
  SPATIAL_MANIPULATION_SCHEMA_VERSION
} from './core/contracts/constants.mjs';
export { SPATIAL_MANIPULATION_ERROR_CODE } from './core/contracts/errors.mjs';
export {
  validateManipulationConfigV1,
  validateRuntimeBindingV1
} from './core/contracts/validators.mjs';
export { intersectRayPlaneV1 } from './core/motion/ray-plane.mjs';
export { createMotionPlanV1 } from './core/motion/planner.mjs';
export { resolveSnapV1 } from './core/snapping/resolver.mjs';
export {
  evaluateAabbCollisionsM,
  intersectAabbM
} from './core/collision/aabb.mjs';
export { buildCollisionProxies } from './core/collision/proxies.mjs';
export { createManipulationRuntimeV1 as createManipulationRuntime } from './runtime/instance.mjs';
