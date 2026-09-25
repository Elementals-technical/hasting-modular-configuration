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
/** The word the price server reads as "the legs of the composition". */
const LEGS_ELEMENT = "LEG";
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

/**
 * Why a cabinet cannot be priced exactly: an attribute the price depends on has no value, e.g.
 * the frame colour of a Class front, or its value is one the collection names no material for,
 * which leaves out the element that carries the price.
 */
export type CollectionCabinetSkuGap = { attributeId: string; cause: "not-chosen" | "no-material" };

export type CollectionCabinetSku = {
  sku: string;
  /** Attributes the collection could not turn into an element of the SKU. */
  missing: CollectionCabinetSkuGap[];
};

const sizeToken = (cm: number | null, unit: "W" | "H" | "D") =>
  cm != null ? `${cmToInches(cm)}${unit}` : `${FALLBACK}${unit}`;

export const buildCollectionCabinetSku = (
  skuProfile: CollectionSkuProfile,
  productProfile: ProductProfile | null,
  { read, widthCm, heightCm, depthCm, readConfiguratorColor }: CollectionCabinetSkuInput,
): CollectionCabinetSku => {
  const { cabinet } = skuProfile;
  const missing: CollectionCabinetSkuGap[] = [];
  const optionOf = (attributeId: string) => {
    const raw = read(attributeId);
    return normalizeOptionValue(productProfile, attributeId, raw) ?? raw;
  };

  // A cabinet type with a series of its own (the Urban Low Height open shelf) is spelled with its codes.
  const cabinetType = optionOf("CabinetType");
  const { series, configBlock } = (cabinetType ? cabinet.byCabinetType?.[cabinetType] : undefined) ?? cabinet;
  const config = configBlock
    .map(({ attributeId, codes }) => {
      const value = optionOf(attributeId);
      return (value && codes[value]) || FALLBACK;
    })
    .join("/");

  const elements = cabinet.elements.flatMap(({ code, attributeId, materialSuffix }) => {
    const value = read(attributeId);
    if (!value) return [];

    const material = resolveCollectionColorMaterial(
      skuProfile,
      productProfile,
      attributeId,
      value,
      readConfiguratorColor,
    );
    // A colour the collection names no material for cannot be priced: the element is left out
    // and said so, rather than leaving a cabinet SKU the price server answers nothing for.
    if (!material) {
      missing.push({ attributeId, cause: "no-material" });
      return [];
    }

    let pricedMaterial = material;
    if (materialSuffix) {
      const decidingValue = read(materialSuffix.attributeId);
      if (decidingValue) {
        pricedMaterial = `${material}/${materialSuffix.byValue[decidingValue] ?? materialSuffix.otherwise}`;
      } else {
        missing.push({ attributeId: materialSuffix.attributeId, cause: "not-chosen" });
      }
    }

    const colorCode = resolveCollectionColorCode(skuProfile, value);
    return [colorCode ? `${code}-${pricedMaterial}-${colorCode}` : `${code}-${pricedMaterial}`];
  });

  const sizes = [sizeToken(widthCm, "W"), sizeToken(heightCm, "H"), sizeToken(depthCm, "D")].join("-");
  const elementsSuffix = elements.length ? `-${elements.join("-")}` : "";

  return { sku: `${CABINET_CATEGORY}-${series}-${config}-${sizes}${elementsSuffix}`, missing };
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

export type CollectionLegsSkuInput = {
  /** The colour the legs are priced in: their own, or the cabinet's when they take it. */
  color: string | null;
  /** The attribute that colour belongs to, so its material is read from the right section. */
  attributeId: string;
  /** Set when the collection takes its colours from the configurator. */
  readConfiguratorColor?: ConfiguratorColorReader;
};

/**
 * `VAN-{series}-LEG-{material}-{colour}`: the legs a composition stands on.
 *
 * The same material and colour block a cabinet element carries, as its own SKU — legs have no
 * size of their own. Null when the collection offers no legs or the colour names no material.
 */
export const buildCollectionLegsSku = (
  skuProfile: CollectionSkuProfile,
  productProfile: ProductProfile | null,
  { color, attributeId, readConfiguratorColor }: CollectionLegsSkuInput,
): string | null => {
  if (!skuProfile.legs || !color) return null;

  const material = resolveCollectionColorMaterial(
    skuProfile,
    productProfile,
    attributeId,
    color,
    readConfiguratorColor,
  );
  if (!material) return null;

  const series = `${CABINET_CATEGORY}-${skuProfile.cabinet.series}-${LEGS_ELEMENT}`;
  const colorCode = resolveCollectionColorCode(skuProfile, color);
  return colorCode ? `${series}-${material}-${colorCode}` : `${series}-${material}`;
};
