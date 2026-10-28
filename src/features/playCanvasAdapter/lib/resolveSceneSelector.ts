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

const UUID_TAIL = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The scene names a product `${type}-${random tail}`. The tail has no dash, or is a UUID for a product
 * the scene re-created (a sink lift or landing, a layout import). Any other dash belongs to a longer
 * type: "UD-open-shelves-side-…" is not a "UD-open-shelves".
 */
const isOfSceneType = (runtimeId: string, productType: string): boolean => {
  if (runtimeId === productType) return true;
  if (!runtimeId.startsWith(`${productType}-`)) return false;

  const tail = runtimeId.slice(productType.length + 1);
  return !tail.includes("-") || UUID_TAIL.test(tail);
};

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
        // The scene takes every product whose id contains the type, so "UD-open-shelves" would
        // also reach "UD-open-shelves-side-…". With such a product placed, the products of the
        // type itself are addressed by id; otherwise the broadcast stays as the binding declares it.
        const reached = context.cabinetRuntimeIds.filter((runtimeId) => runtimeId.includes(target.productType));
        const ofType = reached.filter((runtimeId) => isOfSceneType(runtimeId, target.productType));

        if (ofType.length === reached.length) return { ok: true, selector: { productType: target.productType } };

        return { ok: true, selector: ofType.length > 0 ? { productIds: ofType } : null };
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
