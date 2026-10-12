import { formatThicknessToken } from "./buildCountertopSku";
import { cmToInches } from "./cmToInches";

export type CabinetCoverSkuInput = {
  /** Series of the countertop SKU (`UR`). */
  prefix: string;
  widthCm: number | null;
  depthCm: number | null;
  thicknessIn: number;
  /** The cover's applied colour material SKU (`3D`, `LACM`, `ESS`) and colour code (`10B`, `06A`). */
  materialSku: string | null;
  colorCode: string | null;
};

const positive = (value: number | null): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

/**
 * The decorative cover: `CT-{prefix}{material}-VES-{W}W-{T}H-{D}D-{material}-{colour}`,
 * e.g. `CT-UR3D-VES-33.5W-.5H-19.9D-3D-10B`. Null while a part is unknown.
 */
export const buildCabinetCoverSku = ({
  prefix,
  widthCm,
  depthCm,
  thicknessIn,
  materialSku,
  colorCode,
}: CabinetCoverSkuInput): string | null => {
  if (
    !prefix.trim() ||
    !materialSku ||
    !colorCode ||
    !positive(widthCm) ||
    !positive(depthCm) ||
    !positive(thicknessIn)
  )
    return null;

  const width = `${cmToInches(widthCm)}W`;
  const height = `${formatThicknessToken(thicknessIn)}H`;
  const depth = `${cmToInches(depthCm)}D`;
  return `CT-${prefix}${materialSku}-VES-${width}-${height}-${depth}-${materialSku}-${colorCode}`;
};
