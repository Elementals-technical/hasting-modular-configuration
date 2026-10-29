import { describe, expect, it } from "vitest";
import { buildCollectionPricingLines } from "../buildCollectionPricingLines";
import { LAME, collectionPricingInput, at } from "./fixtures/collectionPricingScenarios";
import { calcTotalCountertopWidthCm, getSidePanelWidthCm } from "@/entities/countertop";
import { resolveSummaryLinePrice } from "../summaryLinePrice";
import type { PricingInput } from "../types";
import { buildFullDimensionsPayload } from "@/utils/functions/playcanvas/refreshFullDimensions";
import { projectedTotalAfterGrooveChange } from "@/widgets/AccessoriesSections/lib/sidePanelOptions";
import { mapCabinetTypeToGroup } from "@/features/sidePanel/model/selectors";
import { mapSidePanelDrawersToHandleType, sidePanelAvailabilityRule } from "@/features/sidePanel/lib/sidePanelRules";

const input = (
  left: PricingInput["sidePanelLeft"],
  right: PricingInput["sidePanelRight"],
  drawers = "2",
  pattern = "Oxford",
) =>
  collectionPricingInput(
    LAME,
    [
      {
        stableKey: "cab-1",
        runtimeId: "Lame-sink-cabinet-one",
        size: { width: 60, height: drawers === "1" ? 26 : 52, depth: 52 },
      },
    ],
    {
      SidePanels: [at({ scope: "global" }, left === "active" || right === "active" ? "NoG" : "None")],
      CabinetPattern: [at({ scope: "global" }, pattern)],
      Drawers: [at({ scope: "cabinet", cabinetId: "cab-1" }, drawers)],
      Handle: [at({ scope: "global" }, "G58")],
      CabinetColor: [at({ scope: "global" }, "Fumo 401 MT")],
      HandleColor: [at({ scope: "global" }, "Fumo 401 MT")],
    },
    {
      sidePanelsOption: left === "active" || right === "active" ? "NoG" : "None",
      sidePanelLeft: left,
      sidePanelRight: right,
    },
  );

const panels = (data: PricingInput) =>
  buildCollectionPricingLines(data).lines.filter((line) => line.group === "sidePanel");

describe("Lamè side-panel order", () => {
  it("prices each active side with the workbook2DW SKU and counts two pieces for both", () => {
    const lines = panels(input("active", "active"));
    expect(lines.reduce((sum, line) => sum + line.quantity, 0)).toBe(2);
    expect(lines.every((line) => line.sku === "VAN-LAMEV-SP/2DW/OXF-2.0W-20.5H-20.5D-CAB-LACM-401")).toBe(true);
    expect(lines.map((line) => line.id)).toEqual(["sidePanel:left", "sidePanel:right"]);
    const quote = resolveSummaryLinePrice(
      lines.map((line) => ({ line, entry: { status: "ready", value: 3345 }, pieces: line.quantity })),
    );
    expect(quote.price).toBe("$6,690.00");
  });
  it("selects1DW and its actual pattern without a cabinet handle token", () => {
    expect(panels(input("active", "none", "1", "Plisse"))[0]?.sku).toBe(
      "VAN-LAMEV-SP/1DW/PLIS-2.0W-10.2H-20.5D-CAB-LACM-401",
    );
  });
  it("removal and auto-removal never leave charged panels", () => {
    expect(panels(input("none", "none"))).toEqual([]);
    expect(panels(input("auto-removed", "none"))).toEqual([]);
    expect(panels(input("active", "auto-removed"))).toHaveLength(1);
  });
  it("adds5cm per actual active side, keeping panel-off unchanged", () => {
    const width = getSidePanelWidthCm(LAME.profile);
    expect(width).toBe(5);
    expect(calcTotalCountertopWidthCm(120, "active", "active", width)).toBe(130);
    expect(calcTotalCountertopWidthCm(120, "active", "none", width)).toBe(125);
    expect(calcTotalCountertopWidthCm(120, "none", "none", width)).toBe(120);
  });
  it("blocks unsupported patterns instead of substituting a different product", () => {
    const result = buildCollectionPricingLines(input("active", "active", "2", "unknown"));
    expect(result.lines.some((line) => line.group === "sidePanel")).toBe(false);
    expect(result.gaps.some((gap) => gap.group === "sidePanel" && gap.blocksTotal)).toBe(true);
  });

  it.each([
    ["Galles", "GAL"],
    ["Gessato", "GES"],
    ["Oxford", "OXF"],
    ["Piquet", "PIQ"],
    ["Plisse", "PLIS"],
  ])("matches the workbook variant for %s, in both heights and finishes", (pattern, token) => {
    for (const drawers of ["1", "2"]) {
      for (const finish of ["MT", "GL"]) {
        const data = input("active", "active", drawers, pattern);
        data.configurationValues = {
          ...data.configurationValues,
          CabinetColor: [at({ scope: "global" }, `Fumo 401 ${finish}`)],
        };
        expect(panels(data).map((line) => line.sku)).toEqual(
          Array(2).fill(
            `VAN-LAMEV-SP/${drawers}DW/${token}-2.0W-${drawers === "1" ? "10.2" : "20.5"}H-20.5D-CAB-LAC${finish === "MT" ? "M" : "G"}-401`,
          ),
        );
      }
    }
  });

  it("uses actual end order and the colour of each end cabinet", () => {
    const data = input("active", "active");
    data.cabinetEntries = [
      { stableKey: "cab-1", runtimeId: "Lame-sink-cabinet-one", index: 0 },
      { stableKey: "cab-2", runtimeId: "Lame-side-cabinet-two", index: 1 },
    ];
    data.dimensionsByCabinet = { ...data.dimensionsByCabinet, "cab-2": { width: 40, height: 52, depth: 52 } };
    data.orderedProductIds = ["Lame-side-cabinet-two", "Lame-sink-cabinet-one"];
    data.configurationValues = {
      ...data.configurationValues,
      Drawers: [at({ scope: "global" }, "2")],
      CabinetColor: [
        at({ scope: "cabinet", cabinetId: "cab-1" }, "Fumo 401 MT"),
        at({ scope: "cabinet", cabinetId: "cab-2" }, "Latte 417 GL"),
      ],
    };
    expect(panels(data).map(({ id, sku, sourceId, quantity }) => ({ id, sku, sourceId, quantity }))).toEqual([
      {
        id: "sidePanel:left",
        sku: "VAN-LAMEV-SP/2DW/OXF-2.0W-20.5H-20.5D-CAB-LACG-417",
        sourceId: "Lame-side-cabinet-two",
        quantity: 1,
      },
      {
        id: "sidePanel:right",
        sku: "VAN-LAMEV-SP/2DW/OXF-2.0W-20.5H-20.5D-CAB-LACM-401",
        sourceId: "Lame-sink-cabinet-one",
        quantity: 1,
      },
    ]);
  });

  it("does not quote a selected panel before side activation is known", () => {
    const data = input("active", "active");
    data.sidePanelLeft = "none";
    data.sidePanelRight = "none";
    const result = buildCollectionPricingLines(data);
    expect(panels(data)).toEqual([]);
    expect(result.gaps.some((gap) => gap.group === "sidePanel" && gap.blocksTotal)).toBe(true);
  });

  it("sizes the countertop guard and dimension overlay with 5cm per active side", () => {
    expect(projectedTotalAfterGrooveChange("NoG", "both", 220, "none", "none", LAME.profile)).toBe(230);
    expect(projectedTotalAfterGrooveChange("NoG", "left", 200, "none", "none", LAME.profile)).toBe(205);
    const payload = buildFullDimensionsPayload(
      [{ node: "cab", config: { Width: 60, Height: 26, Depth: 52 }, positionM: null }],
      { unit: "cm", sidePanels: { left: "NoG", right: "NoG" }, panelWidthCm: getSidePanelWidthCm(LAME.profile) },
    );
    expect(payload.box?.width).toEqual({ label: "70 cm", offset: 0.05 });
    expect(payload.lines?.[0]?.label).toBe("60 cm");
  });

  it.each([
    ["1", 26],
    ["2", 52],
  ] as const)("offers the plain panel for drawer style %s", (drawers, height) => {
    const result = sidePanelAvailabilityRule(
      {
        height,
        cabinetType: mapCabinetTypeToGroup("Lame-sink-cabinet-one", LAME.profile),
        handleType: mapSidePanelDrawersToHandleType(drawers, LAME.profile),
      },
      LAME.profile,
    );
    expect([...result.allowed]).toEqual(["NoG"]);
  });
});
