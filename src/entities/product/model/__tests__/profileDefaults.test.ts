import { describe, expect, it } from "vitest";

import { getPackagedProductProfile } from "@/entities/collection";
import type { ProductProfile } from "@/entities/collection";
import { productReducer, reset, setActiveProfile } from "@/entities/product/model/store/slice";

/**
 * Values the slice used to hardcode. They now come from `profile.defaults`; this test is
 * the parity check that the migration did not change what USH starts with.
 */
const LEGACY_USH_DEFAULTS = {
  CabinetColor: "Pulpis Chiaro TKH",
  CountertopColor: "Cacao Orinoco FF MT",
  sinkType: "Top_Tekorlux_Rectangular",
  CountertopStyle: "integrated",
  SidePanelLeft: "none",
  SidePanelRight: "none",
  TowelBarOption: "None",
  FaucetHolesAmount: "0",
  FaucetHolesSpacing: '4"',
} as const;

const withProfile = (profile: ProductProfile | null) =>
  productReducer(productReducer(undefined, { type: "@@INIT" }), setActiveProfile(profile));

describe("product defaults from the active profile", () => {
  it("starts empty until a collection is active", () => {
    const state = productReducer(undefined, { type: "@@INIT" });

    expect(state.productOptions.CabinetColor).toBe("");
    expect(state.productOptions.sinkType).toBe("");
    expect(state.productOptions.CountertopStyle).toBe("");
  });

  it("reproduces the legacy USH starting values from data", () => {
    const state = withProfile(getPackagedProductProfile());

    for (const [attributeId, value] of Object.entries(LEGACY_USH_DEFAULTS)) {
      expect(state.productOptions[attributeId as keyof typeof LEGACY_USH_DEFAULTS], attributeId).toBe(value);
    }
  });

  it("does not let another collection inherit the USH values", () => {
    const profile = getPackagedProductProfile();
    if (!profile) throw new Error("packaged profile must parse");

    const other: ProductProfile = {
      ...profile,
      collectionId: "other",
      defaults: { CabinetColor: "Other Colour" },
    };

    const state = withProfile(other);

    expect(state.productOptions.CabinetColor).toBe("Other Colour");
    expect(state.productOptions.sinkType).toBe("");
    expect(state.productOptions.CountertopStyle).toBe("");
  });

  it("ignores defaults that are not typed options", () => {
    const profile = getPackagedProductProfile();
    if (!profile) throw new Error("packaged profile must parse");

    const withUnknown: ProductProfile = {
      ...profile,
      defaults: { ...profile.defaults, TestGrooveFinish: "None" },
    };

    const state = withProfile(withUnknown);

    expect(state.productOptions).not.toHaveProperty("TestGrooveFinish");
    expect(state.productOptions.CabinetColor).toBe(LEGACY_USH_DEFAULTS.CabinetColor);
  });

  it("keeps the collection defaults after a reset", () => {
    const active = withProfile(getPackagedProductProfile());
    const afterReset = productReducer(active, reset());

    expect(afterReset.productOptions.CabinetColor).toBe(LEGACY_USH_DEFAULTS.CabinetColor);
    expect(afterReset.activeProfile).not.toBeNull();
  });
});
