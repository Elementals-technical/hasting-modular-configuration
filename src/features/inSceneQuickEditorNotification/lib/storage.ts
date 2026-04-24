import { IN_SCENE_QUICK_EDITOR_NOTIFICATION_STORAGE_KEY } from "./constants";

type StorageLike = Pick<Storage, "getItem" | "removeItem" | "setItem">;

const STORAGE_TRUE_VALUE = "1";

export const getInSceneQuickEditorNotificationSeen = (
  storage: StorageLike | null | undefined,
  key = IN_SCENE_QUICK_EDITOR_NOTIFICATION_STORAGE_KEY,
): boolean => {
  if (!storage) return false;

  try {
    return storage.getItem(key) === STORAGE_TRUE_VALUE;
  } catch {
    return false;
  }
};

export const setInSceneQuickEditorNotificationSeen = (
  storage: StorageLike | null | undefined,
  key = IN_SCENE_QUICK_EDITOR_NOTIFICATION_STORAGE_KEY,
): void => {
  if (!storage) return;

  try {
    storage.setItem(key, STORAGE_TRUE_VALUE);
  } catch {
    // Storage availability and scope are resolved by the host at integration time.
  }
};

export const clearInSceneQuickEditorNotificationSeen = (
  storage: StorageLike | null | undefined,
  key = IN_SCENE_QUICK_EDITOR_NOTIFICATION_STORAGE_KEY,
): void => {
  if (!storage) return;

  try {
    storage.removeItem(key);
  } catch {
    // Storage availability and scope are resolved by the host at integration time.
  }
};
