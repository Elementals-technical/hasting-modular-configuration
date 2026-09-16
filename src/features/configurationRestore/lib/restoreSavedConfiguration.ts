import type { AppDispatch, RootState } from "@/app/store";
import { LEGACY_COLLECTION_ID } from "@/entities/collection";
import { finishRestore, getActiveCollectionId, isRestoreInFlightOrDone, startRestore } from "@/entities/configuration";
import type {
  ConfigurationRecord,
  ConfigurationSceneRestorer,
  RestoreFailureReason,
  SceneRestoreMatch,
} from "@/entities/configuration";
import { captureSnapshot } from "@/entities/history/lib/captureSnapshot";
import { clearHistory, pushSnapshot, setHistoryRestoring } from "@/entities/history/model/store/slice";
import { readSavedCollectionIdentity } from "@/features/saveConfiguration";

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
 * The status in the store says how it ended and why; Save refuses an incomplete restore.
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
  | { status: "failed"; reason: RestoreFailureReason; message: string }
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

  const fail = (reason: RestoreFailureReason, message: string): RestoreSavedConfigurationResult => {
    dispatch(finishRestore({ status: sceneChanged ? "partial" : "failed", reason, message }));
    console.error(`[Restore] ${configId}: ${message}`);
    return { status: "failed", reason, message };
  };

  try {
    let record: ConfigurationRecord;
    try {
      record = await loadRecord(configId);
    } catch {
      return fail("not-found", "The saved configuration could not be loaded.");
    }

    const savedCollection = readSavedCollectionIdentity(record.metadata);
    if (savedCollection.kind === "invalid") {
      return fail("collection", "The saved configuration names an empty collection.");
    }

    const savedCollectionId = savedCollection.kind === "id" ? savedCollection.collectionId : LEGACY_COLLECTION_ID;
    const activeCollectionId = getActiveCollectionId(getState());
    if (savedCollectionId !== activeCollectionId) {
      return fail(
        "collection",
        `The configuration belongs to "${savedCollectionId}", not to "${activeCollectionId ?? "none"}".`,
      );
    }

    const built = buildRestorePlan(configId, record);
    if (!built.ok) return fail("invalid", joinMessages(built.issues));

    const scene = await restorer.restore({ products: built.plan.products });
    if (scene.status === "not-ready") return fail("scene", "The scene is not ready.");
    if (scene.status === "rejected") return fail("scene", joinMessages(scene.issues));

    sceneChanged = true;
    await applyPage(built.plan, scene.matches);
    applyRestoredIdentity(built.plan, scene.matches, dispatch);

    if (scene.status === "partial") {
      console.error(`[Restore] ${configId}: the scene was only partly rebuilt`, scene.failed);
    }

    dispatch(
      finishRestore(
        scene.status === "partial"
          ? { status: "partial", reason: "partial", message: joinMessages(scene.failed) }
          : { status: "restored", reason: null, message: null },
      ),
    );

    // History ignores snapshots while restoring; the restored configuration is its first entry.
    dispatch(setHistoryRestoring(false));
    dispatch(clearHistory());
    dispatch(pushSnapshot(await captureSnapshot(getState)));

    return { status: scene.status, plan: built.plan, matches: scene.matches };
  } catch (error) {
    return fail("scene", error instanceof Error ? error.message : String(error));
  } finally {
    dispatch(setHistoryRestoring(false));
  }
};
