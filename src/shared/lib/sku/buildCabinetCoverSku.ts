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
  /** The cover's applied colour material SKU (`3D`, `LACM`, `ESS`) and colour code (`10B`, `06A`). */
  materialSku: string | null;
  colorCode: string | null;
};

/** The cabinet colour attribute a collection's covers take their palette and material codes from. */
export const resolveCabinetCoverColorAttributeId = (cover: { colorAttributeId?: string }): string =>
  cover.colorAttributeId ?? "CabinetColor";

const positive = (value: number | null): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

/**
 * The decorative cover: `CT-{prefix}{material}-{style}-{W}W-{T}H-{D}D-{material}-{colour}`, in the
 * Upper's style, e.g. `CT-UR3D-VES-33.5W-.5H-19.9D-3D-10B`. Null while a part is unknown.
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
