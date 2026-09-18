import { describe, expect, it } from "vitest";

import { readFragmentValue } from "../lib/configurationFragment";
import { readConfigurationFragment, readSavedCollectionId, readSavedCollectionIdentity } from "../lib/legacyMetadata";

/** A payload as saved before C07: flat uiState, no fragment, no collection identity. */
const legacyMetadata = {
  path: "/custom/summary",
  savedAt: "2026-01-01T00:00:00.000Z",
  orderedProductIds: ["runtime-a", "runtime-b"],
  uiState: {
    CabinetColor: "Pulpis Chiaro TKH",
    sinkType: "Top_Tekorlux_Rectangular",
    TowelBarOption: "None",
    FaucetHolesAmount: "0",
  },
  swatchOrder: {
    selectedMaterials: [],
    manualSelectedMaterials: [],
    isAutofillEnabled: false,
    hasSubmittedCart: false,
  },
};

describe("reading a payload saved before C07", () => {
  it("is reported as legacy rather than failing", () => {
    const { isLegacy, issues } = readConfigurationFragment(legacyMetadata);

    expect(isLegacy).toBe(true);
    expect(issues.map((issue) => issue.code)).toEqual(["fragment.missing"]);
  });

  it("recovers the flat values as configuration-wide", () => {
    const { fragment } = readConfigurationFragment(legacyMetadata);

    expect(readFragmentValue(fragment, "CabinetColor", { scope: "global" })).toBe("Pulpis Chiaro TKH");
    expect(readFragmentValue(fragment, "sinkType", { scope: "global" })).toBe("Top_Tekorlux_Rectangular");
  });

  it("reconstructs product identity from the saved order", () => {
    const { fragment } = readConfigurationFragment(legacyMetadata);

    expect(fragment.cabinets).toEqual([
      { stableKey: "legacy-1", index: 0 },
      { stableKey: "legacy-2", index: 1 },
    ]);
  });

  it("reports no collection, which the resolver treats as legacy USH", () => {
    // Distinct from a payload naming a collection nobody knows: that is an error,
    // and this function must not substitute USH for it.
    expect(readSavedCollectionId(legacyMetadata)).toBeNull();
    expect(readConfigurationFragment(legacyMetadata).fragment.collectionId).toBeNull();
  });

  it("surfaces a recorded collection id whatever level it sits at", () => {
    expect(readSavedCollectionId({ ...legacyMetadata, collectionId: "mako" })).toBe("mako");
    expect(readSavedCollectionId({ ...legacyMetadata, configuration: { collectionId: "class" } })).toBe("class");
    expect(readSavedCollectionId({ ...legacyMetadata, collectionId: "   " })).toBeNull();
  });
});

describe("reading the saved collection identity for restore", () => {
  it("treats a payload without the field anywhere as legacy", () => {
    expect(readSavedCollectionIdentity(legacyMetadata)).toEqual({ kind: "absent" });
    expect(readSavedCollectionIdentity(undefined)).toEqual({ kind: "absent" });
  });

  it.each([null, "", "   "])("treats a recorded but empty collection %j as invalid, not as USH", (collectionId) => {
    expect(readSavedCollectionIdentity({ ...legacyMetadata, collectionId })).toMatchObject({ kind: "invalid" });
    expect(readSavedCollectionIdentity({ ...legacyMetadata, configuration: { collectionId } })).toMatchObject({
      kind: "invalid",
    });
  });

  it("reads a recorded collection at either level", () => {
    expect(readSavedCollectionIdentity({ ...legacyMetadata, collectionId: "mako" })).toEqual({
      kind: "id",
      collectionId: "mako",
    });
    expect(
      readSavedCollectionIdentity({ ...legacyMetadata, collectionId: null, configuration: { collectionId: "class" } }),
    ).toEqual({ kind: "id", collectionId: "class" });
  });
});

describe("reading a damaged payload", () => {
  it("never throws on a missing or non-object metadata", () => {
    expect(readConfigurationFragment(undefined).issues.map((issue) => issue.code)).toEqual(["fragment.missing"]);
    expect(readConfigurationFragment(null).fragment.cabinets).toEqual([]);
  });

  it("falls back to the legacy shape when the fragment is not an object", () => {
    const { fragment, issues, isLegacy } = readConfigurationFragment({
      ...legacyMetadata,
      configuration: "not-an-object",
    });

    expect(isLegacy).toBe(true);
    expect(issues.map((issue) => issue.code)).toContain("fragment.malformed");
    // The recovered legacy values still come through, so restore is not left empty.
    expect(readFragmentValue(fragment, "CabinetColor", { scope: "global" })).toBe("Pulpis Chiaro TKH");
  });

  it("reads what it understands from a newer fragment instead of refusing it", () => {
    const { fragment, issues } = readConfigurationFragment({
      configuration: {
        version: 99,
        collectionId: "urban-standard-height",
        cabinets: [{ stableKey: "cab-1", index: 0 }],
        values: { global: { CabinetColor: "Pulpis Chiaro TKH" } },
      },
    });

    expect(issues.map((issue) => issue.code)).toContain("fragment.newer-version");
    expect(fragment.collectionId).toBe("urban-standard-height");
    expect(readFragmentValue(fragment, "CabinetColor", { scope: "global" })).toBe("Pulpis Chiaro TKH");
  });

  it("drops only the malformed entries, keeping the rest", () => {
    const { fragment, issues } = readConfigurationFragment({
      configuration: {
        version: 1,
        collectionId: "urban-standard-height",
        cabinets: [{ stableKey: "cab-1", index: 0 }, { index: 1 }],
        values: {
          global: { CabinetColor: "Pulpis Chiaro TKH", Broken: { nested: true } },
          "cabinet:cab-1": "not-an-object",
        },
      },
    });

    expect(fragment.cabinets).toEqual([{ stableKey: "cab-1", index: 0 }]);
    expect(readFragmentValue(fragment, "CabinetColor", { scope: "global" })).toBe("Pulpis Chiaro TKH");
    expect(readFragmentValue(fragment, "Broken", { scope: "global" })).toBeUndefined();
    expect(issues.map((issue) => issue.code)).toEqual([
      "fragment.invalid-cabinets",
      "fragment.invalid-values",
      "fragment.invalid-values",
    ]);
  });

  it("accepts every value type the configuration model allows", () => {
    const { fragment, issues } = readConfigurationFragment({
      configuration: {
        version: 1,
        collectionId: "c",
        cabinets: [],
        values: { global: { Height: 56, Enabled: true, Cleared: null, Name: "x" } },
      },
    });

    expect(issues).toEqual([]);
    expect(fragment.values.global).toEqual({ Height: 56, Enabled: true, Cleared: null, Name: "x" });
  });

  it("reads v1's composition-wide basin fallback and rejects it in v2", () => {
    const v1 = readConfigurationFragment({
      configuration: { version: 1, collectionId: "c", cabinets: [], values: { basin: { sinkType: "Vessel" } } },
    });
    expect(readFragmentValue(v1.fragment, "sinkType", { scope: "basin" })).toBe("Vessel");

    const v2 = readConfigurationFragment({
      configuration: { version: 2, collectionId: "c", cabinets: [], values: { basin: { sinkType: "Vessel" } } },
    });
    expect(v2.issues.map(({ code }) => code)).toContain("fragment.invalid-values");
    expect(v2.fragment.values).toEqual({});
  });
});
