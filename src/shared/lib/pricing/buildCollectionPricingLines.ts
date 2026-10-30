import { tandemCountertopLineId } from "./tandemCountertopLines";
import {
  hasOwnCountertop,
  normalizeOptionValue,
  resolveCabinetTypeOfRuntimeId,
  selectAttribute,
  selectDefaultValue,
  selectOption,
  semanticValueOf,
} from "@/entities/collection";
import type { CollectionSkuProfile, ProductProfile } from "@/entities/collection";
import {
  compositionValueOf,
  isSameTarget,
  type CabinetEntry,
  type ScopedValue,
  type ValueTarget,
} from "@/entities/configuration";
import type { DrawerOrganizersRead } from "@/entities/configuration/model/drawerOrganizers";
import { calcTotalCountertopWidthCm, getActiveSidePanelCount, getSidePanelWidthCm } from "@/entities/countertop";
import { readOrganizerRules } from "@/features/drawerOrganizers/model/rules";
import { findCabinetRule } from "@/shared/config/configurator/typeCabinetCatalog";
import {
  buildCabinetCoverSku,
  CABINET_COVER_COLOR_ATTRIBUTE_ID,
  buildCollectionCabinetSku,
  buildCollectionCountertopSkus,
  buildCollectionLegCapSku,
  buildCollectionLegsSku,
  buildCollectionUndertopSku,
  createConfiguratorColorReader,
  extractColorCode,
  isChosenColor,
  OPEN_SIDE_SHELF_SIDE,
  resolveCollectionColorCode,
  resolveCollectionColorMaterial,
  resolveCollectionDividerSku,
  resolveCollectionVessel,
  resolveCountertopColorSkuFromCandidates,
  resolveCountertopMaterialSkuFromColorCode,
  resolveOpenSideShelfSide,
  SKU_SERIES_BY_COLLECTION,
  type CollectionCabinetSkuGap,
  type CollectionValueReader,
  type ConfiguratorColorReader,
} from "@/shared/lib/sku";

import { buildOrganizerLines, ORGANIZER_BILL_EMPTY_COLUMNS } from "./organizerLines";
import { OWN_SIDE_PANEL_LINE_ID } from "./ownSidePanelItems";
import type { PricingGap, PricingInput, PricingLine } from "./types";
import { buildUshCountertopLines, resolveUshCountertop } from "./ushCountertopLines";
import { buildUshSidePanelLines } from "./ushSidePanelLines";
import { buildUshTowelBarLines } from "./ushTowelBarLines";
import { buildUshVesselLines } from "./ushVesselLines";
import { buildCollectionSidePanelSku } from "../sku/buildCollectionSidePanelSku";

/**
 * Order lines of a collection priced from its `sku-profile.json` (D04): Class, Mako and Urban Low
 * Height, whose countertop, towel bar and side panels are priced as Urban Standard Height's.
 *
 * Read from C's state — cabinets, their sizes and the values addressed to each cabinet, basin
 * and drawer — rather than the scene, which these collections do not have yet (I07). The lines
 * have the shape and ids of the USH lines, so the price store, the bottom bar and Summary
 * treat them alike. Quantities follow USH: a basin, a vessel cutout and a vessel per sink base, the
 * top and the faucet holes once. What the collection has not confirmed comes back as gaps.
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
  "invalid-option": {
    owner: "product",
    reason: (attributeId) => `${attributeId} is unsupported or incompatible; no cabinet price request is allowed.`,
  },
  "invalid-dimension": {
    owner: "product",
    reason: (attributeId) => `${attributeId} is not a supported module dimension; no cabinet price request is allowed.`,
  },
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

/** Why a vessel the collection prices has no line: its colour does not give the SKU a material and a code. */
const UNPRICED_VESSEL: Record<"not-chosen" | "no-material", { owner: string; reason: string }> = {
  "not-chosen": { owner: "C", reason: "VesselColor is not chosen, so the vessel has no price." },
  "no-material": {
    owner: "product",
    reason: "VesselColor is set to a value the collection names no material for, so the vessel has no price.",
  },
};

/** Retain an explicit gap rather than pricing an unknown Lower finish as its cabinet's colour. */
const UNPRICED_CABINET_COVER = {
  owner: "product",
  reason:
    "The lower countertop cover has no price: its applied colour/material, the countertop style or the supporting cabinet depth is unknown or unsupported.",
};

/** A collection offers Lower before its cover SKU is confirmed: the cover is ordered, its price unknown. */
const UNCONFIRMED_CABINET_COVER_SKU = {
  owner: "product",
  reason:
    "The lower countertop has no confirmed SKU or price for this collection yet: it is shown in the scene but not priced.",
};

/** Why a countertop priced as Urban Standard Height's has no top line. */
const UNPRICED_USH_COUNTERTOP =
  "The countertop has no Urban Standard Height price here: the countertop table gives no thickness for its material at this depth, or its colour names no material.";

/** A gap concerns this order when a value the order uses for the attribute it names is one it covers. */
const gapApplies = (
  { appliesWhen }: CollectionSkuProfile["gaps"][number],
  usedValuesOf: (attributeId: string) => (string | null)[],
  profile: ProductProfile | null,
  readConfiguratorColor: ConfiguratorColorReader,
): boolean => {
  if (!appliesWhen) return false;
  const { attributeId, values: coveredValues, categories } = appliesWhen;

  return usedValuesOf(attributeId).some((text) => {
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

/** The styles of the organizer sets the order holds: what stands in for `DividersStyle`, which these organizers do not read. */
const organizerStylesOf = (
  readModel: Readonly<Record<string, DrawerOrganizersRead>>,
  cabinets: readonly CabinetEntry[],
): string[] =>
  cabinets.flatMap(({ stableKey }) => {
    const read = readModel[stableKey];
    return read?.status === "ok" ? [read.value.Top, read.value.Bot].flatMap((set) => (set ? [set.style] : [])) : [];
  });

export const buildCollectionPricingLines = (input: PricingInput): CollectionPricingResult => {
  const skuProfile = input.skuBuilders.collectionProfile;
  if (!skuProfile) return { lines: [], gaps: [] };

  const { activeProfile: profile, configurationValues: values, dimensionsByCabinet, placedCabinetStyles } = input;
  const readConfiguratorColor = createConfiguratorColorReader(profile, input.configurator ?? null);
  // The cabinet type the scene placed, read through the collection's scene types (a Mako sink
  // base is a Mako-sink-cabinet in the scene); its drawer style tells a short cabinet apart.
  const cabinetTypeOf = (runtimeId: string) =>
    resolveCabinetTypeOfRuntimeId(profile, input.runtimeBindings ?? null, runtimeId, placedCabinetStyles[runtimeId]);
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
  if ("status" in skuProfile.countertop && cabinets.length > 0)
    gaps.push({ group: "countertop", blocksTotal: true, owner: "product/API", reason: skuProfile.countertop.reason });
  const add = (line: PricingLine) => {
    if (line.sku && line.quantity > 0) lines.push(line);
  };

  // Configuration-wide values: cabinet colours of Class, the countertop.
  const globalValue = (attributeId: string) => valueAt(values, attributeId, { scope: "global" });
  const countertopValue = (attributeId: string, legacy: string | null) =>
    valueAt(values, attributeId, { scope: "countertop" }) ?? (legacy || null);
  // Until a cabinet colour is chosen, the one the builder starts from: the collection's default.
  const startingCabinetColor = asText(input.cabinetColor);

  // A value of one cabinet: its own, the configuration's, else what the state holds for them all —
  // the composition's value, recorded at the first cabinet (a Mako model's handle colour) — else
  // the collection's default, as a Class frame colour nobody has chosen yet.
  const readerOf = (entry: CabinetEntry): CollectionValueReader => {
    const cabinetTarget: ValueTarget = { scope: "cabinet", cabinetId: entry.stableKey };
    return (attributeId) => {
      if (attributeId === "CabinetType") return cabinetTypeOf(entry.runtimeId);
      // An open side shelf is spelled with the end it stands at: the first cabinet is L, any other R.
      if (attributeId === OPEN_SIDE_SHELF_SIDE) {
        return resolveOpenSideShelfSide({
          productIds: [entry.runtimeId],
          orderedProductIds: cabinets.map(({ runtimeId }) => runtimeId),
          fallbackIndex: entry.index,
        });
      }
      const own = valueAt(values, attributeId, cabinetTarget) ?? globalValue(attributeId);
      if (own) return own;
      if (attributeId === "Drawers") return placedCabinetStyles[entry.runtimeId] ?? null;
      // The handle chosen, else the composition's, recorded at the first cabinet: a restored
      // configuration has no choice yet, and its cabinets after the first must not lose the handle.
      if (attributeId === "Handle") {
        return (
          asText(input.selectedProductConfig?.Handle as string | undefined) ??
          asText(compositionValueOf(values.Handle, cabinets[0]?.stableKey))
        );
      }
      if (attributeId === "HandleGrooveColor") return asText(input.handleGrooveColor);
      if (attributeId === "CabinetColor") return startingCabinetColor;
      return (
        asText(compositionValueOf(values[attributeId], cabinets[0]?.stableKey)) ??
        asText(selectDefaultValue(profile, attributeId))
      );
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
      cabinetRule: findCabinetRule(input.cabinetCatalog, cabinetTypeOf(entry.runtimeId)),
      readConfiguratorColor,
    });

    cabinetSku.missing.forEach(({ attributeId, cause }) => missing.set(attributeId, cause));
    if (skuProfile.cabinet.requireCompleteInput && cabinetSku.missing.length) return;
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
  const panelContract = skuProfile.sidePanel && "baseSku" in skuProfile.sidePanel ? skuProfile.sidePanel : null;
  const activeSideCount = getActiveSidePanelCount(input.sidePanelLeft, input.sidePanelRight);
  const sideReadbackKnown = [input.sidePanelLeft, input.sidePanelRight].every((side) =>
    ["active", "none", "auto-removed"].includes(side),
  );
  const ownCompositionWidthCm =
    panelContract?.status === "confirmed" && panelContract.countertopWidthOffsetCm !== undefined && widthCm !== null
      ? sideReadbackKnown
        ? calcTotalCountertopWidthCm(widthCm, input.sidePanelLeft, input.sidePanelRight, getSidePanelWidthCm(profile))
        : null
      : widthCm;
  const ownCountertopWidthCm = hasCommittedCountertopLength ? committedCountertopLengthCm : ownCompositionWidthCm;
  // The basin and vessel colour the builder shows, for a sink base C holds none for.
  const builderBasinValues: Record<string, string> = { sinkType: input.sinkType, VesselColor: input.vesselColor };
  // A value of the basin of one sink base: its own, a cleared one too, as a switch to vessel clears
  // the basin there; else the composition's, which a model and a field record; else the builder's.
  const basinValueOf = (entry: CabinetEntry, attributeId: string) => {
    const own = values[attributeId]?.find(({ target }) =>
      isSameTarget(target, { scope: "basin", sinkBaseId: entry.stableKey }),
    );
    if (own) return asText(own.value);
    return valueAt(values, attributeId, { scope: "basin" }) ?? (builderBasinValues[attributeId] || null);
  };
  const basinOf = (entry: CabinetEntry) => basinValueOf(entry, "sinkType");
  const countertopStyle = countertopValue("CountertopStyle", input.countertopStyle);
  const countertopColor = countertopValue("CountertopColor", input.countertopColor);
  const countertopThickness = countertopValue("Thickness", input.countertopThickness);
  const faucetHoles = countertopValue("FaucetHolesAmount", input.faucetHolesAmount);

  if (hasOwnCountertop(skuProfile)) {
    const countertop = buildCollectionCountertopSkus(skuProfile, profile, {
      style: countertopStyle,
      color: countertopColor,
      thickness: countertopThickness,
      basins: sinkBases.map(basinOf),
      widthCm: cabinets.length > 0 ? ownCountertopWidthCm : null,
      faucetHoles,
      readConfiguratorColor,
    });

    if (countertop.top && ownCountertopWidthCm != null) {
      add({ id: "countertop:0", group: "countertop", sku: countertop.top, quantity: 1, widthCm: ownCountertopWidthCm });
    }
    // Tandem vanities: each clone of the top on a sink base set apart is one more top, at its own length.
    (input.tandemCountertopLengthsCm ?? []).forEach((tandemWidthCm, index) => {
      const tandem = buildCollectionCountertopSkus(skuProfile, profile, {
        style: countertopStyle,
        color: countertopColor,
        thickness: countertopThickness,
        basins: [],
        widthCm: tandemWidthCm,
        faucetHoles,
        readConfiguratorColor,
      });
      if (tandem.top)
        add({
          id: tandemCountertopLineId(index),
          group: "countertop",
          sku: tandem.top,
          quantity: 1,
          widthCm: tandemWidthCm,
        });
    });
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
    // The undertop runs along the whole composition, so it is priced per cm of its width; while it
    // names no colour of its own it is the handles' colour, as the scene paints it.
    if (skuProfile.undertop && cabinets.length > 0) {
      const { attributeId, fallbackColorAttributeId } = skuProfile.undertop;
      const undertopSku = buildCollectionUndertopSku(skuProfile, profile, {
        value: globalValue(attributeId),
        fallbackColor: fallbackColorAttributeId ? readerOf(cabinets[0])(fallbackColorAttributeId) : null,
        widthCm: ownCompositionWidthCm,
        readConfiguratorColor,
      });
      if (undertopSku) add({ id: "undertop", group: "undertop", sku: undertopSku, quantity: 1 });
    }
    // The vessel of each sink base of a vessel top, even before a colour prices the top and its cutout.
    // Sink bases with the same vessel in the same colour order it once, as many pieces as there are;
    // Summary reads the first.
    if (countertop.isVessel) {
      const vessels = new Map<string, { id: string; quantity: number }>();
      let unpricedVessel: CollectionCabinetSkuGap["cause"] | null = null;
      for (const entry of sinkBases) {
        const color = basinValueOf(entry, "VesselColor");
        const vessel = resolveCollectionVessel(skuProfile, profile, {
          basin: basinOf(entry),
          color,
          readConfiguratorColor,
        });
        if (!vessel) continue;
        if (!vessel.sku) {
          unpricedVessel ??= isChosenColor(profile, "VesselColor", color) ? "no-material" : "not-chosen";
          continue;
        }
        const ordered = vessels.get(vessel.sku);
        vessels.set(vessel.sku, {
          id: ordered?.id ?? (vessels.size === 0 ? "vessel" : `vessel:${entry.stableKey}`),
          quantity: (ordered?.quantity ?? 0) + 1,
        });
      }
      vessels.forEach(({ id, quantity }, sku) => add({ id, group: "vessel", sku, quantity }));
      if (unpricedVessel) gaps.push({ group: "input", blocksTotal: true, ...UNPRICED_VESSEL[unpricedVessel] });
    }
  } else if ("pricedAs" in skuProfile.countertop && countertopColor && cabinets.length > 0) {
    // A countertop priced as Urban Standard Height's (Urban Low Height): its SKUs and rules, on this
    // composition — as deep as its cabinets, as wide as they are with their side panels.
    const firstSize = dimensionsByCabinet[cabinets[0].stableKey];
    // A lifted top that carries the sink (`cabinets.liftSink`) leaves no sink base: its own basin is
    // the composition's, ordered once, and sized by the cabinet it was lifted from — the first one here.
    const hostedSink = sinkBases.length === 0 && input.hostedSink?.sinkType ? input.hostedSink : null;
    const sinkType = sinkBases.length > 0 ? basinOf(sinkBases[0]) : (hostedSink?.sinkType ?? null);
    const basinCabinet = sinkBases[0] ?? (hostedSink ? cabinets[0] : null);
    const basinCount = hostedSink ? 1 : sinkBases.length;
    // The countertop table sizes the top by the sink base of that basin (its minimum sink base width).
    const sinkBaseWidth = basinCabinet ? (dimensionsByCabinet[basinCabinet.stableKey]?.width ?? null) : null;
    const compositionWidthCm =
      widthCm === null
        ? null
        : calcTotalCountertopWidthCm(widthCm, input.sidePanelLeft, input.sidePanelRight, getSidePanelWidthCm(profile));
    const countertop = resolveUshCountertop(input, {
      color: countertopColor,
      sinkType,
      width: sinkBaseWidth,
      depth: firstSize?.depth ?? null,
    });
    const countertopLines = buildUshCountertopLines({
      series: SKU_SERIES_BY_COLLECTION["urban-standard-height"],
      countertop,
      style: countertopStyle ?? "",
      faucetHolesAmount: faucetHoles ?? "",
      sinkType,
      widthCm: hasCommittedCountertopLength ? committedCountertopLengthCm : compositionWidthCm,
      depthCm: firstSize?.depth ?? null,
      sinkBases: hostedSink
        ? [{ id: "hosted", sinkType: hostedSink.sinkType }]
        : sinkBases.map((entry) => ({ id: entry.stableKey, sinkType: basinOf(entry) })),
      sinkBaseCount: basinCount,
      tandemWidthsCm: input.tandemCountertopLengthsCm ?? [],
    });

    countertopLines.forEach(add);
    // The countertop table may give no thickness for the material at this depth, or the colour
    // may name no material: then there is no top to price, and the order says so.
    if (!countertopLines.some(({ group }) => group === "countertop")) {
      gaps.push({ group: "countertop", blocksTotal: true, owner: "product", reason: UNPRICED_USH_COUNTERTOP });
    }
    const vesselColor =
      sinkBases.length > 0 ? basinValueOf(sinkBases[0], "VesselColor") : (hostedSink?.vesselColor ?? null);
    buildUshVesselLines({
      profile,
      countertop,
      countertopColorSkuCandidatesByValue: input.colorSkuMaps.countertopColorSkuCandidatesByValue,
      sinkType,
      vesselColor,
      vesselColorSku: vesselColor ? readConfiguratorColor("VesselColor", vesselColor)?.sku : null,
      widthCm: compositionWidthCm,
      depthCm: firstSize?.depth ?? null,
      sinkBaseCount: basinCount,
    }).forEach(add);
  }

  // 3) Legs: the collection's own number of them, in their colour or the cabinet's, as the whole
  // composition holds the leg colour. Legs spelled by drawer style (Lame) always take the cabinet's
  // finish; the leg colour is then their caps', one per leg.
  const legs = skuProfile.legs;
  if (legs) {
    const legColor = asText(compositionValueOf(values.LegColor, cabinets[0]?.stableKey));
    const takesCabinetColor = legColor !== null && (!!legs.byDrawers || legColor === legs.cabinetColorValue);
    const legsSku = buildCollectionLegsSku(skuProfile, profile, {
      color: takesCabinetColor ? (globalValue("CabinetColor") ?? startingCabinetColor) : legColor,
      attributeId: takesCabinetColor ? "CabinetColor" : "LegColor",
      drawers: cabinets[0] ? readerOf(cabinets[0])("Drawers") : null,
      readConfiguratorColor,
    });

    if (legsSku) add({ id: "legs", group: "legs", sku: legsSku, quantity: legs.quantity });
    const capSku =
      legsSku && legs.cap
        ? buildCollectionLegCapSku(skuProfile, profile, {
            value: legColor,
            fallbackColor: cabinets[0] ? readerOf(cabinets[0])(legs.cap.fallbackColorAttributeId) : null,
            readConfiguratorColor,
          })
        : null;
    if (capSku) add({ id: "legCap", group: "legCap", sku: capSku, quantity: legs.quantity });
  }

  // 4) Organizers. A collection with Ph2 organizers orders what the scene holds, a column per unit; any
  // other collection, one per drawer that has a divider style.
  const organizerRules = readOrganizerRules(profile);
  const organizerReadModel = input.organizersByCabinet ?? {};
  if (organizerRules) {
    const organizers = buildOrganizerLines(organizerReadModel, cabinets, {
      skuByStyle: skuProfile.dividers,
      billEmptyColumns: ORGANIZER_BILL_EMPTY_COLUMNS,
    });
    organizers.lines.forEach(add);
    gaps.push(...organizers.gaps);
  } else {
    (values.DividersStyle ?? []).forEach(({ target, value }) => {
      const style = asText(value);
      const sku = style ? resolveCollectionDividerSku(skuProfile, style) : null;
      if (sku && target.scope === "drawer") {
        add({ id: `divider:${target.cabinetId}:${target.drawerType}`, group: "divider", sku, quantity: 1 });
      }
    });
  }

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
  if (skuProfile.sidePanel && "pricedAs" in skuProfile.sidePanel && cabinets.length > 0) {
    // A short cabinet (`ruleData.steppedModules`: the Urban Freestanding Short-Cabinet) stands lower
    // than the others, and the panel at its end has no confirmed height (P1125: a second panel
    // height, UFS-SP-01). That panel is left out and named a gap; the others take the size of the
    // first cabinet that is not short.
    const steppedModules = profile?.ruleData.steppedModules ?? [];
    const isShortCabinet = (entry: CabinetEntry | undefined) => {
      if (entry === undefined || steppedModules.length === 0) return false;
      const read = readerOf(entry);
      const drawersRaw = placedCabinetStyles[entry.runtimeId] ?? read("Drawers");
      const drawers = drawersRaw ? (normalizeOptionValue(profile, "Drawers", drawersRaw) ?? drawersRaw) : null;
      const typeRaw = read("CabinetType");
      const cabinetType = typeRaw ? (normalizeOptionValue(profile, "CabinetType", typeRaw) ?? typeRaw) : null;
      return steppedModules.some((module) => module.cabinetType === cabinetType && module.drawers === drawers);
    };
    const first = cabinets.find((entry) => !isShortCabinet(entry)) ?? cabinets[0];
    const shortLeft = input.sidePanelLeft === "active" && isShortCabinet(cabinets[0]);
    const shortRight = input.sidePanelRight === "active" && isShortCabinet(cabinets[cabinets.length - 1]);
    if (shortLeft || shortRight) {
      gaps.push({
        group: "sidePanel",
        blocksTotal: true,
        owner: "product",
        reason:
          "A side panel beside the Floor-Mount Short Cabinet has no height or SKU: the lower panel height is not given (P1125, UFS-SP-01). It is not priced.",
      });
    }
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
      sidePanelLeft: shortLeft ? "none" : input.sidePanelLeft,
      sidePanelRight: shortRight ? "none" : input.sidePanelRight,
      heightCm: size?.height ?? null,
      depthCm: size?.depth ?? null,
      cabinet: cabinetColor ? colorSku("CabinetColor", cabinetColor) : { materialSku: null, colorCode: null },
      groove: isChosenColor(profile, "HandleGrooveColor", grooveColor)
        ? colorSku("HandleGrooveColor", grooveColor)
        : { materialSku: null, colorCode: null },
    }).forEach(add);
  }

  // 7) Actual generated Lower panels, regardless of Upper offset, spelled in the Upper's style (INTG,
  // VES). Their colour comes from the published scene slab, while D is the nominal depth of the
  // supporting cabinet(s).
  const cover = skuProfile.cabinetCover;
  const coverSku = cover?.prefix && cover.thicknessIn ? { prefix: cover.prefix, thicknessIn: cover.thicknessIn } : null;
  if (cover && !coverSku && input.cabinetCovers?.length) {
    gaps.push({ group: "input", blocksTotal: true, ...UNCONFIRMED_CABINET_COVER_SKU });
  }
  if (cover && coverSku && input.cabinetCovers?.length) {
    const covers = new Map<
      string,
      { quantity: number; totalWidthCm: number; finish: NonNullable<PricingLine["finish"]> }
    >();
    const colorAttributeId = CABINET_COVER_COLOR_ATTRIBUTE_ID;
    // The Lower comes in the Upper's colours and is spelled as the Upper spells them. A countertop priced
    // as Urban Standard Height's: the material of the colour's swatch, unless its code names another
    // (as the USH top reads it), and the code its name ends in. A colour that is not one of the Upper's
    // (a cabinet colour the scene laid the slab in) names no material, so the slab stays unpriced.
    const spell = (color: string) => {
      if (!("pricedAs" in skuProfile.countertop)) {
        return {
          materialSku: resolveCollectionColorMaterial(
            skuProfile,
            profile,
            colorAttributeId,
            color,
            readConfiguratorColor,
          ),
          colorCode: resolveCollectionColorCode(skuProfile, color),
        };
      }
      const colorCode = extractColorCode(color);
      const swatchMaterial = resolveCountertopColorSkuFromCandidates({
        value: color,
        candidatesByValue: input.colorSkuMaps.countertopColorSkuCandidatesByValue,
      });
      return {
        materialSku: swatchMaterial ? (resolveCountertopMaterialSkuFromColorCode(colorCode) ?? swatchMaterial) : null,
        colorCode,
      };
    };
    // The scene names the slab's material as the countertop binding sends the colour ("Solid Surface
    // Matte White" for "Matte White"); a material that is one of the Upper's colours reads as itself.
    const colorOfMaterial = (materialId: string) =>
      readConfiguratorColor(colorAttributeId, materialId) || selectOption(profile, colorAttributeId, materialId)
        ? materialId
        : semanticValueOf(input.runtimeBindings ?? null, colorAttributeId, materialId);
    let unpriced = false;
    input.cabinetCovers.forEach(({ widthCm: coverWidthCm, cabinetIds, materialId }) => {
      const sceneColor = materialId ? colorOfMaterial(materialId) : null;
      const color = sceneColor ? (normalizeOptionValue(profile, colorAttributeId, sceneColor) ?? sceneColor) : null;
      const { materialSku, colorCode } = color ? spell(color) : { materialSku: null, colorCode: null };
      const depths = cabinetIds.map((id) => {
        const under = cabinets.find(({ runtimeId }) => runtimeId === id);
        return under ? (dimensionsByCabinet[under.stableKey]?.depth ?? null) : null;
      });
      const coverDepthCm = depths.length > 0 && depths.every((depth) => depth === depths[0]) ? depths[0] : null;
      const sku = buildCabinetCoverSku({
        prefix: coverSku.prefix,
        style: countertopStyle,
        widthCm: coverWidthCm,
        depthCm: coverDepthCm,
        thicknessIn: coverSku.thicknessIn,
        materialSku,
        colorCode,
      });
      // A SKU names its material and colour code, so the slabs of one SKU share the finish.
      if (sku && color && materialSku) {
        const previous = covers.get(sku);
        covers.set(sku, {
          quantity: (previous?.quantity ?? 0) + 1,
          totalWidthCm: (previous?.totalWidthCm ?? 0) + coverWidthCm,
          finish: previous?.finish ?? { color, materialSku },
        });
      } else unpriced = true;
    });
    [...covers].forEach(([sku, { quantity, totalWidthCm, finish }], index) =>
      add({
        id: index === 0 ? "cabinetCover" : `cabinetCover:${index}`,
        group: "cabinetCover",
        sku,
        quantity,
        // CT pricing is length-based. Preserve the total exact width even if rounded SKU tokens coincide.
        widthCm: totalWidthCm / quantity,
        finish,
      }),
    );
    if (unpriced) gaps.push({ group: "input", blocksTotal: true, ...UNPRICED_CABINET_COVER });
  }

  const ownPanel = skuProfile.sidePanel;
  if (ownPanel && "baseSku" in ownPanel && cabinets.length > 0) {
    const selected = globalValue(ownPanel.selection.attributeId) ?? asText(input.sidePanelsOption);
    const enabled = Boolean(selected && ownPanel.selection.enabledValues.includes(selected));
    if (!enabled && ownPanel.quantitySource === "activeSides" && (!sideReadbackKnown || activeSideCount > 0)) {
      gaps.push({
        group: "sidePanel",
        blocksTotal: true,
        owner: "runtime",
        reason: "Side panel selection and actual side activation disagree; scene synchronization is required.",
      });
    } else if (enabled) {
      const pricePanel = (entry: CabinetEntry, id: string, quantity: number | null) => {
        const read = readerOf(entry);
        const panel = buildCollectionSidePanelSku(ownPanel, skuProfile, profile, {
          quantity,
          color: ownPanel.colorAttributeId ? read(ownPanel.colorAttributeId) : null,
          readConfiguratorColor,
          read,
        });
        if (panel.sku && panel.quantity !== null)
          add({
            id,
            group: "sidePanel",
            sku: panel.sku,
            quantity: panel.quantity,
            finish: panel.finish,
            ...(ownPanel.variants ? { sourceId: entry.runtimeId } : {}),
          });
        else
          gaps.push({
            group: "sidePanel",
            blocksTotal: true,
            owner: "product",
            reason: panel.reason ?? "Panel pricing inputs are missing.",
          });
      };
      if (ownPanel.variants && ownPanel.quantitySource === "activeSides") {
        if (!sideReadbackKnown || activeSideCount === 0) {
          gaps.push({
            group: "sidePanel",
            blocksTotal: true,
            owner: "runtime",
            reason: "Actual side-panel activation is required before pricing.",
          });
        } else {
          // Each active end takes its own cabinet's variant and finish; insertion order cannot substitute the opposite end.
          const ordered = [...cabinets].sort((a, b) => {
            const ai = input.orderedProductIds.indexOf(a.runtimeId),
              bi = input.orderedProductIds.indexOf(b.runtimeId);
            return ai >= 0 && bi >= 0 ? ai - bi : a.index - b.index;
          });
          if (input.sidePanelLeft === "active") pricePanel(ordered[0], "sidePanel:left", 1);
          if (input.sidePanelRight === "active") pricePanel(ordered[ordered.length - 1], "sidePanel:right", 1);
        }
      } else {
        const rawQuantity = ownPanel.quantityAttributeId ? globalValue(ownPanel.quantityAttributeId) : null;
        pricePanel(
          cabinets[0],
          OWN_SIDE_PANEL_LINE_ID,
          ownPanel.quantitySource === "activeSides"
            ? sideReadbackKnown
              ? activeSideCount
              : null
            : rawQuantity === null
              ? null
              : Number(rawQuantity),
        );
      }
    }
  }

  // 7) What the order uses and the collection has not confirmed. The basins it uses are those of its
  // sink bases, read as the lines read them: a basin left by a sink base that is gone does not count.
  // The organizers of the order are not among the values: their sets stand in for DividersStyle, so the
  // unconfirmed divider price is named while the order has them and not otherwise.
  const usedValuesOf = (attributeId: string): (string | null)[] => {
    if (organizerRules && attributeId === "DividersStyle") return organizerStylesOf(organizerReadModel, cabinets);
    return selectAttribute(profile, attributeId)?.scope === "basin"
      ? sinkBases.map((entry) => basinValueOf(entry, attributeId))
      : (values[attributeId] ?? []).map(({ value }) => asText(value));
  };
  skuProfile.gaps.forEach((gap) => {
    if (gapApplies(gap, usedValuesOf, profile, readConfiguratorColor)) {
      gaps.push({ group: gap.group, blocksTotal: gap.blocksTotal, owner: gap.owner, reason: gap.reason });
    }
  });
  missing.forEach((cause, attributeId) => {
    const { owner, reason } = INPUT_GAP[cause];
    gaps.push({ group: "input", blocksTotal: true, owner, reason: reason(attributeId) });
  });

  return { lines, gaps };
};
