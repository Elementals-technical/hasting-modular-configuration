import type { CustomizationSchema } from "../../model/customizationSchema";
import type { CollectionDiagnostic } from "../../model/diagnostics";
import type { RuntimeBindingSet } from "../../model/runtimeBindings";
import type { ProductProfile } from "../../model/productProfile";
import { validateRuntimeBindings, type RuntimeBindingIssue } from "./validateRuntimeBindings";

export const collectCustomizationAttributeIds = (schema?: CustomizationSchema): string[] =>
  schema
    ? [...new Set(Object.values(schema.sections).flatMap(({ fields }) => fields.map(({ attributeId }) => attributeId)))]
    : [];

const issuePath = (issue: RuntimeBindingIssue, set: RuntimeBindingSet): string => {
  if (issue.code === "collection-mismatch") return "/collectionId";
  if (issue.code === "missing-product-type") return `/productTypes/${issue.value ?? ""}`;

  const indexes = set.bindings
    .map((binding, index) => (binding.attributeId === issue.attributeId ? index : -1))
    .filter((index) => index >= 0);

  if (issue.code === "duplicate-binding") return `/bindings/${indexes[1] ?? indexes[0] ?? ""}`;
  if (issue.code === "orphan-binding") return `/bindings/${indexes[0] ?? ""}`;
  if (issue.code === "missing-value") {
    return `/bindings/${indexes[0] ?? ""}/values/patches/${issue.value ?? ""}`;
  }
  return "/bindings";
};

const issueMessage = (issue: RuntimeBindingIssue): string => {
  switch (issue.code) {
    case "collection-mismatch":
      return "Runtime bindings belong to another collection";
    case "missing-binding":
      return `Required attribute "${issue.attributeId}" has no runtime decision`;
    case "missing-value":
      return `Attribute "${issue.attributeId}" has no runtime patch for value "${issue.value}"`;
    case "missing-product-type":
      return `Cabinet type "${issue.value}" has no runtime product type`;
    case "orphan-binding":
      return `Runtime binding "${issue.attributeId}" is not required by the collection contract`;
    case "duplicate-binding":
      return `Runtime binding "${issue.attributeId}" is declared more than once`;
  }
};

export const validateCollectionRuntimeContract = (
  profile: ProductProfile,
  set: RuntimeBindingSet,
  requiredAttributeIds: readonly string[],
): CollectionDiagnostic[] =>
  validateRuntimeBindings(profile, set, requiredAttributeIds).map((issue) => ({
    code: `runtime.${issue.code}`,
    severity: issue.code === "orphan-binding" ? "warning" : "error",
    dataset: "runtimeBindings",
    dataPath: issuePath(issue, set),
    message: issueMessage(issue),
  }));
