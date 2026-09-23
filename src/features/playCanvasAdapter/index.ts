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

export { createCompositionPort } from "./lib/createCompositionPort";
export type { CompositionPortDeps, SceneCompositionBridge } from "./lib/createCompositionPort";
export { createTestCompositionPort } from "./lib/testCompositionPort";
export type { CompositionCall, TestCompositionPort } from "./lib/testCompositionPort";

export { createDividerPort } from "./lib/createDividerPort";
export type { DividerPortDeps } from "./lib/createDividerPort";
export { createTestDividerPort } from "./lib/testDividerPort";
export type { TestDividerPort } from "./lib/testDividerPort";

export { createSidePanelPort } from "./lib/createSidePanelPort";
export type { SidePanelPortDeps } from "./lib/createSidePanelPort";
export { createTestSidePanelPort } from "./lib/testSidePanelPort";
export type { TestSidePanelPort } from "./lib/testSidePanelPort";

export { fitCountertop, restoreCountertopConfigs } from "./lib/countertopScene";
export type { CountertopSize } from "./lib/countertopScene";
export { ensureCabinetHeights } from "./lib/ensureCabinetHeights";
export type { CabinetHeightCheck } from "./lib/ensureCabinetHeights";
