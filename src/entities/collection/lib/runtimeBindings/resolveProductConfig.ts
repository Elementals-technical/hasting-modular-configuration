import type { RuntimeBindingSet, RuntimeFlow, ScenePatch, SemanticValue } from "../../model/runtimeBindings";
import { isStateOnlyResolution, resolveRuntimeBinding, selectRuntimeBinding } from "./resolveRuntimeBinding";

/**
 * The config a product is placed with, as the scene of its collection reads it.
 *
 * A placed product carries its own values (width, drawer style, handle, colours). Each one the
 * collection binds is translated the way a command would send it: a Mako handle becomes
 * HandleStyle, a Mako drawer style the height the scene lays the drawers out from.
 *
 * - A key without a binding is sent as it is: scene-only keys (divider zones, the product type).
 * - A value the binding cannot translate is sent as it is, as before the bindings: a legacy
 *   scene spelling, or a flow-specific target the placement does not choose between.
 * - A state-only or unbound value is not sent, nor a value its binding lists as pending
 *   (`unboundValues`): the collection declares it never reaches the scene, so the product is
 *   placed without it.
 * - The translated patches go on top in binding order, so a later phase wins a shared scene key
 *   (the Mako drawer style over a height the builder catalog suggests).
 */

const isSemanticValue = (value: unknown): value is SemanticValue =>
  value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean";

/**
 * Preflight for opted-in collections: a value the collection cannot translate (an unknown value,
 * a key without a binding) must not reach the scene as it is. A pending value (an unbound
 * attribute, or a value its binding lists in `unboundValues`) does not stop placement: the
 * product is placed without it, and the state keeps the choice. Keys the scene writes into every
 * product it places (position, category, divider zones) come back with its configs and pass.
 */
export const findProductConfigBindingErrors = (
  set: RuntimeBindingSet,
  config: Readonly<Record<string, unknown>>,
  flow?: RuntimeFlow,
): string[] => {
  if (!set.strictProductConfig) return [];
  const typeKeys = new Set(["CabinetType", "ProductType", "productType", "entityName", "EntityName", "name", "type"]);
  const sceneOwnedKeys = new Set([
    "category",
    "topDrawerType",
    "TopDrawerDividers",
    "BotDrawerDividers",
    "positionX",
    "positionY",
    "positionZ",
  ]);
  return Object.entries(config).flatMap(([key, value]) => {
    if (value === undefined || typeKeys.has(key) || sceneOwnedKeys.has(key)) return [];
    const resolution = isSemanticValue(value) ? resolveRuntimeBinding(set, key, value, flow) : null;
    if (resolution?.ok) return [];
    if (resolution?.reason === "unbound") return [];
    // Saved scene configs already carry material names, drawer tokens and keys the scene names
    // itself (Tricot's CabinetPattern for DrawerPanelFluting). Accept only an exact single-key
    // patch {key: value} delivered by this collection; unrelated legacy values remain blocked.
    if (
      set.bindings.some(
        (binding) =>
          binding.status === "bound" &&
          binding.values.kind === "map" &&
          Object.values(binding.values.patches).some(
            (patch) => Object.keys(patch).length === 1 && Object.hasOwn(patch, key) && patch[key] === value,
          ),
      )
    )
      return [];
    return [`No approved scene translation for ${key} "${String(value)}".`];
  });
};

export const resolveProductConfig = (
  set: RuntimeBindingSet,
  config: Readonly<Record<string, unknown>>,
  flow?: RuntimeFlow,
): Record<string, unknown> => {
  const passthrough: Record<string, unknown> = {};
  const translated: { order: number; index: number; patch: ScenePatch }[] = [];

  Object.entries(config).forEach(([key, value], index) => {
    if (value === undefined) return;

    const binding = selectRuntimeBinding(set, key);
    if (!binding) {
      passthrough[key] = value;
      return;
    }

    if (binding.status !== "bound") return;

    const resolution = isSemanticValue(value) ? resolveRuntimeBinding(set, key, value, flow) : null;
    if (resolution && !resolution.ok && resolution.reason === "unbound") return;
    if (!resolution?.ok || isStateOnlyResolution(resolution)) {
      passthrough[key] = value;
      return;
    }

    translated.push({ order: resolution.order ?? Number.POSITIVE_INFINITY, index, patch: resolution.patch });
  });

  translated.sort((left, right) => left.order - right.order || left.index - right.index);

  return Object.assign(passthrough, ...translated.map(({ patch }) => patch));
};
