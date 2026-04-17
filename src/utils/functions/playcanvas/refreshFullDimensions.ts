import { getOrderedProductIds } from "./getOrderedProductIds";
import { getConfig } from "./getConfig";
import { showDimensions, hideDimensions } from "./showDimensions";
import { getDimensionTool } from "./getDimensionTool";
import { cmToInch } from "@/utils/units";
import { SIDE_PANEL_WIDTH_CM } from "@/shared/lib/sku";
import { getRememberedSidePanels } from "./sidePanels";

const readNumericConfigValue = (config: unknown, key: "Width" | "Height" | "Depth") => {
  if (!config || typeof config !== "object") return undefined;

  const rawValue = (config as Record<string, unknown>)[key];

  if (typeof rawValue !== "number" || Number.isNaN(rawValue)) return undefined;

  return rawValue;
};

const formatInchesLabel = (value?: number) => {
  if (typeof value !== "number") return "";

  const normalized = Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.?0+$/, "");

  return `${normalized} "`;
};

/**
 * Computes full dimensions from all products in the scene and calls showDimensions().
 * Returns true if dimensions were shown, false otherwise.
 */
export async function computeAndShowFullDimensions(): Promise<boolean> {
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

  const maxDepth = configs.reduce((max, config) => {
    const value = readNumericConfigValue(config, "Depth");
    return Math.max(max, value ?? 0);
  }, 0);

  const didShow = showDimensions({
    box: {
      nodes: ids,
      width: { label: formatInchesLabel(cmToInch(totalWidth)), offset: 0.05 },
      height: { label: formatInchesLabel(cmToInch(maxHeight)) },
      depth: { label: formatInchesLabel(cmToInch(maxDepth)) },
    },
    lines: widthByNode.map(({ node, width }) => ({
      node,
      axis: "x",
      label: formatInchesLabel(width != null ? cmToInch(width) : undefined),
    })),
    labelSettings: {
      offset: 0.05,
      labelGap: "auto",
      labelPosition: "center",
      units: "in",
      decimals: 2,
    },
  });

  if (didShow) {
    const tool = getDimensionTool();
    tool?.setEnabled(false);
  }

  return didShow;
}
