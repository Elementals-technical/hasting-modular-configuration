// PlayCanvas adapter — owned by I: the runtimePort over the existing scene wrappers.
export { createPlayCanvasRuntimePort } from "./lib/createPlayCanvasRuntimePort";
export type { PlayCanvasRuntimePortDeps, SceneBridge } from "./lib/createPlayCanvasRuntimePort";

export { resolveSceneSelector } from "./lib/resolveSceneSelector";
export type { SceneSelectorResolution } from "./lib/resolveSceneSelector";

export { createTestRuntimePort } from "./lib/testRuntimePort";
export type { TestRuntimePort } from "./lib/testRuntimePort";

// TODO(A07): temporary runtime-bindings loader.
export { getLoadedRuntimeBindings, loadRuntimeBindings, resetRuntimeBindingsCache } from "./lib/runtimeBindingsCache";
export { RuntimeBindingsBridge } from "./ui/RuntimeBindingsBridge";
