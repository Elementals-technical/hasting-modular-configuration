export const INTERACTIVE_CONFIGURATOR_TUTORIAL_EVENTS = {
  selectDefaultCabinetType: "interactiveConfiguratorTutorial:selectDefaultCabinetType",
  selectDefaultCabinetStyle: "interactiveConfiguratorTutorial:selectDefaultCabinetStyle",
} as const;

type InteractiveConfiguratorTutorialEventName =
  (typeof INTERACTIVE_CONFIGURATOR_TUTORIAL_EVENTS)[keyof typeof INTERACTIVE_CONFIGURATOR_TUTORIAL_EVENTS];

export const dispatchInteractiveConfiguratorTutorialEvent = (eventName: InteractiveConfiguratorTutorialEventName) => {
  window.dispatchEvent(new CustomEvent(eventName));
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
