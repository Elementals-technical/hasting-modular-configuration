import { normalizeOptionValue, selectRuntimeBinding } from "@/entities/collection";
import type { ProductProfile, RuntimeBindingSet } from "@/entities/collection";
import type { AttributeValue } from "@/entities/configuration";

/**
 * The value a stored value is sent to the scene as. A value bound through a value map is looked
 * up by its canonical option value, while the state may still hold a legacy spelling ("Vessel"
 * for "vessel"); every other value reaches the scene as it is stored.
 */
export const toSceneValue = (
  profile: ProductProfile | null,
  bindings: RuntimeBindingSet | null,
  attributeId: string,
  value: AttributeValue,
): AttributeValue => {
  const binding = bindings ? selectRuntimeBinding(bindings, attributeId) : null;
  if (binding?.status !== "bound" || binding.values.kind !== "map") return value;

  return normalizeOptionValue(profile, attributeId, value) ?? value;
};
