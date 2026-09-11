import type {
  BoundRuntimeBinding,
  RuntimeBinding,
  RuntimeBindingSet,
  RuntimeFlow,
  RuntimeTarget,
  ScenePatch,
  SemanticValue,
} from "../../model/runtimeBindings";

/**
 * Translates a semantic value into its scene patch, or says why it cannot.
 *
 * Pure: nothing is sent to the scene. Callers check a whole set of changes with
 * findMissingBindings first, so an unknown translation stops the change before the
 * first scene mutation instead of halfway through it.
 */

export type RuntimeBindingFailureReason =
  /** The collection has no entry for the attribute. */
  | "no-binding"
  /** The entry exists but declares that there is no scene translation. */
  | "unbound"
  /** The attribute is bound, but not this value. */
  | "unknown-value"
  /** The target differs by flow and no flow was given. */
  | "flow-required";

export type ResolvedRuntimeBinding = {
  ok: true;
  attributeId: string;
  target: RuntimeTarget;
  patch: ScenePatch;
};

export type RuntimeBindingFailure = {
  ok: false;
  attributeId: string;
  value: SemanticValue;
  reason: RuntimeBindingFailureReason;
  /** The declared reason of an unbound entry. */
  detail?: string;
};

export type RuntimeBindingResolution = ResolvedRuntimeBinding | RuntimeBindingFailure;

/** Anything carrying an attribute and a value; PlannedChange fits as is. */
export type RuntimeBindingRequest = {
  attributeId: string;
  value: SemanticValue;
};

export const selectRuntimeBinding = (set: RuntimeBindingSet, attributeId: string): RuntimeBinding | null =>
  set.bindings.find((binding) => binding.attributeId === attributeId) ?? null;

const isEmpty = (value: SemanticValue): boolean => value === null || value === "";

const toPatch = (binding: BoundRuntimeBinding, value: SemanticValue): ScenePatch | null => {
  const { values } = binding;

  if (values.kind === "identity") {
    if (isEmpty(value) && values.emptyValue !== undefined) {
      return { [values.sceneKey]: values.emptyValue };
    }

    if (typeof value === "string" && values.overrides && Object.hasOwn(values.overrides, value)) {
      return { [values.sceneKey]: values.overrides[value] };
    }

    return typeof value === "string" || typeof value === "number" ? { [values.sceneKey]: value } : null;
  }

  if (typeof value !== "string" && typeof value !== "number") return null;

  // Own keys only, so a value like "toString" is not found on the prototype.
  const key = String(value);
  return Object.hasOwn(values.patches, key) ? { ...values.patches[key] } : null;
};

const toTarget = (binding: BoundRuntimeBinding, flow: RuntimeFlow | undefined): RuntimeTarget | null => {
  if (binding.target.kind !== "byFlow") return binding.target;

  return flow ? binding.target[flow] : null;
};

export const resolveRuntimeBinding = (
  set: RuntimeBindingSet,
  attributeId: string,
  value: SemanticValue,
  /** Needed only by bindings whose target differs by flow. */
  flow?: RuntimeFlow,
): RuntimeBindingResolution => {
  const binding = selectRuntimeBinding(set, attributeId);

  if (!binding) {
    return { ok: false, attributeId, value, reason: "no-binding" };
  }

  if (binding.status === "unbound") {
    return { ok: false, attributeId, value, reason: "unbound", detail: binding.reason };
  }

  const patch = toPatch(binding, value);

  if (!patch) {
    return { ok: false, attributeId, value, reason: "unknown-value" };
  }

  const target = toTarget(binding, flow);

  if (!target) {
    return { ok: false, attributeId, value, reason: "flow-required" };
  }

  return { ok: true, attributeId, target, patch };
};

/**
 * Every change of the set that has no scene translation. Empty means the whole set can
 * be sent; all problems are reported, not only the first.
 */
export const findMissingBindings = (
  set: RuntimeBindingSet,
  changes: readonly RuntimeBindingRequest[],
  flow?: RuntimeFlow,
): RuntimeBindingFailure[] =>
  changes.flatMap(({ attributeId, value }) => {
    const resolution = resolveRuntimeBinding(set, attributeId, value, flow);
    return resolution.ok ? [] : [resolution];
  });
