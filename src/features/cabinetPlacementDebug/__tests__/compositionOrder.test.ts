import { describe, expect, it } from "vitest";

import { inCompositionOrder } from "../lib/compositionOrder";

const cabinets = [{ id: "UD-sink-cabinet" }, { id: "UD-side-cabinet-top" }, { id: "UD-side-cabinet-left" }];

describe("inCompositionOrder", () => {
  it("puts a cabinet added left of the row first, as the composition runs along the wall", () => {
    const order = ["UD-side-cabinet-left", "UD-sink-cabinet", "UD-side-cabinet-top"];

    expect(inCompositionOrder(cabinets, order).map(({ id }) => id)).toEqual(order);
  });

  it("keeps the state's order when the composition order does not name every cabinet", () => {
    expect(inCompositionOrder(cabinets, ["UD-side-cabinet-left", "UD-sink-cabinet"])).toEqual(cabinets);
  });

  it("leaves out what only the composition order names", () => {
    const order = ["UD-side-cabinet-left", "Countertop-1", "UD-sink-cabinet", "UD-side-cabinet-top"];

    expect(inCompositionOrder(cabinets, order).map(({ id }) => id)).toEqual([
      "UD-side-cabinet-left",
      "UD-sink-cabinet",
      "UD-side-cabinet-top",
    ]);
  });
});
