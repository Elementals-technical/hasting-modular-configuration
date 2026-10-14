import { describe, expect, it } from "vitest";

import urbanDuplexProfileDocument from "../../../../../public/collections/urban-duplex/product-profile.json";
import ufsProfileDocument from "../../../../../public/collections/urban-freestanding/product-profile.json";
import ulhProfileDocument from "../../../../../public/collections/urban-low-height/product-profile.json";
import ushProfileDocument from "../../../../../public/collections/urban-standard-height/product-profile.json";
import { parseProductProfile, type ProductProfile } from "@/entities/collection";

import { isLeavingSideShelfHandle, isSideShelfBlockedByHandle } from "../lib/sideShelfHandleRule";

/**
 * A side shelf goes with a handle without a groove, in the collections that have one. Urban
 * Duplex has the Upper Groove alone and sells the shelf beside its cabinets, so its shelf is
 * not tied to the handle.
 */

const parse = (document: unknown): ProductProfile => {
  const parsed = parseProductProfile(document);
  if (!parsed.ok) throw new Error("profile must parse");
  return parsed.profile;
};

const ush = parse(ushProfileDocument);
const ufs = parse(ufsProfileDocument);
const ulh = parse(ulhProfileDocument);
const urbanDuplex = parse(urbanDuplexProfileDocument);

describe("a side shelf and the handle of the cabinets", () => {
  it.each([
    ["Urban Standard Height", ush, "handle_urban_topcut", "handle_pto"],
    ["Urban Freestanding", ufs, "UG", "PTO"],
    ["Urban Low Height", ulh, "handle_urban_topcut", "handle_pto"],
  ])("%s: blocked beside a groove handle, free beside push-to-open", (_name, profile, groove, pushToOpen) => {
    expect(isSideShelfBlockedByHandle(profile, groove)).toBe(true);
    expect(isSideShelfBlockedByHandle(profile, pushToOpen)).toBe(false);
  });

  it("is free while no handle is chosen", () => {
    expect(isSideShelfBlockedByHandle(ush, null)).toBe(false);
    expect(isSideShelfBlockedByHandle(ush, "")).toBe(false);
  });

  it("Urban Duplex: free beside its only handle, the Upper Groove", () => {
    expect(isSideShelfBlockedByHandle(urbanDuplex, "UG")).toBe(false);
  });

  it("is free without a profile", () => {
    expect(isSideShelfBlockedByHandle(null, "UG")).toBe(false);
  });
});

describe("a handle change with side shelves placed", () => {
  it.each([
    ["Urban Standard Height", ush, "handle_urban_topcut", "handle_pto"],
    ["Urban Freestanding", ufs, "UG", "PTO"],
  ])("%s: push-to-open to a groove handle takes their handle away", (_name, profile, groove, pushToOpen) => {
    expect(isLeavingSideShelfHandle(profile, pushToOpen, groove)).toBe(true);
    // As before the rule was shared: no handle yet counts as one without a groove.
    expect(isLeavingSideShelfHandle(profile, undefined, groove)).toBe(true);
    expect(isLeavingSideShelfHandle(profile, groove, pushToOpen)).toBe(false);
    expect(isLeavingSideShelfHandle(profile, groove, groove)).toBe(false);
  });

  it("Urban Duplex: the Upper Groove after no handle leaves the shelves", () => {
    expect(isLeavingSideShelfHandle(urbanDuplex, undefined, "UG")).toBe(false);
    expect(isLeavingSideShelfHandle(urbanDuplex, "", "UG")).toBe(false);
  });
});
