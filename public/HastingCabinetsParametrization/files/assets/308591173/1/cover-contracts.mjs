/** Stable, serializable diagnostic codes for the v1 cabinet-cover planner. */
export const COVER_DIAGNOSTIC_CODE = Object.freeze({
    INVALID_INPUT: 'invalid-input',
    UNKNOWN_ELIGIBILITY: 'unknown-eligibility',
    PARTIAL_DEPTH_OVERLAP: 'partial-depth-overlap',
    INCOMPATIBLE_SUPPORT_OVERLAP: 'incompatible-support-overlap',
    UNSUPPORTED_ORIENTATION: 'unsupported-orientation'
});

export const CABINET_COVER_PLAN_VERSION = 1;
