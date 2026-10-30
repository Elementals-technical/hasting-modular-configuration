// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { schematicLines } from "../model/cellsCodec";
import { ORGANIZER_PROFILES } from "../model/presets";
import { ColumnSchematic } from "../ui/ColumnSchematic";

afterEach(cleanup);

const VIEW_BOX_HEIGHT = 430;

const drawnLines = (container: HTMLElement) =>
  [...container.querySelectorAll<SVGLineElement>("line[data-schematic-line]")].map((line) =>
    Number(line.getAttribute("y1")),
  );

describe("ColumnSchematic", () => {
  it("draws the walls of [1, 4] at 0.203, 0.599 and 0.797 of the tray, back edge on top", () => {
    const { container } = render(<ColumnSchematic positions={[1, 4]} style="Metal" size={86} />);

    const [back, middle, front] = drawnLines(container);
    expect(back).toBeCloseTo(0.203 * VIEW_BOX_HEIGHT, 0);
    expect(middle).toBeCloseTo(0.599 * VIEW_BOX_HEIGHT, 0);
    expect(front).toBeCloseTo(0.797 * VIEW_BOX_HEIGHT, 0);
  });

  it.each(ORGANIZER_PROFILES["ROW-MTL-43"].presets)(
    "draws the lines the codec gives for the preset $id ($positions)",
    ({ positions }) => {
      const { container } = render(<ColumnSchematic positions={positions} style="Metal" size={86} />);

      const expected = schematicLines(positions).map((fraction) => fraction * VIEW_BOX_HEIGHT);
      const drawn = drawnLines(container);
      expect(drawn).toHaveLength(expected.length);
      drawn.forEach((y, index) => expect(y).toBeCloseTo(expected[index], 5));
    },
  );

  it("draws only the tray for an empty column", () => {
    const { container } = render(<ColumnSchematic positions={[]} style="Metal" size={86} />);
    expect(drawnLines(container)).toEqual([]);
    expect(container.querySelector("svg")?.getAttribute("viewBox")).toBe("0 0 100 430");
  });

  it("is sized by its height, keeps the tray proportions, and is hidden from screen readers", () => {
    const { container } = render(<ColumnSchematic positions={[2]} style="Metal" size={86} />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("height")).toBe("86");
    expect(Number(svg?.getAttribute("width"))).toBeCloseTo((86 * 100) / 430, 5);
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
  });

  it("marks the material, so the stylesheet colours Metal and Oak apart", () => {
    const { container } = render(<ColumnSchematic positions={[2]} style="Oak" size={86} />);
    expect(container.querySelector("svg")?.getAttribute("data-style")).toBe("Oak");
  });
});
