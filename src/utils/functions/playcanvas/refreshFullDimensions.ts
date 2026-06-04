import { getOrderedProductIds } from "./getOrderedProductIds";
import { getConfig } from "./getConfig";
import { showDimensions, hideDimensions, type HeightSegmentsPayload } from "./showDimensions";
import { getDimensionTool } from "./getDimensionTool";
import { cmToInch, inchToCm } from "@/utils/units";
import { SIDE_PANEL_WIDTH_CM } from "@/shared/lib/sku";
import { getRememberedSidePanels } from "./sidePanels";

type FullDimensionsOptions = {
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

/**
 * Computes full dimensions from all products in the scene and calls showDimensions().
 * Returns true if dimensions were shown, false otherwise.
 */
export async function computeAndShowFullDimensions(options: FullDimensionsOptions = {}): Promise<boolean> {
  const unit = options.unit ?? DEFAULT_FULL_DIMENSIONS_UNIT;
  const ids = getOrderedProductIds();
  if (!ids.length) {
    hideDimensions();
    return false;
  }

  const configs = await Promise.all(ids.map((id) => getConfig(id)));

  const widthByNode = ids.map((id, index) => ({
    node: id,
    width: readNumericConfigValue(configs[index], "Width"),
  }));

  const sidePanels = getRememberedSidePanels();
  const sidePanelsCm =
    (sidePanels.left !== "None" ? SIDE_PANEL_WIDTH_CM : 0) +
    (sidePanels.right !== "None" ? SIDE_PANEL_WIDTH_CM : 0);
  const totalWidth = widthByNode.reduce((sum, item) => sum + (item.width ?? 0), 0) + sidePanelsCm;

  const maxHeight = configs.reduce((max, config) => {
    const value = readNumericConfigValue(config, "Height");
    return Math.max(max, value ?? 0);
  }, 0);
  const fallbackThicknessInches = parseFiniteNumber(options.countertopThickness);
  const maxCountertopThicknessInches = configs.reduce((max, config) => {
    const value = readCountertopThicknessInches(config);
    return Math.max(max, value ?? 0);
  }, fallbackThicknessInches ?? 0);
  const totalHeight = maxHeight + inchToCm(maxCountertopThicknessInches);
  const heightSegments = buildHeightSegments(maxHeight, maxCountertopThicknessInches, unit);

  const maxDepth = configs.reduce((max, config) => {
    const value = readNumericConfigValue(config, "Depth");
    return Math.max(max, value ?? 0);
  }, 0);

  const didShow = showDimensions({
    box: {
      nodes: ids,
      width: { label: formatDimensionLabel(totalWidth, unit), offset: 0.05 },
      depth: { label: formatDimensionLabel(maxDepth, unit) },
      ...(heightSegments
        ? { heightSegments }
        : { height: { label: formatDimensionLabel(totalHeight, unit) } }),
    },
    lines: widthByNode.map(({ node, width }) => ({
      node,
      axis: "x",
      label: formatDimensionLabel(width, unit),
    })),
    labelSettings: {
      offset: 0.05,
      labelGap: "auto",
      labelPosition: "center",
      units: unit,
      decimals: 2,
    },
  });

  if (didShow) {
    const tool = getDimensionTool();
    tool?.setEnabled(false);
  }

  return didShow;
}
