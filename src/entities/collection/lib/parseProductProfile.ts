import {
  ATTRIBUTE_SCOPES,
  type AttributeConfirmation,
  type AttributeScope,
  type BookMatchingRuleData,
  type CabinetMatrixLegacyAdapter,
  type CountertopFallbacksRuleData,
  type DrawerStyleGroups,
  type FlutingRuleData,
  type GrainDirectionRuleData,
  type MaterialNormalizationRuleData,
  type ProductProfile,
  type ProfileAttribute,
  type ProfileOption,
  type ProfileRuleData,
  type SidePanelsRuleData,
  type SyntesiRuleData,
  type VesselCompatibilityRuleData,
} from "../model/productProfile";

/**
 * Diagnostic emitted by the profile parser.
 * `dataPath` points at the exact place in the source document so A can surface it
 * as a CollectionIssue without re-deriving the location.
 */
export type ProfileDiagnostic = {
  code: ProfileDiagnosticCode;
  dataPath: string;
  message: string;
};

export type ProfileDiagnosticCode =
  | "profile.invalid_json"
  | "profile.invalid_root"
  | "profile.missing_field"
  | "profile.invalid_field_type"
  | "attribute.invalid_scope"
  | "attribute.duplicate_id"
  | "attribute.duplicate_option"
  | "attribute.missing_options_source"
  | "attribute.value_outside_catalog"
  | "adapter.missing_column"
  | "ruleData.invalid_section";

export type ParseProductProfileResult =
  | { ok: true; profile: ProductProfile }
  | { ok: false; diagnostics: ProfileDiagnostic[] };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;

const isFiniteNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

const isStringRecord = (value: unknown): value is Record<string, string> =>
  isRecord(value) && Object.values(value).every((entry) => typeof entry === "string");

const isBoolean = (value: unknown): value is boolean => typeof value === "boolean";

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === "string");

const isNumberArray = (value: unknown): value is number[] => Array.isArray(value) && value.every(isFiniteNumber);

const isStringArrayRecord = (value: unknown): value is Record<string, string[]> =>
  isRecord(value) && Object.values(value).every(isStringArray);

type ValueCheck = (value: unknown) => boolean;

const optional =
  (check: ValueCheck): ValueCheck =>
  (value) =>
    value === undefined || check(value);

const arrayOf =
  (check: ValueCheck): ValueCheck =>
  (value) =>
    Array.isArray(value) && value.every(check);

const recordOf =
  (check: ValueCheck): ValueCheck =>
  (value) =>
    isRecord(value) && Object.values(value).every(check);

const objectWith =
  (fields: Record<string, ValueCheck>): ValueCheck =>
  (value) =>
    isRecord(value) && Object.entries(fields).every(([field, check]) => check(value[field]));

type Collector = {
  diagnostics: ProfileDiagnostic[];
  add: (code: ProfileDiagnosticCode, dataPath: string, message: string) => void;
};

const createCollector = (): Collector => {
  const diagnostics: ProfileDiagnostic[] = [];

  return {
    diagnostics,
    add: (code, dataPath, message) => {
      diagnostics.push({ code, dataPath, message });
    },
  };
};

const parseOptions = (raw: unknown, attributePath: string, collect: Collector): ProfileOption[] | undefined => {
  if (raw === undefined) return undefined;

  if (!Array.isArray(raw)) {
    collect.add("profile.invalid_field_type", `${attributePath}/options`, "options must be an array");
    return undefined;
  }

  const options: ProfileOption[] = [];
  const seen = new Set<string>();

  raw.forEach((entry, index) => {
    const optionPath = `${attributePath}/options/${index}`;

    if (!isRecord(entry)) {
      collect.add("profile.invalid_field_type", optionPath, "option must be an object");
      return;
    }

    // An empty string is a legitimate catalog member: several attributes model
    // "not chosen" as an option rather than as the absence of one.
    if (typeof entry.value !== "string") {
      collect.add("profile.missing_field", `${optionPath}/value`, "option value must be a string");
      return;
    }

    if (seen.has(entry.value)) {
      collect.add(
        "attribute.duplicate_option",
        `${optionPath}/value`,
        `duplicate option value "${entry.value}" in this attribute`,
      );
      return;
    }
    seen.add(entry.value);

    if (!isNonEmptyString(entry.label)) {
      collect.add("profile.missing_field", `${optionPath}/label`, "option label is required");
      return;
    }

    if (!isFiniteNumber(entry.order)) {
      collect.add("profile.missing_field", `${optionPath}/order`, "option order must be a finite number");
      return;
    }

    const aliases = Array.isArray(entry.aliases)
      ? entry.aliases.filter((alias): alias is string => isNonEmptyString(alias))
      : undefined;

    const capabilities = isRecord(entry.capabilities)
      ? { supportsGrooveColor: entry.capabilities.supportsGrooveColor === true }
      : undefined;

    options.push({
      value: entry.value,
      label: entry.label,
      order: entry.order,
      category: isNonEmptyString(entry.category) ? entry.category : undefined,
      aliases,
      capabilities,
      legacyDescription: isNonEmptyString(entry.legacyDescription) ? entry.legacyDescription : undefined,
    });
  });

  return options.sort((a, b) => a.order - b.order);
};

/** Values that must belong to the attribute catalog when the catalog is closed. */
const CATALOG_BOUND_FIELDS = ["defaultValue", "effectiveFallbackValue", "noneValue"] as const;

const parseConfirmation = (
  raw: unknown,
  attributePath: string,
  collect: Collector,
): AttributeConfirmation | undefined => {
  if (raw === undefined) return undefined;

  if (!isRecord(raw) || raw.when !== "cabinetsPlaced" || !isNonEmptyString(raw.reasonCode)) {
    collect.add(
      "profile.invalid_field_type",
      `${attributePath}/confirmation`,
      'confirmation must be { when: "cabinetsPlaced", reasonCode }',
    );
    return undefined;
  }

  return { when: raw.when, reasonCode: raw.reasonCode };
};

const parseAttribute = (raw: unknown, index: number, collect: Collector): ProfileAttribute | null => {
  const path = `/attributes/${index}`;

  if (!isRecord(raw)) {
    collect.add("profile.invalid_field_type", path, "attribute must be an object");
    return null;
  }

  if (!isNonEmptyString(raw.attributeId)) {
    collect.add("profile.missing_field", `${path}/attributeId`, "attributeId is required");
    return null;
  }

  const attributePath = `/attributes/${raw.attributeId}`;

  if (!isNonEmptyString(raw.scope) || !ATTRIBUTE_SCOPES.includes(raw.scope as AttributeScope)) {
    collect.add(
      "attribute.invalid_scope",
      `${attributePath}/scope`,
      `scope must be one of ${ATTRIBUTE_SCOPES.join(", ")}`,
    );
    return null;
  }

  const options = parseOptions(raw.options, attributePath, collect);

  if (!options && !isNonEmptyString(raw.optionsSource)) {
    collect.add(
      "attribute.missing_options_source",
      attributePath,
      "attribute must declare either options or optionsSource",
    );
    return null;
  }

  const attribute: ProfileAttribute = {
    attributeId: raw.attributeId,
    scope: raw.scope as AttributeScope,
    confirmation: parseConfirmation(raw.confirmation, attributePath, collect),
    options,
    optionsSource: isNonEmptyString(raw.optionsSource) ? raw.optionsSource : undefined,
    initialValue: typeof raw.initialValue === "string" ? raw.initialValue : undefined,
    defaultValue: typeof raw.defaultValue === "string" ? raw.defaultValue : undefined,
    effectiveFallbackValue: typeof raw.effectiveFallbackValue === "string" ? raw.effectiveFallbackValue : undefined,
    resetValue: typeof raw.resetValue === "string" ? raw.resetValue : undefined,
    noneValue: typeof raw.noneValue === "string" ? raw.noneValue : undefined,
  };

  if (options) {
    const catalog = new Set(options.map((option) => option.value));

    for (const field of CATALOG_BOUND_FIELDS) {
      const value = attribute[field];
      // An empty string is the documented "not chosen yet" marker and is never a catalog member.
      if (value === undefined || value === "") continue;

      if (!catalog.has(value)) {
        collect.add(
          "attribute.value_outside_catalog",
          `${attributePath}/${field}`,
          `${field} "${value}" is not present in the option catalog`,
        );
      }
    }
  }

  return attribute;
};

const parseLegacyAdapter = (raw: unknown, collect: Collector): CabinetMatrixLegacyAdapter | null => {
  const path = "/ruleData/cabinetMatrixLegacyAdapter";

  if (!isRecord(raw)) {
    collect.add("profile.missing_field", path, "cabinetMatrixLegacyAdapter is required");
    return null;
  }

  if (!isFiniteNumber(raw.tableId)) {
    collect.add("profile.missing_field", `${path}/tableId`, "tableId must be a finite number");
    return null;
  }

  if (!isRecord(raw.columns)) {
    collect.add("profile.missing_field", `${path}/columns`, "columns is required");
    return null;
  }

  const columns = raw.columns;
  const required = ["cabinetType", "drawers", "handlesAllowed", "supportsHeight"] as const;

  for (const key of required) {
    if (!isNonEmptyString(columns[key])) {
      collect.add("adapter.missing_column", `${path}/columns/${key}`, `column mapping "${key}" is required`);
      return null;
    }
  }

  if (!isStringRecord(columns.forcedHeightByHandle)) {
    collect.add(
      "adapter.missing_column",
      `${path}/columns/forcedHeightByHandle`,
      "forcedHeightByHandle must map handleId to a column name",
    );
    return null;
  }

  if (!isStringRecord(columns.requiresDrawersByHandle)) {
    collect.add(
      "adapter.missing_column",
      `${path}/columns/requiresDrawersByHandle`,
      "requiresDrawersByHandle must map handleId to a column name",
    );
    return null;
  }

  return {
    tableId: raw.tableId,
    columns: {
      cabinetType: columns.cabinetType as string,
      drawers: columns.drawers as string,
      handlesAllowed: columns.handlesAllowed as string,
      supportsHeight: columns.supportsHeight as string,
      forcedHeightByHandle: columns.forcedHeightByHandle,
      requiresDrawersByHandle: columns.requiresDrawersByHandle,
    },
  };
};

/** A field of a rule section: how it is checked and how the expectation is worded. */
type FieldCheck = readonly [check: ValueCheck, expectation: string];

const STRING_LIST: FieldCheck = [isStringArray, "an array of strings"];
const NUMBER: FieldCheck = [isFiniteNumber, "a finite number"];
const NON_EMPTY_STRING: FieldCheck = [isNonEmptyString, "a non-empty string"];

const RULE_SECTION_FIELDS = {
  fluting: {
    eligibleMaterialAliases: STRING_LIST,
    forbiddenTargetParts: STRING_LIST,
  },
  grainDirection: {
    eligibleMaterials: STRING_LIST,
    excludedFinishesByMaterial: [isStringArrayRecord, "a map of material to finish codes"],
    excludedFinishLabelsByMaterial: [optional(isStringRecord), "a map of material to a label"],
  },
  bookMatching: {
    horizontalMinimumAdjacentDrawerCabinets: NUMBER,
    verticalAllowedDrawerStyles: STRING_LIST,
    drawerCabinetAliases: STRING_LIST,
    openCabinetAliases: STRING_LIST,
  },
  sidePanels: {
    heightTokenByCm: [isStringRecord, "a map of centimetres to a height token"],
    blockedCabinetTypes: STRING_LIST,
    cabinetGroups: [isStringArrayRecord, "a map of cabinet group to cabinet names"],
    drawersByHandleType: [isStringArrayRecord, "a map of drawer group to drawers values"],
    exactBlockedCabinetLengthCm: NUMBER,
    countertopLengthIncrementCm: NUMBER,
    defaultQuantityUnlessHeightTypeLow: NUMBER,
    availability: [
      arrayOf(
        objectWith({
          height: isNonEmptyString,
          handleType: isNonEmptyString,
          cabinetType: isNonEmptyString,
          allowed: isStringArray,
        }),
      ),
      "an array of { height, handleType, cabinetType, allowed }",
    ],
  },
  syntesi: {
    material: NON_EMPTY_STRING,
    materialSkuToken: NON_EMPTY_STRING,
    maxCabinetCount: NUMBER,
    allowsSidePanels: [isBoolean, "a boolean"],
    finishTransforms: [
      arrayOf(
        objectWith({
          finish: isNonEmptyString,
          sourceFinish: isNonEmptyString,
          label: isNonEmptyString,
          value: isNonEmptyString,
          runtimeValue: isNonEmptyString,
        }),
      ),
      "an array of { finish, sourceFinish, label, value, runtimeValue }",
    ],
    sourceMaterialTokens: STRING_LIST,
  },
  countertopFallbacks: {
    restrictedIntegratedDepthsCm: [isNumberArray, "an array of finite numbers"],
    restrictedIntegratedMaterialTokens: STRING_LIST,
    restrictedIntegratedBasinKeys: STRING_LIST,
    excludedMaterialFilterTokens: STRING_LIST,
    needsConfirmation: [optional(isBoolean), "a boolean"],
  },
  materialNormalization: {
    aliases: [isStringArrayRecord, "a map of material token to alias tokens"],
    displayHierarchy: [
      optional(
        arrayOf(
          objectWith({
            value: isNonEmptyString,
            label: isNonEmptyString,
            children: isStringArray,
            aliases: isStringArray,
          }),
        ),
      ),
      "an array of { value, label, children, aliases }",
    ],
    vesselCompatibleCountertopMaterialTokens: [optional(isStringArray), "an array of strings"],
  },
  vesselCompatibility: {
    hiddenStyles: STRING_LIST,
    allowedMaterialsByStyle: [isStringArrayRecord, "a map of vessel style to material tokens"],
    allowedColorCodesByStyle: [recordOf(isStringArrayRecord), "a map of vessel style to material colour codes"],
    unavailableColorCodesByStyle: [recordOf(isStringArrayRecord), "a map of vessel style to material colour codes"],
    defaultFinishByStyle: [
      recordOf(objectWith({ materialTokens: isStringArray, colorCodes: isStringArray })),
      "a map of vessel style to { materialTokens, colorCodes }",
    ],
  },
} satisfies Record<string, Record<string, FieldCheck>>;

type RuleSectionName = keyof typeof RULE_SECTION_FIELDS;

/**
 * Checks one optional rule section. Every broken field is reported, so a data author sees
 * all problems of the section at once; a broken section fails the whole profile.
 */
const parseRuleSection = <T>(
  ruleData: Record<string, unknown>,
  section: RuleSectionName,
  collect: Collector,
): T | undefined => {
  const raw = ruleData[section];
  if (raw === undefined) return undefined;

  const path = `/ruleData/${section}`;

  if (!isRecord(raw)) {
    collect.add("ruleData.invalid_section", path, `${section} must be an object`);
    return undefined;
  }

  let valid = true;

  for (const [field, [check, expectation]] of Object.entries(RULE_SECTION_FIELDS[section])) {
    if (!check(raw[field])) {
      collect.add("ruleData.invalid_section", `${path}/${field}`, `${field} must be ${expectation}`);
      valid = false;
    }
  }

  return valid ? (raw as T) : undefined;
};

const parseDrawerStyleGroups = (raw: unknown, collect: Collector): DrawerStyleGroups | undefined => {
  if (raw === undefined) return undefined;

  if (!Array.isArray(raw) || !raw.every((group) => isStringArray(group) && group.length > 0)) {
    collect.add(
      "ruleData.invalid_section",
      "/ruleData/drawerStyleGroups",
      "drawerStyleGroups must be an array of non-empty string arrays",
    );
    return undefined;
  }

  return raw as DrawerStyleGroups;
};

/** Optional rule sections of a profile, without the keys the collection does not declare. */
const parseRuleSections = (
  ruleData: Record<string, unknown>,
  collect: Collector,
): Omit<ProfileRuleData, "cabinetMatrixLegacyAdapter"> => {
  const sections: Omit<ProfileRuleData, "cabinetMatrixLegacyAdapter"> = {
    drawerStyleGroups: parseDrawerStyleGroups(ruleData.drawerStyleGroups, collect),
    fluting: parseRuleSection<FlutingRuleData>(ruleData, "fluting", collect),
    grainDirection: parseRuleSection<GrainDirectionRuleData>(ruleData, "grainDirection", collect),
    bookMatching: parseRuleSection<BookMatchingRuleData>(ruleData, "bookMatching", collect),
    sidePanels: parseRuleSection<SidePanelsRuleData>(ruleData, "sidePanels", collect),
    syntesi: parseRuleSection<SyntesiRuleData>(ruleData, "syntesi", collect),
    countertopFallbacks: parseRuleSection<CountertopFallbacksRuleData>(ruleData, "countertopFallbacks", collect),
    materialNormalization: parseRuleSection<MaterialNormalizationRuleData>(ruleData, "materialNormalization", collect),
    vesselCompatibility: parseRuleSection<VesselCompatibilityRuleData>(ruleData, "vesselCompatibility", collect),
  };

  return Object.fromEntries(Object.entries(sections).filter(([, value]) => value !== undefined));
};

/**
 * Validates an untyped profile document into a ProductProfile.
 * Accepts either a parsed value or a raw JSON string, so the same entry point serves
 * a packaged file, an API response and a test fixture.
 */
export const parseProductProfile = (input: unknown): ParseProductProfileResult => {
  const collect = createCollector();

  let raw = input;

  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch (error) {
      collect.add("profile.invalid_json", "/", error instanceof Error ? error.message : "document is not valid JSON");
      return { ok: false, diagnostics: collect.diagnostics };
    }
  }

  if (!isRecord(raw)) {
    collect.add("profile.invalid_root", "/", "profile must be an object");
    return { ok: false, diagnostics: collect.diagnostics };
  }

  if (!isFiniteNumber(raw.schemaVersion)) {
    collect.add("profile.missing_field", "/schemaVersion", "schemaVersion must be a finite number");
  }

  if (!isNonEmptyString(raw.collectionId)) {
    collect.add("profile.missing_field", "/collectionId", "collectionId is required");
  }

  const sourceRefs = isRecord(raw.sourceRefs) ? raw.sourceRefs : null;
  if (!sourceRefs) {
    collect.add("profile.missing_field", "/sourceRefs", "sourceRefs is required");
  } else {
    for (const key of ["configuratorId", "countertopMatrixTableId", "cabinetMatrixTableId"] as const) {
      if (!isFiniteNumber(sourceRefs[key])) {
        collect.add("profile.missing_field", `/sourceRefs/${key}`, `${key} must be a finite number`);
      }
    }
  }

  if (!isStringRecord(raw.defaults)) {
    collect.add("profile.invalid_field_type", "/defaults", "defaults must map attribute ids to string values");
  }

  if (!Array.isArray(raw.attributes)) {
    collect.add("profile.missing_field", "/attributes", "attributes must be an array");
    return { ok: false, diagnostics: collect.diagnostics };
  }

  const attributes: ProfileAttribute[] = [];
  const seenIds = new Set<string>();

  raw.attributes.forEach((entry, index) => {
    const attribute = parseAttribute(entry, index, collect);
    if (!attribute) return;

    if (seenIds.has(attribute.attributeId)) {
      collect.add(
        "attribute.duplicate_id",
        `/attributes/${attribute.attributeId}`,
        `duplicate attributeId "${attribute.attributeId}"`,
      );
      return;
    }

    seenIds.add(attribute.attributeId);
    attributes.push(attribute);
  });

  const ruleData = isRecord(raw.ruleData) ? raw.ruleData : null;
  if (!ruleData) {
    collect.add("profile.missing_field", "/ruleData", "ruleData is required");
    return { ok: false, diagnostics: collect.diagnostics };
  }

  const adapter = parseLegacyAdapter(ruleData.cabinetMatrixLegacyAdapter, collect);
  const ruleSections = parseRuleSections(ruleData, collect);

  const messages = isStringRecord(raw.messages) ? raw.messages : null;
  if (!messages) {
    collect.add("profile.invalid_field_type", "/messages", "messages must map reason codes to strings");
  }

  if (collect.diagnostics.length > 0 || !adapter || !messages) {
    return { ok: false, diagnostics: collect.diagnostics };
  }

  return {
    ok: true,
    profile: {
      schemaVersion: raw.schemaVersion as number,
      collectionId: raw.collectionId as string,
      label: isNonEmptyString(raw.label) ? raw.label : undefined,
      sourceRefs: {
        configuratorId: (sourceRefs as Record<string, number>).configuratorId,
        countertopMatrixTableId: (sourceRefs as Record<string, number>).countertopMatrixTableId,
        cabinetMatrixTableId: (sourceRefs as Record<string, number>).cabinetMatrixTableId,
      },
      defaults: raw.defaults as Record<string, string>,
      attributes,
      ruleData: { cabinetMatrixLegacyAdapter: adapter, ...ruleSections },
      messages,
    },
  };
};
