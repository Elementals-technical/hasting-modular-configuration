import { describe, expect, it } from "vitest";

import renderFixture from "./fixtures/contract/render.v1.json";
import { ORGANIZER_PROFILES, buildPresetCards, matchPreset, type OrganizerPreset } from "../model/presets";

/**
 * The preset table of the ROW-MTL-43 profile (Q-O3): the canon of the positions and of the default labels.
 * The shared render fixture pins the positions, so the table cannot drift from 3D.
 */

const table = ORGANIZER_PROFILES["ROW-MTL-43"];

describe("ROW-MTL-43 profile table", () => {
  it("is the cells-v1 profile of five cells, two of them active at most", () => {
    expect(table).toMatchObject({ positionCount: 5, maxActive: 5, codec: "cells-v1" });
  });

  it("switches Oak off in v1 (Q-K3) with the message that says why", () => {
    expect(table.unavailableStyles).toEqual({ Oak: "organizer.oakPending" });
  });

  it("holds the presets of the render fixture: ids, sheet configs and positions", () => {
    expect(table.presets.map(({ id, sheetConfig, positions }) => ({ id, sheetConfig, positions }))).toEqual(
      renderFixture.presets.map(({ id, sheetConfig, positions }) => ({ id, sheetConfig, positions })),
    );
  });

  it("names the presets Empty and Preset 1-4, in the order of the sheet configs", () => {
    expect(table.presets.map(({ label }) => label)).toEqual(["Empty", "Preset 1", "Preset 2", "Preset 3", "Preset 4"]);
    expect(table.presets.map(({ order }) => order)).toEqual([0, 10, 20, 30, 40]);
  });

  it("keeps every preset inside 1..positionCount, sorted, unique and at most maxActive", () => {
    for (const { id, positions } of table.presets) {
      expect(positions.length, id).toBeLessThanOrEqual(table.maxActive);
      expect(new Set(positions).size, id).toBe(positions.length);
      expect(
        [...positions].sort((a, b) => a - b),
        id,
      ).toEqual(positions);
      for (const position of positions) {
        expect(position, id).toBeGreaterThanOrEqual(1);
        expect(position, id).toBeLessThanOrEqual(table.positionCount);
      }
    }
  });

  it("gives no two presets the same positions, so a column matches one card at most", () => {
    const keys = table.presets.map(({ positions }) => positions.join(","));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("does not offer Config 5 as a preset: five cells would not fit maxActive", () => {
    expect(table.presets.some(({ positions }) => positions.length > table.maxActive)).toBe(false);
  });
});

describe("matchPreset", () => {
  it("finds the preset by the set of positions", () => {
    expect(matchPreset([], table.presets)).toBe("empty");
    expect(matchPreset([2], table.presets)).toBe("preset-1");
    expect(matchPreset([4], table.presets)).toBe("preset-2");
    expect(matchPreset([3], table.presets)).toBe("preset-3");
    expect(matchPreset([2, 4], table.presets)).toBe("preset-4");
  });

  it("does not care about the order or the repeats of the positions", () => {
    expect(matchPreset([4, 2], table.presets)).toBe("preset-4");
    expect(matchPreset([2, 2, 4], table.presets)).toBe("preset-4");
  });

  it("answers custom when no preset has the same set", () => {
    expect(matchPreset([1], table.presets)).toBe("custom");
    expect(matchPreset([1, 4], table.presets)).toBe("custom");
    expect(matchPreset([2, 3], table.presets)).toBe("custom");
    expect(matchPreset([2, 4, 5], table.presets)).toBe("custom");
  });

  it("answers custom for an empty column when the list has no empty preset", () => {
    const withoutEmpty = table.presets.filter(({ id }) => id !== "empty");
    expect(matchPreset([], withoutEmpty)).toBe("custom");
  });

  it("does not change its arguments", () => {
    const positions = [4, 2];
    matchPreset(positions, table.presets);
    expect(positions).toEqual([4, 2]);
  });
});

describe("buildPresetCards", () => {
  it("lists the cards by order with the default labels", () => {
    expect(buildPresetCards(table)).toEqual([
      { id: "empty", label: "Empty", positions: [] },
      { id: "preset-1", label: "Preset 1", positions: [2] },
      { id: "preset-2", label: "Preset 2", positions: [4] },
      { id: "preset-3", label: "Preset 3", positions: [3] },
      { id: "preset-4", label: "Preset 4", positions: [2, 4] },
    ]);
  });

  it("sorts by order whatever the order of the table", () => {
    const shuffled: OrganizerPreset[] = [...table.presets].reverse();
    expect(buildPresetCards({ ...table, presets: shuffled }).map(({ id }) => id)).toEqual(
      table.presets.map(({ id }) => id),
    );
  });

  it("lets ui.json override the label of a preset and nothing else", () => {
    const cards = buildPresetCards(table, { presets: { "preset-2": { label: "Front Pair" }, empty: {} } });

    expect(cards.find(({ id }) => id === "preset-2")).toEqual({ id: "preset-2", label: "Front Pair", positions: [4] });
    expect(cards.find(({ id }) => id === "empty")?.label).toBe("Empty");
    expect(cards.find(({ id }) => id === "preset-1")?.label).toBe("Preset 1");
  });

  it("keeps the default label for a blank override and ignores a preset the table does not have", () => {
    const cards = buildPresetCards(table, { presets: { "preset-3": { label: "  " }, "preset-9": { label: "Nine" } } });

    expect(cards).toHaveLength(5);
    expect(cards.find(({ id }) => id === "preset-3")?.label).toBe("Preset 3");
  });

  it("does not change the table", () => {
    const before = JSON.stringify(table);
    buildPresetCards(table, { presets: { "preset-1": { label: "X" } } });
    expect(JSON.stringify(table)).toBe(before);
  });
});
