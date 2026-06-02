export const INTERACTIVE_CONFIGURATOR_TUTORIAL_TARGET_ATTRIBUTE = "data-tutorial-target";

export const INTERACTIVE_CONFIGURATOR_TUTORIAL_TARGETS = {
  page: "body",
  modelModeSwitcher: "model-mode-switcher",
  createYourOwnMode: "create-your-own-mode",
  prebuiltFilters: "prebuilt-filters",
  prebuiltModelsGrid: "prebuilt-models-grid",
  prebuiltNextButton: "prebuilt-next-button",
  customCabinetType: "custom-cabinet-type",
  customCabinetStyle: "custom-cabinet-style",
  customSizingHandle: "custom-sizing-handle",
  customPlaceCabinet: "custom-place-cabinet",
} as const;

export type InteractiveConfiguratorTutorialTarget =
  (typeof INTERACTIVE_CONFIGURATOR_TUTORIAL_TARGETS)[keyof typeof INTERACTIVE_CONFIGURATOR_TUTORIAL_TARGETS];

export const getInteractiveConfiguratorTutorialTargetSelector = (
  target: InteractiveConfiguratorTutorialTarget,
) => {
  if (target === INTERACTIVE_CONFIGURATOR_TUTORIAL_TARGETS.page) return target;

  return `[${INTERACTIVE_CONFIGURATOR_TUTORIAL_TARGET_ATTRIBUTE}="${target}"]`;
};
