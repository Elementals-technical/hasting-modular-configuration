import type { Configurator, ConfiguratorAvailableOption } from "@/entities/configurator/api/types";
import type { CountertopDatatable } from "@/entities/countertop/api/types";
import type { ProductDatatable } from "@/entities/product/api/types";
import type { ConfiguratorCatalog } from "@/shared/config/configurator/typeCabinetCatalog";
import type { CountertopMatrixRule } from "@/features/configurator-rule-core/countertop/types";

import type { ProductProfile } from "./productProfile";

import type { CollectionError } from "./errors";
import type {
  CabinetSkuMappings,
  CollectionManifest,
  CollectionNavigation,
  CollectionPreset,
  CollectionRegistry,
  CollectionStaticOptions,
} from "./schemas";

export type LocalCollectionSources = {
  navigation?: CollectionNavigation;
  presets?: CollectionPreset[];
  staticOptions?: CollectionStaticOptions;
  cabinetSkuMappings?: CabinetSkuMappings;
  productProfile?: ProductProfile;
};

export type RemoteCollectionSources = {
  configurator?: Configurator;
  countertopTable?: CountertopDatatable;
  cabinetTable?: ProductDatatable;
};

export type ConfiguratorGroupCatalog = {
  groups: ConfiguratorAvailableOption[];
  groupsByName: Record<string, ConfiguratorAvailableOption>;
};

export type LoadedCollectionData = {
  id: string;
  manifest: CollectionManifest;
  sources: {
    local: LocalCollectionSources;
    remote: RemoteCollectionSources;
  };
  catalog: {
    navigation?: CollectionNavigation;
    presets?: CollectionPreset[];
    staticOptions?: CollectionStaticOptions;
    cabinetSkuMappings?: CabinetSkuMappings;
    /**
     * Product data driving the rules. `cabinets` below is normalized against it, so an
     * option added here reaches the rules without a code change.
     */
    productProfile?: ProductProfile;
    configurator?: ConfiguratorGroupCatalog;
    cabinets?: ConfiguratorCatalog;
    countertops?: CountertopMatrixRule[];
  };
};

export type ActiveCollectionState =
  | { status: "resolving" }
  | { status: "loading"; collectionId: string }
  | { status: "ready"; collectionId: string; data: LoadedCollectionData }
  | { status: "error"; collectionId?: string; error: CollectionError };

export type RemoteCollectionLoader = {
  loadConfigurator: (reference: NonNullable<CollectionManifest["remote"]>["configurator"], signal: AbortSignal) => Promise<unknown>;
  loadCountertopTable: (id: string | number, signal: AbortSignal) => Promise<unknown>;
  loadCabinetTable: (id: string | number, signal: AbortSignal) => Promise<unknown>;
};

export type CollectionRuntimeDependencies = {
  registryUrl: string;
  collectionsRootUrl: string;
  fetchJson: (url: string, signal: AbortSignal) => Promise<unknown>;
  remote: RemoteCollectionLoader;
  registry?: CollectionRegistry;
  sourceOverrides?: Record<string, RemoteCollectionSources>;
};
