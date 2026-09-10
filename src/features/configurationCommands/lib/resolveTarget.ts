import type { CabinetEntry, ValueTarget } from "@/entities/configuration";
import { findByStableKey } from "@/entities/configuration";

import type { AttributeChange } from "../model/types";

export type ResolveTargetResult =
  | { ok: true; target: ValueTarget }
  | { ok: false; message: string };

/**
 * Turns a change request into an addressed target.
 *
 * A per-product change must name a cabinet that actually exists; addressing a product
 * that is gone is an error rather than a silently ignored write.
 */
export const resolveTarget = (
  change: AttributeChange,
  cabinets: readonly CabinetEntry[],
): ResolveTargetResult => {
  switch (change.scope) {
    case "global":
    case "countertop":
    case "basin":
      return { ok: true, target: { scope: change.scope } };

    case "cabinet": {
      if (!findByStableKey(cabinets, change.cabinetId)) {
        return { ok: false, message: `unknown cabinet "${change.cabinetId}"` };
      }

      return { ok: true, target: { scope: "cabinet", cabinetId: change.cabinetId } };
    }

    case "drawer": {
      if (!findByStableKey(cabinets, change.cabinetId)) {
        return { ok: false, message: `unknown cabinet "${change.cabinetId}"` };
      }

      return {
        ok: true,
        target: { scope: "drawer", cabinetId: change.cabinetId, drawerType: change.drawerType },
      };
    }
  }
};
