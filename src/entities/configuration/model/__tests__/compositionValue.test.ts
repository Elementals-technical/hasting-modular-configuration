import { describe, expect, it } from "vitest";

import { compositionValueOf } from "../compositionValue";
import type { ScopedValue, ValueTarget } from "../types";

const at = (target: ValueTarget, value: ScopedValue["value"]): ScopedValue => ({ target, value });
const cabinet = (cabinetId: string): ValueTarget => ({ scope: "cabinet", cabinetId });

describe("compositionValueOf", () => {
  it("reads a value recorded at cabinets at the first cabinet, even when it is empty there", () => {
    // A model put its legs on both cabinets; switching them off records no colour at the first.
    const entries = [at(cabinet("cab-1"), ""), at(cabinet("cab-2"), "None")];

    expect(compositionValueOf(entries, "cab-1")).toBe("");
    expect(compositionValueOf([at(cabinet("cab-2"), "Gold"), at(cabinet("cab-1"), "Silver")], "cab-1")).toBe("Silver");
  });

  it("has no value for a cabinet attribute the first cabinet does not hold", () => {
    expect(compositionValueOf([at(cabinet("cab-2"), "Gold")], "cab-1")).toBeUndefined();
    expect(compositionValueOf([at(cabinet("cab-1"), "Gold")], undefined)).toBeUndefined();
  });

  it("reads a value recorded elsewhere as the first one set", () => {
    const entries = [
      at({ scope: "basin", sinkBaseId: "cab-1" }, ""),
      at({ scope: "basin", sinkBaseId: "cab-2" }, "LB440"),
    ];

    expect(compositionValueOf(entries, "cab-1")).toBe("LB440");
    expect(compositionValueOf([at({ scope: "global" }, "Nero 433 MT")], undefined)).toBe("Nero 433 MT");
  });

  it("has no value for an attribute nothing recorded", () => {
    expect(compositionValueOf(undefined, "cab-1")).toBeUndefined();
    expect(compositionValueOf([at({ scope: "global" }, " ")], "cab-1")).toBeUndefined();
  });
});
