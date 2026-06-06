import type { AppDispatch } from "@/app/store";
import { getConfig } from "@/utils/functions/playcanvas/getConfig";
import { getEdgeCabinets } from "@/utils/functions/playcanvas/getEdgeCabinets";
import { getRememberedSidePanels } from "@/utils/functions/playcanvas/sidePanels";
import { mapCabinetTypeToGroup } from "../model/selectors";
import { autoRemoveSide, autoRestoreSide, type GrooveType } from "./sidePanelService";

/**
 * Checks edge cabinets and auto-removes SP from sides with OS/OSS,
 * or auto-restores SP on sides that became eligible again (SB/SC).
 */
export async function enforceSidePanelEligibility(
  dispatch: AppDispatch,
  groove: string,
  leftStatus: string,
  rightStatus: string,
  cabinetCount?: number,
) {
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
    const group = mapCabinetTypeToGroup(rawType);
    sideEligibility[target.side] = group !== "OS" && group !== "OSS";
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
