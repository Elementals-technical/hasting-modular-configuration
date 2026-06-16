import type { AttributeValue } from "@/features/swatchOrder";

export interface ConfigurationUiState {
  CabinetColor: string;
  HandleGrooveColor: string;
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
  uiState: ConfigurationUiState;
  swatchOrder: ConfigurationSwatchOrder;
}

export const buildConfigurationMetadata = (args: {
  path: string;
  orderedProductIds: string[];
  uiState: ConfigurationUiState;
  swatchOrder: ConfigurationSwatchOrder;
}): ConfigurationMetadata => ({
  path: args.path,
  savedAt: new Date().toISOString(),
  orderedProductIds: args.orderedProductIds,
  uiState: args.uiState,
  swatchOrder: args.swatchOrder,
});
