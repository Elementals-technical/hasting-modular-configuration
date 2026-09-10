import type { ZodType } from "zod";

import { buildCabinetCatalogFromMatrix } from "@/entities/product/lib/matrixCabinet";
import { parseCountertopMatrix } from "@/features/configurator-rule-core/countertop/parse";

import { CollectionDataError } from "../model/errors";
import {
  cabinetSkuMappingsSchema,
  configuratorSchema,
  countertopDatatableSchema,
  navigationSchema,
  presetsSchema,
  productDatatableSchema,
  staticOptionsSchema,
  type CollectionManifest,
  type CollectionRegistry,
} from "../model/schemas";
import type { ProductProfile } from "../model/productProfile";
import type {
  CollectionRuntimeDependencies,
  LoadedCollectionData,
  LocalCollectionSources,
  RemoteCollectionSources,
} from "../model/types";
import { parseProductProfile } from "./parseProductProfile";
import type { CollectionResolution } from "./resolveCollection";
import { resolveCollectionImageUrl, resolveCollectionJsonUrl } from "./paths";
import { validateCollectionManifest, validateCollectionRegistry } from "./validation";

const parseSource = <T>(schema: ZodType<T>, input: unknown, sourceName: string): T => {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new CollectionDataError("source-validation-failed", `${sourceName} failed validation: ${result.error.message}`, {
      cause: result.error,
    });
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

export const loadCollectionRegistry = async (
  dependencies: CollectionRuntimeDependencies,
  signal: AbortSignal,
): Promise<CollectionRegistry> => {
  if (dependencies.registry) {
    return validateCollectionRegistry(
      dependencies.registry,
      dependencies.registryUrl,
      dependencies.collectionsRootUrl,
    );
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

  const [navigation, presets, staticOptions, cabinetSkuMappings, productProfile] = await Promise.all([
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
    local.productProfile
      ? fetchProductProfile(local.productProfile, manifestUrl, dependencies, signal)
      : undefined,
  ]);

  return {
    navigation,
    presets: presets?.map((preset) => ({
      ...preset,
      img: resolveCollectionImageUrl(preset.img, manifestUrl, dependencies.collectionsRootUrl),
    })),
    staticOptions,
    cabinetSkuMappings,
    productProfile,
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
): LoadedCollectionData => {
  const configuratorGroups = remote.configurator?.availableOptions;
  return {
    id: manifest.id,
    manifest,
    sources: { local, remote },
    catalog: {
      navigation: local.navigation,
      presets: local.presets,
      staticOptions: local.staticOptions,
      cabinetSkuMappings: local.cabinetSkuMappings,
      configurator: configuratorGroups
        ? {
            groups: configuratorGroups,
            groupsByName: Object.fromEntries(configuratorGroups.map((group) => [group.proxyName, group])),
          }
        : undefined,
      productProfile: local.productProfile,
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
  return assembleCollectionData(manifest, local, remote);
};

export const defaultFetchJson = async (url: string, signal: AbortSignal): Promise<unknown> => {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Request failed with ${response.status} for ${url}`);
  return response.json();
};
