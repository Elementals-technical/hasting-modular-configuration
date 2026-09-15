import { useEffect, useRef } from "react";
import { useStore } from "react-redux";

import type { RootState } from "@/app/store";
import { useActiveCollection } from "@/entities/collection";
import { failRestore, getRestoreState, useLazyRestoreConfigurationQuery } from "@/entities/configuration";
import type { SceneRestoreMatch } from "@/entities/configuration";
import { createSceneRestorer } from "@/features/playCanvasAdapter/lib/createSceneRestorer";
import { useAppDispatch } from "@/shared/hooks/store/redux";
import { usePlayCanvasReady } from "@/shared/hooks/usePlayCanvasReady";

import type { RestorePlan } from "../lib/buildRestorePlan";
import { restoreSavedConfiguration } from "../lib/restoreSavedConfiguration";

export type UseRestoreSavedConfigurationOptions = {
  configId: string | null;
  applyPage: (plan: RestorePlan, matches: SceneRestoreMatch[]) => Promise<void>;
};

/**
 * Restores the configuration in the URL once the scene and the collection are ready.
 *
 * The restore status lives in the store, not in a ref, so a re-run effect, StrictMode or a
 * remount of the page does not restore the same configuration twice.
 */
export const useRestoreSavedConfiguration = ({ configId, applyPage }: UseRestoreSavedConfigurationOptions) => {
  const store = useStore<RootState>();
  const dispatch = useAppDispatch();
  const canvasReady = usePlayCanvasReady();
  const collection = useActiveCollection();
  const isCollectionReady = collection.status === "ready";
  const collectionError = collection.status === "error" ? collection.error.message : null;
  // Preflight checks product types against these, so they come with the loaded collection.
  const bindings = isCollectionReady ? (collection.data.catalog.runtimeBindings ?? null) : null;
  const [loadConfiguration] = useLazyRestoreConfigurationQuery();

  // The page callback changes with the page's state; the restore calls the latest one.
  const applyPageRef = useRef(applyPage);
  useEffect(() => {
    applyPageRef.current = applyPage;
  }, [applyPage]);

  // A collection that failed to load cannot take the configuration: report it rather than wait
  // for a ready state that never comes. The scene is not touched.
  useEffect(() => {
    if (!configId || collectionError === null) return;

    const restore = getRestoreState(store.getState());
    if (restore.configId === configId && restore.status !== "idle") return;

    dispatch(failRestore({ configId, reason: "collection", message: collectionError }));
  }, [collectionError, configId, dispatch, store]);

  useEffect(() => {
    if (!configId || !canvasReady || !isCollectionReady) return;

    void restoreSavedConfiguration(configId, {
      dispatch,
      getState: store.getState,
      loadRecord: (id) => loadConfiguration(id).unwrap(),
      restorer: createSceneRestorer({ getBindings: () => bindings }),
      applyPage: (plan, matches) => applyPageRef.current(plan, matches),
    });
  }, [bindings, canvasReady, configId, dispatch, isCollectionReady, loadConfiguration, store]);
};
