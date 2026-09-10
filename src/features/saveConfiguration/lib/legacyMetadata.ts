import type { AttributeValue } from "@/entities/configuration";

import { CONFIGURATION_FRAGMENT_VERSION, type ConfigurationFragment, type SavedCabinet } from "./configurationFragment";

/**
 * Reads the configuration fragment out of saved metadata, including payloads written
 * before C07 existed.
 *
 * Reading never throws and never clears a configuration: an unreadable fragment yields
 * issues plus whatever could be recovered, so a bad payload cannot wipe the scene.
 */

export type FragmentIssueCode =
  | "fragment.missing"
  | "fragment.malformed"
  | "fragment.newer-version"
  | "fragment.invalid-cabinets"
  | "fragment.invalid-values";

export type FragmentIssue = {
  code: FragmentIssueCode;
  message: string;
};

export type ReadFragmentResult = {
  fragment: ConfigurationFragment;
  issues: FragmentIssue[];
  /** Whether the payload predates the fragment and was reconstructed from `uiState`. */
  isLegacy: boolean;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isAttributeValue = (value: unknown): value is AttributeValue =>
  value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean";

const emptyFragment = (collectionId: string | null = null): ConfigurationFragment => ({
  version: CONFIGURATION_FRAGMENT_VERSION,
  collectionId,
  cabinets: [],
  values: {},
});

const readCabinets = (raw: unknown, issues: FragmentIssue[]): SavedCabinet[] => {
  if (raw === undefined) return [];

  if (!Array.isArray(raw)) {
    issues.push({ code: "fragment.invalid-cabinets", message: "cabinets must be an array" });
    return [];
  }

  return raw.flatMap((entry, index) => {
    if (!isRecord(entry) || typeof entry.stableKey !== "string" || !entry.stableKey.trim()) {
      issues.push({ code: "fragment.invalid-cabinets", message: `cabinet ${index} has no stable key` });
      return [];
    }

    return [
      {
        stableKey: entry.stableKey,
        index: typeof entry.index === "number" && Number.isFinite(entry.index) ? entry.index : index,
      },
    ];
  });
};

const readValues = (raw: unknown, issues: FragmentIssue[]): ConfigurationFragment["values"] => {
  if (raw === undefined) return {};

  if (!isRecord(raw)) {
    issues.push({ code: "fragment.invalid-values", message: "values must be an object" });
    return {};
  }

  const values: ConfigurationFragment["values"] = {};

  for (const [targetKey, byAttribute] of Object.entries(raw)) {
    if (!isRecord(byAttribute)) {
      issues.push({ code: "fragment.invalid-values", message: `values for "${targetKey}" must be an object` });
      continue;
    }

    const accepted: Record<string, AttributeValue> = {};

    for (const [attributeId, value] of Object.entries(byAttribute)) {
      if (!isAttributeValue(value)) {
        issues.push({
          code: "fragment.invalid-values",
          message: `value of "${attributeId}" at "${targetKey}" has an unsupported type`,
        });
        continue;
      }

      accepted[attributeId] = value;
    }

    // Keep a target even when empty: its presence still records that it was saved.
    values[targetKey] = accepted;
  }

  return values;
};

/**
 * Rebuilds a fragment for a payload written before C07.
 *
 * Legacy `uiState` is flat, so every value becomes configuration-wide. `collectionId`
 * stays null, which resolveCollection treats as legacy USH — distinct from a payload
 * that names a collection nobody knows.
 */
const fromLegacyMetadata = (metadata: Record<string, unknown>): ConfigurationFragment => {
  const fragment = emptyFragment(null);

  const uiState = metadata.uiState;
  if (isRecord(uiState)) {
    const globalValues: Record<string, AttributeValue> = {};

    for (const [attributeId, value] of Object.entries(uiState)) {
      if (isAttributeValue(value)) {
        globalValues[attributeId] = value;
      }
    }

    if (Object.keys(globalValues).length > 0) {
      fragment.values.global = globalValues;
    }
  }

  // Legacy payloads have no stable keys; order is all the identity they carry.
  const orderedProductIds = metadata.orderedProductIds;
  if (Array.isArray(orderedProductIds)) {
    fragment.cabinets = orderedProductIds
      .filter((id): id is string => typeof id === "string")
      .map((_, index) => ({ stableKey: `legacy-${index + 1}`, index }));
  }

  return fragment;
};

export const readConfigurationFragment = (
  metadata: Record<string, unknown> | undefined | null,
): ReadFragmentResult => {
  const issues: FragmentIssue[] = [];

  if (!isRecord(metadata)) {
    issues.push({ code: "fragment.missing", message: "metadata is not an object" });
    return { fragment: emptyFragment(), issues, isLegacy: true };
  }

  const raw = metadata.configuration;

  if (raw === undefined) {
    issues.push({ code: "fragment.missing", message: "payload predates the configuration fragment" });
    return { fragment: fromLegacyMetadata(metadata), issues, isLegacy: true };
  }

  if (!isRecord(raw)) {
    issues.push({ code: "fragment.malformed", message: "configuration fragment is not an object" });
    return { fragment: fromLegacyMetadata(metadata), issues, isLegacy: true };
  }

  const version = typeof raw.version === "number" && Number.isFinite(raw.version) ? raw.version : 0;

  if (version > CONFIGURATION_FRAGMENT_VERSION) {
    // Read what this build understands rather than refusing the whole configuration.
    issues.push({
      code: "fragment.newer-version",
      message: `fragment version ${version} is newer than supported ${CONFIGURATION_FRAGMENT_VERSION}`,
    });
  }

  const collectionId = typeof raw.collectionId === "string" && raw.collectionId.trim() ? raw.collectionId : null;

  return {
    fragment: {
      version: CONFIGURATION_FRAGMENT_VERSION,
      collectionId,
      cabinets: readCabinets(raw.cabinets, issues),
      values: readValues(raw.values, issues),
    },
    issues,
    isLegacy: false,
  };
};

/**
 * Collection identity of a saved payload, for the collection resolver.
 *
 * `null` means "not recorded" — legacy USH. An unknown but recorded id is not this
 * function's problem: the resolver reports it as an error instead of substituting USH.
 */
export const readSavedCollectionId = (metadata: Record<string, unknown> | undefined | null): string | null => {
  if (!isRecord(metadata)) return null;

  if (typeof metadata.collectionId === "string" && metadata.collectionId.trim()) {
    return metadata.collectionId;
  }

  const fragment = metadata.configuration;
  if (isRecord(fragment) && typeof fragment.collectionId === "string" && fragment.collectionId.trim()) {
    return fragment.collectionId;
  }

  return null;
};
