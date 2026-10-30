import type { UnknownAction } from "@reduxjs/toolkit";

import type { RootState } from "@/app/store";
import type { RuntimeFlow } from "@/entities/collection";
import type { ConfiguratorGroupCatalog } from "@/entities/collection/model/types";
import { getActiveRuntimeBindings } from "@/entities/configuration";
import type {
  ConfigurationCompositionPort,
  ConfigurationRuntimePort,
  ConfigurationSidePanelPort,
  SceneCompositionProduct,
  SceneProductDraft,
} from "@/entities/configuration";
import { createCompositionPort, createPlayCanvasRuntimePort, createSidePanelPort } from "@/features/playCanvasAdapter";

import { changeAttribute, type ChangeAttributeDeps } from "./changeAttribute";
import { changeDimension } from "./changeDimension";
import {
  addCabinet,
  adoptComposition,
  applyPreset,
  clearComposition,
  prepareCabinet,
  removeCabinets,
  swapCabinets,
  toPresetSceneProduct,
  type AddCabinetRequest,
  type AdoptCompositionRequest,
  type ApplyPresetRequest,
  type ClearCompositionRequest,
  type CompositionDeps,
  type CompositionResult,
  type PreparedCabinet,
} from "./composition";
import { confirmAttributeChange } from "./confirmAttributeChange";
import { evaluateChange, type ChangeEvaluation } from "./evaluateChange";
import {
  recordValues,
  replayValues,
  type RecordValuesResult,
  type ReplayRequest,
  type ReplayResult,
  type ReplayValues,
} from "./replayValues";
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
  /** Tests pass a stand-in; by default the PlayCanvas adapter over the store's bindings. */
  composition?: ConfigurationCompositionPort;
  /** Tests pass a stand-in; by default the PlayCanvas adapter. */
  sidePanels?: ConfigurationSidePanelPort;
  /** Configurator sections of the active collection, for the material and finish of a colour. */
  configurator?: ConfiguratorGroupCatalog | null;
};

export type CommandRunner = {
  change: (change: AttributeChange) => Promise<ChangeResult>;
  /**
   * What `change` would decide, without applying anything: whether the set is planned and waits for
   * confirmation. Lets a page take an undo step only for a change that applies at once.
   */
  evaluate: (change: AttributeChange) => ChangeEvaluation;
  confirm: (preview: ChangePreview) => Promise<ChangeResult>;
  changeDimension: (change: DimensionChange) => Promise<ChangeResult>;
  /** Shows values the configuration already holds on the scene again (undo, restore). */
  replay: (request: ReplayRequest) => Promise<ReplayResult>;
  /** Records values the scene already shows, or never shows, without a scene call. */
  record: (values: ReplayValues) => RecordValuesResult;
  /** Places, removes and moves products, and clears the scene. */
  composition: {
    applyPreset: (request: ApplyPresetRequest) => Promise<CompositionResult>;
    addCabinet: (request: AddCabinetRequest) => Promise<CompositionResult>;
    removeCabinets: (runtimeIds: readonly string[]) => Promise<CompositionResult>;
    swapCabinets: (runtimeIdA: string, runtimeIdB: string) => Promise<CompositionResult>;
    clear: (request: ClearCompositionRequest) => Promise<CompositionResult>;
    /** Records a composition the scene already holds, without a scene call. */
    adopt: (request: AdoptCompositionRequest) => Promise<CompositionResult>;
    /** A cabinet for the scene's own placement tools (Drag & Drop), translated as `addCabinet` would. */
    prepare: (product: SceneCompositionProduct) => PreparedCabinet | null;
    /** A preset's product in the scene's names and values, for a preset the scene imports itself. */
    toPresetSceneProduct: (product: SceneCompositionProduct) => SceneProductDraft | null;
  };
  /** Current state, for reading what a change should address at the moment it is made. */
  getState: () => RootState;
};

export const createCommandRunner = ({
  getState,
  dispatch,
  getFlow,
  runtime = createPlayCanvasRuntimePort({ getBindings: () => getActiveRuntimeBindings(getState()) }),
  composition = createCompositionPort({ getBindings: () => getActiveRuntimeBindings(getState()) }),
  sidePanels = createSidePanelPort(),
  configurator = null,
}: CommandRunnerDeps): CommandRunner => {
  const deps = (): ChangeAttributeDeps => ({ getState, dispatch, runtime, flow: getFlow(), configurator });
  const compositionDeps = (): CompositionDeps => ({ ...deps(), composition, sidePanels });

  return {
    change: (change) => changeAttribute(change, deps()),
    evaluate: (change) => evaluateChange(change, getState(), configurator),
    confirm: (preview) => confirmAttributeChange(preview, deps()),
    changeDimension: (change) => changeDimension(change, deps()),
    replay: (request) => replayValues(request, deps()),
    record: (values) => recordValues(values, deps()),
    composition: {
      applyPreset: (request) => applyPreset(request, compositionDeps()),
      addCabinet: (request) => addCabinet(request, compositionDeps()),
      removeCabinets: (runtimeIds) => removeCabinets(runtimeIds, compositionDeps()),
      swapCabinets: (runtimeIdA, runtimeIdB) => swapCabinets(runtimeIdA, runtimeIdB, compositionDeps()),
      clear: (request) => clearComposition(request, compositionDeps()),
      adopt: (request) => adoptComposition(request, compositionDeps()),
      prepare: (product) => prepareCabinet(product, { getState, composition }),
      toPresetSceneProduct: (product) => toPresetSceneProduct(product, { getState, composition }),
    },
    getState,
  };
};
