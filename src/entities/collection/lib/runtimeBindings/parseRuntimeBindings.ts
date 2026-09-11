import type {
  FlowTargets,
  IdentityValues,
  MappedValues,
  RuntimeBinding,
  RuntimeBindingSet,
  RuntimeTarget,
  ScenePatch,
  SceneValue,
} from "../../model/runtimeBindings";

/**
 * Reads a collection's runtime-bindings.json into a typed table.
 *
 * Checks the format only; whether the table agrees with the profile is
 * validateRuntimeBindings. `dataPath` points at the exact place in the document, so A
 * can surface it while loading without re-deriving the location.
 */

export type RuntimeBindingsDiagnosticCode =
  | "bindings.invalid_root"
  | "bindings.missing_field"
  | "bindings.invalid_field_type"
  | "binding.invalid_status"
  | "binding.invalid_target"
  | "binding.invalid_values";

export type RuntimeBindingsDiagnostic = {
  code: RuntimeBindingsDiagnosticCode;
  dataPath: string;
  message: string;
};

export type ParseRuntimeBindingsResult =
  | { ok: true; bindings: RuntimeBindingSet }
  | { ok: false; diagnostics: RuntimeBindingsDiagnostic[] };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;

const isSceneValue = (value: unknown): value is SceneValue =>
  typeof value === "string" || (typeof value === "number" && Number.isFinite(value));

type Collector = {
  diagnostics: RuntimeBindingsDiagnostic[];
  add: (code: RuntimeBindingsDiagnosticCode, dataPath: string, message: string) => void;
};

const createCollector = (): Collector => {
  const diagnostics: RuntimeBindingsDiagnostic[] = [];

  return {
    diagnostics,
    add: (code, dataPath, message) => {
      diagnostics.push({ code, dataPath, message });
    },
  };
};

const parseTarget = (raw: unknown, path: string, collect: Collector): RuntimeTarget | null => {
  if (!isRecord(raw)) {
    collect.add("binding.invalid_target", path, "target must be an object");
    return null;
  }

  if (raw.kind === "product" || raw.kind === "cabinets" || raw.kind === "all") {
    return { kind: raw.kind };
  }

  if (raw.kind === "productType") {
    if (!isNonEmptyString(raw.productType)) {
      collect.add("binding.invalid_target", `${path}/productType`, "productType target needs a productType");
      return null;
    }

    return { kind: "productType", productType: raw.productType };
  }

  collect.add(
    "binding.invalid_target",
    `${path}/kind`,
    'target kind must be "product", "cabinets", "all" or "productType"',
  );
  return null;
};

const parseTargetSpec = (raw: unknown, path: string, collect: Collector): RuntimeTarget | FlowTargets | null => {
  if (!isRecord(raw) || raw.kind !== "byFlow") return parseTarget(raw, path, collect);

  // Both parsed before returning, so a table reports every broken flow at once.
  const prebuilt = parseTarget(raw.prebuilt, `${path}/prebuilt`, collect);
  const custom = parseTarget(raw.custom, `${path}/custom`, collect);

  return prebuilt && custom ? { kind: "byFlow", prebuilt, custom } : null;
};

const parsePatch = (raw: unknown, path: string, collect: Collector): ScenePatch | null => {
  if (!isRecord(raw) || Object.keys(raw).length === 0) {
    collect.add("binding.invalid_values", path, "patch must be a non-empty object");
    return null;
  }

  const patch: ScenePatch = {};
  let valid = true;

  for (const [sceneKey, value] of Object.entries(raw)) {
    if (!isSceneValue(value)) {
      collect.add("binding.invalid_values", `${path}/${sceneKey}`, "scene value must be a string or a number");
      valid = false;
      continue;
    }

    patch[sceneKey] = value;
  }

  return valid ? patch : null;
};

const parseOverrides = (raw: unknown, path: string, collect: Collector): Record<string, SceneValue> | null => {
  if (!isRecord(raw)) {
    collect.add("binding.invalid_values", path, "overrides must be an object");
    return null;
  }

  const overrides: Record<string, SceneValue> = {};
  let valid = true;

  for (const [value, sceneValue] of Object.entries(raw)) {
    if (!isSceneValue(sceneValue)) {
      collect.add("binding.invalid_values", `${path}/${value}`, "scene value must be a string or a number");
      valid = false;
      continue;
    }

    overrides[value] = sceneValue;
  }

  return valid ? overrides : null;
};

const parseValues = (raw: unknown, path: string, collect: Collector): IdentityValues | MappedValues | null => {
  if (!isRecord(raw)) {
    collect.add("binding.invalid_values", path, "values must be an object");
    return null;
  }

  if (raw.kind === "identity") {
    if (!isNonEmptyString(raw.sceneKey)) {
      collect.add("binding.invalid_values", `${path}/sceneKey`, "identity values need a sceneKey");
      return null;
    }

    if (raw.emptyValue !== undefined && !isSceneValue(raw.emptyValue)) {
      collect.add("binding.invalid_values", `${path}/emptyValue`, "emptyValue must be a string or a number");
      return null;
    }

    const overrides =
      raw.overrides === undefined ? undefined : parseOverrides(raw.overrides, `${path}/overrides`, collect);
    if (overrides === null) return null;

    return {
      kind: "identity",
      sceneKey: raw.sceneKey,
      ...(raw.emptyValue !== undefined ? { emptyValue: raw.emptyValue } : {}),
      ...(overrides ? { overrides } : {}),
    };
  }

  if (raw.kind === "map") {
    if (!isRecord(raw.patches) || Object.keys(raw.patches).length === 0) {
      collect.add("binding.invalid_values", `${path}/patches`, "map values need a non-empty patches object");
      return null;
    }

    const patches: Record<string, ScenePatch> = {};
    let valid = true;

    for (const [value, rawPatch] of Object.entries(raw.patches)) {
      const patch = parsePatch(rawPatch, `${path}/patches/${value}`, collect);

      if (!patch) {
        valid = false;
        continue;
      }

      patches[value] = patch;
    }

    return valid ? { kind: "map", patches } : null;
  }

  collect.add("binding.invalid_values", `${path}/kind`, 'values kind must be "identity" or "map"');
  return null;
};

const parseProductTypes = (raw: unknown, collect: Collector): Record<string, string> | null => {
  if (!isRecord(raw)) {
    collect.add("bindings.missing_field", "/productTypes", "productTypes must be an object");
    return null;
  }

  const productTypes: Record<string, string> = {};
  let valid = true;

  for (const [cabinetType, productType] of Object.entries(raw)) {
    if (!isNonEmptyString(productType)) {
      collect.add("bindings.invalid_field_type", `/productTypes/${cabinetType}`, "product type must be a string");
      valid = false;
      continue;
    }

    productTypes[cabinetType] = productType;
  }

  return valid ? productTypes : null;
};

const parseBinding = (raw: unknown, path: string, collect: Collector): RuntimeBinding | null => {
  if (!isRecord(raw)) {
    collect.add("bindings.invalid_field_type", path, "binding must be an object");
    return null;
  }

  if (!isNonEmptyString(raw.attributeId)) {
    collect.add("bindings.missing_field", `${path}/attributeId`, "attributeId is required");
    return null;
  }

  if (raw.status === "unbound") {
    if (!isNonEmptyString(raw.reason)) {
      collect.add("bindings.missing_field", `${path}/reason`, "an unbound entry must say why");
      return null;
    }

    return { attributeId: raw.attributeId, status: "unbound", reason: raw.reason };
  }

  if (raw.status !== "bound") {
    collect.add("binding.invalid_status", `${path}/status`, 'status must be "bound" or "unbound"');
    return null;
  }

  // Both parsed before returning, so one entry reports every problem it has.
  const target = parseTargetSpec(raw.target, `${path}/target`, collect);
  const values = parseValues(raw.values, `${path}/values`, collect);

  if (!target || !values) return null;

  return {
    attributeId: raw.attributeId,
    status: "bound",
    target,
    values,
    ...(isNonEmptyString(raw.note) ? { note: raw.note } : {}),
  };
};

export const parseRuntimeBindings = (input: unknown): ParseRuntimeBindingsResult => {
  const collect = createCollector();

  if (!isRecord(input)) {
    collect.add("bindings.invalid_root", "", "runtime bindings must be an object");
    return { ok: false, diagnostics: collect.diagnostics };
  }

  const { schemaVersion, collectionId } = input;

  if (typeof schemaVersion !== "number") {
    collect.add("bindings.missing_field", "/schemaVersion", "schemaVersion must be a number");
  }

  if (!isNonEmptyString(collectionId)) {
    collect.add("bindings.missing_field", "/collectionId", "collectionId is required");
  }

  const productTypes = parseProductTypes(input.productTypes, collect);

  if (!Array.isArray(input.bindings)) {
    collect.add("bindings.missing_field", "/bindings", "bindings must be an array");
    return { ok: false, diagnostics: collect.diagnostics };
  }

  const bindings = input.bindings.flatMap((entry, index) => {
    const binding = parseBinding(entry, `/bindings/${index}`, collect);
    return binding ? [binding] : [];
  });

  if (
    typeof schemaVersion !== "number" ||
    !isNonEmptyString(collectionId) ||
    !productTypes ||
    collect.diagnostics.length > 0
  ) {
    return { ok: false, diagnostics: collect.diagnostics };
  }

  return { ok: true, bindings: { schemaVersion, collectionId, productTypes, bindings } };
};
