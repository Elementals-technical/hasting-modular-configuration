import { resolveCabinetTypeOfRuntimeId, selectOption } from "@/entities/collection";
import type { CollectionSkuProfile, ProductProfile } from "@/entities/collection";
import { isSameTarget, type CabinetEntry, type ScopedValue, type ValueTarget } from "@/entities/configuration";
import {
  buildCollectionCabinetSku,
  buildCollectionCountertopSkus,
  buildCollectionLegsSku,
  createConfiguratorColorReader,
  resolveCollectionDividerSku,
  type CollectionCabinetSkuGap,
  type CollectionValueReader,
  type ConfiguratorColorReader,
} from "@/shared/lib/sku";

import type { PricingGap, PricingInput, PricingLine } from "./types";

/**
 * Order lines of a collection priced from its `sku-profile.json` (D04): Class and Mako.
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

/** The first value an attribute holds at any address: what the whole composition shares. */
const anyValue = (values: Values, attributeId: string): string | null => {
  for (const { value } of values[attributeId] ?? []) {
    const text = asText(value);
    if (text) return text;
  }
  return null;
};

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
    if (coveredValues && !coveredValues.includes(text)) return false;

    // The material group of a colour: its own category, or the material the configurator names
    // for a collection whose colours come from there.
    const category =
      readConfiguratorColor(attributeId, text)?.material ?? selectOption(profile, attributeId, text)?.category ?? "";
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

  // 1) Cabinets
  const missing = new Map<string, CollectionCabinetSkuGap["cause"]>();
  cabinets.forEach((entry) => {
    const cabinetTarget: ValueTarget = { scope: "cabinet", cabinetId: entry.stableKey };
    const read: CollectionValueReader = (attributeId) => {
      if (attributeId === "CabinetType") return cabinetTypeOf(entry.runtimeId);
      const own = valueAt(values, attributeId, cabinetTarget) ?? globalValue(attributeId);
      if (own) return own;
      if (attributeId === "Drawers") return placedCabinetStyles[entry.runtimeId] ?? null;
      if (attributeId === "Handle") return asText(input.selectedProductConfig?.Handle as string | undefined);
      return null;
    };
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
      id: `cabinet:${entry.runtimeId}`,
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
  const basinOf = (entry: CabinetEntry) =>
    valueAt(values, "sinkType", { scope: "basin", sinkBaseId: entry.stableKey }) ??
    valueAt(values, "sinkType", { scope: "basin" }) ??
    (input.sinkType || null);
  const countertop = buildCollectionCountertopSkus(skuProfile, profile, {
    style: countertopValue("CountertopStyle", input.countertopStyle),
    color: countertopValue("CountertopColor", input.countertopColor),
    basins: sinkBases.map(basinOf),
    widthCm: cabinets.length > 0 ? widthCm : null,
    faucetHoles: countertopValue("FaucetHolesAmount", input.faucetHolesAmount),
    readConfiguratorColor,
  });

  if (countertop.top && widthCm != null) {
    add({ id: "countertop:0", group: "countertop", sku: countertop.top, quantity: 1, widthCm });
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

  // 3) Legs: the collection's own number of them, in their colour or the cabinet's.
  const legs = skuProfile.legs;
  if (legs) {
    const legColor = anyValue(values, "LegColor");
    const takesCabinetColor = legColor !== null && legColor === legs.cabinetColorValue;
    const legsSku = buildCollectionLegsSku(skuProfile, profile, {
      color: takesCabinetColor ? globalValue("CabinetColor") : legColor,
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

  // 5) What the order uses and the collection has not confirmed.
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
