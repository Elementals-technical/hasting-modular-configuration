import type { RuntimeTarget } from "@/entities/collection";
import type { RuntimeChange, RuntimeContext } from "@/entities/configuration";
import type { SceneSelector } from "@/utils/functions/playcanvas/sceneBridge";

/**
 * Turns a binding target into the products a scene command reaches.
 *
 * `null` selector means there is nothing to send (no cabinets placed), which is not a
 * failure. A change the scene cannot address is a failure, found before any command.
 */

export type SceneSelectorResolution = { ok: true; selector: SceneSelector | null } | { ok: false; message: string };

export const resolveSceneSelector = (
  target: RuntimeTarget,
  change: RuntimeChange,
  context: RuntimeContext,
): SceneSelectorResolution => {
  switch (target.kind) {
    case "all":
      return { ok: true, selector: {} };

    case "productType": {
      // A value that names the sink base it belongs to reaches that one product. Without a
      // name it stays the broadcast the binding declares, which is how a configuration-wide
      // basin still reaches every sink base.
      if (change.target.scope !== "basin" || !change.target.sinkBaseId) {
        return { ok: true, selector: { productType: target.productType } };
      }

      const runtimeId = context.resolveRuntimeId(change.target.sinkBaseId);

      return runtimeId
        ? { ok: true, selector: { productIds: [runtimeId] } }
        : { ok: false, message: `The scene has no product for sink base ${change.target.sinkBaseId}.` };
    }

    case "cabinets":
      return context.cabinetRuntimeIds.length > 0
        ? { ok: true, selector: { productIds: [...context.cabinetRuntimeIds] } }
        : { ok: true, selector: null };

    case "product": {
      if (change.target.scope !== "cabinet" && change.target.scope !== "drawer") {
        return {
          ok: false,
          message: `${change.attributeId} is sent to one cabinet, but the change addresses scope "${change.target.scope}".`,
        };
      }

      const runtimeId = context.resolveRuntimeId(change.target.cabinetId);

      return runtimeId
        ? { ok: true, selector: { productIds: [runtimeId] } }
        : { ok: false, message: `The scene has no product for cabinet ${change.target.cabinetId}.` };
    }
  }
};
