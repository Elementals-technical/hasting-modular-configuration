/**
 * PlayCanvas entry — spatial-manipulation V2.
 *
 * `getSpatialWorld(app, { scene })` is all a consumer needs; the remaining exports are the
 * building blocks (projection, hierarchy, input router, measurement, pose, guides).
 * This entry imports the core; the core entry never imports it.
 */
export { SPATIAL_WORLD_APP_KEY, createPlayCanvasSpatialWorld, getSpatialWorld } from './world.mjs';
export {
  DEFAULT_EXCLUDED_NODE_FRAGMENTS,
  collectTree,
  entityWorldMatrix,
  extractMeshPrimitives,
  measureBodyProxiesM,
  measureEntityBoundsM,
  worldBoxFromLocal
} from './scene-measure.mjs';
export { createEntityGroupPose } from './entity-group-pose.mjs';
export { SnapGuideRenderer, projectWorldToScreen } from './snap-guides.mjs';
export {
  DEFAULT_PROJECTION_PARALLEL_EPSILON,
  PROJECTION_BASIS_STEP_PX,
  createPlayCanvasProjectionAdapter,
  createPlayCanvasProjectionAdapterForApp
} from './projection.mjs';
export {
  collectPlayCanvasAncestorIds,
  collectPlayCanvasDescendantIds,
  createPlayCanvasHierarchyAdapter,
  createPlayCanvasHierarchySnapshotV1,
  defaultPlayCanvasTransformId,
  describePlayCanvasBindingTransforms
} from './hierarchy.mjs';
export {
  DEFAULT_SPATIAL_DRAG_THRESHOLD_PX,
  SPATIAL_MANIPULATION_INPUT_APP_KEY,
  SPATIAL_POINTER_META,
  SPATIAL_SYNTHETIC_MOUSE_OWNER,
  createPlayCanvasInputRouter,
  resolvePlayCanvasInputRouter
} from './input.mjs';
export {
  SPATIAL_MANIPULATION_GESTURE_OWNER_PREFIX,
  acquireGestureOwnership,
  createSpatialManipulationGestureOwner,
  isSpatialManipulationGestureOwner,
  releaseGestureOwnership
} from './gesture-ownership.mjs';
