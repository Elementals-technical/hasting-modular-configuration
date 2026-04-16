import type { OptionState } from "@/features/configurator-rule-core/cabinetBuilder/model/types";

export type { OptionState };

export type GrainDirectionRuleInput = {
  material?: string | null;
  finish?: string | null;
};

export type GrainDirectionRuleResult = {
  available: boolean;
  options: OptionState<string>[];
  reason?: string;
};

export type BookMatchingRuleInput = {
  grainDirection?: string | null;
  cabinets: ReadonlyArray<{ name?: string | null }>;
};

export type BookMatchingRuleResult = {
  enabled: boolean;
  reason?: string;
};

export type FlutingRuleInput = {
  targetPart?: "CABINET" | "SIDE_PANEL" | null;
  cabinetType?: string | null;
  material?: string | null;
};

export type FlutingRuleResult = {
  available: boolean;
  options: OptionState<string>[];
  reason?: string;
};

export type SidePanelSpecInput = {
  sidePanels?: string | null;
  cabinetHeight?: number | null;
  cabinetDepth?: number | null;
  heightType?: "STANDARD" | "LOW" | null;
};

export type SidePanelSpecResult = {
  enabled: boolean;
  qty?: number;
  height?: number | null;
  depth?: number | null;
  reason?: string;
};

export type SidePanelCountertopLengthInput = {
  sidePanels?: string | null;
  vanityLength?: number | null;
};

export type SidePanelCountertopLengthResult = {
  length: number | null;
  reason?: string;
};

export type SyntesiSidePanelRuleInput = {
  sidePanels?: string | null;
  countertopMaterial?: string | null;
};

export type SyntesiSidePanelRuleResult = {
  allowed: boolean;
  reason?: string;
};

export type SidePanelAvailabilityInput = {
  height?: number | null;
  handleType?: "1D" | "2D" | null;
  cabinetType?: "SBSC" | "OS" | "OSS" | null;
};

export type SidePanelAvailabilityResult = {
  allowed: Set<"NoG" | "UpperG" | "CenterG" | "DoubleG">;
  reason?: string;
};
