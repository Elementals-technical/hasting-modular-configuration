import type { ProductProfile } from "../../model/productProfile";
import type { RuntimeBindingSet } from "../../model/runtimeBindings";

/**
 * Cross-checks a profile against its runtime bindings.
 *
 * The profile lists the values a user can pick; the bindings say how each reaches the
 * scene. This reports every place where the two disagree, so a value that would reach
 * the scene untranslated is found while loading, not on the click. Reports, never throws:
 * A decides what a finding means for the load (A07).
 */

export type RuntimeBindingIssueCode =
  /** Bindings were written for another collection. */
  | "collection-mismatch"
  /** A required attribute has neither a translation nor a declared "unbound" entry. */
  | "missing-binding"
  /** A catalog option of a mapped attribute has no scene patch. */
  | "missing-value"
  /** A cabinet type of the profile has neither a runtime product type nor a reason it has none. */
  | "missing-product-type"
  /** A binding for an attribute nobody requires. */
  | "orphan-binding"
  /** Two entries for one attribute; only the first would ever be used. */
  | "duplicate-binding";

export type RuntimeBindingIssue = {
  code: RuntimeBindingIssueCode;
  attributeId?: string;
  value?: string;
};

/** The attribute whose values `productTypes` translates. */
const CABINET_TYPE_ATTRIBUTE_ID = "CabinetType";

export const validateRuntimeBindings = (
  profile: ProductProfile,
  set: RuntimeBindingSet,
  /**
   * Attributes that need an entry beyond the profile catalog: the fields of the
   * collection's UI description (ui.json) and the attributes C commands can send
   * without a field, such as the dimensions a handle change carries.
   */
  requiredAttributeIds: readonly string[] = [],
): RuntimeBindingIssue[] => {
  const issues: RuntimeBindingIssue[] = [];

  if (profile.collectionId !== set.collectionId) {
    issues.push({ code: "collection-mismatch" });
  }

  const requiredIds = [
    ...new Set([...profile.attributes.map(({ attributeId }) => attributeId), ...requiredAttributeIds]),
  ];
  const required = new Set(requiredIds);
  const seen = new Set<string>();

  for (const binding of set.bindings) {
    if (seen.has(binding.attributeId)) {
      issues.push({ code: "duplicate-binding", attributeId: binding.attributeId });
      continue;
    }
    seen.add(binding.attributeId);

    if (!required.has(binding.attributeId)) {
      issues.push({ code: "orphan-binding", attributeId: binding.attributeId });
    }
  }

  for (const attributeId of requiredIds) {
    if (!seen.has(attributeId)) {
      issues.push({ code: "missing-binding", attributeId });
    }
  }

  for (const attribute of profile.attributes) {
    const binding = set.bindings.find(({ attributeId }) => attributeId === attribute.attributeId);

    // Identity passes any value through, and an external option source cannot be listed
    // here; only a closed catalog behind a mapped binding can be checked value by value.
    if (binding?.status !== "bound" || binding.values.kind !== "map") continue;

    for (const option of attribute.options ?? []) {
      if (!Object.hasOwn(binding.values.patches, option.value)) {
        issues.push({ code: "missing-value", attributeId: attribute.attributeId, value: option.value });
      }
    }
  }

  const cabinetTypes = profile.attributes.find(({ attributeId }) => attributeId === CABINET_TYPE_ATTRIBUTE_ID);

  for (const option of cabinetTypes?.options ?? []) {
    const isDeclared =
      Object.hasOwn(set.productTypes, option.value) || Object.hasOwn(set.unplacedProductTypes ?? {}, option.value);

    if (!isDeclared) {
      issues.push({ code: "missing-product-type", attributeId: CABINET_TYPE_ATTRIBUTE_ID, value: option.value });
    }
  }

  return issues;
};
