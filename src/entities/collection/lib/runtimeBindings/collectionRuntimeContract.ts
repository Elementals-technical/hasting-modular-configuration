import type { CustomizationSchema } from "../../model/customizationSchema";
import type { CollectionDiagnostic } from "../../model/diagnostics";
import type { RuntimeBindingSet } from "../../model/runtimeBindings";
import type { ProductProfile } from "../../model/productProfile";
import { selectAttribute } from "../productProfileSelectors";
import { selectRuntimeBinding } from "./resolveRuntimeBinding";
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

/** The cabinet values the style sidebar and the player menu change for one cabinet alone. */
export const collectPerCabinetAttributeIds = (schema?: CustomizationSchema): string[] => [
  ...new Set([...(schema?.styleSidebar?.attributes ?? []), ...(schema?.playerMenu?.attributes ?? [])]),
];

/**
 * A value offered for one cabinet alone must be a cabinet value of the profile that the scene
 * keeps per product (`perProduct`): anything else would change every cabinet or none.
 */
export const validatePerCabinetAttributes = (
  profile: ProductProfile,
  set: RuntimeBindingSet,
  schema?: CustomizationSchema,
): CollectionDiagnostic[] =>
  collectPerCabinetAttributeIds(schema).flatMap((attributeId): CollectionDiagnostic[] => {
    const binding = selectRuntimeBinding(set, attributeId);
    const isPerCabinet =
      selectAttribute(profile, attributeId)?.scope === "cabinet" && binding?.status === "bound" && binding.perProduct;

    return isPerCabinet
      ? []
      : [
          {
            code: "runtime.not-per-product",
            severity: "error",
            dataset: "customization",
            dataPath: attributeId,
            message: `"${attributeId}" is offered for one cabinet alone, but is not a cabinet value bound perProduct`,
          },
        ];
  });
