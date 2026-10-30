import { formatThicknessToken, resolveCountertopStyleSku } from "./buildCountertopSku";
import { cmToInches } from "./cmToInches";

export type CabinetCoverSkuInput = {
  /** Series of the countertop SKU (`UR`). */
  prefix: string;
  /** The Upper countertop's style (`integrated`, `vessel`): the cover is spelled in it, `INTG` or `VES`. */
  style: string | null;
  widthCm: number | null;
  depthCm: number | null;
  thicknessIn: number;
  /** The cover's applied colour material SKU (`HPL`, `FX`, `POR`) and colour code (`TKH`, `TFA`). */
  materialSku: string | null;
  colorCode: string | null;
};

/**
 * The attribute whose colours the cover comes in: the Upper's, in every collection (user, 2026-10-28).
 * The Lower takes the Upper's palette and materials, and reaches the scene as the Upper's colours do.
 */
export const CABINET_COVER_COLOR_ATTRIBUTE_ID = "CountertopColor";

const positive = (value: number | null): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

/**
 * The decorative cover: `CT-{prefix}{material}-{style}-{W}W-{T}H-{D}D-{material}-{colour}`, in the
 * Upper's style, e.g. `CT-URHPL-VES-33.5W-.5H-19.9D-HPL-TKH`. Null while a part is unknown.
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
  const styleSku = resolveCountertopStyleSku(style);
  if (
    !prefix.trim() ||
    !styleSku ||
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
  return `CT-${prefix}${materialSku}-${styleSku}-${width}-${height}-${depth}-${materialSku}-${colorCode}`;
};
