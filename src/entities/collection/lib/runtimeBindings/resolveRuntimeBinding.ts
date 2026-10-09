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
  /** Phase of the binding; absent when the collection declares none. */
  order?: number;
  /** Patch to send before `patch`, e.g. clearing the towel bar before another side. */
  resetBefore?: ScenePatch;
};

/** A value the collection records without a scene call. Nothing is sent for it. */
export type StateOnlyRuntimeResolution = {
  ok: true;
  attributeId: string;
  stateOnly: true;
};

export type RuntimeBindingFailure = {
  ok: false;
  attributeId: string;
  value: SemanticValue;
  reason: RuntimeBindingFailureReason;
  /** The declared reason of an unbound entry. */
  detail?: string;
};

export type RuntimeBindingResolution = ResolvedRuntimeBinding | StateOnlyRuntimeResolution | RuntimeBindingFailure;

export const isStateOnlyResolution = (resolution: RuntimeBindingResolution): resolution is StateOnlyRuntimeResolution =>
  resolution.ok && "stateOnly" in resolution;

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

  if (binding.status === "state-only") {
    return { ok: true, attributeId, stateOnly: true };
  }

  if (binding.values.kind === "map" && Object.hasOwn(binding.values.unboundValues ?? {}, String(value))) {
    return { ok: false, attributeId, value, reason: "unbound", detail: binding.values.unboundValues?.[String(value)] };
  }

  const patch = toPatch(binding, value);

  if (!patch) {
    return { ok: false, attributeId, value, reason: "unknown-value" };
  }

  const target = toTarget(binding, flow);

  if (!target) {
    return { ok: false, attributeId, value, reason: "flow-required" };
  }

  return {
    ok: true,
    attributeId,
    target,
    patch,
    ...(binding.order !== undefined ? { order: binding.order } : {}),
    ...(binding.resetBefore ? { resetBefore: { ...binding.resetBefore } } : {}),
  };
};

/**
 * The configuration value behind a value read back from the scene. An identity binding may send
 * a value under another name (`overrides`), so the scene holds "Acqua 419 Lacquered MT" for the
 * chosen "Acqua 419 MT". The chosen value is returned when the binding sends it as this scene
 * value, or when both are pending (`unboundValues`): a product placed without a pending choice
 * shows the scene's own value, which the binding declares in its place. Any other scene value is
 * returned as it was read.
 */
export const configurationValueOf = (
  set: RuntimeBindingSet | null,
  attributeId: string,
  sceneValue: string,
  chosenValue: string | null | undefined,
): string => {
  if (!set || !chosenValue || chosenValue === sceneValue) return sceneValue;

  const binding = selectRuntimeBinding(set, attributeId);
  if (binding?.status !== "bound") return sceneValue;

  const pending = binding.values.kind === "map" ? (binding.values.unboundValues ?? {}) : {};
  if (Object.hasOwn(pending, chosenValue) && Object.hasOwn(pending, sceneValue)) return chosenValue;

  const patch = toPatch(binding, chosenValue);
  return patch && Object.keys(patch).length === 1 && Object.values(patch)[0] === sceneValue ? chosenValue : sceneValue;
};

/**
 * The configuration value a scene value stands for, with no choice to compare it to: the one value
 * the binding sends as it (an `overrides` entry, or a value map's patch), so the scene's
 * "Nero 433 Lacquered MT" reads as Tricot's "Nero 433 MT". The binding is the only place that
 * knows the scene's names. A scene value no value is sent as, or more than one, is returned as read.
 */
export const semanticValueOf = (set: RuntimeBindingSet | null, attributeId: string, sceneValue: string): string => {
  const binding = set ? selectRuntimeBinding(set, attributeId) : null;
  if (binding?.status !== "bound") return sceneValue;

  const sentAs = (scenePatch: ScenePatch) =>
    Object.keys(scenePatch).length === 1 && Object.values(scenePatch)[0] === sceneValue;
  const values =
    binding.values.kind === "identity"
      ? Object.entries(binding.values.overrides ?? {}).flatMap(([value, sceneName]) =>
          sceneName === sceneValue ? [value] : [],
        )
      : Object.entries(binding.values.patches).flatMap(([value, scenePatch]) => (sentAs(scenePatch) ? [value] : []));

  return values.length === 1 ? values[0] : sceneValue;
};

/**
 * The size a scene size stands for: the one number a value map sends as it, so the Urban Duplex
 * scene's 50.5 cm depth reads as the cabinet table's 50. A size sent as is, or a value no number
 * is sent as, is returned as read.
 */
export const sceneDimensionValueOf = (
  set: RuntimeBindingSet | null,
  attributeId: string,
  sceneValue: number | null,
): number | null => {
  const binding = sceneValue === null || !set ? null : selectRuntimeBinding(set, attributeId);
  if (binding?.status !== "bound" || binding.values.kind !== "map") return sceneValue;

  const values = Object.entries(binding.values.patches).flatMap(([value, scenePatch]) =>
    Object.keys(scenePatch).length === 1 &&
    Object.values(scenePatch)[0] === sceneValue &&
    Number.isFinite(Number(value))
      ? [Number(value)]
      : [],
  );

  return values.length === 1 ? values[0] : sceneValue;
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
