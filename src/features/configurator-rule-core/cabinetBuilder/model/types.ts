export type DimensionField = "width" | "depth" | "height";
export type DrawerField = "drawers";
export type HandleField = "handle";
export type IntentField = DimensionField | DrawerField | HandleField | "cabinetType";

export type Selection = {
  cabinetType: string | null;
  width: number;
  depth: number;
  height: number;
  drawers?: string | null;
  handle?: string | null;
};

export type Intent = {
  field: IntentField;
  value: string | number | null;
};

export type OptionState<TValue> = {
  value: TValue;
  label?: string;
  enabled: boolean;
  reason?: string;
};

export type AvailableOptions = {
  width: OptionState<number>[];
  depth: OptionState<number>[];
  height: OptionState<number>[];
  drawers: OptionState<string>[];
  handles: OptionState<string>[];
};

export type Violation = {
  field: IntentField;
  reason: string;
};

export type RuleResult = {
  availableOptions: AvailableOptions;
  violations: Violation[];
  heightLocked: number | null;
};

export type AutoChangeEntry = {
  field: IntentField;
  from: string | number | null | undefined;
  to: string | number | null | undefined;
};

export type AutoChangeResult = {
  nextSelection: Selection;
  autoChanges: AutoChangeEntry[];
};

export type RuleContext = {
  selection: Selection;
  selectedProductIds?: string[];
};
