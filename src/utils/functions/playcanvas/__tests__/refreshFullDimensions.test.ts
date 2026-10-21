import { describe, expect, it } from "vitest";

import { buildFullDimensionsPayload, type FullDimensionsProduct } from "../refreshFullDimensions";

const NO_PANELS = { left: "None", right: "None" };

/** A placed product as `getConfig` answers for it: sizes in cm, positions in m. */
const product = (
  node: string,
  config: { Width?: number; Height: number; Depth: number; positionX?: number; positionY?: number } & Record<
    string,
    unknown
  >,
): FullDimensionsProduct => ({ node, config: { Thickness: "0.5", ...config } });

const labelSettings = { offset: 0.05, labelGap: "auto", labelPosition: "center", units: "in", decimals: 2 };

// Urban Duplex #29 (Multi-level): the Sink Base hangs over the Side Cabinet, shifted as the lower row is.
const udSink = { Width: 70, Height: 28, Depth: 50.5, positionX: 0.35, positionY: 0.28 };
const udSide = { Width: 90, Height: 28, Depth: 50.5, positionX: 1, positionY: 0 };
const udMultiLevel = [product("ud-sink", udSink), product("ud-side", udSide)];

describe("buildFullDimensionsPayload", () => {
  it("keeps today's payload for one level: the widths add up, the tallest cabinet, no line offsets", () => {
    // Urban Standard #29 as the scene lays it, 0.05 cm between the two cabinets.
    const payload = buildFullDimensionsPayload(
      [
        product("Sink-Base-a", { Width: 80, Height: 56, Depth: 50.5, positionX: 0, positionY: 0 }),
        product("Sink-Base-b", { Width: 80, Height: 56, Depth: 50.5, positionX: 0.8005000297688529, positionY: 0 }),
      ],
      { sidePanels: NO_PANELS, countertopThickness: "0.5", unit: "in" },
    );

    expect(payload).toEqual({
      box: {
        nodes: ["Sink-Base-a", "Sink-Base-b"],
        width: { label: '63 "', offset: 0.05 },
        depth: { label: '19.9 "' },
        heightSegments: { cabinet: { label: '22 "' }, countertop: { label: '0.5 "' } },
      },
      lines: [
        { node: "Sink-Base-a", axis: "x", label: '31.5 "' },
        { node: "Sink-Base-b", axis: "x", label: '31.5 "' },
      ],
      labelSettings,
    });
  });

  it("keeps a sink base a few cm above its side shelf on one level", () => {
    // Urban Duplex #8: the Sink Base stands 3 cm higher than the Open Side Shelf next to it.
    const payload = buildFullDimensionsPayload(
      [
        product("ud-sink", { Width: 70, Height: 53, Depth: 46, positionX: 0, positionY: 0.02999996367172897 }),
        product("ud-shelf", { Width: 15, Height: 53, Depth: 46, positionX: 0.42550018328428263, positionY: 0 }),
      ],
      { sidePanels: NO_PANELS, countertopThickness: "0.5", unit: "in" },
    );

    expect(payload.box?.width).toEqual({ label: '33.5 "', offset: 0.05 });
    expect(payload.box?.heightSegments).toEqual({ cabinet: { label: '20.9 "' }, countertop: { label: '0.5 "' } });
    expect(payload.lines?.every((line) => !("offset" in line))).toBe(true);
  });

  it("measures a multi-level composition as a whole and gives its upper level a line row of its own", () => {
    const payload = buildFullDimensionsPayload(udMultiLevel, {
      sidePanels: NO_PANELS,
      countertopThickness: "0.5",
      unit: "in",
    });

    // 145 cm from the left edge of the Sink Base to the right edge of the Side Cabinet; 56 cm of two levels.
    expect(payload.box?.width).toEqual({ label: '57.1 "', offset: 0.05 });
    expect(payload.box?.heightSegments).toEqual({ cabinet: { label: '22 "' }, countertop: { label: '0.5 "' } });
    const [sinkLine, sideLine] = payload.lines ?? [];
    expect(sinkLine).toMatchObject({ node: "ud-sink", label: '27.6 "' });
    expect(sinkLine?.offset).toBeCloseTo(0.11);
    expect(sideLine).toEqual({ node: "ud-side", axis: "x", label: '35.4 "' });
  });

  it("spans a lower row that reaches past the upper one", () => {
    // Urban Low Height #46: the 120 cm Sink Base over two 80 cm Side Cabinets that start at 95 cm.
    const payload = buildFullDimensionsPayload(
      [
        product("ulh-side-a", { Width: 80, Height: 38, Depth: 46, positionX: 1.35, positionY: -0.38 }),
        product("ulh-side-b", { Width: 80, Height: 38, Depth: 46, positionX: 2.1505, positionY: -0.38 }),
        product("ulh-sink", { Width: 120, Height: 38, Depth: 46, positionX: 0.6, positionY: 0 }),
      ],
      { sidePanels: NO_PANELS, countertopThickness: "0.5", unit: "in" },
    );

    expect(payload.box?.width).toEqual({ label: '100.4 "', offset: 0.05 });
    expect(payload.box?.heightSegments).toEqual({ cabinet: { label: '29.9 "' }, countertop: { label: '0.5 "' } });
    expect(payload.lines?.map((line) => [line.node, line.offset])).toEqual([
      ["ulh-side-a", undefined],
      ["ulh-side-b", undefined],
      ["ulh-sink", expect.closeTo(0.11)],
    ]);
  });

  it("levels cabinets by their bottom, so a tall cabinet beside a column does not merge its two levels", () => {
    const payload = buildFullDimensionsPayload(
      [
        product("tall", { Width: 60, Height: 56, Depth: 50.5, positionX: 0.3, positionY: 0 }),
        product("floor", { Width: 70, Height: 28, Depth: 50.5, positionX: 0.95, positionY: 0 }),
        product("hanging", { Width: 70, Height: 28, Depth: 50.5, positionX: 0.95, positionY: 0.28 }),
      ],
      { sidePanels: NO_PANELS, countertopThickness: "0.5", unit: "in" },
    );

    expect(payload.box?.width).toEqual({ label: '51.2 "', offset: 0.05 });
    expect(payload.lines?.map((line) => [line.node, line.offset === undefined ? 0 : 1])).toEqual([
      ["tall", 0],
      ["floor", 0],
      ["hanging", 1],
    ]);
  });

  it("places a product at its position plus its SpatialOffsetM", () => {
    const moved = product("ud-side", { ...udSide, SpatialOffsetM: { x: 0.1, y: 0, z: 0 } });

    const payload = buildFullDimensionsPayload([product("ud-sink", udSink), moved], {
      sidePanels: NO_PANELS,
      countertopThickness: "0.5",
      unit: "in",
    });

    expect(payload.box?.width).toEqual({ label: '61 "', offset: 0.05 });
  });

  it("falls back to one level when a product has no position", () => {
    const unplaced = product("ud-side", { ...udSide, positionY: undefined });

    const payload = buildFullDimensionsPayload([product("ud-sink", udSink), unplaced], {
      sidePanels: NO_PANELS,
      countertopThickness: "0.5",
      unit: "in",
    });

    expect(payload.box?.width).toEqual({ label: '63 "', offset: 0.05 });
    expect(payload.box?.heightSegments).toEqual({ cabinet: { label: '11 "' }, countertop: { label: '0.5 "' } });
    expect(payload.lines?.every((line) => !("offset" in line))).toBe(true);
  });

  it("adds 1 cm per side panel the scene took and labels in centimetres", () => {
    const payload = buildFullDimensionsPayload(udMultiLevel, {
      sidePanels: { left: "NoG", right: "None" },
      countertopThickness: "0.5",
      unit: "cm",
    });

    expect(payload.box?.width).toEqual({ label: "146 cm", offset: 0.05 });
    expect(payload.box?.heightSegments).toEqual({ cabinet: { label: "56 cm" }, countertop: { label: "1.3 cm" } });
    expect(payload.lines?.map((line) => line.label)).toEqual(["70 cm", "90 cm"]);
  });
});
