import { useContext, useMemo } from "react";
import { useStore } from "react-redux";
import { useLocation } from "react-router-dom";

import type { RootState } from "@/app/store";
import { ActiveCollectionContext } from "@/entities/collection";
import type { RuntimeFlow } from "@/entities/collection";
import type { ConfigurationRuntimePort } from "@/entities/configuration";
import { createPlayCanvasRuntimePort } from "@/features/playCanvasAdapter";
import { useAppDispatch } from "@/shared/hooks/store/redux";

import { changeAttribute, type ChangeAttributeDeps } from "../lib/changeAttribute";
import { confirmAttributeChange } from "../lib/confirmAttributeChange";
import type { AttributeChange, ChangePreview, ChangeResult } from "../model/types";

/**
 * The command service for a page: one place that wires the store, the scene adapter and
 * the flow, so a page only says what the user chose and shows the result.
 */

export type UseChangeAttributeOptions = {
  /** Tests pass a stand-in; the app uses the PlayCanvas adapter. */
  runtime?: ConfigurationRuntimePort;
};

export const useChangeAttribute = ({ runtime: runtimeOverride }: UseChangeAttributeOptions = {}) => {
  const store = useStore<RootState>();
  const dispatch = useAppDispatch();
  const { pathname } = useLocation();
  const flow: RuntimeFlow = pathname.includes("/custom") ? "custom" : "prebuilt";

  // The bindings arrive with the active collection. Outside its provider (a test with a
  // stand-in runtime) there are none.
  const collection = useContext(ActiveCollectionContext);
  const bindings = collection?.status === "ready" ? (collection.data.catalog.runtimeBindings ?? null) : null;
  const configurator = collection?.status === "ready" ? (collection.data.catalog.configurator ?? null) : null;

  const runtime = useMemo(
    () => runtimeOverride ?? createPlayCanvasRuntimePort({ getBindings: () => bindings }),
    [bindings, runtimeOverride],
  );

  return useMemo(() => {
    const deps: ChangeAttributeDeps = { getState: store.getState, dispatch, runtime, flow, configurator };

    return {
      change: (change: AttributeChange): Promise<ChangeResult> => changeAttribute(change, deps),
      confirm: (preview: ChangePreview): Promise<ChangeResult> => confirmAttributeChange(preview, deps),
      /** Current state, for reading what a change should address at the moment it is made. */
      getState: store.getState,
    };
  }, [configurator, dispatch, flow, runtime, store]);
};
