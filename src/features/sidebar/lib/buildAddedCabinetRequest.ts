import { isVesselBasin, type ProductProfile } from "@/entities/collection";
import type { AddCabinetRequest } from "@/features/configurationCommands";
import type { ScenePlusKind } from "@/utils/functions/playcanvas/sceneBridge";

import { placementForPlus } from "./plusPlacement";

export type AddedCabinetInput = {
  /** The cabinet type as the collection names it; the port finds its scene product. */
  cabinetType: string;
  /** The builder's current cabinet config, null until its size is known. */
  config: Record<string, unknown> | null;
  /** The width the new cabinet fits in, or null to keep the one in `config`. */
  width: number | null;
  sinkType?: string | null;
  countertopStyle?: string | null;
  vesselColor?: string | null;
  /** The active collection, whose basin catalog names its own vessels (Tricot's Iris, Urban's Vessel_Blade11). */
  profile?: ProductProfile | null;
  /** The placed cabinet whose plus button was clicked. */
  anchorRuntimeId: string;
  /** The kind of the plus button: a row end, or the free place of a column (`top`, `bottom`). */
  side: ScenePlusKind;
};

/**
 * The cabinet the builder's plus button adds beside a placed one. A sink base takes the
 * basin and countertop style of the configuration; a vessel basin gets its colour once placed.
 */
export const buildAddedCabinetRequest = ({
  cabinetType,
  config,
  width,
  sinkType,
  countertopStyle,
  vesselColor,
  profile = null,
  anchorRuntimeId,
  side,
}: AddedCabinetInput): AddCabinetRequest => {
  const isSinkBase = cabinetType.toLowerCase().includes("sink-base");
  const isVesselStyle = countertopStyle?.toLowerCase() === "vessel";
  const resolvedSinkType = sinkType || (isVesselStyle ? "Vessel" : "");

  const productConfig: Record<string, unknown> =
    isSinkBase && (resolvedSinkType || countertopStyle)
      ? {
          ...config,
          ...(resolvedSinkType ? { sinkType: resolvedSinkType } : {}),
          ...(countertopStyle ? { CountertopStyle: countertopStyle } : {}),
        }
      : { ...config };

  if (width !== null) productConfig.Width = width;

  // A vessel by its scene name (Vessel_Blade11, the Vessel cutout) or by the collection's own name for it (Iris).
  const placedSinkType = typeof productConfig.sinkType === "string" ? productConfig.sinkType : "";
  const isVessel = placedSinkType.startsWith("Vessel") || isVesselBasin(profile, placedSinkType);

  return {
    product: { productType: cabinetType, config: productConfig },
    placement: placementForPlus(side, anchorRuntimeId),
    afterPlacement: vesselColor && isVessel ? { VesselColor: vesselColor } : undefined,
  };
};
