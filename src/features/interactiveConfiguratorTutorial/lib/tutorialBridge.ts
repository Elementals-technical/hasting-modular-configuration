import type { InteractiveConfiguratorTutorialStepId } from "../model/types";

export const INTERACTIVE_CONFIGURATOR_TUTORIAL_EVENTS = {
  selectDefaultCabinetType: "interactiveConfiguratorTutorial:selectDefaultCabinetType",
  selectDefaultCabinetStyle: "interactiveConfiguratorTutorial:selectDefaultCabinetStyle",
  enterCustomMode: "interactiveConfiguratorTutorial:enterCustomMode",
  ensureSelectedCabinetOnScene: "interactiveConfiguratorTutorial:ensureSelectedCabinetOnScene",
  selectedCabinetOnSceneReady: "interactiveConfiguratorTutorial:selectedCabinetOnSceneReady",
  cancelPendingActions: "interactiveConfiguratorTutorial:cancelPendingActions",
  activeStepChange: "interactiveConfiguratorTutorial:activeStepChange",
} as const;

type InteractiveConfiguratorTutorialEventName =
  Exclude<
    (typeof INTERACTIVE_CONFIGURATOR_TUTORIAL_EVENTS)[keyof typeof INTERACTIVE_CONFIGURATOR_TUTORIAL_EVENTS],
    | typeof INTERACTIVE_CONFIGURATOR_TUTORIAL_EVENTS.activeStepChange
    | typeof INTERACTIVE_CONFIGURATOR_TUTORIAL_EVENTS.selectedCabinetOnSceneReady
    | typeof INTERACTIVE_CONFIGURATOR_TUTORIAL_EVENTS.ensureSelectedCabinetOnScene
    | typeof INTERACTIVE_CONFIGURATOR_TUTORIAL_EVENTS.enterCustomMode
  >;

type InteractiveConfiguratorTutorialActiveStepChangeDetail = {
  stepId: InteractiveConfiguratorTutorialStepId | null;
};

type InteractiveConfiguratorTutorialSceneCabinetRequestDetail = {
  requestId: string;
};

type InteractiveConfiguratorTutorialSceneCabinetReadyDetail = {
  requestId: string;
};

type InteractiveConfiguratorTutorialEnterCustomModeDetail = {
  route: string;
};

let currentSceneCabinetRequestDetail: InteractiveConfiguratorTutorialSceneCabinetRequestDetail | null = null;

const isActiveStepChangeDetail = (
  value: unknown,
): value is InteractiveConfiguratorTutorialActiveStepChangeDetail => {
  if (!value || typeof value !== "object") return false;

  const detail = value as Record<string, unknown>;

  return detail.stepId === null || typeof detail.stepId === "string";
};

const isSceneCabinetRequestDetail = (
  value: unknown,
): value is InteractiveConfiguratorTutorialSceneCabinetRequestDetail => {
  if (!value || typeof value !== "object") return false;

  const detail = value as Record<string, unknown>;

  return typeof detail.requestId === "string";
};

const isSceneCabinetReadyDetail = (
  value: unknown,
): value is InteractiveConfiguratorTutorialSceneCabinetReadyDetail => {
  if (!value || typeof value !== "object") return false;

  const detail = value as Record<string, unknown>;

  return typeof detail.requestId === "string";
};

const isEnterCustomModeDetail = (value: unknown): value is InteractiveConfiguratorTutorialEnterCustomModeDetail => {
  if (!value || typeof value !== "object") return false;

  const detail = value as Record<string, unknown>;

  return typeof detail.route === "string";
};

export const dispatchInteractiveConfiguratorTutorialEvent = (eventName: InteractiveConfiguratorTutorialEventName) => {
  window.dispatchEvent(new CustomEvent(eventName));
};

export const dispatchInteractiveConfiguratorTutorialEnterCustomMode = (route: string) => {
  window.dispatchEvent(
    new CustomEvent<InteractiveConfiguratorTutorialEnterCustomModeDetail>(
      INTERACTIVE_CONFIGURATOR_TUTORIAL_EVENTS.enterCustomMode,
      {
        detail: { route },
      },
    ),
  );
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

export const dispatchInteractiveConfiguratorTutorialSceneCabinetRequest = (requestId: string) => {
  currentSceneCabinetRequestDetail = { requestId };

  window.dispatchEvent(
    new CustomEvent<InteractiveConfiguratorTutorialSceneCabinetRequestDetail>(
      INTERACTIVE_CONFIGURATOR_TUTORIAL_EVENTS.ensureSelectedCabinetOnScene,
      {
        detail: currentSceneCabinetRequestDetail,
      },
    ),
  );
};

export const clearInteractiveConfiguratorTutorialSceneCabinetRequest = (requestId?: string) => {
  if (requestId !== undefined && currentSceneCabinetRequestDetail?.requestId !== requestId) return;

  currentSceneCabinetRequestDetail = null;
};

export const dispatchInteractiveConfiguratorTutorialSceneCabinetReady = (requestId: string) => {
  clearInteractiveConfiguratorTutorialSceneCabinetRequest(requestId);

  window.dispatchEvent(
    new CustomEvent<InteractiveConfiguratorTutorialSceneCabinetReadyDetail>(
      INTERACTIVE_CONFIGURATOR_TUTORIAL_EVENTS.selectedCabinetOnSceneReady,
      {
        detail: { requestId },
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

export const subscribeToInteractiveConfiguratorTutorialSceneCabinetRequest = (
  listener: (detail: InteractiveConfiguratorTutorialSceneCabinetRequestDetail) => void,
) => {
  const eventListener: EventListener = (event) => {
    if (!(event instanceof CustomEvent)) return;
    if (!isSceneCabinetRequestDetail(event.detail)) return;

    listener(event.detail);
  };

  window.addEventListener(INTERACTIVE_CONFIGURATOR_TUTORIAL_EVENTS.ensureSelectedCabinetOnScene, eventListener);

  if (currentSceneCabinetRequestDetail) {
    listener(currentSceneCabinetRequestDetail);
  }

  return () => {
    window.removeEventListener(INTERACTIVE_CONFIGURATOR_TUTORIAL_EVENTS.ensureSelectedCabinetOnScene, eventListener);
  };
};

export const subscribeToInteractiveConfiguratorTutorialEnterCustomMode = (
  listener: (detail: InteractiveConfiguratorTutorialEnterCustomModeDetail) => void,
) => {
  const eventListener: EventListener = (event) => {
    if (!(event instanceof CustomEvent)) return;
    if (!isEnterCustomModeDetail(event.detail)) return;

    listener(event.detail);
  };

  window.addEventListener(INTERACTIVE_CONFIGURATOR_TUTORIAL_EVENTS.enterCustomMode, eventListener);

  return () => {
    window.removeEventListener(INTERACTIVE_CONFIGURATOR_TUTORIAL_EVENTS.enterCustomMode, eventListener);
  };
};

export const subscribeToInteractiveConfiguratorTutorialSceneCabinetReady = (
  listener: (detail: InteractiveConfiguratorTutorialSceneCabinetReadyDetail) => void,
) => {
  const eventListener: EventListener = (event) => {
    if (!(event instanceof CustomEvent)) return;
    if (!isSceneCabinetReadyDetail(event.detail)) return;

    listener(event.detail);
  };

  window.addEventListener(INTERACTIVE_CONFIGURATOR_TUTORIAL_EVENTS.selectedCabinetOnSceneReady, eventListener);

  return () => {
    window.removeEventListener(INTERACTIVE_CONFIGURATOR_TUTORIAL_EVENTS.selectedCabinetOnSceneReady, eventListener);
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
