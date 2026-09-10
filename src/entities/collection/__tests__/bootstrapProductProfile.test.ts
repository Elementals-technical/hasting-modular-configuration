import { describe, expect, it } from "vitest";

import { store } from "@/app/store";
import { getActiveCollectionId, getActiveProductProfile } from "@/entities/configuration/model/store/selectors";

import { getPackagedProductProfile, loadPackagedProductProfile } from "../lib/bootstrapProductProfile";

describe("packaged ProductProfile", () => {
  it("validates against the parser", () => {
    const result = loadPackagedProductProfile();

    expect(result.ok, result.ok ? "" : JSON.stringify(result.diagnostics)).toBe(true);
  });

  it("declares the handle catalog the configurator needs", () => {
    const profile = getPackagedProductProfile();

    expect(profile?.collectionId).toBe("urban-standard-height");
    expect(profile?.attributes.find((attribute) => attribute.attributeId === "Handle")?.options).toHaveLength(3);
  });

  it("is in the store from startup", () => {
    // Guard against the regression this bootstrap exists to prevent: with no profile the
    // handle catalog is empty and the configurator offers no handles at all.
    expect(getActiveCollectionId(store.getState())).toBe("urban-standard-height");
    expect(getActiveProductProfile(store.getState())).not.toBeNull();
  });
});
