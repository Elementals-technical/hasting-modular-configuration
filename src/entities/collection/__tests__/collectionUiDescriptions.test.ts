import { describe, expect, it } from "vitest";

import classProfile from "../../../../public/collections/class/product-profile.json";
import classUi from "../../../../public/collections/class/ui.json";
import makoProfile from "../../../../public/collections/mako/product-profile.json";
import makoUi from "../../../../public/collections/mako/ui.json";
import urbanLowHeightProfile from "../../../../public/collections/urban-low-height/product-profile.json";
import urbanLowHeightUi from "../../../../public/collections/urban-low-height/ui.json";
import ushProfile from "../../../../public/collections/urban-standard-height/product-profile.json";
import ushUi from "../../../../public/collections/urban-standard-height/ui.json";
import { CUSTOMIZATION_FLOW_IDS, type CustomizationSchema } from "../model/customizationSchema";
import { parseProductProfile } from "../lib/parseProductProfile";
import { selectAttribute } from "../lib/productProfileSelectors";
import { validateCustomizationSchema } from "../lib/customization/validateCustomizationSchema";

/**
 * Each collection describes its own UI in ui.json. This test keeps that description honest against the
 * product profile: a field may only name an attribute the profile can supply options for.
 * Validity of the documents themselves is covered by validateCustomizationSchema and the package tests.
 */

type CollectionDocuments = [collectionId: string, uiDocument: unknown, profileDocument: unknown];

const ushDocuments: CollectionDocuments = ["urban-standard-height", ushUi, ushProfile];
const urbanLowHeightDocuments: CollectionDocuments = ["urban-low-height", urbanLowHeightUi, urbanLowHeightProfile];
const classDocuments: CollectionDocuments = ["class", classUi, classProfile];
const makoDocuments: CollectionDocuments = ["mako", makoUi, makoProfile];
const collections = [ushDocuments, urbanLowHeightDocuments, classDocuments, makoDocuments];

const parseCollection = ([collectionId, uiDocument, profileDocument]: CollectionDocuments) => {
  const validation = validateCustomizationSchema(uiDocument);
  const parsed = parseProductProfile(profileDocument);
  if (!validation.ok) throw new Error(`${collectionId} ui.json: ${JSON.stringify(validation.diagnostics)}`);
  if (!parsed.ok) throw new Error(`${collectionId} product-profile.json: ${JSON.stringify(parsed.diagnostics)}`);
  return { schema: validation.schema, profile: parsed.profile };
};

const fieldAttributeIds = (schema: CustomizationSchema) =>
  Object.values(schema.sections).flatMap((section) => section.fields.map((field) => field.attributeId));

describe.each(collections)("%s ui.json", (...documents) => {
  const { schema, profile } = parseCollection(documents);

  it("ends both flows on a summary step", () => {
    for (const flowId of CUSTOMIZATION_FLOW_IDS) {
      const { steps } = schema.flows[flowId];
      expect(steps.length).toBeGreaterThanOrEqual(2);
      expect(schema.steps[steps[steps.length - 1].stepId]?.kind).toBe("summary");
    }
  });

  it("names only attributes its profile declares, each with a source of options", () => {
    for (const [sectionId, section] of Object.entries(schema.sections)) {
      for (const { attributeId } of section.fields) {
        const attribute = selectAttribute(profile, attributeId);
        expect(attribute, `${sectionId}.${attributeId}`).not.toBeNull();
        expect(
          (attribute?.options?.length ?? 0) > 0 || Boolean(attribute?.optionsSource),
          `${sectionId}.${attributeId} has no options`,
        ).toBe(true);
      }
    }
  });
});

describe("Class and Mako UI descriptions", () => {
  it("show no handle field for Class and the Mako-only colour fields for Mako", () => {
    const classFields = fieldAttributeIds(parseCollection(classDocuments).schema);
    const makoFields = fieldAttributeIds(parseCollection(makoDocuments).schema);

    expect(classFields).not.toContain("Handle");
    expect(classFields).toEqual(expect.arrayContaining(["CabinetSideColor", "FrameColor"]));
    expect(makoFields).toEqual(expect.arrayContaining(["HandleColor", "LegColor"]));
  });
});
