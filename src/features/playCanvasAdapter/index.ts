// PlayCanvas adapter — owned by I: the runtimePort over the existing scene wrappers.
export { createPlayCanvasRuntimePort } from "./lib/createPlayCanvasRuntimePort";
export type { PlayCanvasRuntimePortDeps, SceneBridge } from "./lib/createPlayCanvasRuntimePort";

export { resolveSceneSelector } from "./lib/resolveSceneSelector";
export type { SceneSelectorResolution } from "./lib/resolveSceneSelector";

export { createTestRuntimePort } from "./lib/testRuntimePort";
export type { TestRuntimePort } from "./lib/testRuntimePort";

export { createSceneReader } from "./lib/createSceneReader";
export type { SceneReadBridge, SceneReaderDeps } from "./lib/createSceneReader";
export { createTestSceneReader } from "./lib/testSceneReader";
export type { TestSceneReader } from "./lib/testSceneReader";

export { createSceneRestorer, resolveSceneProductType } from "./lib/createSceneRestorer";
export type { SceneRestoreBridge, SceneRestorerDeps } from "./lib/createSceneRestorer";
export { createTestSceneRestorer } from "./lib/testSceneRestorer";
export type { TestSceneRestorer } from "./lib/testSceneRestorer";
