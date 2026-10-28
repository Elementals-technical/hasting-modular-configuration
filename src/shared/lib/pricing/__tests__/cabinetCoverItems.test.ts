import { describe, expect, it } from "vitest";

import { cabinetCoverItems } from "../cabinetCoverItems";
import { appendUncoveredLines, resolveSummaryLinePrice } from "../summaryLinePrice";
import type { PricingLine } from "../types";

const cover: PricingLine = {
  id: "cabinetCover",
  group: "cabinetCover",
  sku: "CT-URHPL-INTG-35.4W-.5H-19.7D-HPL-TKH",
  quantity: 2,
  widthCm: 90,
  finish: { color: "Pulpis Chiaro TKH", materialSku: "HPL" },
};
const options = {
  priceOfLine: (line: PricingLine) => resolveSummaryLinePrice([{ line, entry: { status: "ready", value: 1594 } }]),
  swatchOf: (color: string) => ({ color: "#d8c8b0", image: `/swatches/${color}.png` }),
  thickness: '1/2"',
};

describe("Summary items of the Lower slabs", () => {
  it("shows each slab in the finish it is ordered in: its colour and material", () => {
    const items = cabinetCoverItems([cover], options);

    expect(items.map(({ id }) => id)).toEqual(["countertop-cabinetCover-0", "countertop-cabinetCover-1"]);
    expect(items[0]).toMatchObject({
      title: "Cabinet Cover",
      subtitle: '1/2"',
      sku: "CT-URHPL-INTG-35.4W-.5H-19.7D-HPL-TKH",
      price: "$1,594.00",
      lineIds: ["cabinetCover"],
      swatch: {
        label: "Cabinet Cover",
        value: "Pulpis Chiaro TKH",
        color: "#d8c8b0",
        image: "/swatches/Pulpis Chiaro TKH.png",
        materialSku: "HPL",
      },
      description: {
        "Product Category": "Cabinet Cover",
        Width: 90,
        Thickness: '1/2"',
        Material: "HPL",
        "Color Code": "Pulpis Chiaro TKH",
      },
    });
  });

  it("names the material as Summary names a countertop's, the SKU's token when it has no name", () => {
    const fenix = { ...cover, finish: { color: "Bianco Male TFA", materialSku: "FX" } };
    const solidSurface = { ...cover, id: "cabinetCover:1", finish: { color: "Matte White", materialSku: "SSTL" } };

    expect(cabinetCoverItems([fenix], options)[0].description.Material).toBe("Fenix");
    expect(cabinetCoverItems([solidSurface], options)[0].description.Material).toBe("SSTL");
  });

  it("shows only the Lower lines, and leaves none of them to the uncovered fallback", () => {
    const top: PricingLine = { id: "countertop:0", group: "countertop", sku: "CT-TOP", quantity: 1, widthCm: 90 };
    const items = cabinetCoverItems([top, cover], options);
    const sections = [{ id: "countertop", title: "Countertop", items }];

    appendUncoveredLines(sections, [cover], () => ({ status: "ready", value: 1594 }));
    expect(sections[0].items.map(({ id }) => id)).toEqual(["countertop-cabinetCover-0", "countertop-cabinetCover-1"]);
  });
});
