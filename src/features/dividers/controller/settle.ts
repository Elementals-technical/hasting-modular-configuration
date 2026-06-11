import {
  recordDividerUiDebug,
  type RuntimePlacedDivider,
} from "@/utils/functions/playcanvas/dividers";

import type { DividerRuntimeAdapter } from "../adapter";
import type { DividerAvailability, DividerContext, DividerType } from "../model/types";

export type SettleDeps = {
  adapter: DividerRuntimeAdapter;
  traceId: string;
  /** Fresh selected type — MUST read from the redux store at call time, never from a closure. */
  getSelectedType: () => DividerType | null;
  /** dispatch(replacePlacedDividersForDrawer(...)) */
  syncPlaced: (context: DividerContext, dividers: RuntimePlacedDivider[]) => void;
  /** Value-equal state update (no-op when dividerTypesEqual says nothing changed). */
  applyAvailability: (availability: DividerAvailability | null) => void;
};

/**
 * THE single post-command sequence (invariant 4 of the migration plan). After every
 * place/remove the controller runs exactly this:
 *
 *   syncPlaced → showSlots with the CURRENT selected type from the store → refreshAvailability
 *
 * Reading the selected type at execution time (not from a captured closure) is what makes
 * the "overlay jumps back to A/default after remove" bug impossible.
 */
export async function settle(context: DividerContext, deps: SettleDeps): Promise<void> {
  const { adapter, traceId } = deps;

  recordDividerUiDebug("Controller.Settle", "Settle started", {
    traceId,
    cabinetId: context.cabinetId,
    drawerType: context.drawerType,
  });

  const placed = await adapter.fetchPlaced(context);
  if (placed) {
    deps.syncPlaced(context, placed);
  }

  const selectedType = deps.getSelectedType();
  await adapter.execute({ kind: "showSlots", context, selectedType, traceId });

  const availability = await adapter.fetchAvailability(context);
  deps.applyAvailability(availability);

  recordDividerUiDebug("Controller.Settle", "Settle completed", {
    traceId,
    cabinetId: context.cabinetId,
    drawerType: context.drawerType,
    selectedType,
    placedCount: placed?.length ?? null,
    availabilityTypes: availability?.types ?? null,
  });
}
