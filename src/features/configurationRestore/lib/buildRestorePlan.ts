import type { ConfigurationRecord, SceneRestoreProduct } from "@/entities/configuration";
import { resolveRuntimeProductType } from "@/entities/product/lib/resolveRuntimeProductType";
import { readConfigurationFragment, type ConfigurationFragment } from "@/features/saveConfiguration";

/**
 * Checks a saved configuration and turns it into what restore needs (C09).
 *
 * Runs before anything touches the scene: a payload that fails here never clears the
 * composition. A problem that does not stop the restore is kept as a warning.
 */

export type RestoreIssue = {
  code: string;
  message: string;
};

/** A countertop part (`Top_*`), saved next to the cabinets but not created by the restorer. */
export type RestoreTopConfig = {
  sourceId: string;
  productType: string;
  config: Record<string, unknown>;
};

export type RestorePlan = {
  configId: string;
  /** Cabinets in composition order, for the scene restorer. */
  products: SceneRestoreProduct[];
  topConfigs: RestoreTopConfig[];
  configuration: Record<string, unknown>;
  metadata: Record<string, unknown>;
  uiState: Record<string, unknown>;
  fragment: ConfigurationFragment;
  /** Saved before the fragment existed: no stable keys, values only in `uiState`. */
  isLegacy: boolean;
  /** Route the configuration was saved on, when it is an app path. */
  path: string | null;
  warnings: RestoreIssue[];
};

export type BuildRestorePlanResult = { ok: true; plan: RestorePlan } | { ok: false; issues: RestoreIssue[] };

/** A fragment that cannot be read at all; the rest only costs stable keys or values. */
const BLOCKING_FRAGMENT_ISSUES = new Set(["fragment.malformed"]);

const TYPE_KEYS = ["productType", "ProductType", "entityName", "EntityName"];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const isTopConfig = (sourceId: string, config: Record<string, unknown>): boolean => {
  const name =
    TYPE_KEYS.map((key) => config[key]).find(
      (value): value is string => typeof value === "string" && value.length > 0,
    ) ?? sourceId;

  return name.startsWith("Top_");
};

const readSavedOrder = (metadata: Record<string, unknown>, configuration: Record<string, unknown>): string[] => {
  const saved = Array.isArray(metadata.orderedProductIds)
    ? metadata.orderedProductIds.filter((id): id is string => typeof id === "string")
    : [];

  return saved.length > 0 ? saved : Object.keys(configuration);
};

export const buildRestorePlan = (configId: string, record: ConfigurationRecord): BuildRestorePlanResult => {
  if (!isRecord(record.configuration)) {
    return {
      ok: false,
      issues: [{ code: "record.invalid-configuration", message: "The saved configuration has no product configs." }],
    };
  }

  const configuration = record.configuration;
  const metadata = isRecord(record.metadata) ? record.metadata : {};
  const issues: RestoreIssue[] = [];
  const warnings: RestoreIssue[] = [];
  const products: SceneRestoreProduct[] = [];
  const topConfigs: RestoreTopConfig[] = [];

  for (const sourceId of readSavedOrder(metadata, configuration)) {
    const config = configuration[sourceId];

    if (!isRecord(config)) {
      issues.push({
        code: "record.missing-product",
        message: `Product ${sourceId} is in the saved order but has no config.`,
      });
      continue;
    }

    const productType = resolveRuntimeProductType(sourceId, config);

    if (isTopConfig(sourceId, config)) {
      topConfigs.push({ sourceId, productType, config });
    } else {
      products.push({ sourceId, productType, config });
    }
  }

  if (products.length === 0) {
    issues.push({ code: "record.no-cabinets", message: "The saved configuration has no cabinets." });
  }

  const { fragment, issues: fragmentIssues, isLegacy } = readConfigurationFragment(metadata);

  for (const issue of fragmentIssues) {
    // A payload saved before the fragment is expected; it is read from `uiState`.
    if (issue.code === "fragment.missing") continue;
    (BLOCKING_FRAGMENT_ISSUES.has(issue.code) ? issues : warnings).push(issue);
  }

  if (issues.length > 0) return { ok: false, issues };

  return {
    ok: true,
    plan: {
      configId,
      products,
      topConfigs,
      configuration,
      metadata,
      uiState: isRecord(metadata.uiState) ? metadata.uiState : {},
      fragment,
      isLegacy,
      path: typeof metadata.path === "string" && metadata.path.startsWith("/") ? metadata.path : null,
      warnings,
    },
  };
};
