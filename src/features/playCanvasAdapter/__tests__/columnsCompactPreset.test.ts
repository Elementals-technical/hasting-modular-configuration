import { describe, expect, it } from "vitest";

import urbanDuplexBindingsDocument from "../../../../public/collections/urban-duplex/runtime-bindings.json";
import urbanDuplexPresets from "../../../../public/collections/urban-duplex/presets.json";
import { parseRuntimeBindings } from "@/entities/collection";

import type { CompactPresetSource } from "../lib/applyCompactPreset";
import { columnsCollectionOf, toColumnsCompactPreset } from "../lib/columnsCompactPreset";
import { createCompositionPort, type SceneCompositionBridge } from "../lib/createCompositionPort";
import { createTestSceneReader } from "../lib/testSceneReader";

const parsed = parseRuntimeBindings(urbanDuplexBindingsDocument);
if (!parsed.ok) throw new Error("the packaged Urban Duplex bindings must parse");
const port = createCompositionPort({
  getBindings: () => parsed.bindings,
  scene: {} as SceneCompositionBridge,
  reader: createTestSceneReader().reader,
});
const translate = port.toSceneProduct;

const UD = columnsCollectionOf("urban-duplex");
if (!UD) throw new Error("Urban Duplex lays its cabinets in columns");

const presetOf = (id: number) => {
  const preset = urbanDuplexPresets.find((entry) => entry.id === id);
  if (!preset) throw new Error(`no Urban Duplex preset ${id}`);
  return preset as CompactPresetSource;
};

const COLOURS = {
  CabinetColor: "Bianco Calce DA ST",
  CabinetColorLateral: "Pulpis Chiaro TKH",
  HandleGrooveColor: "Pulpis Chiaro TKH",
};

describe("Multi-Level models of Urban Duplex as columns", () => {
  it("knows only the collections whose scene lays columns", () => {
    expect(UD).toMatchObject({ sceneCollection: "UD", tierHeightCm: 56 });
    expect(columnsCollectionOf("urban-low-height")).toBeNull();
    expect(columnsCollectionOf(null)).toBeNull();
  });

  it("hangs the upper Sink Base over the lower Side Cabinet, shifted as the lower row is (#29)", () => {
    const { preset, cabinets } = toColumnsCompactPreset(presetOf(29), UD, translate);

    expect(preset).toMatchObject({
      format: "urban-compact-v2",
      collection: "UD",
      shared: { ...COLOURS, CountertopColor: "Pulpis Chiaro TKH", Depth: 50, Height: 28 },
      // The countertop's own values go with it: the import does not take them from the shared ones.
      top: { productType: "Top_Solid", CountertopColor: "Pulpis Chiaro TKH", sinkType: "Top_HPLStrip" },
    });
    expect(preset.rows).toEqual([
      {
        products: [
          {
            top: expect.objectContaining({
              name: "UD-sink-cabinet",
              Width: 70,
              Drawers: "1D",
              HandleStyle: "Duplex",
              HandleSide: "Left",
              sinkType: "Top_HPLStrip",
              ...COLOURS,
            }),
            bottom: expect.objectContaining({
              name: "UD-side-cabinet",
              Width: 90,
              HandleStyle: "Duplex",
              HandleSide: "Right",
              offsetX: 55,
            }),
          },
        ],
      },
    ]);
    // The scene names the product itself; the collection's own keys stay out of its config.
    const [column] = preset.rows[0].products as { top: Record<string, unknown> }[];
    expect(column.top).not.toHaveProperty("productType");
    expect(column.top).not.toHaveProperty("Series");
    expect(column.top).not.toHaveProperty("BasePanelColor");

    // The keys the scene gives the cabinets, with what each is in the collection's terms.
    expect(cabinets).toEqual([
      {
        key: "cabinet0",
        product: {
          productType: "Sink-Base",
          config: expect.objectContaining({
            Series: "URDPX",
            LateralPanelSide: "L",
            BasePanelColor: "Bianco Calce DA ST",
          }),
        },
      },
      {
        key: "cabinet1",
        product: {
          productType: "Sink-Cabinet",
          config: expect.objectContaining({ Series: "URDPX", LateralPanelSide: "R" }),
        },
      },
    ]);
  });

  it("puts a lower cabinet that stands under nothing in a place of its own, after the column (#34)", () => {
    const { preset, cabinets } = toColumnsCompactPreset(presetOf(34), UD, translate);

    expect(preset.rows[0].products).toEqual([
      {
        top: expect.objectContaining({ name: "UD-sink-cabinet", Width: 70, HandleSide: "Right" }),
        bottom: expect.objectContaining({ name: "UD-side-cabinet", Width: 70, HandleSide: "Left", offsetX: 45 }),
      },
      { bottom: expect.objectContaining({ name: "UD-open-shelves", Width: 35 }) },
    ]);
    expect(cabinets.map(({ key, product }) => [key, product.productType])).toEqual([
      ["cabinet0", "Sink-Base"],
      ["cabinet1", "Sink-Cabinet"],
      ["cabinet2", "Open-Shelf"],
    ]);
  });

  it("keeps a side shelf hanging at the row end in its own colour (#44)", () => {
    const { preset, cabinets } = toColumnsCompactPreset(presetOf(44), UD, translate);

    expect(preset.rows[0].products).toEqual([
      { top: expect.objectContaining({ name: "UD-open-shelves-side", Width: 15, CabinetColor: "Pulpis Chiaro TKH" }) },
      {
        top: expect.objectContaining({ name: "UD-sink-cabinet", Width: 70 }),
        bottom: expect.objectContaining({ name: "UD-open-shelves", Width: 35, offsetX: 34.95 }),
      },
      { bottom: expect.objectContaining({ name: "UD-side-cabinet", Width: 90 }) },
    ]);
    // Most of the cabinets are in the Base Panel colour; the scene builds the cover from it.
    expect(preset.shared).toMatchObject({ CabinetColor: "Bianco Calce DA ST" });
    expect(cabinets.map(({ product }) => product.productType)).toEqual([
      "Side-Shelf",
      "Sink-Base",
      "Open-Shelf",
      "Sink-Cabinet",
    ]);
  });

  it("gives a cabinet of another series its full handles (#64)", () => {
    const { preset } = toColumnsCompactPreset(presetOf(64), UD, translate);

    expect(preset.rows[0].products).toEqual([
      {
        top: expect.objectContaining({ name: "UD-sink-cabinet", Width: 105, HandleStyle: "Duplex" }),
        bottom: expect.objectContaining({ name: "UD-side-cabinet", Width: 105, HandleStyle: "Default", offsetX: 82 }),
      },
      { bottom: expect.objectContaining({ name: "UD-open-shelves", Width: 50 }) },
    ]);
  });

  it("converts every Multi-Level model of the collection", () => {
    const multiLevel = urbanDuplexPresets.filter((entry) => "rows" in entry);

    expect(multiLevel.map(({ id }) => id)).toEqual([29, 34, 44, 45, 64]);
    for (const entry of multiLevel) {
      expect(() => toColumnsCompactPreset(entry as CompactPresetSource, UD, translate)).not.toThrow();
    }
  });

  const twoRows = (lower: Record<string, unknown>[], offsetX: number, upper = [{ name: "Sink-Base", Width: 70 }]) => ({
    shared: { Height: 28, BasePanelColor: "Bianco Calce DA ST" },
    rows: [
      { products: upper },
      { elevation: -28, offsetX, products: lower.map((p) => ({ name: "Sink-Cabinet", ...p })) },
    ],
  });

  it("refuses a lower cabinet that stands under two upper ones", () => {
    const preset = twoRows([{ Width: 90 }], 30, [
      { name: "Sink-Base", Width: 70 },
      { name: "Sink-Cabinet", Width: 70 },
    ]);

    expect(() => toColumnsCompactPreset(preset, UD, translate)).toThrow(/under one hanging cabinet alone/);
  });

  it("refuses a layout the scene would not reproduce: a gap before a lower cabinet", () => {
    // The scene lays the lone 35 right after the column; the preset puts it 20 cm further.
    const preset = {
      ...twoRows([{ Width: 70 }], 40),
      rows: [
        { products: [{ name: "Sink-Base", Width: 70 }] },
        { elevation: -28, offsetX: 40, products: [{ name: "Sink-Cabinet", Width: 70 }] },
        { elevation: -28, offsetX: 130, products: [{ name: "Sink-Cabinet", Width: 35 }] },
      ],
    };

    expect(() => toColumnsCompactPreset(preset, UD, translate)).toThrow(/would be laid at 110\.05 cm/);
  });

  it("stands a cabinet of the tier's height on the floor, alone in its place", () => {
    const { preset } = toColumnsCompactPreset(
      {
        shared: { Height: 56, BasePanelColor: "Bianco Calce DA ST" },
        rows: [{ products: [{ name: "Sink-Base", Width: 70 }] }],
      },
      UD,
      translate,
    );

    expect(preset.rows[0].products).toEqual([expect.objectContaining({ name: "UD-sink-cabinet", Height: 56 })]);
    expect(() =>
      toColumnsCompactPreset(
        {
          shared: { Height: 56 },
          rows: [
            { products: [{ name: "Sink-Base", Width: 70 }] },
            { elevation: -28, offsetX: 0, products: [{ name: "Sink-Cabinet", Width: 70, Height: 28 }] },
          ],
        },
        UD,
        translate,
      ),
    ).toThrow(/under one hanging cabinet alone/);
  });

  it("names the product the collection has no scene type for", () => {
    expect(() =>
      toColumnsCompactPreset({ rows: [{ products: [{ name: "Towel-Bar", Width: 40, Height: 28 }] }] }, UD, translate),
    ).toThrow(/no scene type for "Towel-Bar"/);
  });
});
