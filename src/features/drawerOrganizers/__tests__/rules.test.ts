import { afterEach, describe, expect, it, vi } from "vitest";

import classDocument from "../../../../public/collections/class/product-profile.json";
import lameDocument from "../../../../public/collections/lame/product-profile.json";
import makoDocument from "../../../../public/collections/mako/product-profile.json";
import tricotDocument from "../../../../public/collections/tricot/product-profile.json";
import urbanDuplexDocument from "../../../../public/collections/urban-duplex/product-profile.json";
import urbanFreestandingDocument from "../../../../public/collections/urban-freestanding/product-profile.json";
import urbanLowHeightDocument from "../../../../public/collections/urban-low-height/product-profile.json";
import urbanStandardHeightDocument from "../../../../public/collections/urban-standard-height/product-profile.json";
import { parseProductProfile } from "@/entities/collection/lib/parseProductProfile";
import type { ProductProfile } from "@/entities/collection/model/productProfile";

import contractFixture from "./fixtures/contract/contract.v1.json";
import { ORGANIZER_PROFILES } from "../model/presets";
import { readOrganizerRules } from "../model/rules";

/**
 * `readOrganizerRules(profile) !== null` is the one gate of the feature in the UI: the page, the layer,
 * the price and the Summary all ask it (organizersEnabled).
 */

const profileOf = (document: unknown): ProductProfile => {
  const parsed = parseProductProfile(document);
  if (!parsed.ok) throw new Error(`profile failed validation: ${JSON.stringify(parsed.diagnostics)}`);
  return parsed.profile;
};

const withOrganizers = (profileId: string): ProductProfile => {
  const base = profileOf(classDocument);
  return { ...base, ruleData: { ...base.ruleData, drawerOrganizers: { profile: profileId } } };
};

afterEach(() => vi.restoreAllMocks());

describe("readOrganizerRules", () => {
  it.each([
    ["class", classDocument],
    ["mako", makoDocument],
    ["lame", lameDocument],
    ["tricot", tricotDocument],
  ])("returns the ROW-MTL-43 profile for %s", (_collection, document) => {
    const rules = readOrganizerRules(profileOf(document));

    expect(rules).toMatchObject({ profileId: "ROW-MTL-43", positionCount: 5, maxActive: 5, codec: "cells-v1" });
    expect(rules?.presets).toEqual(ORGANIZER_PROFILES["ROW-MTL-43"].presets);
  });

  it.each([
    ["urban-standard-height", urbanStandardHeightDocument],
    ["urban-low-height", urbanLowHeightDocument],
    ["urban-freestanding", urbanFreestandingDocument],
    ["urban-duplex", urbanDuplexDocument],
  ])("returns null for %s, which does not offer Ph2 organizers", (_collection, document) => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(readOrganizerRules(profileOf(document))).toBeNull();
    expect(warn).not.toHaveBeenCalled();
  });

  it("returns null without a profile", () => {
    expect(readOrganizerRules(null)).toBeNull();
  });

  it("returns null and warns once for a profile id it does not know", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(readOrganizerRules(withOrganizers("ROW-XYZ-99"))).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith("[drawerOrganizers] unknown organizer profile", "ROW-XYZ-99");
  });

  it("does not mistake a property of Object for a profile", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(readOrganizerRules(withOrganizers("constructor"))).toBeNull();
    expect(readOrganizerRules(withOrganizers("toString"))).toBeNull();
  });

  it("gives the caller a copy: changing it leaves the table as it was", () => {
    const rules = readOrganizerRules(withOrganizers("ROW-MTL-43"));

    expect(rules).not.toBe(ORGANIZER_PROFILES["ROW-MTL-43"]);
    expect(Object.keys(ORGANIZER_PROFILES["ROW-MTL-43"])).not.toContain("profileId");
  });
});

describe("the table against the contract fixture", () => {
  const { profile: fixtureProfile } = contractFixture;
  const table = ORGANIZER_PROFILES[fixtureProfile.id];

  it("is the profile the fixture declares", () => {
    expect(table).toBeDefined();
    expect(table).toMatchObject({
      positionCount: fixtureProfile.positionCount,
      maxActive: fixtureProfile.maxActive,
      codec: fixtureProfile.codec,
    });
  });

  it("is the derived.profile of every drawer 3D reports one for", () => {
    const reported = contractFixture.cases.flatMap(({ name, expected }) =>
      Object.entries(expected.derived).flatMap(([drawer, derived]) =>
        derived.profile ? [{ where: `${name}/${drawer}`, profile: derived.profile }] : [],
      ),
    );

    expect(reported.length).toBeGreaterThan(10);
    for (const { where, profile } of reported) {
      const row = ORGANIZER_PROFILES[profile.id];
      expect(row, where).toBeDefined();
      expect({ positionCount: row.positionCount, maxActive: row.maxActive, codec: row.codec }, where).toEqual({
        positionCount: profile.positionCount,
        maxActive: profile.maxActive,
        codec: profile.codec,
      });
    }
  });
});
