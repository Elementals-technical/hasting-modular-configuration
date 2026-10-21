import { describe, expect, it } from "vitest";

import type { CabinetHeightStyle } from "@/entities/collection";

import { resolveHeightStyleCards } from "../lib/heightStyles";

/**
 * Urban Low Height shows its one drawer style as two models: the taller one and the Slim. Each stands
 * at the height the handle gives it, and the one the placed cabinets do not stand at switches them.
 */

const ULH_HEIGHT_STYLES: CabinetHeightStyle[] = [
  { id: "standard", heights: [38, 35] },
  { id: "slim", label: "Slim", heights: [28, 25] },
];

const UPPER_GROOVE = [28, 38];
const PUSH_TO_OPEN = [25, 35];

const cardsAt = (heightChoices: number[], compositionHeight: number | null) =>
  resolveHeightStyleCards({ heightStyles: ULH_HEIGHT_STYLES, heightChoices, compositionHeight }).map(
    ({ id, height, switchesComposition }) => [id, height, switchesComposition],
  );

describe("the height models of a drawer style", () => {
  it("stands each model at the height the handle gives it, in the declared order", () => {
    expect(cardsAt(UPPER_GROOVE, null)).toEqual([
      ["standard", 38, false],
      ["slim", 28, false],
    ]);
    expect(cardsAt(PUSH_TO_OPEN, null)).toEqual([
      ["standard", 35, false],
      ["slim", 25, false],
    ]);
  });

  it("keeps the label of a model, none for one that declares none", () => {
    expect(
      resolveHeightStyleCards({
        heightStyles: ULH_HEIGHT_STYLES,
        heightChoices: UPPER_GROOVE,
        compositionHeight: null,
      }).map(({ label }) => label),
    ).toEqual([null, "Slim"]);
  });

  it("switches the placed cabinets only with the model they do not stand at", () => {
    expect(cardsAt(UPPER_GROOVE, 38)).toEqual([
      ["standard", 38, false],
      ["slim", 28, true],
    ]);
    expect(cardsAt(PUSH_TO_OPEN, 25)).toEqual([
      ["standard", 35, true],
      ["slim", 25, false],
    ]);
  });

  it("switches with both models where the cabinets stand at a height neither has", () => {
    expect(cardsAt(UPPER_GROOVE, 53)).toEqual([
      ["standard", 38, true],
      ["slim", 28, true],
    ]);
  });

  it("leaves the style its one card where there is nothing to choose", () => {
    // No models declared, no heights to choose between, or only one model at the heights allowed.
    expect(
      resolveHeightStyleCards({ heightStyles: undefined, heightChoices: UPPER_GROOVE, compositionHeight: null }),
    ).toEqual([]);
    expect(cardsAt([], null)).toEqual([]);
    expect(cardsAt([38, 35], 38)).toEqual([]);
  });
});
