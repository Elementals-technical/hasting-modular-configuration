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
 * that is gone is an error rather than a silently ignored write. `isSinkBase` tells a Sink
 * Base by its runtime id, which only the collection's runtime bindings can read.
 */
export const resolveTarget = (
  change: AttributeChange,
  cabinets: readonly CabinetEntry[],
  isSinkBase: (runtimeId: string) => boolean,
): ResolveTargetResult => {
  switch (change.scope) {
    case "global":
    case "countertop":
      return { ok: true, target: { scope: change.scope } };

    case "basin": {
      if (!change.sinkBaseId) return { ok: true, target: { scope: "basin" } };
      const sinkBase = findByStableKey(cabinets, change.sinkBaseId);
      if (!sinkBase) {
        return { ok: false, message: `unknown sink base "${change.sinkBaseId}"` };
      }
      if (!isSinkBase(sinkBase.runtimeId)) {
        return { ok: false, message: `cabinet "${change.sinkBaseId}" is not a sink base` };
      }
      return { ok: true, target: { scope: "basin", sinkBaseId: change.sinkBaseId } };
    }

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
