import { normalizeOptionValue, selectOption } from "@/entities/collection/lib/productProfileSelectors";
import type { ProductProfile } from "@/entities/collection/model/productProfile";
import type { CollectionSkuProfile } from "@/entities/collection/model/schemas";

import { cmToInches } from "./cmToInches";
import type { ConfiguratorColorReader } from "./configuratorColors";

/**
 * SKUs of a collection priced from its `sku-profile.json` (D04): Class and Mako.
 *
 * The grammar is the one the price server resolves for these collections —
 * `VAN-{series}-{config}-{W}W-{H}H-{D}D-{element}-{material}-{colour}…` for a cabinet and
 * `CT-{series}{material}-…` for the countertop, its basins, cutout and faucet holes. Every word
 * comes from the collection: series, codes, the material of a colour group, the thicknesses.
 */

const CABINET_CATEGORY = "VAN";
const COUNTERTOP_CATEGORY = "CT";
const FALLBACK = "X";

/** An attribute value of the product being priced, or null when none is chosen. */
export type CollectionValueReader = (attributeId: string) => string | null;

/** The colour code the profile names, else the number the colour name carries (`Nero 433 MT` → `433`). */
export const resolveCollectionColorCode = (skuProfile: CollectionSkuProfile, value: string): string | null =>
  skuProfile.colors.codeByValue[value] ??
  value
    .split(/\s+/)
    .reverse()
    .find((token) => /^\d+$/.test(token)) ??
  null;

/**
 * The material of a colour: the SKU the configurator gives it, else the category of its option
 * in the product profile. A collection declares one or the other, never both.
 */
export const resolveCollectionColorMaterial = (
  skuProfile: CollectionSkuProfile,
  productProfile: ProductProfile | null,
  attributeId: string,
  value: string,
  readConfiguratorColor?: ConfiguratorColorReader,
): string | null => {
  const fromConfigurator = readConfiguratorColor?.(attributeId, value)?.sku;
  if (fromConfigurator) return fromConfigurator;

  const category = selectOption(productProfile, attributeId, value)?.category;
  return category ? (skuProfile.colors.materialByCategory[category] ?? null) : null;
};

export type CollectionCabinetSkuInput = {
  read: CollectionValueReader;
  widthCm: number | null;
  heightCm: number | null;
  depthCm: number | null;
  /** Set when the collection takes its colours from the configurator. */
  readConfiguratorColor?: ConfiguratorColorReader;
};

export type CollectionCabinetSku = {
  sku: string;
  /** Attributes the price depends on that have no value, e.g. the frame colour of a Class front. */
  missing: string[];
};

const sizeToken = (cm: number | null, unit: "W" | "H" | "D") =>
  cm != null ? `${cmToInches(cm)}${unit}` : `${FALLBACK}${unit}`;

export const buildCollectionCabinetSku = (
  skuProfile: CollectionSkuProfile,
  productProfile: ProductProfile | null,
  { read, widthCm, heightCm, depthCm, readConfiguratorColor }: CollectionCabinetSkuInput,
): CollectionCabinetSku => {
  const { cabinet } = skuProfile;
  const missing: string[] = [];

  const configBlock = cabinet.configBlock
    .map(({ attributeId, codes }) => {
      const raw = read(attributeId);
      const value = normalizeOptionValue(productProfile, attributeId, raw) ?? raw;
      return (value && codes[value]) || FALLBACK;
    })
    .join("/");

  const elements = cabinet.elements.flatMap(({ code, attributeId, materialSuffix }) => {
    const value = read(attributeId);
    const material = value
      ? resolveCollectionColorMaterial(skuProfile, productProfile, attributeId, value, readConfiguratorColor)
      : null;
    if (!value || !material) return [];

    let pricedMaterial = material;
    if (materialSuffix) {
      const decidingValue = read(materialSuffix.attributeId);
      if (decidingValue) {
        pricedMaterial = `${material}/${materialSuffix.byValue[decidingValue] ?? materialSuffix.otherwise}`;
      } else {
        missing.push(materialSuffix.attributeId);
      }
    }

    const colorCode = resolveCollectionColorCode(skuProfile, value);
    return [colorCode ? `${code}-${pricedMaterial}-${colorCode}` : `${code}-${pricedMaterial}`];
  });

  const sizes = [sizeToken(widthCm, "W"), sizeToken(heightCm, "H"), sizeToken(depthCm, "D")].join("-");
  const elementsSuffix = elements.length ? `-${elements.join("-")}` : "";

  return { sku: `${CABINET_CATEGORY}-${cabinet.series}-${configBlock}-${sizes}${elementsSuffix}`, missing };
};

export type CollectionCountertopSkuInput = {
  /** `CountertopStyle` value. */
  style: string | null;
  /** `CountertopColor` value. */
  color: string | null;
  /** `sinkType` of each sink base, in composition order. */
  basins: readonly (string | null)[];
  widthCm: number | null;
  /** `FaucetHolesAmount` value. */
  faucetHoles: string | null;
  /** Set when the collection takes its colours from the configurator. */
  readConfiguratorColor?: ConfiguratorColorReader;
};

export type CollectionCountertopSkus = {
  material: string | null;
  thickness: string | null;
  top: string | null;
  /** The basin SKU of each sink base, integrated tops only. */
  basins: (string | null)[];
  /** The vessel cutout, one per sink base, vessel tops only. */
  holeCut: string | null;
  faucetHoles: string | null;
  bracket: { sku: string; quantity: number } | null;
};

export const buildCollectionCountertopSkus = (
  skuProfile: CollectionSkuProfile,
  productProfile: ProductProfile | null,
  { style, color, basins, widthCm, faucetHoles, readConfiguratorColor }: CollectionCountertopSkuInput,
): CollectionCountertopSkus => {
  const { countertop } = skuProfile;
  const styleCode = style ? (countertop.styles[style] ?? null) : null;
  const isIntegrated = styleCode === countertop.styles.integrated;

  // A basin that belongs to one material decides it; otherwise the colour group does.
  const basinMaterial = isIntegrated
    ? basins.map((basin) => (basin ? countertop.materialByBasin[basin] : undefined)).find(Boolean)
    : undefined;
  const colorSku = color ? readConfiguratorColor?.("CountertopColor", color)?.sku : undefined;
  const colorCategory = color ? selectOption(productProfile, "CountertopColor", color)?.category : undefined;
  const material =
    basinMaterial ??
    colorSku ??
    (colorCategory ? countertop.materialByColorCategory[colorCategory] : undefined) ??
    null;
  const thickness = material ? (countertop.thicknessByMaterial[material] ?? null) : null;
  const series = material ? `${COUNTERTOP_CATEGORY}-${countertop.series}${material}` : null;
  const colorCode = color ? resolveCollectionColorCode(skuProfile, color) : null;

  const top =
    series && styleCode && thickness && widthCm != null
      ? `${series}-${styleCode}-${cmToInches(widthCm)}W-${thickness}H-${countertop.depthIn}D${colorCode ? `-${material}-${colorCode}` : ""}`
      : null;
  const basinSkus = basins.map((basin) =>
    series && thickness && isIntegrated && basin ? `${series}-${basin}-${thickness}H` : null,
  );
  const holeCut = series && styleCode === countertop.styles.vessel ? `${series}-HCUT` : null;
  const faucetSku = series && faucetHoles && /^\d+$/.test(faucetHoles) ? `${series}-FAHO/${faucetHoles}` : null;
  const bracket =
    countertop.bracket && thickness && countertop.bracket.thicknesses.includes(thickness)
      ? { sku: countertop.bracket.sku, quantity: countertop.bracket.quantity }
      : null;

  return { material, thickness, top, basins: basinSkus, holeCut, faucetHoles: faucetSku, bracket };
};

/** The organizer SKU of a `DividersStyle` value. */
export const resolveCollectionDividerSku = (skuProfile: CollectionSkuProfile, style: string): string | null =>
  skuProfile.dividers[style] ?? null;
