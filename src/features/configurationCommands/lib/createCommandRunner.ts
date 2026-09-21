import type { UnknownAction } from "@reduxjs/toolkit";

import type { RootState } from "@/app/store";
import type { RuntimeFlow } from "@/entities/collection";
import type { ConfiguratorGroupCatalog } from "@/entities/collection/model/types";
import { getActiveRuntimeBindings } from "@/entities/configuration";
import type { ConfigurationRuntimePort } from "@/entities/configuration";
import { createPlayCanvasRuntimePort } from "@/features/playCanvasAdapter";

import { changeAttribute, type ChangeAttributeDeps } from "./changeAttribute";
import { changeDimension } from "./changeDimension";
import { confirmAttributeChange } from "./confirmAttributeChange";
import { replayValues, type ReplayRequest, type ReplayResult } from "./replayValues";
import type { AttributeChange, ChangePreview, ChangeResult, DimensionChange } from "../model/types";

/**
 * The command service bound to a store, a scene and a flow.
 *
 * Hooks build it from the collection context; listeners, restore and undo build it from
 * the store alone, since the active collection's bindings are published there too. Either
 * way a change goes through the same checks and the same scene adapter.
 */

export type CommandRunnerDeps = {
  getState: () => RootState;
  dispatch: (action: UnknownAction) => unknown;
  /** Read at each change: some attributes reach different products in each flow. */
  getFlow: () => RuntimeFlow;
  /** Tests pass a stand-in; by default the PlayCanvas adapter over the store's bindings. */
  runtime?: ConfigurationRuntimePort;
  /** Configurator sections of the active collection, for the material and finish of a colour. */
  configurator?: ConfiguratorGroupCatalog | null;
};

export type CommandRunner = {
  change: (change: AttributeChange) => Promise<ChangeResult>;
  confirm: (preview: ChangePreview) => Promise<ChangeResult>;
  changeDimension: (change: DimensionChange) => Promise<ChangeResult>;
  /** Shows values the configuration already holds on the scene again (undo, restore). */
  replay: (request: ReplayRequest) => Promise<ReplayResult>;
  /** Current state, for reading what a change should address at the moment it is made. */
  getState: () => RootState;
};

export const createCommandRunner = ({
  getState,
  dispatch,
  getFlow,
  runtime = createPlayCanvasRuntimePort({ getBindings: () => getActiveRuntimeBindings(getState()) }),
  configurator = null,
}: CommandRunnerDeps): CommandRunner => {
  const deps = (): ChangeAttributeDeps => ({ getState, dispatch, runtime, flow: getFlow(), configurator });

  return {
    change: (change) => changeAttribute(change, deps()),
    confirm: (preview) => confirmAttributeChange(preview, deps()),
    changeDimension: (change) => changeDimension(change, deps()),
    replay: (request) => replayValues(request, deps()),
    getState,
  };
};
