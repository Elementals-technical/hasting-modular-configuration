import type { InteractiveConfiguratorTutorialStepId } from "../model/types";

export const INTERACTIVE_CONFIGURATOR_TUTORIAL_EVENTS = {
  selectDefaultCabinetType: "interactiveConfiguratorTutorial:selectDefaultCabinetType",
  selectDefaultCabinetStyle: "interactiveConfiguratorTutorial:selectDefaultCabinetStyle",
  ensureSelectedCabinetOnScene: "interactiveConfiguratorTutorial:ensureSelectedCabinetOnScene",
  cancelPendingActions: "interactiveConfiguratorTutorial:cancelPendingActions",
  activeStepChange: "interactiveConfiguratorTutorial:activeStepChange",
} as const;

type InteractiveConfiguratorTutorialEventName =
  Exclude<
    (typeof INTERACTIVE_CONFIGURATOR_TUTORIAL_EVENTS)[keyof typeof INTERACTIVE_CONFIGURATOR_TUTORIAL_EVENTS],
    typeof INTERACTIVE_CONFIGURATOR_TUTORIAL_EVENTS.activeStepChange
  >;

type InteractiveConfiguratorTutorialActiveStepChangeDetail = {
  stepId: InteractiveConfiguratorTutorialStepId | null;
};

const isActiveStepChangeDetail = (
  value: unknown,
): value is InteractiveConfiguratorTutorialActiveStepChangeDetail => {
  if (!value || typeof value !== "object") return false;

  const detail = value as Record<string, unknown>;

  return detail.stepId === null || typeof detail.stepId === "string";
};

export const dispatchInteractiveConfiguratorTutorialEvent = (eventName: InteractiveConfiguratorTutorialEventName) => {
  window.dispatchEvent(new CustomEvent(eventName));
};

export const dispatchInteractiveConfiguratorTutorialActiveStepChange = (
  stepId: InteractiveConfiguratorTutorialStepId | null,
) => {
  window.dispatchEvent(
    new CustomEvent<InteractiveConfiguratorTutorialActiveStepChangeDetail>(
      INTERACTIVE_CONFIGURATOR_TUTORIAL_EVENTS.activeStepChange,
      {
        detail: { stepId },
      },
    ),
  );
};

export const subscribeToInteractiveConfiguratorTutorialEvent = (
  eventName: InteractiveConfiguratorTutorialEventName,
  listener: EventListener,
) => {
  window.addEventListener(eventName, listener);

  return () => {
    window.removeEventListener(eventName, listener);
  };
};

export const subscribeToInteractiveConfiguratorTutorialActiveStepChange = (
  listener: (detail: InteractiveConfiguratorTutorialActiveStepChangeDetail) => void,
) => {
  const eventListener: EventListener = (event) => {
    if (!(event instanceof CustomEvent)) return;
    if (!isActiveStepChangeDetail(event.detail)) return;

    listener(event.detail);
  };

  window.addEventListener(INTERACTIVE_CONFIGURATOR_TUTORIAL_EVENTS.activeStepChange, eventListener);

  return () => {
    window.removeEventListener(INTERACTIVE_CONFIGURATOR_TUTORIAL_EVENTS.activeStepChange, eventListener);
  };
};
