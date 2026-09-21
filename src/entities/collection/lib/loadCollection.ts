import type { ZodType } from "zod";

import { CORE_ATTRIBUTE_IDS } from "@/entities/configuration/model/ownership";
import { buildCabinetCatalogFromMatrix } from "@/entities/product/lib/matrixCabinet";
import { parseCountertopMatrix } from "@/features/configurator-rule-core/countertop/parse";

import type { CustomizationSchema } from "../model/customizationSchema";
import type { CollectionDiagnostic } from "../model/diagnostics";
import { CollectionDataError } from "../model/errors";
import type { ProductProfile } from "../model/productProfile";
import type { RuntimeBindingSet } from "../model/runtimeBindings";
import {
  cabinetSkuMappingsSchema,
  collectionSkuProfileSchema,
  configuratorSchema,
  countertopDatatableSchema,
  navigationSchema,
  presetsSchema,
  productDatatableSchema,
  staticOptionsSchema,
  type CollectionManifest,
  type CollectionRegistry,
} from "../model/schemas";
import type {
  CollectionRuntimeDependencies,
  LoadedCollectionData,
  LocalCollectionSources,
  RemoteCollectionSources,
} from "../model/types";
import { deriveCollectionNavigation, findNavigationMismatch } from "./customization/deriveCollectionNavigation";
import { validateCustomizationSchema } from "./customization/validateCustomizationSchema";
import { parseProductProfile } from "./parseProductProfile";
import type { CollectionResolution } from "./resolveCollection";
import { resolveCollectionImageUrl, resolveCollectionJsonUrl } from "./paths";
import {
  collectCustomizationAttributeIds,
  validateCollectionRuntimeContract,
} from "./runtimeBindings/collectionRuntimeContract";
import { parseRuntimeBindings } from "./runtimeBindings/parseRuntimeBindings";
import { validateCollectionManifest, validateCollectionRegistry } from "./validation";

const parseSource = <T>(schema: ZodType<T>, input: unknown, sourceName: string): T => {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new CollectionDataError(
      "source-validation-failed",
      `${sourceName} failed validation: ${result.error.message}`,
      {
        cause: result.error,
      },
    );
  }
  return result.data;
};

const fetchSource = async <T>(
  schema: ZodType<T>,
  reference: string,
  manifestUrl: string,
  dependencies: CollectionRuntimeDependencies,
  signal: AbortSignal,
  sourceName: string,
): Promise<T> => {
  const url = resolveCollectionJsonUrl(reference, manifestUrl, dependencies.collectionsRootUrl);
  try {
    return parseSource(schema, await dependencies.fetchJson(url, signal), sourceName);
  } catch (error) {
    if (error instanceof CollectionDataError) throw error;
    throw new CollectionDataError("source-load-failed", `${sourceName} could not be loaded`, { cause: error });
  }
};

/**
 * Loads the ProductProfile.
 *
 * Validated by `parseProductProfile` instead of a zod schema: the profile contract
 * belongs to C, and its diagnostics carry the exact data path of a bad entry, which a
 * second schema here would only duplicate and eventually contradict.
 */
const fetchProductProfile = async (
  reference: string,
  manifestUrl: string,
  dependencies: CollectionRuntimeDependencies,
  signal: AbortSignal,
): Promise<ProductProfile> => {
  const url = resolveCollectionJsonUrl(reference, manifestUrl, dependencies.collectionsRootUrl);

  let input: unknown;
  try {
    input = await dependencies.fetchJson(url, signal);
  } catch (error) {
    throw new CollectionDataError("source-load-failed", "Product profile could not be loaded", { cause: error });
  }

  const result = parseProductProfile(input);

  if (!result.ok) {
    const details = result.diagnostics.map(({ code, dataPath }) => `${dataPath} (${code})`).join(", ");
    // The diagnostics travel in `cause` as well as in the message: `toCollectionError`
    // passes `cause` through, so a consumer can group or render them without parsing
    // the text back apart.
    throw new CollectionDataError("source-validation-failed", `Product profile failed validation: ${details}`, {
      cause: result.diagnostics,
    });
  }

  return result.profile;
};

const fetchCustomizationSchema = async (
  reference: string,
  manifestUrl: string,
  dependencies: CollectionRuntimeDependencies,
  signal: AbortSignal,
): Promise<CustomizationSchema> => {
  const url = resolveCollectionJsonUrl(reference, manifestUrl, dependencies.collectionsRootUrl);

  let input: unknown;
  try {
    input = await dependencies.fetchJson(url, signal);
  } catch (error) {
    throw new CollectionDataError("source-load-failed", "Customization schema could not be loaded", { cause: error });
  }

  const result = validateCustomizationSchema(input);
  if (!result.ok) {
    const details = result.diagnostics.map(({ code, dataPath }) => `${dataPath} (${code})`).join(", ");
    throw new CollectionDataError("source-validation-failed", `Customization schema failed validation: ${details}`, {
      cause: result.diagnostics,
    });
  }

  return result.schema;
};

const fetchRuntimeBindings = async (
  reference: string,
  manifestUrl: string,
  dependencies: CollectionRuntimeDependencies,
  signal: AbortSignal,
): Promise<RuntimeBindingSet> => {
  const url = resolveCollectionJsonUrl(reference, manifestUrl, dependencies.collectionsRootUrl);

  let input: unknown;
  try {
    input = await dependencies.fetchJson(url, signal);
  } catch (error) {
    throw new CollectionDataError("source-load-failed", "Runtime bindings could not be loaded", { cause: error });
  }

  const result = parseRuntimeBindings(input);
  if (!result.ok) {
    const diagnostics: CollectionDiagnostic[] = result.diagnostics.map(({ code, dataPath, message }) => ({
      code,
      severity: "error",
      dataset: "runtimeBindings",
      dataPath,
      message,
    }));
    const details = diagnostics.map(({ code, dataPath }) => `${dataPath} (${code})`).join(", ");
    throw new CollectionDataError("source-validation-failed", `Runtime bindings failed validation: ${details}`, {
      cause: diagnostics,
    });
  }

  return result.bindings;
};

const validateCustomizationContract = (
  manifest: CollectionManifest,
  navigation: LocalCollectionSources["navigation"],
  ui: LocalCollectionSources["ui"],
) => {
  if (!ui) return;

  if (ui.collectionId !== manifest.id) {
    throw new CollectionDataError(
      "source-validation-failed",
      `Customization schema collectionId "${ui.collectionId}" does not match manifest "${manifest.id}"`,
      {
        cause: {
          code: "collection-mismatch",
          dataPath: "collectionId",
          expected: manifest.id,
          actual: ui.collectionId,
        },
      },
    );
  }

  if (!navigation) return;

  const mismatch = findNavigationMismatch(deriveCollectionNavigation(ui), navigation);
  if (mismatch) {
    throw new CollectionDataError(
      "source-validation-failed",
      `Navigation data does not match customization schema at ${mismatch}`,
      { cause: { code: "navigation-mismatch", dataPath: mismatch } },
    );
  }
};

const validateLocalContracts = (
  manifest: CollectionManifest,
  local: LocalCollectionSources,
): CollectionDiagnostic[] => {
  const diagnostics: CollectionDiagnostic[] = [];

  if (local.productProfile && local.productProfile.collectionId !== manifest.id) {
    diagnostics.push({
      code: "profile.collection-mismatch",
      severity: "error",
      dataset: "productProfile",
      dataPath: "/collectionId",
      message: `ProductProfile collectionId "${local.productProfile.collectionId}" does not match manifest "${manifest.id}"`,
    });
  }

  if (local.runtimeBindings) {
    if (!local.productProfile) {
      diagnostics.push({
        code: "runtime.missing-product-profile",
        severity: "error",
        dataset: "runtimeBindings",
        dataPath: "/",
        message: "Runtime bindings require a ProductProfile for semantic validation",
      });
    } else {
      const requiredAttributeIds = [
        ...new Set([...CORE_ATTRIBUTE_IDS, ...collectCustomizationAttributeIds(local.ui), "Height", "Width", "Depth"]),
      ];
      diagnostics.push(
        ...validateCollectionRuntimeContract(local.productProfile, local.runtimeBindings, requiredAttributeIds),
      );
    }
  }

  const errors = diagnostics.filter(({ severity }) => severity === "error");
  if (errors.length > 0) {
    const details = errors.map(({ code, dataPath }) => `${dataPath ?? "/"} (${code})`).join(", ");
    throw new CollectionDataError("source-validation-failed", `Collection contract failed validation: ${details}`, {
      cause: diagnostics,
    });
  }

  return diagnostics;
};

export const loadCollectionRegistry = async (
  dependencies: CollectionRuntimeDependencies,
  signal: AbortSignal,
): Promise<CollectionRegistry> => {
  if (dependencies.registry) {
    return validateCollectionRegistry(dependencies.registry, dependencies.registryUrl, dependencies.collectionsRootUrl);
  }

  try {
    const input = await dependencies.fetchJson(dependencies.registryUrl, signal);
    return validateCollectionRegistry(input, dependencies.registryUrl, dependencies.collectionsRootUrl);
  } catch (error) {
    if (error instanceof CollectionDataError) throw error;
    throw new CollectionDataError("source-load-failed", "Collection registry could not be loaded", { cause: error });
  }
};

const loadLocalSources = async (
  manifest: CollectionManifest,
  manifestUrl: string,
  dependencies: CollectionRuntimeDependencies,
  signal: AbortSignal,
): Promise<LocalCollectionSources> => {
  const local = manifest.local;
  if (!local) return {};

  const [navigation, presets, staticOptions, cabinetSkuMappings, skuProfile, productProfile, ui, runtimeBindings] =
    await Promise.all([
      local.navigation
        ? fetchSource(navigationSchema, local.navigation, manifestUrl, dependencies, signal, "Navigation data")
        : undefined,
      local.presets
        ? fetchSource(presetsSchema, local.presets, manifestUrl, dependencies, signal, "Preset data")
        : undefined,
      local.staticOptions
        ? fetchSource(staticOptionsSchema, local.staticOptions, manifestUrl, dependencies, signal, "Static option data")
        : undefined,
      local.cabinetSkuMappings
        ? fetchSource(
            cabinetSkuMappingsSchema,
            local.cabinetSkuMappings,
            manifestUrl,
            dependencies,
            signal,
            "Cabinet SKU mappings",
          )
        : undefined,
      local.skuProfile
        ? fetchSource(collectionSkuProfileSchema, local.skuProfile, manifestUrl, dependencies, signal, "SKU profile")
        : undefined,
      local.productProfile ? fetchProductProfile(local.productProfile, manifestUrl, dependencies, signal) : undefined,
      local.ui ? fetchCustomizationSchema(local.ui, manifestUrl, dependencies, signal) : undefined,
      local.runtimeBindings
        ? fetchRuntimeBindings(local.runtimeBindings, manifestUrl, dependencies, signal)
        : undefined,
    ]);

  validateCustomizationContract(manifest, navigation, ui);

  return {
    navigation,
    presets: presets?.map((preset) => ({
      ...preset,
      img: resolveCollectionImageUrl(preset.img, manifestUrl, dependencies.collectionsRootUrl),
    })),
    staticOptions,
    cabinetSkuMappings,
    skuProfile,
    productProfile,
    ui,
    runtimeBindings,
  };
};

const loadRemoteSources = async (
  manifest: CollectionManifest,
  dependencies: CollectionRuntimeDependencies,
  signal: AbortSignal,
): Promise<RemoteCollectionSources> => {
  const remote = manifest.remote;
  const overrides = dependencies.sourceOverrides?.[manifest.id];
  if (!remote && !overrides) return {};

  const [configurator, countertopTable, cabinetTable] = await Promise.all([
    overrides?.configurator
      ? Promise.resolve(parseSource(configuratorSchema, overrides.configurator, "Injected configurator data"))
      : remote?.configurator
        ? dependencies.remote
            .loadConfigurator(remote.configurator, signal)
            .then((input) => parseSource(configuratorSchema, input, "Configurator data"))
        : undefined,
    overrides?.countertopTable
      ? Promise.resolve(parseSource(countertopDatatableSchema, overrides.countertopTable, "Injected countertop table"))
      : remote?.countertopTable
        ? dependencies.remote
            .loadCountertopTable(remote.countertopTable.id, signal)
            .then((input) => parseSource(countertopDatatableSchema, input, "Countertop table"))
        : undefined,
    overrides?.cabinetTable
      ? Promise.resolve(parseSource(productDatatableSchema, overrides.cabinetTable, "Injected cabinet table"))
      : remote?.cabinetTable
        ? dependencies.remote
            .loadCabinetTable(remote.cabinetTable.id, signal)
            .then((input) => parseSource(productDatatableSchema, input, "Cabinet table"))
        : undefined,
  ]);

  return { configurator, countertopTable, cabinetTable };
};

export const assembleCollectionData = (
  manifest: CollectionManifest,
  local: LocalCollectionSources,
  remote: RemoteCollectionSources,
  diagnostics: CollectionDiagnostic[] = [],
): LoadedCollectionData => {
  const configuratorGroups = remote.configurator?.availableOptions;
  return {
    id: manifest.id,
    manifest,
    diagnostics,
    sources: { local, remote },
    catalog: {
      navigation: local.ui ? deriveCollectionNavigation(local.ui) : local.navigation,
      presets: local.presets,
      staticOptions: local.staticOptions,
      cabinetSkuMappings: local.cabinetSkuMappings,
      skuProfile: local.skuProfile,
      configurator: configuratorGroups
        ? {
            groups: configuratorGroups,
            groupsByName: Object.fromEntries(configuratorGroups.map((group) => [group.proxyName, group])),
          }
        : undefined,
      productProfile: local.productProfile,
      customization: local.ui,
      runtimeBindings: local.runtimeBindings,
      // Normalized against the profile: the handle -> column mapping of the legacy
      // matrix comes from data, so a collection with different handles needs no code
      // change here. Without a profile the parser falls back to the hardcoded USH
      // columns, which is right for USH and silently wrong for anything else.
      cabinets: remote.cabinetTable
        ? buildCabinetCatalogFromMatrix(remote.cabinetTable, local.productProfile ?? null)
        : undefined,
      countertops: remote.countertopTable ? parseCountertopMatrix(remote.countertopTable) : undefined,
    },
  };
};

export const loadResolvedCollection = async (
  resolution: Extract<CollectionResolution, { ok: true }>,
  dependencies: CollectionRuntimeDependencies,
  signal: AbortSignal,
): Promise<LoadedCollectionData> => {
  const manifestUrl = resolveCollectionJsonUrl(
    resolution.entry.manifest,
    dependencies.registryUrl,
    dependencies.collectionsRootUrl,
  );

  let manifest: CollectionManifest;
  try {
    const manifestInput = await dependencies.fetchJson(manifestUrl, signal);
    manifest = validateCollectionManifest(
      manifestInput,
      resolution.collectionId,
      manifestUrl,
      dependencies.collectionsRootUrl,
    );
  } catch (error) {
    if (error instanceof CollectionDataError) throw error;
    throw new CollectionDataError("source-load-failed", `Manifest for ${resolution.collectionId} could not be loaded`, {
      cause: error,
    });
  }

  const [local, remote] = await Promise.all([
    loadLocalSources(manifest, manifestUrl, dependencies, signal),
    loadRemoteSources(manifest, dependencies, signal),
  ]);
  const diagnostics = validateLocalContracts(manifest, local);
  return assembleCollectionData(manifest, local, remote, diagnostics);
};

export const defaultFetchJson = async (url: string, signal: AbortSignal): Promise<unknown> => {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Request failed with ${response.status} for ${url}`);
  return response.json();
};
