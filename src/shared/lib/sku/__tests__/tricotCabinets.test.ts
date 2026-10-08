import { describe, expect, it } from "vitest";
import { tricotProfile, tricotSkuProfile, tricotTestBindings } from "@/entities/collection/__tests__/tricotFixtures";
import { buildCabinetCatalogFromProfile } from "@/entities/product/lib/matrixCabinet";
import { parseProductProfile } from "@/entities/collection/lib/parseProductProfile";
import { validateChange } from "@/features/configurationCommands/lib/validateChange";
import { buildCollectionPricingLines } from "@/shared/lib/pricing/buildCollectionPricingLines";
import { createSkuBuilders } from "../createSkuBuilders";
import { pricingInput } from "@/shared/lib/pricing/__tests__/fixtures/pricingScenarios";
import workbook from "@/shared/lib/pricing/__tests__/fixtures/tricot-cabinet-workbook.json";
import { buildCollectionCabinetSku } from "../buildCollectionSkus";

const patterns: Record<string, string> = { CAN: "Cannette", TWLL: "Twill", GES: "Gessato", SAT: "Satin", LOD: "Loden" };
const widths: Record<string, number> = { "15.7": 40, "23.6": 60, "31.5": 80, "39.4": 100, "47.2": 120 };
const drawers: Record<string, string> = { "1DW": "1", "2DW": "2", "1DWID": "1+inner" };
const values = {
  CabinetType: "Side-Cabinet",
  Drawers: "1",
  DrawerPanelFluting: "Twill",
  CabinetColor: "Noce Canaletto 933",
  HandleGrooveColor: "Zafferano 412 MT",
};
const build = (overrides: Record<string, string> = {}, widthCm = 40, heightCm = 40, depthCm = 52) =>
  buildCollectionCabinetSku(tricotSkuProfile, tricotProfile, {
    read: (id) => (({ ...values, ...overrides }) as Record<string, string>)[id] ?? null,
    widthCm,
    heightCm,
    depthCm,
  });

describe("Tricot custom cabinets and pricing", () => {
  it("exposes source-backed SB/SC dimensions and three drawer styles without Urban rules", () => {
    const catalog = buildCabinetCatalogFromProfile(tricotProfile, tricotTestBindings);
    expect(
      catalog.typeCabinetRules.map((rule) => ({
        type: rule.code,
        widths: rule.widths,
        heights: rule.heights,
        depths: rule.depths,
        drawers: rule.drawers,
        handles: rule.handlesAllowed,
      })),
    ).toEqual([
      {
        type: "Sink-Base",
        widths: [60, 80, 100, 120],
        heights: [40],
        depths: [52],
        drawers: ["1", "2", "1+inner"],
        handles: [],
      },
      {
        type: "Side-Cabinet",
        widths: [40, 60, 80, 100, 120],
        heights: [40],
        depths: [52],
        drawers: ["1", "2", "1+inner"],
        handles: [],
      },
    ]);
    expect(tricotProfile.sourceRefs).toEqual({
      configuratorId: 12,
      cabinetMatrixTableId: 592,
      countertopMatrixTableId: 593,
    });
    expect(tricotProfile.defaults).toMatchObject({
      CabinetColor: "Rovere Oro 932",
      DrawerPanelFluting: "Cannette",
      CountertopColor: "Matte White",
      sinkType: "LB440",
      SidePanels: "No",
    });
  });

  it("matches both complete SKU examples and their independently recorded workbook prices", () => {
    expect(build()).toEqual({ sku: "VAN-TRIC-SC/1DW/TWLL-15.7W-15.7H-20.5D-CAB-WDV-933-HDL-LACM-412", missing: [] });
    expect(
      build(
        {
          Drawers: "1DWID",
          DrawerPanelFluting: "Loden",
          CabinetColor: "Ambra 413 MT",
          HandleGrooveColor: "Ambra 413 MT",
        },
        120,
      ).sku,
    ).toBe("VAN-TRIC-SC/1DWID/LOD-47.2W-15.7H-20.5D-CAB-LACM-413-HDL-LACM-413");
    expect(workbook.cases.find(({ sourceCell }) => sourceCell === "B120")?.price).toBe(2014);
    expect(workbook.cases.find(({ sourceCell }) => sourceCell === "C172")?.price).toBe(3097);
  });

  it.each(workbook.cases.filter(({ baseSku }) => !baseSku.includes("-SP-")))(
    "matches workbook SKU at $sourceCell",
    ({ baseSku, material }) => {
      const match = /^VAN-TRIC-(SB|SC)\/(1DWID|1DW|2DW)\/(\w+)-([\d.]+)W-15.7H-20.5D$/.exec(baseSku);
      expect(match).not.toBeNull();
      if (!match) return;
      const color = material === "WDV" ? "Noce Canaletto 933" : "Antracite 400 MT";
      expect(
        build(
          {
            CabinetType: match[1] === "SB" ? "Sink-Base" : "Side-Cabinet",
            Drawers: drawers[match[2]],
            DrawerPanelFluting: patterns[match[3]],
            CabinetColor: color,
          },
          widths[match[4]],
        ).sku,
      ).toBe(`${baseSku}-CAB-${material}-${material === "WDV" ? "933" : "400"}-HDL-LACM-412`);
      expect(workbook.cases.filter(({ baseSku }) => !baseSku.includes("-SP-")).length).toBe(135);
    },
  );

  it("refuses unsupported or incomplete modules, colors and config words before pricing", () => {
    for (const result of [
      build({ CabinetType: "Sink-Base" }),
      build({}, 40, 56),
      build({}, 40, 40, 50.5),
      build({ Drawers: "3" }),
      build({ CabinetColor: "Other 999 MT" }),
      build({ HandleGrooveColor: "" }),
      build({ DrawerPanelFluting: "" }),
    ]) {
      expect(result.sku).toBe("");
      expect(result.missing.length).toBeGreaterThan(0);
    }
    expect(
      validateChange({ attributeId: "Drawers", scope: "cabinet", cabinetId: "cabinet-1", value: "3" }, tricotProfile)
        .ok,
    ).toBe(false);
    expect(
      parseProductProfile({
        ...tricotProfile,
        ruleData: {
          ...tricotProfile.ruleData,
          cabinetModules: [{ ...tricotProfile.ruleData.cabinetModules?.[0], widthsCm: [-1] }],
        },
      }).ok,
    ).toBe(false);
  });

  it("creates a cabinet order line but explicitly leaves unapproved countertop pricing incomplete", () => {
    const input = pricingInput({
      skuBuilders: createSkuBuilders({ status: "collection", collectionProfile: tricotSkuProfile }),
      activeProfile: tricotProfile,
      runtimeBindings: tricotTestBindings,
      cabinetEntries: [{ stableKey: "cabinet-1", runtimeId: "test-tricot-sc-1", index: 0 }],
      dimensionsByCabinet: { "cabinet-1": { width: 40, height: 40, depth: 52 } },
      placedCabinetStyles: { "test-tricot-sc-1": "1" },
      cabinetColor: "Noce Canaletto 933",
      handleGrooveColor: "Zafferano 412 MT",
      configurationValues: {
        DrawerPanelFluting: [{ target: { scope: "cabinet", cabinetId: "cabinet-1" }, value: "Twill" }],
      },
    });
    const result = buildCollectionPricingLines(input);
    expect(result.lines.filter(({ group }) => group === "cabinet").map(({ sku }) => sku)).toEqual([build().sku]);
    expect(result.lines.some(({ group }) => group === "countertop")).toBe(false);
    expect(result.gaps.some(({ group, blocksTotal }) => group === "countertop" && blocksTotal)).toBe(true);
  });
});
