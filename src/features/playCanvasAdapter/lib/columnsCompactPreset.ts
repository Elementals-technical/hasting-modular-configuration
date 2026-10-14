import type { SceneCompositionProduct, SceneProductDraft } from "@/entities/configuration";
import type {
  ConfiguratorCompactColumn,
  ConfiguratorCompactPreset,
  ConfiguratorPresetProduct,
} from "@/features/configuratorApi";

import type { CompactPresetSource } from "./applyCompactPreset";

/**
 * A collection whose scene lays its cabinets in columns (Urban Duplex) imports a compact preset
 * only as "urban-compact-v2": one row of places, each a cabinet of the full height or a column of
 * a cabinet hanging from the countertop plane (`top`) over one standing on the floor (`bottom`).
 *
 * Its presets are written as the other collections' Multi-Level models are: rows of the
 * collection's own products and values, the lower row at a negative elevation and shifted by
 * `offsetX`. Here a cabinet of the lower row that stands under one of the upper row becomes the
 * bottom of its column, shifted by the difference of their left edges, and the names and values
 * become the scene's.
 */

export type ColumnsCollection = {
  /** The scene's id of the collection. */
  sceneCollection: string;
  /** The height (cm) of the row's one tier: a lower cabinet of the upper row hangs from its top. */
  tierHeightCm: number;
  /** The countertop of a preset that names none. */
  countertopProductType: string;
};

const COLUMNS_COLLECTIONS: Readonly<Record<string, ColumnsCollection>> = {
  "urban-duplex": { sceneCollection: "UD", tierHeightCm: 56, countertopProductType: "Top_Solid" },
};

export const columnsCollectionOf = (collectionId: string | null | undefined): ColumnsCollection | null =>
  (collectionId ? COLUMNS_COLLECTIONS[collectionId] : undefined) ?? null;

/** A cabinet of the preset in the collection's names and values, under the key the scene's import gives it. */
export type ColumnsPresetCabinet = { key: string; product: SceneCompositionProduct };

export type ColumnsCompactPreset = {
  preset: ConfiguratorCompactPreset;
  /** In the order of the scene's keys: place by place, a column's top before its bottom. */
  cabinets: ColumnsPresetCabinet[];
};

/** Translates a product of the collection into the scene's names and values; null for an unknown type. */
export type PresetProductTranslator = (product: SceneCompositionProduct) => SceneProductDraft | null;

/** The scene's gap (cm) between neighbours of a row. */
const GAP_CM = 0.05;
/** How far (cm) a cabinet may land from where the preset puts it; less overlap is two neighbours touching. */
const TOLERANCE_CM = 0.5;

type Cabinet = {
  product: SceneCompositionProduct;
  scene: SceneProductDraft;
  leftCm: number;
  widthCm: number;
  heightCm: number;
};

type Place = { full: Cabinet } | { top: Cabinet | null; bottom: Cabinet | null };

const finiteNumber = (value: unknown): number | null => {
  const number = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  return typeof number === "number" && Number.isFinite(number) ? number : null;
};

const roundCm = (value: number) => Math.round(value * 100) / 100;

const overlapCm = (a: Cabinet, b: Cabinet) =>
  Math.min(a.leftCm + a.widthCm, b.leftCm + b.widthCm) - Math.max(a.leftCm, b.leftCm);

const cabinetsOf = (place: Place): Cabinet[] =>
  "full" in place ? [place.full] : [place.top, place.bottom].filter((cabinet): cabinet is Cabinet => cabinet !== null);

const leftOf = (place: Place) => Math.min(...cabinetsOf(place).map(({ leftCm }) => leftCm));

/** The bottom's left edge from the top's (cm); 0 unless the place holds both. */
const offsetOf = (place: Place) =>
  "full" in place || !place.top || !place.bottom ? 0 : roundCm(place.bottom.leftCm - place.top.leftCm);

/** Where the scene puts each cabinet of a place, from the place's left edge (its layoutColumnRow). */
const shiftOf = (place: Place, cabinet: Cabinet) => {
  const offset = offsetOf(place);
  if ("full" in place) return 0;
  return cabinet === place.top ? Math.max(0, -offset) : Math.max(0, offset);
};

/** The scene's item of a cabinet: its scene type and config; the scene names the product type itself. */
const itemOf = ({ scene }: Cabinet): ConfiguratorPresetProduct => ({
  name: scene.sceneType,
  ...Object.fromEntries(Object.entries(scene.config).filter(([key]) => key !== "productType")),
});

const labelOf = ({ product, leftCm }: Cabinet) => `${product.productType} at ${roundCm(leftCm)} cm`;

/**
 * The countertop's own keys. The import reads them from the countertop's entry alone, not from the
 * shared values, as a flat preset's countertop carries them; the sink cabinet holds the basin.
 */
const COUNTERTOP_KEYS = ["CountertopColor", "Thickness", "sinkType"];

const countertopOf = (cabinets: readonly Cabinet[], shared: Record<string, unknown>): Record<string, unknown> => {
  const sink = cabinets.find(({ scene }) => typeof scene.config.sinkType === "string" && scene.config.sinkType);
  return Object.fromEntries(
    COUNTERTOP_KEYS.flatMap((key) => {
      const value = sink?.scene.config[key] ?? shared[key];
      return value === undefined || value === null || value === "" ? [] : [[key, value]];
    }),
  );
};

/** The values every cabinet holds, and the cabinet colour most of them hold: the scene requires one. */
const sharedOf = (cabinets: readonly Cabinet[]): Record<string, unknown> => {
  const configs = cabinets.map(({ scene }) => scene.config);
  const shared = Object.fromEntries(
    Object.entries(configs[0] ?? {}).filter(
      ([key, value]) =>
        key !== "productType" && key !== "ProductType" && configs.every((config) => config[key] === value),
    ),
  );
  if (shared.CabinetColor !== undefined) return shared;

  const counts = new Map<unknown, number>();
  for (const { CabinetColor } of configs) {
    if (CabinetColor !== undefined) counts.set(CabinetColor, (counts.get(CabinetColor) ?? 0) + 1);
  }
  const [common] = [...counts].sort(([, left], [, right]) => right - left)[0] ?? [];
  return common === undefined ? shared : { ...shared, CabinetColor: common };
};

/**
 * The preset as the scene of a columns collection imports it. Throws when the preset cannot be
 * laid out as columns: a lower cabinet under two upper ones, under a cabinet of the full height,
 * or anywhere the scene would not put it.
 */
export const toColumnsCompactPreset = (
  source: CompactPresetSource,
  collection: ColumnsCollection,
  translate: PresetProductTranslator,
): ColumnsCompactPreset => {
  const rows = source.rows ?? [];
  if (!rows.length) throw new Error("The compact preset has no rows.");

  const shared = source.shared ?? {};
  const upperElevation = Math.max(...rows.map(({ elevation }) => elevation ?? 0));
  const upper: Cabinet[] = [];
  const lower: Cabinet[] = [];

  // Laid as the scene lays rows of cabinets: from the row's offset, or after the row before it.
  let cursorCm = 0;
  rows.forEach((row, index) => {
    let xCm = row.offsetX ?? (index === 0 ? 0 : cursorCm + GAP_CM);
    for (const { name, ...own } of row.products) {
      const product: SceneCompositionProduct = { productType: name, config: { ...shared, ...own } };
      const widthCm = finiteNumber(product.config.Width);
      const heightCm = finiteNumber(product.config.Height);
      if (!widthCm || widthCm <= 0 || !heightCm || heightCm <= 0) {
        throw new Error(`${name} of row ${index} has no width or height.`);
      }
      const scene = translate(product);
      if (!scene) throw new Error(`The collection has no scene type for "${name}".`);

      const cabinet = { product, scene, leftCm: xCm, widthCm, heightCm };
      ((row.elevation ?? 0) < upperElevation ? lower : upper).push(cabinet);
      xCm += widthCm + GAP_CM;
    }
    cursorCm = xCm - GAP_CM;
  });

  // A cabinet of the upper row lower than the tier hangs; one of the full height stands on the floor.
  const places: Place[] = upper.map((cabinet) =>
    cabinet.heightCm < collection.tierHeightCm ? { top: cabinet, bottom: null } : { full: cabinet },
  );
  for (const cabinet of lower) {
    const over = places.filter((place) =>
      cabinetsOf(place).some((other) => other !== cabinet && overlapCm(other, cabinet) > TOLERANCE_CM),
    );
    if (over.length === 0) {
      places.push({ top: null, bottom: cabinet });
      continue;
    }
    const [place] = over;
    if (over.length > 1 || "full" in place || place.bottom) {
      throw new Error(`${labelOf(cabinet)} does not stand under one hanging cabinet alone.`);
    }
    place.bottom = cabinet;
  }
  places.sort((left, right) => leftOf(left) - leftOf(right));

  // The scene lays the places edge to edge; each cabinet has to land where the preset puts it.
  const rowLeftCm = Math.min(...places.map(leftOf));
  let placeLeftCm = rowLeftCm;
  for (const place of places) {
    let placeWidthCm = 0;
    for (const cabinet of cabinetsOf(place)) {
      const shiftCm = shiftOf(place, cabinet);
      if (Math.abs(placeLeftCm + shiftCm - cabinet.leftCm) > TOLERANCE_CM) {
        throw new Error(`${labelOf(cabinet)} would be laid at ${roundCm(placeLeftCm + shiftCm)} cm.`);
      }
      placeWidthCm = Math.max(placeWidthCm, shiftCm + cabinet.widthCm);
    }
    placeLeftCm += placeWidthCm + GAP_CM;
  }

  const cabinets: ColumnsPresetCabinet[] = [];
  const keyed = (cabinet: Cabinet) => {
    cabinets.push({ key: `cabinet${cabinets.length}`, product: cabinet.product });
    return itemOf(cabinet);
  };
  const products = places.map((place): ConfiguratorPresetProduct | ConfiguratorCompactColumn => {
    if ("full" in place) return keyed(place.full);
    const column: ConfiguratorCompactColumn = {};
    if (place.top) column.top = keyed(place.top);
    if (place.bottom) {
      const offsetX = offsetOf(place);
      column.bottom = { ...keyed(place.bottom), ...(offsetX !== 0 ? { offsetX } : {}) };
    }
    return column;
  });

  const sceneShared = sharedOf([...upper, ...lower]);
  return {
    preset: {
      format: "urban-compact-v2",
      collection: collection.sceneCollection,
      shared: sceneShared,
      rows: [{ ...(roundCm(rowLeftCm) !== 0 ? { offsetX: roundCm(rowLeftCm) } : {}), products }],
      top: {
        productType: collection.countertopProductType,
        ...countertopOf([...upper, ...lower], sceneShared),
        ...(source.top as ConfiguratorCompactPreset["top"]),
      },
      ...(source.featureSettings && Object.keys(source.featureSettings).length
        ? { featureSettings: source.featureSettings }
        : {}),
    },
    cabinets,
  };
};
