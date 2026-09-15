import type { AppDispatch, RootState } from "@/app/store";
import { LEGACY_COLLECTION_ID } from "@/entities/collection";
import { finishRestore, getActiveCollectionId, isRestoreInFlightOrDone, startRestore } from "@/entities/configuration";
import type { ConfigurationRecord, ConfigurationSceneRestorer, SceneRestoreMatch } from "@/entities/configuration";
import { captureSnapshot } from "@/entities/history/lib/captureSnapshot";
import { clearHistory, pushSnapshot, setHistoryRestoring } from "@/entities/history/model/store/slice";
import { readSavedCollectionId } from "@/features/saveConfiguration";

import { applyRestoredIdentity } from "./applyRestoredIdentity";
import { buildRestorePlan, type RestorePlan } from "./buildRestorePlan";

/**
 * Restores a saved configuration (C09).
 *
 * 1. A configuration that is being restored or already came back is not started again.
 * 2. The saved collection must be the open one, and the payload must pass `buildRestorePlan`.
 *    Until then nothing touches the scene.
 * 3. The scene restorer (I05) rebuilds the cabinets. The page records them and re-applies its
 *    add-ons, then the saved stable keys and per-cabinet values come back.
 * 4. The history starts over from the restored configuration.
 *
 * The status in the store says how it ended; Save refuses an incomplete restore.
 */

export type RestoreSavedConfigurationDeps = {
  dispatch: AppDispatch;
  getState: () => RootState;
  loadRecord: (configId: string) => Promise<ConfigurationRecord>;
  restorer: ConfigurationSceneRestorer;
  /** The page's own state for the rebuilt products: prebuilt and custom record them differently. */
  applyPage: (plan: RestorePlan, matches: SceneRestoreMatch[]) => Promise<void>;
};

export type RestoreSavedConfigurationResult =
  | { status: "skipped" }
  | { status: "failed"; message: string }
  | { status: "restored" | "partial"; plan: RestorePlan; matches: SceneRestoreMatch[] };

const joinMessages = (issues: readonly { message: string }[]): string => issues.map(({ message }) => message).join(" ");

export const restoreSavedConfiguration = async (
  configId: string,
  { dispatch, getState, loadRecord, restorer, applyPage }: RestoreSavedConfigurationDeps,
): Promise<RestoreSavedConfigurationResult> => {
  if (isRestoreInFlightOrDone(getState(), configId)) return { status: "skipped" };

  dispatch(startRestore(configId));
  dispatch(setHistoryRestoring(true));

  // Once the scene was rebuilt, a later error leaves it changed: that is reported as partial.
  let sceneChanged = false;

  const fail = (message: string): RestoreSavedConfigurationResult => {
    dispatch(finishRestore({ status: sceneChanged ? "partial" : "failed", message }));
    console.error(`[Restore] ${configId}: ${message}`);
    return { status: "failed", message };
  };

  try {
    let record: ConfigurationRecord;
    try {
      record = await loadRecord(configId);
    } catch {
      return fail("The saved configuration could not be loaded.");
    }

    const savedCollectionId = readSavedCollectionId(record.metadata) ?? LEGACY_COLLECTION_ID;
    const activeCollectionId = getActiveCollectionId(getState());
    if (savedCollectionId !== activeCollectionId) {
      return fail(`The configuration belongs to "${savedCollectionId}", not to "${activeCollectionId ?? "none"}".`);
    }

    const built = buildRestorePlan(configId, record);
    if (!built.ok) return fail(joinMessages(built.issues));

    const scene = await restorer.restore({ products: built.plan.products });
    if (scene.status === "not-ready") return fail("The scene is not ready.");
    if (scene.status === "rejected") return fail(joinMessages(scene.issues));

    sceneChanged = true;
    await applyPage(built.plan, scene.matches);
    applyRestoredIdentity(built.plan, scene.matches, dispatch);

    if (scene.status === "partial") {
      console.error(`[Restore] ${configId}: the scene was only partly rebuilt`, scene.failed);
    }

    dispatch(
      finishRestore({ status: scene.status, message: scene.status === "partial" ? joinMessages(scene.failed) : null }),
    );

    // History ignores snapshots while restoring; the restored configuration is its first entry.
    dispatch(setHistoryRestoring(false));
    dispatch(clearHistory());
    dispatch(pushSnapshot(await captureSnapshot(getState)));

    return { status: scene.status, plan: built.plan, matches: scene.matches };
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  } finally {
    dispatch(setHistoryRestoring(false));
  }
};
