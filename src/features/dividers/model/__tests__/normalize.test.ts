import { describe, expect, it } from "vitest";

import {
  dividerTypeSetsEqual,
  dividerTypesEqual,
  getDividerTypeFromOptionTitle,
  normalizeDividerType,
  normalizeDividerTypes,
  normalizeSlotInfo,
  sortDividerTypes,
} from "../normalize";

describe("normalizeDividerType", () => {
  it("accepts A/B/C and rejects everything else", () => {
    expect(normalizeDividerType("A")).toBe("A");
    expect(normalizeDividerType("B")).toBe("B");
    expect(normalizeDividerType("C")).toBe("C");
    expect(normalizeDividerType("D")).toBeNull();
    expect(normalizeDividerType("")).toBeNull();
    expect(normalizeDividerType(null)).toBeNull();
    expect(normalizeDividerType(undefined)).toBeNull();
    expect(normalizeDividerType(1)).toBeNull();
  });
});

describe("normalizeDividerTypes", () => {
  it("filters invalid entries and preserves incoming order", () => {
    expect(normalizeDividerTypes(["C", "x", "A", null, "B"])).toEqual(["C", "A", "B"]);
    expect(normalizeDividerTypes("AB")).toEqual([]);
    expect(normalizeDividerTypes(undefined)).toEqual([]);
  });
});

describe("sortDividerTypes", () => {
  it("returns a stable A,B,C ordering with de-duplication", () => {
    expect(sortDividerTypes(["C", "A", "B"])).toEqual(["A", "B", "C"]);
    expect(sortDividerTypes(["B", "B", "A"])).toEqual(["A", "B"]);
    expect(sortDividerTypes(["C", "junk", 5])).toEqual(["C"]);
    expect(sortDividerTypes(null)).toEqual([]);
  });
});

describe("dividerTypesEqual (anti effect-loop)", () => {
  it("treats fresh arrays with the same values as equal", () => {
    expect(dividerTypesEqual(["A", "B"], ["A", "B"])).toBe(true);
    expect(dividerTypesEqual([], [])).toBe(true);
  });

  it("detects differences in content and order", () => {
    expect(dividerTypesEqual(["A", "B"], ["B", "A"])).toBe(false);
    expect(dividerTypesEqual(["A"], ["A", "B"])).toBe(false);
    expect(dividerTypesEqual(["A"], null)).toBe(false);
    expect(dividerTypesEqual(null, null)).toBe(true);
  });
});

describe("dividerTypeSetsEqual", () => {
  it("compares sets by value", () => {
    expect(dividerTypeSetsEqual(new Set(["A", "B"]), new Set(["B", "A"]))).toBe(true);
    expect(dividerTypeSetsEqual(new Set(["A"]), new Set(["A", "B"]))).toBe(false);
    expect(dividerTypeSetsEqual(null, new Set(["A"]))).toBe(false);
    expect(dividerTypeSetsEqual(null, null)).toBe(true);
  });
});

describe("getDividerTypeFromOptionTitle", () => {
  it("parses UI option labels", () => {
    expect(getDividerTypeFromOptionTitle("Option A")).toBe("A");
    expect(getDividerTypeFromOptionTitle(" Option B ")).toBe("B");
    expect(getDividerTypeFromOptionTitle("Option C")).toBe("C");
    expect(getDividerTypeFromOptionTitle("Option D")).toBeNull();
    expect(getDividerTypeFromOptionTitle("")).toBeNull();
  });
});

describe("normalizeSlotInfo", () => {
  it("normalizes an add-slot payload (DividerSlotInfo shape)", () => {
    const slot = normalizeSlotInfo({
      cabinetId: "Sink-Base-abc123",
      drawerType: "Bot",
      zone: "main",
      key: "candidate:Bot:main:left:0:A",
      availableTypes: ["A", "B"],
      zoneIndex: 0,
      placementType: "A",
      canPlace: true,
      disabledReason: null,
      position: { start: 0, center: 6.75, end: 13.5 },
    });

    expect(slot).toEqual({
      context: { cabinetId: "Sink-Base-abc123", drawerType: "Bot" },
      zone: "main",
      key: "candidate:Bot:main:left:0:A",
      kind: "candidate",
      placementType: "A",
      occupiedType: null,
      stateId: null,
      availableTypes: ["A", "B"],
      canPlace: true,
      disabledReason: null,
      position: { start: 0, center: 6.75, end: 13.5 },
      zoneIndex: 0,
    });
  });

  it("normalizes an occupied-slot payload (OccupiedSlotInfo shape)", () => {
    const slot = normalizeSlotInfo({
      cabinetId: "Sink-Base-abc123",
      drawerType: "Top",
      zone: "siphon_left",
      key: "occupied:Top:siphon_left:1",
      isOccupied: true,
      stateId: "state-42",
      dividerType: "C",
      zoneIndex: 1,
    });

    expect(slot).toMatchObject({
      kind: "occupied",
      occupiedType: "C",
      stateId: "state-42",
      placementType: null,
      canPlace: false,
      availableTypes: [],
      zoneIndex: 1,
    });
  });

  it("detects occupancy from stateId + dividerType even without isOccupied flag", () => {
    const slot = normalizeSlotInfo({
      cabinetId: "cab",
      drawerType: "Bot",
      zone: "main",
      key: "slot:1",
      stateId: "state-7",
      dividerType: "B",
      zoneIndex: 0,
    });

    expect(slot?.kind).toBe("occupied");
    expect(slot?.occupiedType).toBe("B");
  });

  it("normalizes a legacy add payload (DividerSlotClickInfo without isOccupied)", () => {
    const slot = normalizeSlotInfo({
      cabinetId: "cab",
      drawerType: "TopFull",
      zone: "main",
      key: "candidate:TopFull:main:right:2:B",
      availableTypes: ["B", "C"],
    });

    expect(slot).toMatchObject({
      kind: "candidate",
      placementType: "B", // parsed from key — payload has no placementType field
      availableTypes: ["B", "C"],
      canPlace: true,
      zoneIndex: null,
      position: null,
    });
  });

  it("falls back to parsing placementType from the key's last segment", () => {
    const slot = normalizeSlotInfo({
      cabinetId: "cab",
      drawerType: "Bot",
      zone: "main",
      key: "candidate:Bot:main:left:0:C",
      availableTypes: [],
    });

    expect(slot?.placementType).toBe("C");
  });

  it("prefers the explicit placementType field over the key", () => {
    const slot = normalizeSlotInfo({
      cabinetId: "cab",
      drawerType: "Bot",
      zone: "main",
      key: "candidate:Bot:main:left:0:C",
      placementType: "A",
      availableTypes: [],
    });

    expect(slot?.placementType).toBe("A");
  });

  it("keeps placementType null for keys without a type suffix", () => {
    const slot = normalizeSlotInfo({
      cabinetId: "cab",
      drawerType: "Bot",
      zone: "main",
      key: "plainkey",
      availableTypes: [],
    });

    expect(slot?.placementType).toBeNull();
  });

  it("returns null for malformed payloads", () => {
    expect(normalizeSlotInfo(null)).toBeNull();
    expect(normalizeSlotInfo("nope")).toBeNull();
    expect(normalizeSlotInfo({})).toBeNull();
    expect(normalizeSlotInfo({ cabinetId: "cab", drawerType: "Sideways", zone: "main", key: "k" })).toBeNull();
    expect(normalizeSlotInfo({ cabinetId: "cab", drawerType: "Bot", zone: "main" })).toBeNull();
  });
});
