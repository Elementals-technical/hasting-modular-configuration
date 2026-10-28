import { describe, expect, it } from "vitest";

import renderFixture from "./fixtures/contract/render.v1.json";
import { WALL_Z_CM, schematicLines, wallsOf } from "../model/cellsCodec";

/**
 * The cells-v1 codec as the SVG scheme of the preset cards reads it. The same fixture runs in 3D
 * (`toRenderPlan`), so the scheme and the scene cannot show different walls for the same positions.
 */

const maskOf = (walls: readonly boolean[]) => walls.map((wall) => (wall ? "1" : "0")).join("");

describe("wallsOf", () => {
  it.each(renderFixture.codec.cases.map(({ positions, walls }) => [positions.join(",") || "none", positions, walls]))(
    "turns the positions [%s] into the walls of the fixture",
    (_label, positions, walls) => {
      expect(wallsOf(positions as number[])).toEqual(walls);
    },
  );

  it("reaches exactly the 12 distinct masks of the fixture", () => {
    const masks = new Set(renderFixture.codec.cases.map(({ walls }) => maskOf(walls)));
    expect(masks.size).toBe(12);
    expect(new Set(renderFixture.codec.cases.map(({ positions }) => maskOf(wallsOf(positions))))).toEqual(masks);
  });

  it("puts Config 1-4 of the sheet on 0011, 1100, 0110 and 1111", () => {
    const byId = Object.fromEntries(renderFixture.presets.map(({ id, positions }) => [id, maskOf(wallsOf(positions))]));

    expect(byId).toEqual({
      empty: "0000",
      "preset-1": "0011",
      "preset-2": "1100",
      "preset-3": "0110",
      "preset-4": "1111",
    });
  });

  it("draws the mock-up's [1, 4] as three walls (W1, W2, W4)", () => {
    expect(maskOf(wallsOf([1, 4]))).toBe("1101");
  });

  it("does not care about the order or the repeats of the positions", () => {
    expect(wallsOf([4, 2, 2])).toEqual(wallsOf([2, 4]));
  });

  it("leaves out a position outside 1..5 instead of inventing a wall", () => {
    expect(maskOf(wallsOf([0, 6, 2.5, -1]))).toBe("0000");
    expect(maskOf(wallsOf([0, 2]))).toBe("0011");
  });

  it("refuses a codec it does not know", () => {
    expect(() => wallsOf([2], "walls-direct-4")).toThrow(/walls-direct-4/);
    expect(() => schematicLines([2], "walls-direct-4")).toThrow(/walls-direct-4/);
  });
});

describe("WALL_Z_CM", () => {
  it("runs from the facade (Wall_1) to the back wall (Wall_4) of the 43 cm tray", () => {
    expect(WALL_Z_CM).toEqual([12.78, 4.26, -4.26, -12.78]);
  });
});

describe("schematicLines", () => {
  it("draws no line for an empty column", () => {
    expect(schematicLines([])).toEqual([]);
  });

  it("puts the mock-up's [1, 4] at about 0.203, 0.599 and 0.797 of the length from the back edge", () => {
    const lines = schematicLines([1, 4]);

    expect(lines).toHaveLength(3);
    expect(lines[0]).toBeCloseTo(0.203, 3);
    expect(lines[1]).toBeCloseTo(0.599, 3);
    expect(lines[2]).toBeCloseTo(0.797, 3);
    // The mock-up measures 0.19 / 0.61 / 0.80: within two points of the fraction.
    [0.19, 0.61, 0.8].forEach((measured, index) => expect(Math.abs(lines[index] - measured)).toBeLessThan(0.02));
  });

  it("draws a line for each wall of the mask, ascending from the back", () => {
    expect(schematicLines([2]).map((line) => line.toFixed(3))).toEqual(["0.203", "0.401"]);
    expect(schematicLines([4]).map((line) => line.toFixed(3))).toEqual(["0.599", "0.797"]);
    expect(schematicLines([3]).map((line) => line.toFixed(3))).toEqual(["0.401", "0.599"]);
    expect(schematicLines([2, 4]).map((line) => line.toFixed(3))).toEqual(["0.203", "0.401", "0.599", "0.797"]);
  });

  it("agrees with the walls: one line per wall that is on", () => {
    for (const { positions, walls } of renderFixture.codec.cases) {
      const lines = schematicLines(positions);

      expect(lines, positions.join(",")).toHaveLength(walls.filter(Boolean).length);
      expect(
        [...lines].sort((a, b) => a - b),
        positions.join(","),
      ).toEqual(lines);
      lines.forEach((line) => {
        expect(line).toBeGreaterThan(0);
        expect(line).toBeLessThan(1);
      });
    }
  });
});
