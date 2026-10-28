export const SNAPSHOT_DEVICE_PROFILE = Object.freeze({
  IOS: 'ios',
  MOBILE: 'mobile',
  DESKTOP: 'desktop'
});

const SNAPSHOT_MEMORY_POLICIES = Object.freeze({
  [SNAPSHOT_DEVICE_PROFILE.IOS]: Object.freeze({
    maxOutputLongEdge: 4096,
    maxOutputPixels: 4096 * 4096,
    maxRenderLongEdge: 4096,
    maxRenderPixels: 4096 * 4096,
    maxSuperSample: 1,
    allowCameraFrame: false,
    allowSsao: false
  }),
  [SNAPSHOT_DEVICE_PROFILE.MOBILE]: Object.freeze({
    maxOutputLongEdge: 4096,
    maxOutputPixels: 4096 * 4096,
    maxRenderLongEdge: 4096,
    maxRenderPixels: 4096 * 4096,
    maxSuperSample: 1,
    allowCameraFrame: false,
    allowSsao: false
  }),
  [SNAPSHOT_DEVICE_PROFILE.DESKTOP]: Object.freeze({
    maxOutputLongEdge: 8192,
    maxOutputPixels: 8192 * 8192,
    maxRenderLongEdge: 16384,
    maxRenderPixels: 134_217_728,
    maxSuperSample: 3,
    allowCameraFrame: true,
    allowSsao: true
  })
});

const positiveInt = (value, fallback = 1) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : fallback;
};

const roundMegabytes = (bytes) => Math.round((bytes / (1024 * 1024)) * 10) / 10;

const fitDimensions = (width, height, maxLongEdge, maxPixels) => {
  const longEdgeScale = Math.min(1, maxLongEdge / Math.max(width, height));
  const pixelScale = Math.min(1, Math.sqrt(maxPixels / (width * height)));
  const scale = Math.min(longEdgeScale, pixelScale);

  return {
    width: Math.max(1, Math.floor(width * scale)),
    height: Math.max(1, Math.floor(height * scale)),
    scale
  };
};

const estimateTransientBytes = (renderPixels, outputPixels) => {
  // Conservative approximation of concurrently live allocations:
  // GPU color/depth, readback, ImageData and render canvas (~20 B/render px),
  // plus final canvas and encoder/blob working memory (~8 B/output px).
  return renderPixels * 20 + outputPixels * 8;
};

export function resolveSnapshotDeviceProfile(platformCapabilities) {
  if (platformCapabilities?.ios) return SNAPSHOT_DEVICE_PROFILE.IOS;
  if (platformCapabilities?.mobile) return SNAPSHOT_DEVICE_PROFILE.MOBILE;
  return SNAPSHOT_DEVICE_PROFILE.DESKTOP;
}

export function getSnapshotMemoryPolicy(profile, overrides = {}) {
  const resolvedProfile = SNAPSHOT_MEMORY_POLICIES[profile]
    ? profile
    : SNAPSHOT_DEVICE_PROFILE.DESKTOP;

  return {
    ...SNAPSHOT_MEMORY_POLICIES[resolvedProfile],
    ...overrides,
    profile: resolvedProfile
  };
}

export function createSnapshotMemoryPlan(options, platformCapabilities, deviceLimits = {}, policyOverrides = {}) {
  const requestedWidth = positiveInt(options?.width);
  const requestedHeight = positiveInt(options?.height);
  const autoSuperSample = Math.max(requestedWidth, requestedHeight) >= 4096 ? 2 : 3;
  const rawSuperSample = options?.ss ?? options?.superSample;
  const requestedSuperSample = Number(rawSuperSample) > 0
    ? positiveInt(rawSuperSample)
    : autoSuperSample;
  const requestedCameraFrame = options?.cameraFrame === true;
  const requestedSsao = options?.ssao === true;
  const profile = resolveSnapshotDeviceProfile(platformCapabilities);
  const policy = getSnapshotMemoryPolicy(profile, policyOverrides);
  const reasons = [];

  const output = fitDimensions(
    requestedWidth,
    requestedHeight,
    policy.maxOutputLongEdge,
    policy.maxOutputPixels
  );

  if (Math.max(requestedWidth, requestedHeight) > policy.maxOutputLongEdge) {
    reasons.push('output-long-edge');
  }
  if (requestedWidth * requestedHeight > policy.maxOutputPixels) {
    reasons.push('output-pixel-budget');
  }

  const superSample = Math.min(requestedSuperSample, policy.maxSuperSample);
  if (superSample !== requestedSuperSample) {
    reasons.push('supersample-cap');
  }

  const desiredRenderWidth = output.width * superSample;
  const desiredRenderHeight = output.height * superSample;
  const maxTextureSize = positiveInt(deviceLimits.maxTextureSize, policy.maxRenderLongEdge);
  const renderLongEdgeLimit = Math.min(policy.maxRenderLongEdge, maxTextureSize);
  const render = fitDimensions(
    desiredRenderWidth,
    desiredRenderHeight,
    renderLongEdgeLimit,
    policy.maxRenderPixels
  );

  if (Math.max(desiredRenderWidth, desiredRenderHeight) > policy.maxRenderLongEdge) {
    reasons.push('render-long-edge');
  }
  if (desiredRenderWidth * desiredRenderHeight > policy.maxRenderPixels) {
    reasons.push('render-pixel-budget');
  }
  if (Math.max(desiredRenderWidth, desiredRenderHeight) > maxTextureSize) {
    reasons.push('max-texture-size');
  }

  const cameraFrame = policy.allowCameraFrame && requestedCameraFrame;
  const ssao = policy.allowSsao && requestedSsao;
  if (cameraFrame !== requestedCameraFrame) reasons.push('camera-frame-disabled');
  if (ssao !== requestedSsao) reasons.push('ssao-disabled');

  const requestedRenderWidth = requestedWidth * requestedSuperSample;
  const requestedRenderHeight = requestedHeight * requestedSuperSample;
  const requestedRenderPixels = requestedRenderWidth * requestedRenderHeight;
  const effectiveRenderPixels = render.width * render.height;
  const outputPixels = output.width * output.height;
  const uniqueReasons = [...new Set(reasons)];

  return {
    options: {
      ...options,
      width: output.width,
      height: output.height,
      ss: superSample,
      cameraFrame,
      ssao
    },
    renderWidth: render.width,
    renderHeight: render.height,
    metadata: {
      profile,
      adjusted: uniqueReasons.length > 0,
      reasons: uniqueReasons,
      requested: {
        width: requestedWidth,
        height: requestedHeight,
        superSample: requestedSuperSample,
        renderWidth: requestedRenderWidth,
        renderHeight: requestedRenderHeight,
        cameraFrame: requestedCameraFrame,
        ssao: requestedSsao,
        estimatedTransientMB: roundMegabytes(
          estimateTransientBytes(requestedRenderPixels, requestedWidth * requestedHeight)
        )
      },
      effective: {
        width: output.width,
        height: output.height,
        superSample,
        renderWidth: render.width,
        renderHeight: render.height,
        cameraFrame,
        ssao,
        nativeOutputRender: render.width >= output.width && render.height >= output.height,
        estimatedTransientMB: roundMegabytes(
          estimateTransientBytes(effectiveRenderPixels, outputPixels)
        )
      }
    }
  };
}
