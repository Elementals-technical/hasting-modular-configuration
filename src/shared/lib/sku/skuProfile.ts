import type { CabinetSkuMappings } from "@/entities/collection/model/schemas";

/**
 * How the active collection spells its pricing SKUs (D01).
 *
 * The builders keep the SKU grammar; the collection supplies the words: its series per
 * product group and the option -> code mappings A loads from `cabinet-sku-mappings.json`.
 */

/** Series token of each product group, e.g. USH cabinets are `VAN-URSTD-…`. */
export type SkuSeries = {
  cabinet: string;
  openShelf: string;
  openSideShelf: string;
  sidePanel: string;
  divider: string;
  towelBar: string;
  bookMatching: string;
  /** Countertop series is this prefix plus the countertop material SKU (`UR` + `FX` → `URFX`). */
  countertopPrefix: string;
  /** Material that completes the countertop series when none is resolved. */
  countertopDefaultMaterial: string;
  /** Token written for a value the mappings do not know. */
  fallback: string;
};

export type SkuProfile = {
  collectionId: string;
  series: SkuSeries;
  cabinetMappings: CabinetSkuMappings;
};

export type SkuProfileUnsupportedReason =
  /** No collection is active yet. */
  | "no-collection"
  /** The collection has no SKU series: its prices cannot be requested. */
  | "no-sku-series"
  /** The collection declares no cabinet SKU mappings. */
  | "no-cabinet-mappings";

export type SkuProfileResolution =
  | { status: "ready"; profile: SkuProfile }
  | { status: "unsupported"; collectionId: string | null; reason: SkuProfileUnsupportedReason };
