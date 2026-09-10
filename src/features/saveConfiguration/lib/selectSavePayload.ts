import { createSelector } from "@reduxjs/toolkit";

import type { RootState } from "@/app/store";
import { CONFIGURATION_SNAPSHOT_VERSION } from "@/entities/configuration";

import { buildConfigurationFragment, type ConfigurationFragment } from "./configurationFragment";
import type { ConfigurationUiState } from "./buildConfigurationMetadata";

/**
 * Single source of the values that go into a saved configuration.
 *
 * The five save entry points each assemble the UI state by hand today, so adding a field
 * means five edits and one of them is always forgotten — which is how `Handle`,
 * `CabinetColorMaterial` and `CabinetColorFinish` came to be dropped. These selectors
 * exist so those places can read one value instead; wiring them up is C08.
 *
 * All three are memoized: they build fresh objects, and a component reading an unmemoized
 * one would re-render on every store action — which in the summary pages would re-trigger
 * the autosave effect on each render.
 */

const selectProductOptions = (state: RootState) => state.rootStateUI.product.productOptions;
const selectSelectedProductConfig = (state: RootState) => state.rootStateUI.product.selectedProductConfig;

export const selectConfigurationUiState = createSelector(
  [selectProductOptions, selectSelectedProductConfig],
  (options, selectedConfig): ConfigurationUiState => ({
    CabinetColor: options.CabinetColor,
    CabinetColorMaterial: options.CabinetColorMaterial,
    CabinetColorFinish: options.CabinetColorFinish,
    HandleGrooveColor: options.HandleGrooveColor,
    // The active cabinet's handle. Per-cabinet handles live in the fragment.
    Handle: typeof selectedConfig?.Handle === "string" ? selectedConfig.Handle : options.Handle,
    sinkType: options.sinkType,
    CountertopColor: options.CountertopColor,
    CountertopColorSku: options.CountertopColorSku,
    VesselColor: options.VesselColor,
    Thickness: options.Thickness,
    DrawerPanelFluting: options.DrawerPanelFluting,
    GrainDirection: options.GrainDirection,
    BookMatching: options.BookMatching,
    CountertopStyle: options.CountertopStyle,
    SidePanels: options.SidePanels,
    SidePanelLeft: options.SidePanelLeft,
    SidePanelRight: options.SidePanelRight,
    LedOption: options.LedOption,
    DividersOption: options.DividersOption,
    DividersStyle: options.DividersStyle,
    TowelBarOption: options.TowelBarOption,
    TowelBarColor: options.TowelBarColor,
    FaucetHolesAmount: options.FaucetHolesAmount,
    FaucetHolesSpacing: options.FaucetHolesSpacing,
  }),
);

const selectConfigurationState = (state: RootState) => state.rootStateUI.configuration;

/**
 * Built from the raw configuration slice rather than from `getConfigurationSnapshot`:
 * that selector returns a fresh object on every call, so using it as an input would
 * defeat the memoization this file exists for.
 */
export const selectConfigurationFragment = createSelector(
  [selectConfigurationState],
  (configuration): ConfigurationFragment =>
    buildConfigurationFragment({
      collectionId: configuration.collectionId,
      version: CONFIGURATION_SNAPSHOT_VERSION,
      cabinets: configuration.cabinets,
      values: configuration.valuesByAttributeId,
    }),
);

export type ConfigurationSavePayload = {
  uiState: ConfigurationUiState;
  fragment: ConfigurationFragment;
};

export const selectConfigurationSavePayload = createSelector(
  [selectConfigurationUiState, selectConfigurationFragment],
  (uiState, fragment): ConfigurationSavePayload => ({ uiState, fragment }),
);
