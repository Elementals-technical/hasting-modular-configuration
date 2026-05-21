import type {
  SelectionAction,
  SelectionActionConfig,
  SelectionInfo,
} from "@/utils/functions/playcanvas/getSelectTool";

export const VESSEL_BASIN_SELECTION_TYPE = "vessel-basin";
export const SINK_BASIN_SELECTION_TYPE = "sink-basin";
export const VESSEL_PLACEHOLDER_SINK_TYPE = "Vessel";
export const SELECTION_ACTION_COLOR_ID = "color";
export const SELECTION_ACTION_DELETE_ID = "delete";
export const SELECTION_ACTION_SET_CONFIG_METHOD = "setConfig";

export const normalizeSelectionActionKey = (action: SelectionAction): string =>
  String(action.id || action.label || "")
    .trim()
    .toLowerCase();

export const isVesselBasinSelectionInfo = (info: SelectionInfo | null | undefined): info is SelectionInfo =>
  info?.selectionType === VESSEL_BASIN_SELECTION_TYPE;

export const isSinkBasinSelectionInfo = (info: SelectionInfo | null | undefined): info is SelectionInfo =>
  info?.selectionType === SINK_BASIN_SELECTION_TYPE;

export const isInPlayerBasinSelectionInfo = (info: SelectionInfo | null | undefined): info is SelectionInfo =>
  isVesselBasinSelectionInfo(info) || isSinkBasinSelectionInfo(info);

export const findVesselBasinSelectionInfo = (selectionInfo: SelectionInfo[] | undefined): SelectionInfo | null =>
  selectionInfo?.find(isInPlayerBasinSelectionInfo) ?? null;

const isSelectionActionConfig = (value: unknown): value is SelectionActionConfig =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export type ExecutableSetConfigSelectionAction = SelectionAction & {
  method: typeof SELECTION_ACTION_SET_CONFIG_METHOD;
  productId: string;
  config: SelectionActionConfig;
};

export const canExecuteSetConfigSelectionAction = (
  action: SelectionAction,
): action is ExecutableSetConfigSelectionAction =>
  action.method === SELECTION_ACTION_SET_CONFIG_METHOD &&
  typeof action.productId === "string" &&
  action.productId.length > 0 &&
  isSelectionActionConfig(action.config);
