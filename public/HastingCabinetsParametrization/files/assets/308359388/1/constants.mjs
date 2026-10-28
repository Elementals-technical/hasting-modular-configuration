export const SPATIAL_MANIPULATION_SCHEMA_VERSION = 1;

export const SPATIAL_MANIPULATION_EVENT = Object.freeze({
  MOTION_APPLIED: 'motionapplied',
  SPATIAL_CHANGE: 'spatialchange',
  SNAP_CHANGE: 'snapchange',
  COLLISION_CHANGE: 'collisionchange',
  GESTURE_START: 'gesturestart',
  GESTURE_END: 'gestureend',
  GESTURE_CANCEL: 'gesturecancel',
  LIFECYCLE_CHANGE: 'lifecyclechange'
});
