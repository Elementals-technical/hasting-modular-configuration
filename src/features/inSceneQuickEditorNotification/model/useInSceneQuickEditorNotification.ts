import { useCallback, useState } from "react";

import { IN_SCENE_QUICK_EDITOR_NOTIFICATION_INITIAL_STATE } from "../lib/constants";

import type {
  InSceneQuickEditorNotificationController,
  InSceneQuickEditorNotificationState,
  UseInSceneQuickEditorNotificationArgs,
} from "./types";

const createInitialState = (
  initialState?: Partial<InSceneQuickEditorNotificationState>,
): InSceneQuickEditorNotificationState => ({
  ...IN_SCENE_QUICK_EDITOR_NOTIFICATION_INITIAL_STATE,
  ...initialState,
});

export function useInSceneQuickEditorNotification(
  args: UseInSceneQuickEditorNotificationArgs = {},
): InSceneQuickEditorNotificationController {
  const [state, setState] = useState<InSceneQuickEditorNotificationState>(() => createInitialState(args.initialState));

  const dismiss = useCallback(() => {
    setState((current) => ({
      ...current,
      isVisible: false,
      isDismissed: true,
    }));
  }, []);

  const hide = useCallback(() => {
    setState((current) => ({
      ...current,
      isVisible: false,
    }));
  }, []);

  const markEligible = useCallback(() => {
    setState((current) => ({
      ...current,
      isEligible: true,
    }));
  }, []);

  const markSeen = useCallback(() => {
    setState((current) => ({
      ...current,
      hasSeen: true,
      isVisible: false,
      isDismissed: false,
    }));
  }, []);

  const reset = useCallback(() => {
    setState(createInitialState(args.initialState));
  }, [args.initialState]);

  const show = useCallback(() => {
    setState((current) => ({
      ...current,
      hasSeen: true,
      isVisible: true,
      isDismissed: false,
    }));
  }, []);

  return {
    ...state,
    dismiss,
    hide,
    markEligible,
    markSeen,
    reset,
    show,
  };
}
