import { useMemo } from "react";
import { useStore } from "react-redux";

import type { RootState } from "@/app/store";
import { useActiveCollection } from "@/entities/collection";
import type { RuntimeFlow } from "@/entities/collection";
import type {
  ConfigurationCompositionPort,
  ConfigurationRuntimePort,
  ConfigurationSidePanelPort,
} from "@/entities/configuration";
import { useCollectionNavigation } from "@/features/collectionCustomization";
import { createCompositionPort, createPlayCanvasRuntimePort } from "@/features/playCanvasAdapter";
import { useAppDispatch } from "@/shared/hooks/store/redux";

import { createCommandRunner, type CommandRunner } from "../lib/createCommandRunner";

/**
 * The command service for a page: one place that wires the store, the scene adapter and
 * the flow, so a page only says what the user chose and shows the result.
 */

export type UseChangeAttributeOptions = {
  /** Tests pass a stand-in; the app uses the PlayCanvas adapter. */
  runtime?: ConfigurationRuntimePort;
  /** Tests pass a stand-in; the app uses the PlayCanvas adapter. */
  composition?: ConfigurationCompositionPort;
  /** Tests pass a stand-in; the app uses the PlayCanvas adapter. */
  sidePanels?: ConfigurationSidePanelPort;
};

export const useChangeAttribute = ({
  runtime: runtimeOverride,
  composition: compositionOverride,
  sidePanels,
}: UseChangeAttributeOptions = {}): CommandRunner => {
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

  const composition = useMemo(
    () => compositionOverride ?? createCompositionPort({ getBindings: () => bindings }),
    [bindings, compositionOverride],
  );

  return useMemo(
    () =>
      createCommandRunner({
        getState: store.getState,
        dispatch,
        getFlow: () => flow,
        runtime,
        composition,
        sidePanels,
        configurator,
      }),
    [composition, configurator, dispatch, flow, runtime, sidePanels, store],
  );
};
