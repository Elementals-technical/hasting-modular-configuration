import type { AttributeValue } from "@/features/swatchOrder";

import type { ConfigurationFragment } from "./configurationFragment";

/**
 * Flat UI state of a configuration.
 *
 * Kept for compatibility: three restore paths read this shape, and old saved links
 * contain nothing else. New values are addressed per target in `ConfigurationFragment`.
 * These fields go away once C08 and C09 move every reader onto the fragment.
 */
export interface ConfigurationUiState {
  CabinetColor: string;
  /**
   * Material and finish drive grain/fluting availability but used to be dropped by Save
   * and re-derived from CabinetColor on restore. Saving them removes that guesswork.
   */
  CabinetColorMaterial: string;
  CabinetColorFinish: string;
  HandleGrooveColor: string;
  /**
   * Handle previously survived Save only because it sits inside each product's
   * PlayCanvas config. It is recorded explicitly here, and per cabinet in the fragment.
   */
  Handle: string;
  sinkType: string;
  CountertopColor: string;
  CountertopColorSku: string;
  VesselColor: string;
  Thickness: string;
  DrawerPanelFluting: string;
  GrainDirection: string;
  BookMatching: string;
  CountertopStyle: string;
  SidePanels: string;
  SidePanelLeft: string;
  SidePanelRight: string;
  LedOption: string;
  DividersOption: string;
  DividersStyle: string;
  TowelBarOption: string;
  TowelBarColor: string;
  FaucetHolesAmount: string;
  FaucetHolesSpacing: string;
}

export interface ConfigurationSwatchOrder {
  selectedMaterials: AttributeValue[];
  manualSelectedMaterials: AttributeValue[];
  isAutofillEnabled: boolean;
  hasSubmittedCart: boolean;
}

export interface ConfigurationMetadata {
  [key: string]: unknown;
  path: string;
  savedAt: string;
  orderedProductIds: string[];
  /**
   * Collection this configuration belongs to, duplicated at the top level so the
   * collection resolver can read it without parsing the fragment.
   */
  collectionId: string | null;
  uiState: ConfigurationUiState;
  swatchOrder: ConfigurationSwatchOrder;
  configuration: ConfigurationFragment;
}

export const buildConfigurationMetadata = (args: {
  path: string;
  orderedProductIds: string[];
  uiState: ConfigurationUiState;
  swatchOrder: ConfigurationSwatchOrder;
  fragment: ConfigurationFragment;
}): ConfigurationMetadata => ({
  path: args.path,
  savedAt: new Date().toISOString(),
  orderedProductIds: args.orderedProductIds,
  collectionId: args.fragment.collectionId,
  uiState: args.uiState,
  swatchOrder: args.swatchOrder,
  configuration: args.fragment,
});
