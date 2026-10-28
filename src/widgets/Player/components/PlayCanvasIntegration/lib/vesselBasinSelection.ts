import { selectAttribute, type ProductProfile } from "@/entities/collection";
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

export type VesselBasinActionValues = {
  send: Record<string, string>;
  recordOnly: Record<string, string>;
};

/**
 * The configuration values a vessel-basin action of the scene stands for.
 *
 * The scene names "no vessel, keep the cutout" with its placeholder sink type "Vessel"; a
 * collection names it with its sinkType noneValue ("Vessel" in Urban, "None" in Class, Tricot,
 * Mako and Lame). Replayed as the scene's spelling, the choice has no translation where the
 * two differ and never reaches the scene, so the placeholder is read as the noneValue. Choosing
 * the cutout makes the countertop a vessel one.
 */
export const resolveVesselBasinActionValues = (
  config: SelectionActionConfig,
  profile: ProductProfile | null,
): VesselBasinActionValues => {
  const send = Object.fromEntries(
    (["sinkType", "VesselColor"] as const).flatMap((key) =>
      typeof config[key] === "string" ? [[key, config[key] as string]] : [],
    ),
  );

  if (send.sinkType !== VESSEL_PLACEHOLDER_SINK_TYPE) return { send, recordOnly: {} };

  return {
    send: { ...send, sinkType: selectAttribute(profile, "sinkType")?.noneValue ?? VESSEL_PLACEHOLDER_SINK_TYPE },
    recordOnly: { CountertopStyle: VESSEL_PLACEHOLDER_SINK_TYPE },
  };
};
