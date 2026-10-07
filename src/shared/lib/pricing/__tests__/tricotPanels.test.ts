import { describe, expect, it } from "vitest";
import {
  tricotProfile,
  tricotSkuProfile,
  tricotTestBindings,
  tricotUi,
} from "@/entities/collection/__tests__/tricotFixtures";
import { collectionSkuProfileSchema } from "@/entities/collection/model/schemas";
import type { CollectionOwnSidePanel } from "@/entities/collection/model/schemas";
import { buildCollectionSidePanelSku } from "@/shared/lib/sku/buildCollectionSidePanelSku";
import { createSkuBuilders } from "@/shared/lib/sku";
import { resolveSectionFields } from "@/features/collectionCustomization/lib/resolveSectionState";
import {
  derivePriceStatus,
  priceStoreReducer,
  setPricingGaps,
  setPricingLines,
  setSkuPriceEntries,
} from "@/entities/product/model/store/priceStore";
import { buildCollectionPricingLines } from "../buildCollectionPricingLines";
import { pricingInput } from "./fixtures/pricingScenarios";
import workbook from "./fixtures/tricot-cabinet-workbook.json";
import classSkuDocument from "../../../../../public/collections/class/sku-profile.json";
import type { PricingInput } from "../types";

/** Alternate explicit-quantity test contract; production uses confirmed active-side readback. */
const confirmed: CollectionOwnSidePanel = {
  baseSku: "VAN-TRIC-SP-.8W-15.7H-20.5D",
  status: "confirmed",
  selection: { attributeId: "SidePanels", enabledValues: ["Yes"] },
  quantityAttributeId: "testPanelQuantity",
  colorAttributeId: "CabinetColor",
  elementCode: "CAB",
};
const skuProfile = collectionSkuProfileSchema.parse({ ...tricotSkuProfile, sidePanel: confirmed, gaps: [] });
const input = (selected: string, quantity: number | null, profile = skuProfile) =>
  pricingInput({
    activeProfile: tricotProfile,
    runtimeBindings: tricotTestBindings,
    skuBuilders: createSkuBuilders({ status: "collection", collectionProfile: profile }),
    cabinetEntries: [{ stableKey: "cab-1", runtimeId: "test-tricot-sc-1", index: 0 }],
    dimensionsByCabinet: { "cab-1": { width: 40, height: 40, depth: 52 } },
    placedCabinetStyles: { "test-tricot-sc-1": "1" },
    cabinetColor: "Noce Canaletto 933",
    handleGrooveColor: "Zafferano 412 MT",
    sidePanelsOption: selected,
    configurationValues: {
      DrawerPanelFluting: [{ target: { scope: "cabinet", cabinetId: "cab-1" }, value: "Twill" }],
      SidePanels: [{ target: { scope: "global" }, value: selected }],
      ...(quantity === null ? {} : { testPanelQuantity: [{ target: { scope: "global" as const }, value: quantity }] }),
    },
  });

describe("Tricot own side panels", () => {
  const withSides = (
    left: PricingInput["sidePanelLeft"],
    right: PricingInput["sidePanelRight"],
    color = "Noce Canaletto 933",
    selected = "Yes",
  ) => ({
    ...input(selected, null, tricotSkuProfile),
    sidePanelLeft: left,
    sidePanelRight: right,
    cabinetColor: color,
  });

  it("declares the approved production suffix, inheritance and active-side quantity policy", () => {
    expect(tricotSkuProfile.sidePanel).toMatchObject({
      status: "confirmed",
      quantitySource: "activeSides",
      colorAttributeId: "CabinetColor",
      elementCode: "CAB",
      countertopWidthOffsetCm: 1,
    });
  });

  it.each([
    ["active", "none", 1],
    ["none", "active", 1],
    ["active", "active", 2],
    ["active", "auto-removed", 1],
    ["auto-removed", "active", 1],
  ] as const)("prices only active sides %s/%s as %s panels", (left, right, quantity) => {
    const result = buildCollectionPricingLines(withSides(left, right));
    expect(result.lines.filter((line) => line.group === "sidePanel")).toEqual([
      { id: "sidePanel:composition", group: "sidePanel", sku: "VAN-TRIC-SP-.8W-15.7H-20.5D-CAB-WDV-933", quantity },
    ]);
    expect(result.gaps.some((gap) => gap.group === "sidePanel")).toBe(false);
  });

  it.each([
    ["Noce Canaletto 933", "WDV-933"],
    ["Rovere Oro 932", "WDV-932"],
    ["Nero 433 MT", "LACM-433"],
  ])("inherits %s without a separate panel color", (color, suffix) => {
    const result = buildCollectionPricingLines(withSides("active", "none", color));
    expect(result.lines.find((line) => line.group === "sidePanel")?.sku).toBe(
      `VAN-TRIC-SP-.8W-15.7H-20.5D-CAB-${suffix}`,
    );
  });

  it("does not invent two panels before activation, nor silently omit a stale active panel after removal", () => {
    for (const data of [
      withSides("none", "none"),
      withSides("auto-removed", "none"),
      withSides("active", "none", undefined, "No"),
    ]) {
      const result = buildCollectionPricingLines(data);
      expect(result.lines.some((line) => line.group === "sidePanel")).toBe(false);
      expect(result.gaps.some((gap) => gap.group === "sidePanel" && gap.blocksTotal)).toBe(true);
    }
    const removed = buildCollectionPricingLines(withSides("none", "none", undefined, "No"));
    expect(removed.lines.some((line) => line.group === "sidePanel")).toBe(false);
    expect(removed.gaps.some((gap) => gap.group === "sidePanel")).toBe(false);
  });

  it("requires known readback for both sides, including legacy snapshots with missing side state", () => {
    const data = { ...withSides("active", "none"), sidePanelRight: undefined } as unknown as PricingInput;
    const result = buildCollectionPricingLines(data);
    expect(result.lines.some((line) => line.group === "sidePanel")).toBe(false);
    expect(result.gaps.some((gap) => gap.group === "sidePanel" && gap.blocksTotal)).toBe(true);
  });

  it("inherits the committed global cabinet color over stale legacy color", () => {
    const data = withSides("active", "none");
    const result = buildCollectionPricingLines({
      ...data,
      configurationValues: {
        ...data.configurationValues,
        CabinetColor: [{ target: { scope: "global" }, value: "Rovere Oro 932" }],
      },
    });
    expect(result.lines.find((line) => line.group === "sidePanel")?.sku).toBe(
      "VAN-TRIC-SP-.8W-15.7H-20.5D-CAB-WDV-932",
    );
  });

  it.each([
    ["none", "none", 40],
    ["active", "none", 41],
    ["none", "active", 41],
    ["active", "active", 42],
  ] as const)("adds the approved +1 cm per active side to shared-top width %s/%s", (left, right, widthCm) => {
    // Explicit test top contract only: does not approve production GB price mappings.
    const profile = collectionSkuProfileSchema.parse({ ...tricotSkuProfile, countertop: classSkuDocument.countertop });
    const data = {
      ...withSides(left, right, undefined, widthCm === 40 ? "No" : "Yes"),
      skuBuilders: createSkuBuilders({ status: "collection", collectionProfile: profile }),
      countertopColor: "Matte White",
      sinkType: "LB440",
    };
    expect(buildCollectionPricingLines(data).lines.find((line) => line.group === "countertop")?.widthCm).toBe(widthCm);
    expect(
      buildCollectionPricingLines({ ...data, committedCountertopLengthCm: 88 }).lines.find(
        (line) => line.group === "countertop",
      )?.widthCm,
    ).toBe(88);
    // No opt-in policy means existing Class/Mako-style width semantics are unchanged.
    const legacyPanel = collectionSkuProfileSchema.parse({ ...profile, sidePanel: confirmed });
    expect(
      buildCollectionPricingLines({
        ...data,
        skuBuilders: createSkuBuilders({ status: "collection", collectionProfile: legacyPanel }),
      }).lines.find((line) => line.group === "countertop")?.widthCm,
    ).toBe(40);
  });
  it("renders source Yes/None and does not translate them to Urban groove variants", () => {
    expect(
      resolveSectionFields(tricotUi, "side-panels", tricotProfile, {}, {})[0].field.options.map(({ value, label }) => [
        value,
        label,
      ]),
    ).toEqual([
      ["Yes", "Yes"],
      ["No", "None"],
    ]);
  });

  it.each([
    ["Noce Canaletto 933", "WDV", "933", 984],
    ["Antracite 400 MT", "LACM", "400", 941],
  ])("spells the audited %s panel and matches its workbook price", (color, material, code, price) => {
    const panel = buildCollectionSidePanelSku(confirmed, skuProfile, tricotProfile, {
      quantity: 1,
      color: String(color),
    });
    expect(panel).toEqual({ sku: `VAN-TRIC-SP-.8W-15.7H-20.5D-CAB-${material}-${code}`, quantity: 1 });
    expect(
      workbook.cases.find((entry) => entry.baseSku === confirmed.baseSku && entry.material === material)?.price,
    ).toBe(price);
  });

  it.each([1, 2, 3])("uses the explicitly supplied quantity %s, never an Urban default", (quantity) => {
    const result = buildCollectionPricingLines(input("Yes", quantity));
    expect(result.lines.filter(({ group }) => group === "sidePanel")).toEqual([
      { id: "sidePanel:composition", group: "sidePanel", sku: "VAN-TRIC-SP-.8W-15.7H-20.5D-CAB-WDV-933", quantity },
    ]);
    expect(result.gaps.some(({ group }) => group === "sidePanel")).toBe(false);
  });

  it("omits deselected panels without requiring a quantity or creating a panel gap", () => {
    const result = buildCollectionPricingLines(input("No", null));
    expect(result.lines.some(({ group }) => group === "sidePanel")).toBe(false);
    expect(result.gaps.some(({ group }) => group === "sidePanel")).toBe(false);
  });

  it.each([null, 0, -1, 1.5, Number.NaN])("does not price a selected panel with invalid quantity %s", (quantity) => {
    const result = buildCollectionPricingLines(input("Yes", quantity));
    expect(result.lines.some(({ group }) => group === "sidePanel")).toBe(false);
    expect(result.gaps.some(({ group, blocksTotal }) => group === "sidePanel" && blocksTotal)).toBe(true);
  });

  it("keeps selected panels incomplete without active-side readback and rejects missing/ambiguous contracts", () => {
    const result = buildCollectionPricingLines(input("Yes", 2, tricotSkuProfile));
    expect(result.lines.some(({ group }) => group === "sidePanel")).toBe(false);
    expect(result.gaps.some(({ group, blocksTotal }) => group === "sidePanel" && blocksTotal)).toBe(true);
    const state = [
      setPricingLines(result.lines),
      setPricingGaps(result.gaps),
      setSkuPriceEntries(Object.fromEntries(result.lines.map(({ sku }) => [sku, { status: "ready", value: 2014 }]))),
    ].reduce((state, action) => priceStoreReducer(state, action), priceStoreReducer(undefined, { type: "init" }));
    expect(derivePriceStatus(state)).toBe("partial");
    expect(
      collectionSkuProfileSchema.safeParse({
        ...skuProfile,
        sidePanel: { ...confirmed, quantityAttributeId: undefined },
      }).success,
    ).toBe(false);
    expect(
      collectionSkuProfileSchema.safeParse({
        ...skuProfile,
        sidePanel: { ...confirmed, quantitySource: "activeSides" },
      }).success,
    ).toBe(false);
    expect(
      buildCollectionSidePanelSku(confirmed, skuProfile, tricotProfile, { quantity: 1, color: "Foreign 999" }).sku,
    ).toBeNull();
  });
});
