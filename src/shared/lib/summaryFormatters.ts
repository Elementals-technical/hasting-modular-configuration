import { cmToInches, drawerSkuMap, toSkuDepth } from "@/shared/lib/sku";

const CM_SKU_PREFIXES = ["VAN-URSTD-", "VAN-URTWLBR-", "VAN-URSP-"];

const formatInches = (cm: number): string => {
  const inches = Math.round((cm / 2.54) * 10) / 10;
  if (Number.isInteger(inches)) return String(inches);
  const str = inches.toFixed(1);
  return str.startsWith("0.") ? str.slice(1) : str;
};

export const convertSkuToInchesForSummary = (sku: string): string => {
  if (!CM_SKU_PREFIXES.some((prefix) => sku.startsWith(prefix))) return sku;
  return sku.replace(/-(\d+(?:\.\d+)?)(W|H|D)(?=-|$)/g, (_, value, unit) => {
    return `-${formatInches(parseFloat(value))}${unit}`;
  });
};

export const formatCabinetDrawersForSummary = (drawers: unknown): string => {
  if (typeof drawers !== "string") return "";
  const normalized = drawers.trim();
  if (!normalized) return "";
  if (normalized === "1D" || normalized === "1DW") return "1-Drawer";
  if (normalized === "2D" || normalized === "2DW") return "2-Drawer";
  if (normalized === "1DWID") return "1DWID";
  return drawerSkuMap[normalized] ?? normalized;
};

export const formatCabinetTitleForSummary = (name: string | null | undefined): string => {
  if (!name) return "Cabinet";
  if (name === "Sink-Base") return "Sink Base";
  if (name === "Sink-Cabinet") return "Side Cabinet";
  if (name === "Open-Shelf") return "Open Shelf";
  if (name === "Side-Shelf") return "Side Shelf";
  return name.replace(/-/g, " ");
};

export const isShelfCabinetType = (name: string | null | undefined): boolean => {
  if (!name) return false;
  const normalized = name.toLowerCase().replace(/[\s_]+/g, "-");
  return normalized.includes("open-shelf") || normalized.includes("side-shelf");
};

export const formatCabinetDimsForSummary = (
  width: number | null | undefined,
  depth: number | null | undefined,
  height: number | null | undefined,
): string => {
  if (typeof width !== "number" || typeof depth !== "number" || typeof height !== "number") return "";
  return `${cmToInches(width)}W-${cmToInches(height)}H-${cmToInches(toSkuDepth(depth))}D`;
};

export const formatCabinetDimsForSummaryWithFallback = (
  width: number | null | undefined,
  depth: number | null | undefined,
  height: number | null | undefined,
): string => {
  const widthText = typeof width === "number" ? `${cmToInches(width)}W` : "-W";
  const heightText = typeof height === "number" ? `${cmToInches(height)}H` : "-H";
  const depthText = typeof depth === "number" ? `${cmToInches(toSkuDepth(depth))}D` : "-D";
  return `${widthText}-${heightText}-${depthText}`;
};
