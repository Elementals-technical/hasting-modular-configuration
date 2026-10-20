import {
  hasCapability,
  normalizeOptionValue,
  selectAttribute,
  selectOption,
} from "@/entities/collection/lib/productProfileSelectors";
import type { ProductProfile } from "@/entities/collection/model/productProfile";
import type { TypeCabinetRuleConfig } from "@/shared/config/configurator/typeCabinetCatalog";
import { isPatternMaterialAllowed } from "@/entities/collection/lib/materialEligibility";
import {
  hasOwnCountertop,
  type CollectionCountertop,
  type CollectionSkuProfile,
} from "@/entities/collection/model/schemas";

import { formatVesselSku, type VesselDimensionTokens } from "./buildVesselSku";
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
/** The cabinet's height is its size, not a value: a code keyed on it reads the size (`2S` at 56 cm). */
const HEIGHT_ATTRIBUTE_ID = "Height";

/** An attribute value of the product being priced, or null when none is chosen. */
export type CollectionValueReader = (attributeId: string) => string | null;

/**
 * The end of the composition an open side shelf stands at, `L` or `R`, as its SKU spells it
 * (`VAN-UROSS-L-…`). No attribute holds it: the pricing reader answers it from the cabinet's place.
 */
export const OPEN_SIDE_SHELF_SIDE = "OpenSideShelfSide";

/** The colour code the profile names, else the number the colour name carries (`Nero 433 MT` → `433`). */
export const resolveCollectionColorCode = (skuProfile: CollectionSkuProfile, value: string): string | null =>
  skuProfile.colors.codeByValue[value] ??
  value
    .split(/\s+/)
    .reverse()
    .find((token) => /^\d+$/.test(token)) ??
  null;

/** A colour value that chooses a colour: set, and not the attribute's reset value ("None"). */
export const isChosenColor = (
  productProfile: ProductProfile | null,
  attributeId: string,
  value: string | null,
): value is string => Boolean(value) && value !== selectAttribute(productProfile, attributeId)?.resetValue;

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
  /**
   * The row of the cabinet's type in the collection's cabinet table, as the builder catalog holds it:
   * the sizes and drawers a cabinet that must be priced from complete input is checked against,
   * unless the profile lists modules of its own.
   */
  cabinetRule?: Pick<TypeCabinetRuleConfig, "widths" | "heights" | "depths" | "drawers"> | null;
  /** Set when the collection takes its colours from the configurator. */
  readConfiguratorColor?: ConfiguratorColorReader;
};

/**
 * Why a cabinet cannot be priced exactly: an attribute the price depends on has no value, e.g.
 * the frame colour of a Class front, or its value is one the collection names no material for,
 * which leaves out the element that carries the price.
 */
export type CollectionCabinetSkuGap = {
  attributeId: string;
  cause: "not-chosen" | "no-material" | "invalid-option" | "invalid-dimension";
};

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
  { read, widthCm, heightCm, depthCm, cabinetRule, readConfiguratorColor }: CollectionCabinetSkuInput,
): CollectionCabinetSku => {
  const { cabinet } = skuProfile;
  const missing: CollectionCabinetSkuGap[] = [];
  const optionOf = (attributeId: string) => {
    const raw = attributeId === HEIGHT_ATTRIBUTE_ID && heightCm != null ? String(heightCm) : read(attributeId);
    return normalizeOptionValue(productProfile, attributeId, raw) ?? raw;
  };
  const codeOf = ({ attributeId, codes }: { attributeId: string; codes: Record<string, string> }) => {
    const value = optionOf(attributeId);
    if (cabinet.requireCompleteInput && (!value || !codes[value]))
      missing.push({ attributeId, cause: value ? "invalid-option" : "not-chosen" });
    return (value && codes[value]) || FALLBACK;
  };

  // A cabinet type with a series of its own (the Urban Low Height open shelf) is spelled with its codes,
  // and so is a drawer cabinet of another series (the Urban Standard Height one in an Urban Duplex model).
  const cabinetType = optionOf("CabinetType");
  const seriesValue = cabinet.bySeries ? optionOf(cabinet.bySeries.attributeId) : null;
  const ownSpelling =
    (cabinetType ? cabinet.byCabinetType?.[cabinetType] : undefined) ??
    (seriesValue ? cabinet.bySeries?.byValue[seriesValue] : undefined);
  const { series, configBlock } = ownSpelling ?? cabinet;
  const config = configBlock
    // `2DW` + `R`: a code whose last letter another attribute decides, as the side of a lateral panel.
    .map((entry) => (entry.suffix ? `${codeOf(entry)}${codeOf(entry.suffix)}` : codeOf(entry)))
    .join("/");

  const elementsOfType = ownSpelling?.elements ?? cabinet.elements;
  const elements = elementsOfType.flatMap(({ code, attributeId, materialSuffix, appliesWhen, inheritsFrom }) => {
    // An element of a part the cabinet may not have, e.g. a handle groove, only where it has it.
    if (
      appliesWhen &&
      !hasCapability(productProfile, appliesWhen.attributeId, optionOf(appliesWhen.attributeId), appliesWhen.capability)
    ) {
      return [];
    }

    // A colour not chosen, empty or the reset value ("None"), is spelled with the one it inherits.
    const own = read(attributeId);
    const isChosen = isChosenColor(productProfile, attributeId, own);
    const colorAttributeId = isChosen || !inheritsFrom ? attributeId : inheritsFrom;
    const value = isChosen ? own : inheritsFrom ? read(inheritsFrom) : null;
    if (!value) {
      if (cabinet.requireCompleteInput) missing.push({ attributeId: colorAttributeId, cause: "not-chosen" });
      return [];
    }
    // A colour is the collection's when its profile lists it or, for colours the profile takes from the
    // configurator section it names, when that section offers it.
    const isOffered =
      Boolean(selectOption(productProfile, colorAttributeId, value)) ||
      Boolean(readConfiguratorColor?.(colorAttributeId, value));
    if (cabinet.requireCompleteInput && !isOffered) {
      missing.push({ attributeId: colorAttributeId, cause: "invalid-option" });
      return [];
    }

    const material = resolveCollectionColorMaterial(
      skuProfile,
      productProfile,
      colorAttributeId,
      value,
      readConfiguratorColor,
    );
    // A colour the collection names no material for cannot be priced: the element is left out
    // and said so, rather than leaving a cabinet SKU the price server answers nothing for.
    if (!material) {
      missing.push({ attributeId: colorAttributeId, cause: "no-material" });
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
    if (cabinet.requireCompleteInput && !colorCode)
      missing.push({ attributeId: colorAttributeId, cause: "invalid-option" });
    return [colorCode ? `${code}-${pricedMaterial}-${colorCode}` : `${code}-${pricedMaterial}`];
  });

  // A cabinet type spelled at another height than the table gives it, as a shelf without its plinth,
  // or in its price list's words (`22.0H`).
  const skuHeightCm =
    heightCm != null && ownSpelling?.heightOffsetCm ? heightCm + ownSpelling.heightOffsetCm : heightCm;
  const heightCode = heightCm != null ? (ownSpelling ?? cabinet).heightCodes?.[String(heightCm)] : undefined;
  const sizes = [
    sizeToken(widthCm, "W"),
    heightCode ? `${heightCode}H` : sizeToken(skuHeightCm, "H"),
    sizeToken(depthCm, "D"),
  ].join("-");
  if (cabinet.requireCompleteInput) {
    const pattern = optionOf("DrawerPanelFluting");
    const color = read("CabinetColor");
    const material = color
      ? resolveCollectionColorMaterial(skuProfile, productProfile, "CabinetColor", color, readConfiguratorColor)
      : null;
    if (pattern && !isPatternMaterialAllowed(productProfile, pattern, material))
      missing.push({ attributeId: "DrawerPanelFluting", cause: "invalid-option" });
    // The modules the profile lists, else the row of the cabinet table the builder places from.
    const module = productProfile?.ruleData.cabinetModules?.find(({ cabinetType: type }) => type === cabinetType);
    const allowed = module
      ? { widths: module.widthsCm, heights: module.heightsCm, depths: module.depthsCm, drawers: module.drawerValues }
      : cabinetRule;
    for (const [attributeId, value, sizes] of [
      ["Width", widthCm, allowed?.widths],
      ["Height", heightCm, allowed?.heights],
      ["Depth", depthCm, allowed?.depths],
    ] as const) {
      if (value === null || !Number.isFinite(value) || value <= 0 || (sizes?.length && !sizes.includes(value)))
        missing.push({ attributeId, cause: "invalid-dimension" });
    }
    const drawers = optionOf("Drawers");
    if (allowed?.drawers.length && drawers && !allowed.drawers.includes(drawers))
      missing.push({ attributeId: "Drawers", cause: "invalid-option" });
  }
  const elementsSuffix = elements.length ? `-${elements.join("-")}` : "";

  return {
    sku:
      cabinet.requireCompleteInput && missing.length
        ? ""
        : `${CABINET_CATEGORY}-${series}-${config}-${sizes}${elementsSuffix}`,
    missing,
  };
};

export type CollectionCountertopSkuInput = {
  /** `CountertopStyle` value. */
  style: string | null;
  /** `CountertopColor` value. */
  color: string | null;
  /** `Thickness` value; while none is chosen, the thickness of the material. */
  thickness: string | null;
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
  /** A vessel top, whether or not its colour prices the top and the cutout yet. */
  isVessel: boolean;
  faucetHoles: string | null;
  bracket: { sku: string; quantity: number } | null;
};

export const buildCollectionCountertopSkus = (
  /** A collection that spells its countertop itself (`hasOwnCountertop`). */
  skuProfile: CollectionSkuProfile & { countertop: CollectionCountertop },
  productProfile: ProductProfile | null,
  {
    style,
    color,
    thickness: chosenThickness,
    basins,
    widthCm,
    faucetHoles,
    readConfiguratorColor,
  }: CollectionCountertopSkuInput,
): CollectionCountertopSkus => {
  const { countertop } = skuProfile;
  // A style recorded in the scene's spelling ("Integrated") reads as its option, as a cabinet's values do.
  const styleValue = normalizeOptionValue(productProfile, "CountertopStyle", style) ?? style;
  const styleCode = styleValue ? (countertop.styles[styleValue] ?? null) : null;
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
  const thickness = !material
    ? null
    : chosenThickness
      ? (countertop.thicknessCodes[chosenThickness] ?? null)
      : (countertop.thicknessByMaterial[material] ?? null);
  const series = material ? `${COUNTERTOP_CATEGORY}-${countertop.series}${material}` : null;
  const colorCode = color ? resolveCollectionColorCode(skuProfile, color) : null;

  const top =
    series && styleCode && thickness && widthCm != null
      ? `${series}-${styleCode}-${cmToInches(widthCm)}W-${thickness}H-${countertop.depthIn}D${colorCode ? `-${material}-${colorCode}` : ""}`
      : null;
  const basinSkus = basins.map((basin) =>
    series && thickness && isIntegrated && basin ? `${series}-${basin}-${thickness}H` : null,
  );
  const isVessel = styleCode !== null && styleCode === countertop.styles.vessel;
  const holeCut = series && isVessel ? `${series}-HCUT` : null;
  const faucetSku = series && faucetHoles && /^\d+$/.test(faucetHoles) ? `${series}-FAHO/${faucetHoles}` : null;
  const bracket =
    countertop.bracket && thickness && countertop.bracket.thicknesses.includes(thickness)
      ? { sku: countertop.bracket.sku, quantity: countertop.bracket.quantity }
      : null;

  return { material, thickness, top, basins: basinSkus, holeCut, isVessel, faucetHoles: faucetSku, bracket };
};

export type CollectionVesselInput = {
  /** `sinkType` of the sink base. */
  basin: string | null;
  /** `VesselColor` of the sink base. */
  color: string | null;
  /** Set when the collection takes its colours from the configurator. */
  readConfiguratorColor?: ConfiguratorColorReader;
};

export type CollectionVessel = {
  /** The vessel's own size, in inches as its SKU spells it. */
  dimensions: VesselDimensionTokens;
  /** The material of its colour (`LACM`), null while no colour is chosen or it names none. */
  material: string | null;
  /** Null until the colour gives both a material and a code: the price server prices no vessel without. */
  sku: string | null;
};

/**
 * `VES-{series}-X-{W}W-{H}H-{D}D-{material}-{colour}`: a vessel the collection declares in its SKU
 * profile, in the colour of `VesselColor`. Null for a basin that is not one of them.
 */
export const resolveCollectionVessel = (
  skuProfile: CollectionSkuProfile,
  productProfile: ProductProfile | null,
  { basin, color, readConfiguratorColor }: CollectionVesselInput,
): CollectionVessel | null => {
  const value = normalizeOptionValue(productProfile, "sinkType", basin) ?? basin;
  const vessel = value ? skuProfile.vessels?.[value] : undefined;
  if (!vessel) return null;

  const dimensions = { width: vessel.widthIn, height: vessel.heightIn, depth: vessel.depthIn };
  const chosenColor = isChosenColor(productProfile, "VesselColor", color) ? color : null;
  const material = chosenColor
    ? resolveCollectionColorMaterial(skuProfile, productProfile, "VesselColor", chosenColor, readConfiguratorColor)
    : null;
  const colorCode = chosenColor ? resolveCollectionColorCode(skuProfile, chosenColor) : null;

  return {
    dimensions,
    material,
    sku:
      material && colorCode
        ? formatVesselSku({ series: vessel.series, model: FALLBACK, dimensions, materialSku: material, colorCode })
        : null,
  };
};

/** The organizer SKU of a `DividersStyle` value. */
export const resolveCollectionDividerSku = (skuProfile: CollectionSkuProfile, style: string): string | null =>
  skuProfile.dividers[style] ?? null;

export type CollectionLegsSkuInput = {
  /** The colour the legs are priced in: their own, or the cabinet's when they take it. */
  color: string | null;
  /** The attribute that colour belongs to, so its material is read from the right section. */
  attributeId: string;
  /** The cabinets' `Drawers`, for legs spelled by drawer style. */
  drawers?: string | null;
  /** Set when the collection takes its colours from the configurator. */
  readConfiguratorColor?: ConfiguratorColorReader;
};

/**
 * `VAN-{series}-LEG-{material}-{colour}`: the legs a composition stands on.
 *
 * The same material and colour block a cabinet element carries, as its own SKU — legs have no
 * size of their own. Legs spelled by drawer style (Lame) are `VAN-{series}-LEG/{code}-{element}-…`,
 * in the cabinet element whose colour they take. Null when the collection offers no legs, the
 * colour names no material or the drawer style no leg.
 */
export const buildCollectionLegsSku = (
  skuProfile: CollectionSkuProfile,
  productProfile: ProductProfile | null,
  { color, attributeId, drawers, readConfiguratorColor }: CollectionLegsSkuInput,
): string | null => {
  const { legs } = skuProfile;
  if (!legs || !color) return null;

  const material = resolveCollectionColorMaterial(
    skuProfile,
    productProfile,
    attributeId,
    color,
    readConfiguratorColor,
  );
  if (!material) return null;

  const colorCode = resolveCollectionColorCode(skuProfile, color);
  const finish = colorCode ? `${material}-${colorCode}` : material;
  const series = `${CABINET_CATEGORY}-${skuProfile.cabinet.series}-${LEGS_ELEMENT}`;
  if (!legs.byDrawers) return `${series}-${finish}`;

  const model = drawers ? legs.byDrawers[normalizeOptionValue(productProfile, "Drawers", drawers) ?? drawers] : null;
  const element = skuProfile.cabinet.elements.find((entry) => entry.attributeId === attributeId)?.code;
  return model && element ? `${series}/${model}-${element}-${finish}` : null;
};

/**
 * The colour a part is priced in: the first of its candidates whose colour names a material, as
 * its own colour or, while that names none ("None"), the one it is painted in instead.
 */
const resolvePaintedColor = (
  skuProfile: CollectionSkuProfile,
  productProfile: ProductProfile | null,
  candidates: readonly (readonly [attributeId: string | undefined, color: string | null])[],
  readConfiguratorColor?: ConfiguratorColorReader,
): { material: string; color: string } | null => {
  for (const [attributeId, color] of candidates) {
    if (!attributeId || !color) continue;
    const material = resolveCollectionColorMaterial(
      skuProfile,
      productProfile,
      attributeId,
      color,
      readConfiguratorColor,
    );
    if (material) return { material, color };
  }
  return null;
};

export type CollectionLegCapSkuInput = {
  /** `LegColor`: "" off, a colour of its section, or one that names none ("None"). */
  value: string | null;
  /** The colour the cap is painted in while its value names none of its own: the handles'. */
  fallbackColor: string | null;
  /** Set when the collection takes its colours from the configurator. */
  readConfiguratorColor?: ConfiguratorColorReader;
};

/**
 * `VAN-{series}-LEGCAP-{material}-{colour}`: the cap at the foot of each leg (Lame), in the leg
 * colour or the handles'. Null while the legs are off or when neither colour names a material.
 */
export const buildCollectionLegCapSku = (
  skuProfile: CollectionSkuProfile,
  productProfile: ProductProfile | null,
  { value, fallbackColor, readConfiguratorColor }: CollectionLegCapSkuInput,
): string | null => {
  const cap = skuProfile.legs?.cap;
  if (!cap || !value) return null;

  const painted = resolvePaintedColor(
    skuProfile,
    productProfile,
    [
      ["LegColor", value],
      [cap.fallbackColorAttributeId, fallbackColor],
    ],
    readConfiguratorColor,
  );
  if (!painted) return null;

  const colorCode = resolveCollectionColorCode(skuProfile, painted.color);
  const sku = `${CABINET_CATEGORY}-${skuProfile.cabinet.series}-${cap.code}-${painted.material}`;
  return colorCode ? `${sku}-${colorCode}` : sku;
};

export type CollectionUndertopSkuInput = {
  /** The undertop's value: "" off, a colour of its section, or one that names none ("None"). */
  value: string | null;
  /** The colour it is painted in while its value names none of its own: the handles'. */
  fallbackColor: string | null;
  /** The composition's width, which the undertop runs along. */
  widthCm: number | null;
  /** Set when the collection takes its colours from the configurator. */
  readConfiguratorColor?: ConfiguratorColorReader;
};

/**
 * `CT-{series}{material}-UDTP-{W}W-.7H-20.5D-{material}-{colour}`: the undertop under the whole
 * composition (Lame), priced per cm of its width. Null while it is off, or when its colour names no
 * material: the price server prices no undertop without one.
 */
export const buildCollectionUndertopSku = (
  skuProfile: CollectionSkuProfile,
  productProfile: ProductProfile | null,
  { value, fallbackColor, widthCm, readConfiguratorColor }: CollectionUndertopSkuInput,
): string | null => {
  const { undertop } = skuProfile;
  if (!undertop || !hasOwnCountertop(skuProfile) || !value || widthCm == null) return null;

  const painted = resolvePaintedColor(
    skuProfile,
    productProfile,
    [
      [undertop.attributeId, value],
      [undertop.fallbackColorAttributeId, fallbackColor],
    ],
    readConfiguratorColor,
  );
  if (!painted) return null;

  const colorCode = resolveCollectionColorCode(skuProfile, painted.color);
  const sku = `${COUNTERTOP_CATEGORY}-${skuProfile.countertop.series}${painted.material}-${undertop.code}-${cmToInches(widthCm)}W-${undertop.heightIn}H-${undertop.depthIn}D`;
  return colorCode ? `${sku}-${painted.material}-${colorCode}` : sku;
};
