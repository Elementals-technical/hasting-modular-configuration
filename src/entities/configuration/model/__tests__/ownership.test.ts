import { describe, expect, it } from "vitest";

import ushProfile from "../../../../../public/collections/urban-standard-height/product-profile.json";
import { parseProductProfile } from "@/entities/collection";
import { productReducer } from "@/entities/product/model/store/slice";

import { ATTRIBUTE_OWNERSHIP, getUnpersistedAttributeIds } from "../ownership";

const initialProductState = productReducer(undefined, { type: "@@INIT" });

describe("ATTRIBUTE_OWNERSHIP", () => {
  it("covers every field of the typed product options", () => {
    const missing = Object.keys(initialProductState.productOptions).filter(
      (field) => !(field in ATTRIBUTE_OWNERSHIP),
    );

    expect(missing, `add an ownership entry for: ${missing.join(", ")}`).toEqual([]);
  });

  it("declares exactly one scope and one owner per attribute", () => {
    for (const [attributeId, ownership] of Object.entries(ATTRIBUTE_OWNERSHIP)) {
      expect(ownership.scope, attributeId).toBeTruthy();
      expect(ownership.owner, attributeId).toBeTruthy();
      expect(ownership.stateField, attributeId).toBeTruthy();
    }
  });

  it("agrees with the profile about which attributes have a catalog", () => {
    const parsed = parseProductProfile(ushProfile);
    if (!parsed.ok) throw new Error("USH fixture must parse");

    const profileIds = new Set(parsed.profile.attributes.map((attribute) => attribute.attributeId));

    const disagreements = Object.entries(ATTRIBUTE_OWNERSHIP)
      .filter(([attributeId, ownership]) => ownership.hasProfileAttribute !== profileIds.has(attributeId))
      .map(([attributeId]) => attributeId);

    expect(disagreements, `registry and profile disagree about: ${disagreements.join(", ")}`).toEqual([]);
  });

  it("agrees with the profile about the scope of every shared attribute", () => {
    const parsed = parseProductProfile(ushProfile);
    if (!parsed.ok) throw new Error("USH fixture must parse");

    const mismatched = parsed.profile.attributes
      .filter((attribute) => ATTRIBUTE_OWNERSHIP[attribute.attributeId])
      .filter((attribute) => ATTRIBUTE_OWNERSHIP[attribute.attributeId].scope !== attribute.scope)
      .map((attribute) => `${attribute.attributeId}: ${ATTRIBUTE_OWNERSHIP[attribute.attributeId].scope} vs ${attribute.scope}`);

    expect(mismatched).toEqual([]);
  });

  it("names the values that the current Save format drops", () => {
    // Documented gap, not a passing grade: these are the input for C07.
    expect(getUnpersistedAttributeIds().sort()).toEqual([
      "CabinetColorFinish",
      "CabinetColorMaterial",
      "CabinetColorSku",
      "HandleGrooveColorSku",
    ]);
  });
});
