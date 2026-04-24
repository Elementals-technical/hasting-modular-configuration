export type InSceneQuickEditorNotificationFlow = "custom" | "prebuilt";

export type InSceneQuickEditorNotificationTransition = "none" | "forward" | "backtrack" | "outside-flow";

export type InSceneQuickEditorNotificationStep = {
  id: string;
  label: string;
  path: string;
};

export type InSceneQuickEditorNotificationResolvedStep = InSceneQuickEditorNotificationStep & {
  index: number;
};

export type InSceneQuickEditorNotificationContent = {
  title: string;
  intro?: string;
  details?: readonly string[];
  closeButtonLabel: string;
  closeButtonAriaLabel: string;
};

export type InSceneQuickEditorNotificationState = {
  isEligible: boolean;
  isVisible: boolean;
  hasSeen: boolean;
  isDismissed: boolean;
};

export type InSceneQuickEditorNotificationViewContext = {
  isMenuVisible: boolean;
  isMobile: boolean;
};

export type InSceneQuickEditorNotificationController = InSceneQuickEditorNotificationState & {
  dismiss: () => void;
  hide: () => void;
  markEligible: () => void;
  markSeen: () => void;
  reset: () => void;
  show: () => void;
};

export type UseInSceneQuickEditorNotificationArgs = {
  initialState?: Partial<InSceneQuickEditorNotificationState>;
};

export type ResolveInSceneQuickEditorNotificationBacktrackArgs = {
  flow: InSceneQuickEditorNotificationFlow;
  currentPath: string;
  previousPath: string | null;
};

export type InSceneQuickEditorNotificationTransitionResult = {
  flow: InSceneQuickEditorNotificationFlow;
  currentStep: InSceneQuickEditorNotificationResolvedStep | null;
  previousStep: InSceneQuickEditorNotificationResolvedStep | null;
  transition: InSceneQuickEditorNotificationTransition;
};
