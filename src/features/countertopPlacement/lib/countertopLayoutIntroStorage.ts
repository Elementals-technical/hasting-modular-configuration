export const COUNTERTOP_LAYOUT_INTRO_STORAGE_KEY = "countertop-layout-intro:seen";

type StorageLike = Pick<Storage, "getItem" | "setItem">;

const STORAGE_TRUE_VALUE = "1";

/** Reading `window.sessionStorage` itself throws where the host blocks storage (a sandboxed iframe). */
const resolveSessionStorage = (): StorageLike | null => {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
};

/** Whether the "Customize Your Countertop Layout" intro was continued past in this browser session. */
export const getCountertopLayoutIntroSeen = (
  storage: StorageLike | null = resolveSessionStorage(),
  key = COUNTERTOP_LAYOUT_INTRO_STORAGE_KEY,
): boolean => {
  if (!storage) return false;

  try {
    return storage.getItem(key) === STORAGE_TRUE_VALUE;
  } catch {
    return false;
  }
};

export const setCountertopLayoutIntroSeen = (
  storage: StorageLike | null = resolveSessionStorage(),
  key = COUNTERTOP_LAYOUT_INTRO_STORAGE_KEY,
): void => {
  if (!storage) return;

  try {
    storage.setItem(key, STORAGE_TRUE_VALUE);
  } catch {
    // A blocked or full storage only means the intro shows again on the next entry.
  }
};
