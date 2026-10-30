import { describe, expect, it } from "vitest";

import { maxSeqFromKeys, rebindSavedCabinets, reconcileOrder, registerCabinets, resolveStableKey } from "../identity";
import type { CabinetEntry } from "../types";

const register = (runtimeIds: string[]) => registerCabinets([], runtimeIds, 1);

describe("registerCabinets", () => {
  it("assigns one stable key per runtime id", () => {
    const { entries, nextSeq } = register(["rt-a", "rt-b"]);

    expect(entries).toEqual([
      { stableKey: "cab-1", runtimeId: "rt-a", index: 0 },
      { stableKey: "cab-2", runtimeId: "rt-b", index: 1 },
    ]);
    expect(nextSeq).toBe(3);
  });

  it("keeps existing keys when a product is inserted in the middle", () => {
    const first = register(["rt-a", "rt-b"]);
    const second = registerCabinets(first.entries, ["rt-a", "rt-new", "rt-b"], first.nextSeq);

    expect(second.entries.map((entry) => entry.stableKey)).toEqual(["cab-1", "cab-3", "cab-2"]);
    expect(second.entries.map((entry) => entry.index)).toEqual([0, 1, 2]);
  });

  it("keeps existing keys when two products are swapped", () => {
    const first = register(["rt-a", "rt-b"]);
    const second = registerCabinets(first.entries, ["rt-b", "rt-a"], first.nextSeq);

    expect(second.entries).toEqual([
      { stableKey: "cab-2", runtimeId: "rt-b", index: 0 },
      { stableKey: "cab-1", runtimeId: "rt-a", index: 1 },
    ]);
    expect(second.nextSeq).toBe(3);
  });

  it("never reissues the key of a removed product", () => {
    const first = register(["rt-a", "rt-b"]);
    const afterRemoval = registerCabinets(first.entries, ["rt-a"], first.nextSeq);
    const afterAdd = registerCabinets(afterRemoval.entries, ["rt-a", "rt-c"], afterRemoval.nextSeq);

    expect(afterAdd.entries.map((entry) => entry.stableKey)).toEqual(["cab-1", "cab-3"]);
  });
});

describe("reconcileOrder", () => {
  const entries: CabinetEntry[] = [
    { stableKey: "cab-1", runtimeId: "rt-a", index: 0 },
    { stableKey: "cab-2", runtimeId: "rt-b", index: 1 },
    { stableKey: "cab-3", runtimeId: "rt-c", index: 2 },
  ];

  it("applies the order reported by the scene", () => {
    const ordered = reconcileOrder(entries, ["rt-c", "rt-a", "rt-b"]);

    expect(ordered.map((entry) => entry.stableKey)).toEqual(["cab-3", "cab-1", "cab-2"]);
    expect(ordered.map((entry) => entry.index)).toEqual([0, 1, 2]);
  });

  it("keeps the previous order when the scene reports nothing", () => {
    // getOrderedProductIds falls back to its argument when the composition manager is
    // unreachable; a transient miss must not read as "no products".
    expect(reconcileOrder(entries, [])).toEqual(entries);
  });

  it("keeps products the scene did not mention instead of dropping them", () => {
    const ordered = reconcileOrder(entries, ["rt-c"]);

    expect(ordered.map((entry) => entry.stableKey)).toEqual(["cab-3", "cab-1", "cab-2"]);
  });

  it("ignores runtime ids it does not know", () => {
    const ordered = reconcileOrder(entries, ["rt-unknown", "rt-b"]);

    expect(ordered.map((entry) => entry.stableKey)).toEqual(["cab-2", "cab-1", "cab-3"]);
  });
});

describe("restore identity", () => {
  it("pairs saved keys with the runtime ids created while replaying", () => {
    const entries = rebindSavedCabinets(["cab-7", "cab-8"], ["new-1", "new-2"]);

    expect(entries).toEqual([
      { stableKey: "cab-7", runtimeId: "new-1", index: 0 },
      { stableKey: "cab-8", runtimeId: "new-2", index: 1 },
    ]);
  });

  it("does not pair leftovers when the counts differ", () => {
    expect(rebindSavedCabinets(["cab-1", "cab-2", "cab-3"], ["new-1"])).toHaveLength(1);
    expect(rebindSavedCabinets(["cab-1"], ["new-1", "new-2"])).toHaveLength(1);
  });

  it("continues numbering after the highest restored key", () => {
    expect(maxSeqFromKeys(["cab-3", "cab-11", "cab-2"])).toBe(11);
    expect(maxSeqFromKeys([])).toBe(0);
  });
});

describe("resolveStableKey", () => {
  it("returns null for an unknown runtime id instead of throwing", () => {
    const { entries } = register(["rt-a"]);

    expect(resolveStableKey(entries, "rt-a")).toBe("cab-1");
    expect(resolveStableKey(entries, "rt-missing")).toBeNull();
  });
});
