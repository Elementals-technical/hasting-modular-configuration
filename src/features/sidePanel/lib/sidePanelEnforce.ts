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
) {
  const { leftCabinetId, rightCabinetId } = getEdgeCabinets();
  const remembered = getRememberedSidePanels();
  const enforceDbg = { t: Date.now(), action: "SP_ENFORCE", groove, leftStatus, rightStatus, remembered: { ...remembered }, leftCabinetId, rightCabinetId };
  console.warn("[SP] enforce:", enforceDbg);
  ((window as unknown as Record<string, unknown>).__SP_DEBUG__ as unknown[]) ??= [];
  ((window as unknown as Record<string, unknown>).__SP_DEBUG__ as unknown[]).push(enforceDbg);

  const targets: Array<{ side: "left" | "right"; cabinetId: string | null; opposite: "left" | "right" }> = [
    { side: "left", opposite: "right", cabinetId: leftCabinetId },
    { side: "right", opposite: "left", cabinetId: rightCabinetId },
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
    console.warn("[SP] enforce:", target.side, "type:", rawType, "group:", group, "eligible:", sideEligibility[target.side]);
  }

  for (const target of targets) {
    const currentType = remembered[target.side];
    const hasPhysicalSP = currentType && currentType !== "None";
    const reduxStatus = target.side === "left" ? leftStatus : rightStatus;
    const decision: Record<string, unknown> = { t: Date.now(), action: "SP_ENFORCE_SIDE", side: target.side, eligible: sideEligibility[target.side], remembered: currentType, hasPhysicalSP, reduxStatus, groove };

    if (!sideEligibility[target.side]) {
      if (hasPhysicalSP) {
        decision.result = "auto-remove";
        console.warn("[SP] enforce: auto-remove", target.side, "(was:", currentType, ")");
        await autoRemoveSide(dispatch, target.side);
      } else {
        decision.result = "skip-already-none";
      }
    } else {
      if (reduxStatus === "auto-removed" && groove && !hasPhysicalSP) {
        decision.result = "auto-restore";
        console.warn("[SP] enforce: auto-restore", target.side, "→", groove);
        await autoRestoreSide(dispatch, target.side, groove as GrooveType);
      } else {
        decision.result = "no-action";
      }
    }

    console.warn("[SP] enforce decision:", decision);
    ((window as unknown as Record<string, unknown>).__SP_DEBUG__ as unknown[]).push(decision);
  }
}
