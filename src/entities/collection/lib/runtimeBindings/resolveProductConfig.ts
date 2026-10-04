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
 * - A state-only or unbound value is not sent: the collection declares it never reaches the scene.
 * - The translated patches go on top in binding order, so a later phase wins a shared scene key
 *   (the Mako drawer style over a height the builder catalog suggests).
 */

const isSemanticValue = (value: unknown): value is SemanticValue =>
  value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean";

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
    if (!resolution?.ok || isStateOnlyResolution(resolution)) {
      passthrough[key] = value;
      return;
    }

    translated.push({ order: resolution.order ?? Number.POSITIVE_INFINITY, index, patch: resolution.patch });
  });

  translated.sort((left, right) => left.order - right.order || left.index - right.index);

  return Object.assign(passthrough, ...translated.map(({ patch }) => patch));
};
