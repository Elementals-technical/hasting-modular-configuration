import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";

import { useAppDispatch } from "@/shared/hooks/store/redux";

import { loadCollectionRegistry, loadResolvedCollection, defaultFetchJson } from "../lib/loadCollection";
import { resolveCollection } from "../lib/resolveCollection";
import { toAbsoluteCollectionUrl } from "../lib/paths";
import { createRtkCollectionRemoteLoader } from "../lib/rtkRemoteLoader";
import { DEFAULT_COLLECTION_REGISTRY_URL, DEFAULT_COLLECTIONS_ROOT_URL } from "../model/constants";
import { toCollectionError } from "../model/errors";
import type { ActiveCollectionState, CollectionRuntimeDependencies } from "../model/types";
import { ActiveCollectionContext, ActiveCollectionSessionContext } from "./activeCollectionContext";

export type ActiveCollectionProviderProps = {
  children: ReactNode;
  dependencies?: CollectionRuntimeDependencies;
};

export const ActiveCollectionProvider = ({ children, dependencies }: ActiveCollectionProviderProps) => {
  const location = useLocation();
  const dispatch = useAppDispatch();
  const requestSequence = useRef(0);
  const [sessionCollectionId] = useState(() => new URLSearchParams(location.search).get("collectionId"));
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
  const [defaultCollectionId, setDefaultCollectionId] = useState<string>();
  const [loadAttempt, setLoadAttempt] = useState(0);
  const retry = useCallback(() => {
    setState({ status: "resolving" });
    setDefaultCollectionId(undefined);
    setLoadAttempt((attempt) => attempt + 1);
  }, []);
  const session = useMemo(
    () => ({ requestedCollectionId: sessionCollectionId, defaultCollectionId, retry }),
    [defaultCollectionId, retry, sessionCollectionId],
  );

  useEffect(() => {
    const sequence = ++requestSequence.current;
    const abortController = new AbortController();
    const isLatest = () => requestSequence.current === sequence && !abortController.signal.aborted;
    let activeCollectionId: string | undefined;

    queueMicrotask(() => {
      if (isLatest()) setState({ status: "resolving" });
    });
    void (async () => {
      try {
        const registry = await loadCollectionRegistry(runtimeDependencies, abortController.signal);
        if (!isLatest()) return;
        setDefaultCollectionId(registry.defaultCollectionId);

        const resolution = resolveCollection({ registry, urlCollectionId: sessionCollectionId });
        if (!resolution.ok) {
          setState({
            status: "error",
            collectionId: sessionCollectionId === null ? undefined : sessionCollectionId,
            error: resolution.error,
          });
          return;
        }

        activeCollectionId = resolution.collectionId;
        setState({ status: "loading", collectionId: resolution.collectionId });
        const data = await loadResolvedCollection(resolution, runtimeDependencies, abortController.signal);
        if (isLatest()) setState({ status: "ready", collectionId: resolution.collectionId, data });
      } catch (error) {
        if (isLatest())
          setState({ status: "error", collectionId: activeCollectionId, error: toCollectionError(error) });
      }
    })();

    return () => abortController.abort();
  }, [loadAttempt, runtimeDependencies, sessionCollectionId]);

  return (
    <ActiveCollectionSessionContext.Provider value={session}>
      <ActiveCollectionContext.Provider value={state}>{children}</ActiveCollectionContext.Provider>
    </ActiveCollectionSessionContext.Provider>
  );
};
