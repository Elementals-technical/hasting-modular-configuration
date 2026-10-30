import { describe, expect, it } from "vitest";

import { OWN_SIDE_PANEL_END_LINE_IDS, OWN_SIDE_PANEL_LINE_ID, ownSidePanelItems } from "../ownSidePanelItems";
import { appendUncoveredLines, resolveSummaryLinePrice } from "../summaryLinePrice";
import type { PricingLine } from "../types";

const panel: PricingLine = {
  id: OWN_SIDE_PANEL_LINE_ID,
  group: "sidePanel",
  sku: "VAN-TRIC-SP-.8W-15.7H-20.5D-CAB-WDV-933",
  quantity: 2,
  finish: { color: "Noce Canaletto 933", materialSku: "WDV" },
};
const options = {
  priceOfLine: (line: PricingLine) => resolveSummaryLinePrice([{ line, entry: { status: "ready", value: 984 } }]),
  swatchOf: (color: string) => ({ color: "#6b4f3a", image: `/swatches/${color}.png` }),
  sidePanelLeft: "active" as const,
  sidePanelRight: "active" as const,
  panelType: "No groove",
  panelWidthCm: 5,
};

// Lamè: each end in its own cabinet's variant and finish (the order of lameSidePanels.test.ts).
const lameLeft: PricingLine = {
  id: OWN_SIDE_PANEL_END_LINE_IDS.left,
  group: "sidePanel",
  sku: "VAN-LAMEV-SP/2DW/OXF-2.0W-20.5H-20.5D-CAB-LACG-417",
  quantity: 1,
  sourceId: "Lame-side-cabinet-two",
  finish: { color: "Latte 417 GL", materialSku: "LACG" },
};
const lameRight: PricingLine = {
  id: OWN_SIDE_PANEL_END_LINE_IDS.right,
  group: "sidePanel",
  sku: "VAN-LAMEV-SP/2DW/OXF-2.0W-20.5H-20.5D-CAB-LACM-401",
  quantity: 1,
  sourceId: "Lame-sink-cabinet-one",
  finish: { color: "Fumo 401 MT", materialSku: "LACM" },
};
const lameOptions = { ...options, panelType: "Yes" };

describe("Summary items of a collection's own side panels", () => {
  it("shows a piece per active side, in the finish the line is ordered in", () => {
    const items = ownSidePanelItems([panel], options);

    expect(items.map(({ id, title }) => [id, title])).toEqual([
      ["accessories-side-panel-left", "Side Panel Left"],
      ["accessories-side-panel-right", "Side Panel Right"],
    ]);
    expect(items[1]).toMatchObject({
      subtitle: "No groove",
      sku: "VAN-TRIC-SP-.8W-15.7H-20.5D-CAB-WDV-933",
      price: "$984.00",
      lineIds: [OWN_SIDE_PANEL_LINE_ID],
      swatch: {
        label: "Cabinet",
        value: "Noce Canaletto 933",
        color: "#6b4f3a",
        image: "/swatches/Noce Canaletto 933.png",
        materialSku: "WDV",
      },
      description: {
        "Product Category": "Side Panel",
        "Panel Type": "No groove",
        Side: "right",
        "Cabinet Color": "Noce Canaletto 933",
        elements: [{ "Product Elements": "Cabinet", Material: "WDV", "Color Code": "Noce Canaletto 933" }],
      },
    });
  });

  it("shows only the active side", () => {
    const items = ownSidePanelItems([{ ...panel, quantity: 1 }], { ...options, sidePanelLeft: "auto-removed" });

    expect(items.map(({ title }) => title)).toEqual(["Side Panel Right"]);
  });

  it("shows a panel priced per end in the finish of its own end cabinet", () => {
    const items = ownSidePanelItems([lameLeft, lameRight], lameOptions);

    expect(items.map(({ id, title, sku }) => [id, title, sku])).toEqual([
      ["accessories-side-panel-left", "Side Panel Left", lameLeft.sku],
      ["accessories-side-panel-right", "Side Panel Right", lameRight.sku],
    ]);
    expect(items[0]).toMatchObject({
      price: "$984.00",
      lineIds: [OWN_SIDE_PANEL_END_LINE_IDS.left],
      swatch: { label: "Cabinet", value: "Latte 417 GL", color: "#6b4f3a", materialSku: "LACG" },
      description: {
        "Product Category": "Side Panel",
        Side: "left",
        Width: 5,
        "Cabinet Color": "Latte 417 GL",
        elements: [{ "Product Elements": "Cabinet", Material: "Lacquered Gloss", "Color Code": "Latte 417 GL" }],
      },
    });
    expect(items[1].swatch).toMatchObject({ value: "Fumo 401 MT", materialSku: "LACM" });
  });

  it("gives a panel priced per end no subtitle: its choice only reads Yes", () => {
    const [item] = ownSidePanelItems([lameLeft], lameOptions);

    expect(item.subtitle).toBeUndefined();
    expect(item.description).not.toHaveProperty("Panel Type");
  });

  it("shows a panel priced per end only where the order has its line", () => {
    const items = ownSidePanelItems([lameRight], { ...lameOptions, sidePanelLeft: "active" });

    expect(items.map(({ title }) => title)).toEqual(["Side Panel Right"]);
  });

  it("leaves the Urban Standard Height panel line to the page, and shows nothing without a line", () => {
    const ushPanel: PricingLine = { id: "sidePanel", group: "sidePanel", sku: "VAN-URSP-0G", quantity: 2 };

    expect(ownSidePanelItems([ushPanel], options)).toEqual([]);
    expect(ownSidePanelItems([], options)).toEqual([]);
  });

  it.each([
    ["the composition line", [panel]],
    ["the lines per end", [lameLeft, lameRight]],
  ])("leaves none of %s to the uncovered fallback", (_name, lines) => {
    const sections = [{ id: "accessories", title: "Accessories", items: ownSidePanelItems(lines, options) }];

    appendUncoveredLines(sections, lines, () => ({ status: "ready", value: 984 }));
    expect(sections[0].items.map(({ id }) => id)).toEqual([
      "accessories-side-panel-left",
      "accessories-side-panel-right",
    ]);
  });
});
