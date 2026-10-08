import { describe, expect, it } from "vitest";

import {
  CUSTOMIZATION_FLOW_IDS,
  parseProductProfile,
  PLAYER_MENU_ITEM_IDS,
  type CustomizationSchema,
  type ProductProfile,
} from "@/entities/collection";
import { readCustomizationSchema } from "@/entities/collection/__tests__/fixtures/readCustomizationSchema";

import classProfileDocument from "../../../../../../../public/collections/class/product-profile.json";
import classUi from "../../../../../../../public/collections/class/ui.json";
import lameProfileDocument from "../../../../../../../public/collections/lame/product-profile.json";
import lameUi from "../../../../../../../public/collections/lame/ui.json";
import makoProfileDocument from "../../../../../../../public/collections/mako/product-profile.json";
import makoUi from "../../../../../../../public/collections/mako/ui.json";
import tricotProfileDocument from "../../../../../../../public/collections/tricot/product-profile.json";
import tricotUi from "../../../../../../../public/collections/tricot/ui.json";
import urbanDuplexProfileDocument from "../../../../../../../public/collections/urban-duplex/product-profile.json";
import urbanDuplexUi from "../../../../../../../public/collections/urban-duplex/ui.json";
import urbanFreestandingProfileDocument from "../../../../../../../public/collections/urban-freestanding/product-profile.json";
import urbanFreestandingUi from "../../../../../../../public/collections/urban-freestanding/ui.json";
import urbanLowHeightProfileDocument from "../../../../../../../public/collections/urban-low-height/product-profile.json";
import urbanLowHeightUi from "../../../../../../../public/collections/urban-low-height/ui.json";
import ushProfileDocument from "../../../../../../../public/collections/urban-standard-height/product-profile.json";
import ushUi from "../../../../../../../public/collections/urban-standard-height/ui.json";
import { resolvePlayerMenuSupport } from "../playerMenuCatalog";

const readProfile = (document: unknown): ProductProfile => {
  const result = parseProductProfile(document);
  if (!result.ok) throw new Error(`Expected a valid product profile: ${JSON.stringify(result.diagnostics)}`);

  return result.profile;
};

const COLLECTIONS: Record<string, { schema: CustomizationSchema; profile: ProductProfile }> = {
  "urban-standard-height": { schema: readCustomizationSchema(ushUi), profile: readProfile(ushProfileDocument) },
  "urban-low-height": {
    schema: readCustomizationSchema(urbanLowHeightUi),
    profile: readProfile(urbanLowHeightProfileDocument),
  },
  "urban-freestanding": {
    schema: readCustomizationSchema(urbanFreestandingUi),
    profile: readProfile(urbanFreestandingProfileDocument),
  },
  "urban-duplex": { schema: readCustomizationSchema(urbanDuplexUi), profile: readProfile(urbanDuplexProfileDocument) },
  class: { schema: readCustomizationSchema(classUi), profile: readProfile(classProfileDocument) },
  mako: { schema: readCustomizationSchema(makoUi), profile: readProfile(makoProfileDocument) },
  lame: { schema: readCustomizationSchema(lameUi), profile: readProfile(lameProfileDocument) },
  tricot: { schema: readCustomizationSchema(tricotUi), profile: readProfile(tricotProfileDocument) },
};

const supportOf = (collectionId: string, flowId: "prebuilt" | "custom") => {
  const { schema, profile } = COLLECTIONS[collectionId];
  return resolvePlayerMenuSupport(schema, profile, flowId);
};

describe("resolvePlayerMenuSupport", () => {
  it("offers Urban Standard Height every item of the menu", () => {
    for (const flowId of CUSTOMIZATION_FLOW_IDS) {
      expect([...supportOf("urban-standard-height", flowId).items].sort()).toEqual([...PLAYER_MENU_ITEM_IDS].sort());
    }
  });

  it("leaves out what Class has no data for: the accessories page and a handle choice", () => {
    for (const flowId of CUSTOMIZATION_FLOW_IDS) {
      const { items } = supportOf("class", flowId);

      expect(items.has("accessories")).toBe(false);
      expect(items.has("handle-style")).toBe(false);
      expect(items.has("color")).toBe(true);
      expect(items.has("basin-style")).toBe(true);
    }
  });

  it("leaves out the countertop style and the vessel of Tricot, which shows neither", () => {
    const { items } = supportOf("tricot", "custom");

    expect(items.has("countertop-style")).toBe(false);
    expect(items.has("vessel-style")).toBe(true);
    expect(items.has("vessel-color")).toBe(false);
  });

  it("leads each item to the collection's own step and section", () => {
    expect(supportOf("class", "prebuilt").targets.color).toEqual({
      stepId: "color",
      path: "/prebuilt/color",
      sectionId: "cabinet-color",
    });
    expect(supportOf("urban-standard-height", "custom").targets["basin-style"]).toMatchObject({
      stepId: "countertop-custom",
      sectionId: "basin-style-custom",
    });
    // Add continues in the custom flow, from Prebuilt as well.
    expect(supportOf("class", "prebuilt").targets.add).toMatchObject({
      stepId: "cabinet-builder",
      sectionId: "cabinet-type",
    });
  });

  it("hides an item the collection's ui.json hides, although its data supports it", () => {
    const { schema, profile } = COLLECTIONS.class;
    const { items, targets } = resolvePlayerMenuSupport(
      { ...schema, playerMenu: { hidden: ["duplicate", "color"] } },
      profile,
      "custom",
    );

    expect(items.has("duplicate")).toBe(false);
    expect(items.has("color")).toBe(false);
    expect(targets.color).toBeUndefined();
    expect(items.has("delete")).toBe(true);
  });

  it("offers only the items that need nothing while no collection is loaded", () => {
    expect([...resolvePlayerMenuSupport(null, null, "custom").items].sort()).toEqual(
      ["countertop-position", "delete", "duplicate", "open", "reposition", "resize"].sort(),
    );
  });

  it.each(Object.keys(COLLECTIONS))("gives every navigating item of %s a step of the flow it opens", (collectionId) => {
    const { schema } = COLLECTIONS[collectionId];
    const paths = new Set(
      CUSTOMIZATION_FLOW_IDS.flatMap((flowId) => schema.flows[flowId].steps.map(({ path }) => path)),
    );

    for (const flowId of CUSTOMIZATION_FLOW_IDS) {
      for (const target of Object.values(supportOf(collectionId, flowId).targets)) {
        expect(paths.has(target.path)).toBe(true);
      }
    }
  });
});
