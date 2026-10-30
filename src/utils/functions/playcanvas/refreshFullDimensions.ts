import { getOrderedProductIds } from "./getOrderedProductIds";
import { getConfig } from "./getConfig";
import { showDimensions, hideDimensions, type DimensionsPayload, type HeightSegmentsPayload } from "./showDimensions";
import { getDimensionTool } from "./getDimensionTool";
import { cmToInch, inchToCm } from "@/utils/units";
import { SIDE_PANEL_WIDTH_CM } from "@/shared/lib/sku";
import { getRememberedSidePanels } from "./sidePanels";
import { readScenePositionsM, type ScenePositionM } from "./sceneBridge";

type FullDimensionsOptions = {
  panelWidthCm?: number;
  countertopThickness?: string | number | null;
  unit?: FullDimensionsUnit;
};

export type FullDimensionsUnit = "in" | "cm";

const DEFAULT_FULL_DIMENSIONS_UNIT: FullDimensionsUnit = "in";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const parseFiniteNumber = (value: unknown) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.trim().replace(/"$/, "").replace(",", "."));
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  if (isRecord(value)) {
    const firstKey = Object.keys(value)[0];
    if (!firstKey) return undefined;

    return parseFiniteNumber(firstKey);
  }

  return undefined;
};

const readNumericConfigValue = (config: unknown, key: "Width" | "Height" | "Depth") => {
  if (!isRecord(config)) return undefined;

  return parseFiniteNumber(config[key]);
};

const readCountertopThicknessInches = (config: unknown) => {
  if (!isRecord(config)) return undefined;

  return parseFiniteNumber(config.Thickness);
};

const formatNumber = (value: number) => {
  const normalized = Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.?0+$/, "");
  return normalized;
};

const formatDimensionLabel = (valueCm: number | undefined, unit: FullDimensionsUnit) => {
  if (typeof valueCm !== "number") return "";

  if (unit === "cm") {
    return `${formatNumber(valueCm)} cm`;
  }

  return `${formatNumber(cmToInch(valueCm))} "`;
};

const formatThicknessLabel = (valueInches?: number, unit: FullDimensionsUnit = DEFAULT_FULL_DIMENSIONS_UNIT) => {
  if (typeof valueInches !== "number") return "";

  if (unit === "cm") {
    return `${formatNumber(inchToCm(valueInches))} cm`;
  }

  return `${formatNumber(valueInches)} "`;
};

const buildHeightSegments = (
  cabinetHeightCm: number,
  countertopThicknessInches: number,
  unit: FullDimensionsUnit,
): HeightSegmentsPayload | undefined => {
  const segmentDefinitions = [
    { key: "cabinet", label: formatDimensionLabel(cabinetHeightCm, unit), valueCm: cabinetHeightCm },
    {
      key: "countertop",
      label: formatThicknessLabel(countertopThicknessInches, unit),
      valueCm: inchToCm(countertopThicknessInches),
    },
  ].filter(({ valueCm }) => valueCm > 0);

  if (segmentDefinitions.length < 2) return undefined;

  return Object.fromEntries(
    segmentDefinitions.map(({ key, label }) => [
      key,
      {
        label,
      },
    ]),
  );
};

/** A placed product: its scene config (`getConfig`) and where the scene shows it, in the composition's order. */
export type FullDimensionsProduct = { node: string; config: unknown; positionM: ScenePositionM | null };

export type FullDimensionsPayloadOptions = FullDimensionsOptions & {
  /** The side panels the scene took, per side (`getRememberedSidePanels`). */
  sidePanels: { left: string; right: string };
};

const LINE_OFFSET_M = 0.05;
/** Bottoms this close (cm) stand on one level: a sink base a few cm above its side shelf is not a second level. */
const LEVEL_TOLERANCE_CM = 10;
/** The width lines of each level above the lowest stand this much (m) further below the box, so they do not overlap. */
const LEVEL_LINE_GAP_M = 0.06;

type MeasuredProduct = {
  node: string;
  width: number | undefined;
  height: number | undefined;
  /** Centre along the wall and bottom, cm. */
  centreX: number | undefined;
  bottom: number | undefined;
};

/**
 * Level of each product, counted from the lowest; null when the composition stands on one level
 * or a product has no position.
 */
const resolveLevels = (products: readonly MeasuredProduct[]): number[] | null => {
  if (
    products.some(
      ({ width, centreX, bottom }) => bottom === undefined || (width !== undefined && centreX === undefined),
    )
  )
    return null;

  const byBottom = products
    .map(({ bottom }, index) => ({ index, bottom: bottom ?? 0 }))
    .sort((a, b) => a.bottom - b.bottom);
  const levels = new Array<number>(products.length).fill(0);
  let level = 0;
  let levelBottom = byBottom[0]?.bottom ?? 0;
  for (const { index, bottom } of byBottom) {
    if (bottom - levelBottom > LEVEL_TOLERANCE_CM) {
      level += 1;
      levelBottom = bottom;
    }
    levels[index] = level;
  }
  return level > 0 ? levels : null;
};

/** From the leftmost cabinet edge to the rightmost, and from the lowest bottom to the highest top, cm. */
const measureLevels = (products: readonly MeasuredProduct[]) => {
  let left = Infinity;
  let right = -Infinity;
  let bottom = Infinity;
  let top = -Infinity;
  for (const product of products) {
    if (product.width !== undefined && product.centreX !== undefined) {
      left = Math.min(left, product.centreX - product.width / 2);
      right = Math.max(right, product.centreX + product.width / 2);
    }
    if (product.height !== undefined && product.bottom !== undefined) {
      bottom = Math.min(bottom, product.bottom);
      top = Math.max(top, product.bottom + product.height);
    }
  }
  // Rounded to whole cm: the scene leaves 0.05 cm between two cabinets of a row.
  return {
    width: Number.isFinite(right - left) ? Math.round(right - left) : 0,
    height: Number.isFinite(top - bottom) ? Math.round(top - bottom) : 0,
  };
};

/**
 * The Full Dimensions overlay of the placed products. One level: the sum of the widths and the tallest
 * cabinet. Several levels (multi-level compositions): the whole composition, and the width lines of
 * each level on a row of their own. The countertop's overhang is not counted.
 */
export const buildFullDimensionsPayload = (
  products: readonly FullDimensionsProduct[],
  options: FullDimensionsPayloadOptions,
): DimensionsPayload => {
  const unit = options.unit ?? DEFAULT_FULL_DIMENSIONS_UNIT;
  const configs = products.map(({ config }) => config);
  const measured = products.map(
    ({ node, config, positionM }): MeasuredProduct => ({
      node,
      width: readNumericConfigValue(config, "Width"),
      height: readNumericConfigValue(config, "Height"),
      centreX: positionM ? positionM.x * 100 : undefined,
      bottom: positionM ? positionM.y * 100 : undefined,
    }),
  );
  const levels = resolveLevels(measured);
  const levelSize = levels ? measureLevels(measured) : null;

  const { sidePanels, panelWidthCm = SIDE_PANEL_WIDTH_CM } = options;
  const sidePanelsCm =
    (sidePanels.left !== "None" ? panelWidthCm : 0) + (sidePanels.right !== "None" ? panelWidthCm : 0);
  const totalWidth = (levelSize?.width ?? measured.reduce((sum, item) => sum + (item.width ?? 0), 0)) + sidePanelsCm;

  const maxHeight =
    levelSize?.height ??
    configs.reduce<number>((max, config) => {
      const value = readNumericConfigValue(config, "Height");
      return Math.max(max, value ?? 0);
    }, 0);
  const fallbackThicknessInches = parseFiniteNumber(options.countertopThickness);
  const maxCountertopThicknessInches = configs.reduce<number>((max, config) => {
    const value = readCountertopThicknessInches(config);
    return Math.max(max, value ?? 0);
  }, fallbackThicknessInches ?? 0);
  const totalHeight = maxHeight + inchToCm(maxCountertopThicknessInches);
  const heightSegments = buildHeightSegments(maxHeight, maxCountertopThicknessInches, unit);

  const maxDepth = configs.reduce<number>((max, config) => {
    const value = readNumericConfigValue(config, "Depth");
    return Math.max(max, value ?? 0);
  }, 0);

  return {
    box: {
      nodes: products.map(({ node }) => node),
      width: { label: formatDimensionLabel(totalWidth, unit), offset: LINE_OFFSET_M },
      depth: { label: formatDimensionLabel(maxDepth, unit) },
      ...(heightSegments
        ? { heightSegments }
        : { height: { label: formatDimensionLabel(totalHeight, unit) } }),
    },
    lines: measured.map(({ node, width }, index) => {
      const level = levels?.[index] ?? 0;
      return {
        node,
        axis: "x",
        label: formatDimensionLabel(width, unit),
        ...(level > 0 ? { offset: LINE_OFFSET_M + level * LEVEL_LINE_GAP_M } : {}),
      };
    }),
    labelSettings: {
      offset: LINE_OFFSET_M,
      labelGap: "auto",
      labelPosition: "center",
      units: unit,
      decimals: 2,
    },
  };
};

/**
 * Computes full dimensions from all products in the scene and calls showDimensions().
 * Returns true if dimensions were shown, false otherwise.
 */
export async function computeAndShowFullDimensions(options: FullDimensionsOptions = {}): Promise<boolean> {
  const ids = getOrderedProductIds();
  if (!ids.length) {
    hideDimensions();
    return false;
  }

  const configs = await Promise.all(ids.map((id) => getConfig(id)));
  const positions = readScenePositionsM(ids);

  const didShow = showDimensions(
    buildFullDimensionsPayload(
      ids.map((node, index) => ({ node, config: configs[index], positionM: positions[node] ?? null })),
      { ...options, sidePanels: getRememberedSidePanels() },
    ),
  );

  if (didShow) {
    const tool = getDimensionTool();
    tool?.setEnabled(false);
  }

  return didShow;
}
