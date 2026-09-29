import {
  hasOwnCountertop,
  normalizeOptionValue,
  resolveCabinetTypeOfRuntimeId,
  selectOption,
} from "@/entities/collection";
import type { CollectionSkuProfile, ProductProfile } from "@/entities/collection";
import {
  compositionValueOf,
  isSameTarget,
  type CabinetEntry,
  type ScopedValue,
  type ValueTarget,
} from "@/entities/configuration";
import { calcTotalCountertopWidthCm } from "@/entities/countertop";
import {
  buildCollectionCabinetSku,
  buildCollectionCountertopSkus,
  buildCollectionLegsSku,
  createConfiguratorColorReader,
  isChosenColor,
  resolveCollectionColorCode,
  resolveCollectionColorMaterial,
  resolveCollectionDividerSku,
  SKU_SERIES_BY_COLLECTION,
  type CollectionCabinetSkuGap,
  type CollectionValueReader,
  type ConfiguratorColorReader,
} from "@/shared/lib/sku";

import type { PricingGap, PricingInput, PricingLine } from "./types";
import { buildUshCountertopLines, resolveUshCountertop } from "./ushCountertopLines";
import { buildUshSidePanelLines } from "./ushSidePanelLines";
import { buildUshTowelBarLines } from "./ushTowelBarLines";

/**
 * Order lines of a collection priced from its `sku-profile.json` (D04): Class, Mako and Urban Low
 * Height, whose countertop, towel bar and side panels are priced as Urban Standard Height's.
 *
 * Read from C's state — cabinets, their sizes and the values addressed to each cabinet, basin
 * and drawer — rather than the scene, which these collections do not have yet (I07). The lines
 * have the shape and ids of the USH lines, so the price store, the bottom bar and Summary
 * treat them alike. Quantities follow USH: a basin and a vessel cutout per sink base, the top
 * and the faucet holes once. What the collection has not confirmed comes back as gaps.
 */

export type CollectionPricingResult = { lines: PricingLine[]; gaps: PricingGap[] };

type Values = PricingInput["configurationValues"];

const asText = (value: ScopedValue["value"] | undefined): string | null =>
  typeof value === "string" && value.trim() ? value : typeof value === "number" ? String(value) : null;

const valueAt = (values: Values, attributeId: string, target: ValueTarget): string | null =>
  asText(values[attributeId]?.find((entry) => isSameTarget(entry.target, target))?.value);

type InputGap = { owner: string; reason: (attributeId: string) => string };

/** What an attribute the cabinet SKU could not spell says about the order, by why it could not. */
const INPUT_GAP: Record<CollectionCabinetSkuGap["cause"], InputGap> = {
  "not-chosen": {
    owner: "C",
    reason: (attributeId) => `${attributeId} is not chosen, so the cabinet material cannot be priced exactly.`,
  },
  "no-material": {
    owner: "product",
    reason: (attributeId) =>
      `${attributeId} is set to a value the collection names no material for, so the cabinet has no price.`,
  },
};

/** Why a countertop priced as Urban Standard Height's has no top line. */
const UNPRICED_USH_COUNTERTOP =
  "The countertop has no Urban Standard Height price here: the countertop table gives no thickness for its material at this depth, or its colour names no material.";

/** A gap concerns this order when the attribute it names has a value it covers. */
const gapApplies = (
  { appliesWhen }: CollectionSkuProfile["gaps"][number],
  values: Values,
  profile: ProductProfile | null,
  readConfiguratorColor: ConfiguratorColorReader,
): boolean => {
  if (!appliesWhen) return false;
  const { attributeId, values: coveredValues, categories } = appliesWhen;

  return (values[attributeId] ?? []).some(({ value }) => {
    const text = asText(value);
    if (!text) return false;
    // A value recorded in the scene's spelling ("Vessel") reads as its option.
    const option = normalizeOptionValue(profile, attributeId, text) ?? text;
    if (coveredValues && !coveredValues.includes(option)) return false;

    // The material group of a colour: its own category, or the material the configurator names
    // for a collection whose colours come from there.
    const category =
      readConfiguratorColor(attributeId, option)?.material ??
      selectOption(profile, attributeId, option)?.category ??
      "";
    if (categories && !categories.includes(category)) return false;
    return true;
  });
};

export const buildCollectionPricingLines = (input: PricingInput): CollectionPricingResult => {
  const skuProfile = input.skuBuilders.collectionProfile;
  if (!skuProfile) return { lines: [], gaps: [] };

  const { activeProfile: profile, configurationValues: values, dimensionsByCabinet, placedCabinetStyles } = input;
  const readConfiguratorColor = createConfiguratorColorReader(profile, input.configurator ?? null);
  // The cabinet type the scene placed, read through the collection's scene types (a Mako sink
  // base is a Mako-sink-cabinet in the scene).
  const cabinetTypeOf = (runtimeId: string) =>
    resolveCabinetTypeOfRuntimeId(profile, input.runtimeBindings ?? null, runtimeId);
  const isSinkBase = (entry: CabinetEntry) => cabinetTypeOf(entry.runtimeId) === "Sink-Base";
  // The Summary of a model reads the model's cabinets by their place in it, as the USH lines
  // name them; a cabinet added on top of the model, or of a custom composition, by its runtime id.
  const cabinetLineId = (runtimeId: string) => {
    const presetIndex = input.shouldUsePresets ? input.productIds.indexOf(runtimeId) : -1;
    return presetIndex >= 0 && presetIndex < input.productsPresets.length
      ? `cabinet:preset-${presetIndex}`
      : `cabinet:${runtimeId}`;
  };
  const cabinets = [...input.cabinetEntries].sort((left, right) => left.index - right.index);
  const lines: PricingLine[] = [];
  const gaps: PricingGap[] = [];
  const add = (line: PricingLine) => {
    if (line.sku && line.quantity > 0) lines.push(line);
  };

  // Configuration-wide values: cabinet colours of Class, the countertop.
  const globalValue = (attributeId: string) => valueAt(values, attributeId, { scope: "global" });
  const countertopValue = (attributeId: string, legacy: string | null) =>
    valueAt(values, attributeId, { scope: "countertop" }) ?? (legacy || null);
  // Until a cabinet colour is chosen, the one the builder starts from: the collection's default.
  const startingCabinetColor = asText(input.cabinetColor);

  // A value of one cabinet: its own, the configuration's, else what the state holds for them all.
  const readerOf = (entry: CabinetEntry): CollectionValueReader => {
    const cabinetTarget: ValueTarget = { scope: "cabinet", cabinetId: entry.stableKey };
    return (attributeId) => {
      if (attributeId === "CabinetType") return cabinetTypeOf(entry.runtimeId);
      const own = valueAt(values, attributeId, cabinetTarget) ?? globalValue(attributeId);
      if (own) return own;
      if (attributeId === "Drawers") return placedCabinetStyles[entry.runtimeId] ?? null;
      if (attributeId === "Handle") return asText(input.selectedProductConfig?.Handle as string | undefined);
      if (attributeId === "HandleGrooveColor") return asText(input.handleGrooveColor);
      if (attributeId === "CabinetColor") return startingCabinetColor;
      return null;
    };
  };

  // 1) Cabinets
  const missing = new Map<string, CollectionCabinetSkuGap["cause"]>();
  cabinets.forEach((entry) => {
    const read = readerOf(entry);
    const size = dimensionsByCabinet[entry.stableKey];
    const cabinetSku = buildCollectionCabinetSku(skuProfile, profile, {
      read,
      widthCm: size?.width ?? null,
      heightCm: size?.height ?? null,
      depthCm: size?.depth ?? null,
      readConfiguratorColor,
    });

    cabinetSku.missing.forEach(({ attributeId, cause }) => missing.set(attributeId, cause));
    add({
      id: cabinetLineId(entry.runtimeId),
      group: "cabinet",
      sku: cabinetSku.sku,
      quantity: 1,
      sourceId: entry.runtimeId,
    });
  });

  // 2) Countertop: one top across the composition, a basin and a cutout per sink base.
  const sinkBases = cabinets.filter(isSinkBase);
  const widthCm = cabinets.reduce<number | null>((sum, entry) => {
    const width = dimensionsByCabinet[entry.stableKey]?.width;
    return sum === null || width == null ? null : sum + width;
  }, 0);
  const committedCountertopLengthCm = input.committedCountertopLengthCm;
  const hasCommittedCountertopLength =
    typeof committedCountertopLengthCm === "number" &&
    Number.isFinite(committedCountertopLengthCm) &&
    committedCountertopLengthCm > 0;
  const ownCountertopWidthCm = hasCommittedCountertopLength ? committedCountertopLengthCm : widthCm;
  const basinOf = (entry: CabinetEntry) =>
    valueAt(values, "sinkType", { scope: "basin", sinkBaseId: entry.stableKey }) ??
    valueAt(values, "sinkType", { scope: "basin" }) ??
    (input.sinkType || null);
  const countertopStyle = countertopValue("CountertopStyle", input.countertopStyle);
  const countertopColor = countertopValue("CountertopColor", input.countertopColor);
  const faucetHoles = countertopValue("FaucetHolesAmount", input.faucetHolesAmount);

  if (hasOwnCountertop(skuProfile)) {
    const countertop = buildCollectionCountertopSkus(skuProfile, profile, {
      style: countertopStyle,
      color: countertopColor,
      basins: sinkBases.map(basinOf),
      widthCm: cabinets.length > 0 ? ownCountertopWidthCm : null,
      faucetHoles,
      readConfiguratorColor,
    });

    if (countertop.top && ownCountertopWidthCm != null) {
      add({ id: "countertop:0", group: "countertop", sku: countertop.top, quantity: 1, widthCm: ownCountertopWidthCm });
    }
    sinkBases.forEach((entry, index) => {
      const basinSku = countertop.basins[index];
      if (basinSku) add({ id: `countertop:basin:${entry.stableKey}`, group: "basin", sku: basinSku, quantity: 1 });
    });
    if (countertop.holeCut) {
      add({ id: "countertop:holeCut", group: "holeCut", sku: countertop.holeCut, quantity: sinkBases.length });
    }
    if (countertop.faucetHoles) {
      add({ id: "countertop:faucetDefault", group: "faucetHoles", sku: countertop.faucetHoles, quantity: 1 });
    }
    if (countertop.bracket) {
      add({
        id: "countertop:bracket",
        group: "bracket",
        sku: countertop.bracket.sku,
        quantity: countertop.bracket.quantity,
      });
    }
  } else if (countertopColor && cabinets.length > 0) {
    // A countertop priced as Urban Standard Height's (Urban Low Height): its SKUs and rules, on this
    // composition — as deep as its cabinets, as wide as they are with their side panels.
    const firstSize = dimensionsByCabinet[cabinets[0].stableKey];
    const sinkType = sinkBases.length > 0 ? basinOf(sinkBases[0]) : null;
    // The countertop table sizes the top by the sink base of that basin (its minimum sink base width).
    const sinkBaseWidth = sinkBases.length > 0 ? (dimensionsByCabinet[sinkBases[0].stableKey]?.width ?? null) : null;
    const countertopLines = buildUshCountertopLines({
      series: SKU_SERIES_BY_COLLECTION["urban-standard-height"],
      countertop: resolveUshCountertop(input, {
        color: countertopColor,
        sinkType,
        width: sinkBaseWidth,
        depth: firstSize?.depth ?? null,
      }),
      style: countertopStyle ?? "",
      faucetHolesAmount: faucetHoles ?? "",
      sinkType,
      widthCm: hasCommittedCountertopLength
        ? committedCountertopLengthCm
        : widthCm === null
          ? null
          : calcTotalCountertopWidthCm(widthCm, input.sidePanelLeft, input.sidePanelRight),
      depthCm: firstSize?.depth ?? null,
      sinkBases: sinkBases.map((entry) => ({ id: entry.stableKey, sinkType: basinOf(entry) })),
      sinkBaseCount: sinkBases.length,
    });

    countertopLines.forEach(add);
    // The countertop table may give no thickness for the material at this depth, or the colour
    // may name no material: then there is no top to price, and the order says so.
    if (!countertopLines.some(({ group }) => group === "countertop")) {
      gaps.push({ group: "countertop", blocksTotal: true, owner: "product", reason: UNPRICED_USH_COUNTERTOP });
    }
  }

  // 3) Legs: the collection's own number of them, in their colour or the cabinet's, as the whole
  // composition holds the leg colour.
  const legs = skuProfile.legs;
  if (legs) {
    const legColor = asText(compositionValueOf(values.LegColor, cabinets[0]?.stableKey));
    const takesCabinetColor = legColor !== null && legColor === legs.cabinetColorValue;
    const legsSku = buildCollectionLegsSku(skuProfile, profile, {
      color: takesCabinetColor ? (globalValue("CabinetColor") ?? startingCabinetColor) : legColor,
      attributeId: takesCabinetColor ? "CabinetColor" : "LegColor",
      readConfiguratorColor,
    });

    if (legsSku) add({ id: "legs", group: "legs", sku: legsSku, quantity: legs.quantity });
  }

  // 4) Organizers: one per drawer that has a divider style.
  (values.DividersStyle ?? []).forEach(({ target, value }) => {
    const style = asText(value);
    const sku = style ? resolveCollectionDividerSku(skuProfile, style) : null;
    if (sku && target.scope === "drawer") {
      add({ id: `divider:${target.cabinetId}:${target.drawerType}`, group: "divider", sku, quantity: 1 });
    }
  });

  // 5) Towel bar: a collection that reuses Urban Standard Height's orders it as USH does.
  if (skuProfile.towelBar) {
    buildUshTowelBarLines({
      series: SKU_SERIES_BY_COLLECTION["urban-standard-height"],
      towelBarOption: input.towelBarOption,
      towelBarColor: input.towelBarColor,
    }).forEach(add);
  }

  // 6) Side panels: a collection that reuses Urban Standard Height's orders them as USH does, at the
  // size and in the colours of the first cabinet. A groove without a colour of its own is the cabinet's.
  if (skuProfile.sidePanel && cabinets.length > 0) {
    const [first] = cabinets;
    const read = readerOf(first);
    const colorSku = (attributeId: string, value: string) => ({
      materialSku: resolveCollectionColorMaterial(skuProfile, profile, attributeId, value, readConfiguratorColor),
      colorCode: resolveCollectionColorCode(skuProfile, value),
    });
    const cabinetColor = read("CabinetColor");
    const grooveColor = read("HandleGrooveColor");
    const size = dimensionsByCabinet[first.stableKey];

    buildUshSidePanelLines({
      series: SKU_SERIES_BY_COLLECTION["urban-standard-height"],
      panelType: input.sidePanelsOption,
      sidePanelLeft: input.sidePanelLeft,
      sidePanelRight: input.sidePanelRight,
      heightCm: size?.height ?? null,
      depthCm: size?.depth ?? null,
      cabinet: cabinetColor ? colorSku("CabinetColor", cabinetColor) : { materialSku: null, colorCode: null },
      groove: isChosenColor(profile, "HandleGrooveColor", grooveColor)
        ? colorSku("HandleGrooveColor", grooveColor)
        : { materialSku: null, colorCode: null },
    }).forEach(add);
  }

  // 7) What the order uses and the collection has not confirmed.
  skuProfile.gaps.forEach((gap) => {
    if (gapApplies(gap, values, profile, readConfiguratorColor)) {
      gaps.push({ group: gap.group, blocksTotal: gap.blocksTotal, owner: gap.owner, reason: gap.reason });
    }
  });
  missing.forEach((cause, attributeId) => {
    const { owner, reason } = INPUT_GAP[cause];
    gaps.push({ group: "input", blocksTotal: true, owner, reason: reason(attributeId) });
  });

  return { lines, gaps };
};
