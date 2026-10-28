export const OUTLINE_DEVICE_PROFILE = Object.freeze({
  MOBILE: "mobile",
  DESKTOP: "desktop"
});

export const OUTLINE_SEMANTIC_STATE = Object.freeze({
  INVALID: "invalid",
  EDITING: "editing",
  SELECTED: "selected"
});

export const OUTLINE_SEMANTIC_PRECEDENCE = Object.freeze([
  OUTLINE_SEMANTIC_STATE.INVALID,
  OUTLINE_SEMANTIC_STATE.EDITING,
  OUTLINE_SEMANTIC_STATE.SELECTED
]);

export const DEFAULT_OUTLINE_SEMANTIC_COLORS = Object.freeze({
  [OUTLINE_SEMANTIC_STATE.INVALID]: Object.freeze([1, 0, 0, 1]),
  [OUTLINE_SEMANTIC_STATE.EDITING]: Object.freeze([0, 1, 0, 1]),
  [OUTLINE_SEMANTIC_STATE.SELECTED]: Object.freeze([1, 1, 0, 1])
});

const BASE_OUTLINE_CONFIGURATION = Object.freeze({
  idleSleep: true,
  radius: 4,
  shaderPrewarm: false
});

const PROFILE_CONFIGURATION = Object.freeze({
  [OUTLINE_DEVICE_PROFILE.MOBILE]: Object.freeze({
    resolutionScale: 0.5
  }),
  [OUTLINE_DEVICE_PROFILE.DESKTOP]: Object.freeze({
    resolutionScale: 1
  })
});

export function resolveOutlineDeviceProfile(platformCapabilities) {
  return platformCapabilities?.mobile
    ? OUTLINE_DEVICE_PROFILE.MOBILE
    : OUTLINE_DEVICE_PROFILE.DESKTOP;
}

export function createOutlineConfiguration(profile, overrides = {}) {
  const resolvedProfile = PROFILE_CONFIGURATION[profile]
    ? profile
    : OUTLINE_DEVICE_PROFILE.DESKTOP;

  return {
    ...BASE_OUTLINE_CONFIGURATION,
    ...PROFILE_CONFIGURATION[resolvedProfile],
    ...overrides,
    deviceProfile: resolvedProfile
  };
}

export function createOutlineConfigurationForPlatform(platformCapabilities, overrides = {}) {
  return createOutlineConfiguration(
    resolveOutlineDeviceProfile(platformCapabilities),
    overrides
  );
}

export const DEFAULT_OUTLINE_CONFIGURATION = Object.freeze(
  createOutlineConfiguration(OUTLINE_DEVICE_PROFILE.DESKTOP)
);
