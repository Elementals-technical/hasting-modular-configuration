import type { InSceneQuickEditorNotificationContent, InSceneQuickEditorNotificationState } from "../model/types";

export const IN_SCENE_QUICK_EDITOR_NOTIFICATION_FEATURE_KEY = "in-scene-quick-editor-notification";

export const IN_SCENE_QUICK_EDITOR_NOTIFICATION_STORAGE_KEY =
  `${IN_SCENE_QUICK_EDITOR_NOTIFICATION_FEATURE_KEY}:seen`;

export const IN_SCENE_QUICK_EDITOR_NOTIFICATION_CLOSE_BUTTON_LABEL = "Close";
export const IN_SCENE_QUICK_EDITOR_NOTIFICATION_PANEL_WIDTH = 320;
export const IN_SCENE_QUICK_EDITOR_NOTIFICATION_CLUSTER_GAP = 18;

export const IN_SCENE_QUICK_EDITOR_NOTIFICATION_DEFAULT_CONTENT = {
  title: "In-Scene Configuration",
  intro: "Use the in-scene quick editor to make design changes fast and effortlessly.",
  details: [
    "Resize, reposition, clone and add cabinets",
    "Change colors, cabinet styles and handle details and more",
  ],
  closeButtonLabel: IN_SCENE_QUICK_EDITOR_NOTIFICATION_CLOSE_BUTTON_LABEL,
  closeButtonAriaLabel: "Close in-scene quick editor notification",
} satisfies InSceneQuickEditorNotificationContent;

export const IN_SCENE_QUICK_EDITOR_NOTIFICATION_INITIAL_STATE = {
  isEligible: false,
  isVisible: false,
  hasSeen: false,
  isDismissed: false,
} satisfies InSceneQuickEditorNotificationState;
