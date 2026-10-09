import { formatThicknessToken } from "./buildCountertopSku";
import { cmToInches } from "./cmToInches";
import { countertopStyleSkuMap } from "./countertopSkuMaps";

export type CabinetCoverSkuInput = {
  /** Series of the countertop SKU (`UR`). */
  prefix: string;
  /** Countertop style value (`vessel`, `integrated`): the cover goes with the lifted top's style. */
  style: string | null;
  widthCm: number | null;
  depthCm: number | null;
  thicknessIn: number;
  /** The cabinet colour's material SKU (`3D`, `LACM`, `ESS`) and colour code (`10B`, `06A`). */
  materialSku: string | null;
  colorCode: string | null;
};

const positive = (value: number | null): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

/**
 * The cabinet cover: `CT-{prefix}{material}-{style}-{W}W-{T}H-{D}D-{material}-{colour}`,
 * e.g. `CT-UR3D-VES-33.5W-.5H-19.9D-3D-10B`. Null while a part is unknown.
 */
export const buildCabinetCoverSku = ({
  prefix,
  style,
  widthCm,
  depthCm,
  thicknessIn,
  materialSku,
  colorCode,
}: CabinetCoverSkuInput): string | null => {
  // Presets spell the style as a label (`Integrated`), the countertop step as a value (`integrated`).
  const styleKey = Object.keys(countertopStyleSkuMap).find((key) => key.toLowerCase() === style?.trim().toLowerCase());
  const styleCode = styleKey ? countertopStyleSkuMap[styleKey] : undefined;
  if (!styleCode || !materialSku || !colorCode || !positive(widthCm) || !positive(depthCm)) return null;

  const width = `${cmToInches(widthCm)}W`;
  const height = `${formatThicknessToken(thicknessIn)}H`;
  const depth = `${cmToInches(depthCm)}D`;
  return `CT-${prefix}${materialSku}-${styleCode}-${width}-${height}-${depth}-${materialSku}-${colorCode}`;
};
