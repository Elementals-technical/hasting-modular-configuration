import type { AppDispatch } from "@/app/store";
import type { ProductProfile } from "@/entities/collection";
import { selectRuleData } from "@/entities/collection";
import { getConfig } from "@/utils/functions/playcanvas/getConfig";
import { getEdgeCabinets } from "@/utils/functions/playcanvas/getEdgeCabinets";
import type { EdgeCabinets } from "@/utils/functions/playcanvas/getEdgeCabinets";
import { getRememberedSidePanels } from "@/utils/functions/playcanvas/sidePanels";
import { mapCabinetTypeToGroup } from "../model/selectors";
import { autoRemoveSide, autoRestoreSide, type GrooveType } from "./sidePanelService";
import type { SidePanelSide, SidePanelStatus } from "./sidePanelService";

const SIDES = ["left", "right"] as const;

/** Which sides may hold a panel, by the cabinet group at each edge. A side with no edge cabinet may. */
const readSideEligibility = async (
  { leftCabinetId, rightCabinetId }: EdgeCabinets,
  blockedGroups: readonly string[],
  profile: ProductProfile | null,
): Promise<Record<SidePanelSide, boolean>> => {
  const targets: Array<{ side: SidePanelSide; cabinetId: string | null }> = [
    { side: "left", cabinetId: leftCabinetId },
    { side: "right", cabinetId: rightCabinetId },
  ];

  const sideEligibility: Record<SidePanelSide, boolean> = { left: true, right: true };

  for (const target of targets) {
    if (!target.cabinetId) continue;
    const cfg = await getConfig(target.cabinetId);
    const config = cfg && typeof cfg === "object" ? (cfg as Record<string, unknown>) : null;
    const rawType =
      (typeof config?.productType === "string" && config.productType) ||
      (typeof config?.ProductType === "string" && config.ProductType) ||
      (typeof config?.name === "string" && config.name) ||
      target.cabinetId;
    const group = mapCabinetTypeToGroup(rawType, profile);
    sideEligibility[target.side] = !(group && blockedGroups.includes(group));
  }

  return sideEligibility;
};

/**
 * The saved per-side statuses, settled against the restored edges before they are placed or recorded.
 * A side saved without its panel stays without it, so the restored panels and price are the saved ones:
 * on an eligible edge `auto-removed` becomes `none`, the status enforcement leaves alone. A blocked edge
 * keeps `auto-removed`, so its panel still comes back when the edge stops being blocked.
 */
export const settleSavedSideStatuses = async (
  profile: ProductProfile | null,
  left: SidePanelStatus,
  right: SidePanelStatus,
): Promise<Record<SidePanelSide, SidePanelStatus>> => {
  // Without the collection's side panel data no edge can be judged, and enforcement keeps the scene as it is.
  const blockedGroups = selectRuleData(profile, "sidePanels")?.blockedCabinetTypes;
  if (!blockedGroups) return { left, right };

  const sideEligibility = await readSideEligibility(getEdgeCabinets(), blockedGroups, profile);
  const settle = (side: SidePanelSide, status: SidePanelStatus): SidePanelStatus =>
    status === "auto-removed" && sideEligibility[side] ? "none" : status;

  return { left: settle("left", left), right: settle("right", right) };
};

/**
 * Checks edge cabinets and auto-removes SP from sides with a blocked cabinet group (OS/OSS),
 * or auto-restores SP on sides that became eligible again (SB/SC).
 */
export async function enforceSidePanelEligibility(
  dispatch: AppDispatch,
  profile: ProductProfile | null,
  groove: string,
  leftStatus: string,
  rightStatus: string,
  cabinetCount?: number,
) {
  // Without the collection's side panel data no edge can be judged; keep the scene as it is.
  const blockedGroups = selectRuleData(profile, "sidePanels")?.blockedCabinetTypes;
  if (!blockedGroups) return;

  const edges = getEdgeCabinets();
  const { leftCabinetId, rightCabinetId } = edges;
  const remembered = getRememberedSidePanels();
  const isSingle = leftCabinetId != null && leftCabinetId === rightCabinetId;
  const effectiveCabinetCount = cabinetCount ?? (isSingle ? 1 : 2);

  const sideEligibility = await readSideEligibility(edges, blockedGroups, profile);

  for (const side of SIDES) {
    const currentType = remembered[side];
    const hasPhysicalSP = currentType && currentType !== "None";
    const reduxStatus = side === "left" ? leftStatus : rightStatus;

    if (!sideEligibility[side]) {
      if (hasPhysicalSP) {
        await autoRemoveSide(dispatch, side, effectiveCabinetCount);
      }
    } else {
      if (reduxStatus === "auto-removed" && groove && !hasPhysicalSP) {
        await autoRestoreSide(dispatch, side, groove as GrooveType, effectiveCabinetCount);
      }
    }
  }
}
