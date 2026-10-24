import { describe, expect, it } from "vitest";

import { buildFullDimensionsPayload, type FullDimensionsProduct } from "../refreshFullDimensions";

const NO_PANELS = { left: "None", right: "None" };

/** A placed product as the scene answers for it: its config (`getConfig`, sizes in cm) and where its entity stands (m). */
const product = (
  node: string,
  config: { Width?: number; Height: number; Depth: number } & Record<string, unknown>,
  positionM: { x: number; y: number } | null,
): FullDimensionsProduct => ({ node, config: { Thickness: "0.5", ...config }, positionM });

const labelSettings = { offset: 0.05, labelGap: "auto", labelPosition: "center", units: "in", decimals: 2 };

// Urban Duplex #29 (Multi-level): the Sink Base hangs over the Side Cabinet, shifted as the lower row is.
const udSink = { Width: 70, Height: 28, Depth: 50.5 };
const udSide = { Width: 90, Height: 28, Depth: 50.5 };
const udSinkAt = { x: 0.35, y: 0.28 };
const udMultiLevel = [product("ud-sink", udSink, udSinkAt), product("ud-side", udSide, { x: 1, y: 0 })];

describe("buildFullDimensionsPayload", () => {
  it("keeps today's payload for one level: the widths add up, the tallest cabinet, no line offsets", () => {
    // Urban Standard #29 as the scene lays it, 0.05 cm between the two cabinets.
    const payload = buildFullDimensionsPayload(
      [
        product("Sink-Base-a", { Width: 80, Height: 56, Depth: 50.5 }, { x: 0, y: 0 }),
        product("Sink-Base-b", { Width: 80, Height: 56, Depth: 50.5 }, { x: 0.8005000297688529, y: 0 }),
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
        product("ud-sink", { Width: 70, Height: 53, Depth: 46 }, { x: 0, y: 0.02999996367172897 }),
        product("ud-shelf", { Width: 15, Height: 53, Depth: 46 }, { x: 0.42550018328428263, y: 0 }),
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
        product("ulh-side-a", { Width: 80, Height: 38, Depth: 46 }, { x: 1.35, y: -0.38 }),
        product("ulh-side-b", { Width: 80, Height: 38, Depth: 46 }, { x: 2.1505, y: -0.38 }),
        product("ulh-sink", { Width: 120, Height: 38, Depth: 46 }, { x: 0.6, y: 0 }),
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
        product("tall", { Width: 60, Height: 56, Depth: 50.5 }, { x: 0.3, y: 0 }),
        product("floor", { Width: 70, Height: 28, Depth: 50.5 }, { x: 0.95, y: 0 }),
        product("hanging", { Width: 70, Height: 28, Depth: 50.5 }, { x: 0.95, y: 0.28 }),
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

  it("measures a cabinet off its laid-out place where it stands, without adding its SpatialOffsetM again", () => {
    // The entity already stands at the laid-out place plus the offset.
    const moved = product("ud-side", { ...udSide, SpatialOffsetM: { x: 0.1, y: 0, z: 0 } }, { x: 1.1, y: 0 });

    const payload = buildFullDimensionsPayload([product("ud-sink", udSink, udSinkAt), moved], {
      sidePanels: NO_PANELS,
      countertopThickness: "0.5",
      unit: "in",
    });

    expect(payload.box?.width).toEqual({ label: '61 "', offset: 0.05 });
  });

  it("measures a resized cabinet where the scene shows it, not at the position its config was added with", () => {
    // Urban Low Height #29 after Resize > Width of the Sink Base, 90 -> 105 cm: the scene laid it out at
    // 0..105 cm, its entity at 52.5 cm, while its config kept positionX 0.45.
    const payload = buildFullDimensionsPayload(
      [
        product(
          "ulh-side",
          { Width: 90, Height: 38, Depth: 46, positionX: 1.06, positionY: -0.38 },
          { x: 1.06, y: -0.38 },
        ),
        product(
          "ulh-shelf",
          { Width: 60, Height: 38, Depth: 46, positionX: 1.811, positionY: -0.38 },
          { x: 1.811, y: -0.38 },
        ),
        product("ulh-sink", { Width: 105, Height: 38, Depth: 46, positionX: 0.45, positionY: 0 }, { x: 0.525, y: 0 }),
      ],
      { sidePanels: NO_PANELS, countertopThickness: "0.5", unit: "in" },
    );

    // 211 cm, the box the scene measures; the config position gave 219 cm (86.2″).
    expect(payload.box?.width).toEqual({ label: '83.1 "', offset: 0.05 });
  });

  it("falls back to one level when a product has no position", () => {
    const unplaced = product("ud-side", udSide, null);

    const payload = buildFullDimensionsPayload([product("ud-sink", udSink, udSinkAt), unplaced], {
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
