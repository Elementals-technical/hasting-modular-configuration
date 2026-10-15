import { useSyncExternalStore } from "react";

import { UI_REASON_TEXTS } from "@/shared/lib/reasonText";

/**
 * Scene refusals the user is told about, reported from wherever a command runs (the sidebar's "+",
 * the player's duplicate and swap) and shown by SceneRefusalNotice in the player. One notice at a
 * time: a newer refusal replaces the one shown. The scene's code is the reason code: its text comes
 * from UI_REASON_TEXTS (shared/lib/reasonText) or the collection's `messages`.
 */

let shownCode: string | null = null;
const listeners = new Set<() => void>();

const show = (code: string | null) => {
  shownCode = code;
  listeners.forEach((listener) => listener());
};

/**
 * Shows the notice for a command the scene refused with a code the interface has a text for
 * (UI_REASON_TEXTS: UF_HEIGHT_RUN_VIOLATION). Any other result, and another collection's code, shows nothing.
 */
export const reportSceneRefusal = (result: { status: string; sceneCode?: string }) => {
  if (result.status === "error" && result.sceneCode && Object.hasOwn(UI_REASON_TEXTS, result.sceneCode)) {
    show(result.sceneCode);
  }
};

export const dismissSceneRefusal = () => show(null);

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** The refusal code shown now, or null. */
export const useSceneRefusal = (): string | null => useSyncExternalStore(subscribe, () => shownCode);
