import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";

import { useAppDispatch } from "@/shared/hooks/store/redux";

import { loadCollectionRegistry, loadResolvedCollection, defaultFetchJson } from "../lib/loadCollection";
import { resolveCollection } from "../lib/resolveCollection";
import { toAbsoluteCollectionUrl } from "../lib/paths";
import { createRtkCollectionRemoteLoader } from "../lib/rtkRemoteLoader";
import { DEFAULT_COLLECTION_REGISTRY_URL, DEFAULT_COLLECTIONS_ROOT_URL } from "../model/constants";
import { toCollectionError } from "../model/errors";
import type { ActiveCollectionState, CollectionRuntimeDependencies } from "../model/types";
import { ActiveCollectionContext } from "./activeCollectionContext";

export type ActiveCollectionProviderProps = {
  children: ReactNode;
  dependencies?: CollectionRuntimeDependencies;
};

export const ActiveCollectionProvider = ({ children, dependencies }: ActiveCollectionProviderProps) => {
  const location = useLocation();
  const dispatch = useAppDispatch();
  const requestSequence = useRef(0);
  const remote = useMemo(() => createRtkCollectionRemoteLoader(dispatch), [dispatch]);
  const runtimeDependencies = useMemo<CollectionRuntimeDependencies>(() => {
    if (dependencies) return dependencies;
    const origin = window.location.origin;
    return {
      registryUrl: toAbsoluteCollectionUrl(DEFAULT_COLLECTION_REGISTRY_URL, origin),
      collectionsRootUrl: toAbsoluteCollectionUrl(DEFAULT_COLLECTIONS_ROOT_URL, origin),
      fetchJson: defaultFetchJson,
      remote,
    };
  }, [dependencies, remote]);
  const [state, setState] = useState<ActiveCollectionState>({ status: "resolving" });
  // Only the collection id selects the collection. Other query params (`accordion`, `configId`)
  // change on ordinary navigation and must not reload it: the store resets the options on reload.
  const urlCollectionId = new URLSearchParams(location.search).get("collectionId");
  const readyCollectionId = useRef<string | null>(null);

  useEffect(() => {
    readyCollectionId.current = state.status === "ready" ? state.collectionId : null;
  }, [state]);

  useEffect(() => {
    const sequence = ++requestSequence.current;
    const abortController = new AbortController();
    const isLatest = () => requestSequence.current === sequence && !abortController.signal.aborted;
    const loadedCollectionId = readyCollectionId.current;
    let activeCollectionId: string | undefined;

    // A ready collection stays published until the URL is known to select another one.
    if (loadedCollectionId === null) {
      queueMicrotask(() => {
        if (isLatest()) setState({ status: "resolving" });
      });
    }
    void (async () => {
      try {
        const registry = await loadCollectionRegistry(runtimeDependencies, abortController.signal);
        if (!isLatest()) return;

        const resolution = resolveCollection({ registry, urlCollectionId });
        if (!resolution.ok) {
          setState({
            status: "error",
            collectionId: urlCollectionId === null ? undefined : urlCollectionId,
            error: resolution.error,
          });
          return;
        }

        // `?collectionId=<default>` and no id at all select the same collection.
        if (resolution.collectionId === loadedCollectionId) return;

        activeCollectionId = resolution.collectionId;
        setState({ status: "loading", collectionId: resolution.collectionId });
        const data = await loadResolvedCollection(resolution, runtimeDependencies, abortController.signal);
        if (isLatest()) setState({ status: "ready", collectionId: resolution.collectionId, data });
      } catch (error) {
        if (isLatest()) setState({ status: "error", collectionId: activeCollectionId, error: toCollectionError(error) });
      }
    })();

    return () => abortController.abort();
  }, [urlCollectionId, runtimeDependencies]);

  return <ActiveCollectionContext.Provider value={state}>{children}</ActiveCollectionContext.Provider>;
};
