import type { AppDispatch } from "@/app/store";
import type { ProductProfile } from "@/entities/collection";
import { selectRuleData } from "@/entities/collection";
import { getConfig } from "@/utils/functions/playcanvas/getConfig";
import { getEdgeCabinets } from "@/utils/functions/playcanvas/getEdgeCabinets";
import { getRememberedSidePanels } from "@/utils/functions/playcanvas/sidePanels";
import { mapCabinetTypeToGroup } from "../model/selectors";
import { autoRemoveSide, autoRestoreSide, type GrooveType } from "./sidePanelService";

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

  const { leftCabinetId, rightCabinetId } = getEdgeCabinets();
  const remembered = getRememberedSidePanels();
  const isSingle = leftCabinetId != null && leftCabinetId === rightCabinetId;
  const effectiveCabinetCount = cabinetCount ?? (isSingle ? 1 : 2);

  const targets: Array<{ side: "left" | "right"; cabinetId: string | null }> = [
    { side: "left", cabinetId: leftCabinetId },
    { side: "right", cabinetId: rightCabinetId },
  ];

  const sideEligibility: Record<"left" | "right", boolean> = { left: true, right: true };

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

  for (const target of targets) {
    const currentType = remembered[target.side];
    const hasPhysicalSP = currentType && currentType !== "None";
    const reduxStatus = target.side === "left" ? leftStatus : rightStatus;

    if (!sideEligibility[target.side]) {
      if (hasPhysicalSP) {
        await autoRemoveSide(dispatch, target.side, effectiveCabinetCount);
      }
    } else {
      if (reduxStatus === "auto-removed" && groove && !hasPhysicalSP) {
        await autoRestoreSide(dispatch, target.side, groove as GrooveType, effectiveCabinetCount);
      }
    }
  }
}
