import { useMemo } from "react";
import { useStore } from "react-redux";

import type { RootState } from "@/app/store";
import { useActiveCollection } from "@/entities/collection";
import type { RuntimeFlow } from "@/entities/collection";
import type { ConfigurationRuntimePort } from "@/entities/configuration";
import { useCollectionNavigation } from "@/features/collectionCustomization";
import { createPlayCanvasRuntimePort } from "@/features/playCanvasAdapter";
import { useAppDispatch } from "@/shared/hooks/store/redux";

import { createCommandRunner, type CommandRunner } from "../lib/createCommandRunner";

/**
 * The command service for a page: one place that wires the store, the scene adapter and
 * the flow, so a page only says what the user chose and shows the result.
 */

export type UseChangeAttributeOptions = {
  /** Tests pass a stand-in; the app uses the PlayCanvas adapter. */
  runtime?: ConfigurationRuntimePort;
};

export const useChangeAttribute = ({ runtime: runtimeOverride }: UseChangeAttributeOptions = {}): CommandRunner => {
  const store = useStore<RootState>();
  const dispatch = useAppDispatch();
  const flow: RuntimeFlow = useCollectionNavigation()?.flowId ?? "prebuilt";

  const collection = useActiveCollection();
  const bindings = collection.catalog.runtimeBindings ?? null;
  const configurator = collection.catalog.configurator;

  // The page reads the bindings from the collection context, which is ready before the store copy.
  const runtime = useMemo(
    () => runtimeOverride ?? createPlayCanvasRuntimePort({ getBindings: () => bindings }),
    [bindings, runtimeOverride],
  );

  return useMemo(
    () => createCommandRunner({ getState: store.getState, dispatch, getFlow: () => flow, runtime, configurator }),
    [configurator, dispatch, flow, runtime, store],
  );
};
