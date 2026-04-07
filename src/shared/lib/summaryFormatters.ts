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
  return drawerSkuMap[normalized] ?? normalized;
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
