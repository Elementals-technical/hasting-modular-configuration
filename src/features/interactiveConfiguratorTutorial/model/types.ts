import type { Step as JoyrideStep } from "react-joyride";

import type { InteractiveConfiguratorTutorialTarget } from "./targets";

export const INTERACTIVE_CONFIGURATOR_TUTORIAL_STEP_IDS = {
  intro: "intro",
  gettingStarted: "getting-started",
  prebuiltMode: "prebuilt-mode",
  prebuiltDetails: "prebuilt-details",
  customMode: "custom-mode",
  customCabinetType: "custom-cabinet-type",
  customCabinetStyle: "custom-cabinet-style",
  customSizingHandle: "custom-sizing-handle",
  customPlaceCabinet: "custom-place-cabinet",
} as const;

export type InteractiveConfiguratorTutorialStepId =
  (typeof INTERACTIVE_CONFIGURATOR_TUTORIAL_STEP_IDS)[keyof typeof INTERACTIVE_CONFIGURATOR_TUTORIAL_STEP_IDS];

export type InteractiveConfiguratorTutorialStep = {
  id: InteractiveConfiguratorTutorialStepId;
  target: InteractiveConfiguratorTutorialTarget;
  placement: JoyrideStep["placement"];
  title: string;
  description: string;
  progressLabel?: string;
  primaryLabel: string;
  secondaryLabel?: string;
  secondaryAction?: "back" | "skip";
  route?: string;
  spotlightPadding?: JoyrideStep["spotlightPadding"];
};
