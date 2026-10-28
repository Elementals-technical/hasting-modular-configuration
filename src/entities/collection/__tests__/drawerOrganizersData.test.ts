import { describe, expect, it } from "vitest";

import classProfileDocument from "../../../../public/collections/class/product-profile.json";
import classUi from "../../../../public/collections/class/ui.json";
import lameProfileDocument from "../../../../public/collections/lame/product-profile.json";
import lameUi from "../../../../public/collections/lame/ui.json";
import makoProfileDocument from "../../../../public/collections/mako/product-profile.json";
import makoUi from "../../../../public/collections/mako/ui.json";
import tricotProfileDocument from "../../../../public/collections/tricot/product-profile.json";
import tricotUi from "../../../../public/collections/tricot/ui.json";
import { readOrganizerRules } from "@/features/drawerOrganizers/model/rules";

import { validateCustomizationSchema } from "../lib/customization/validateCustomizationSchema";
import { parseProductProfile } from "../lib/parseProductProfile";
import type { ProductProfile } from "../model/productProfile";

/**
 * The Ph2 drawer organizer data of Class, Mako and Lame (Tricot is a separate package): the capability flag
 * in `ruleData`, the `DividersOption` attribute, the texts, the Accessories step and the `ui.json` block.
 */

const COLLECTIONS = [
  { id: "class", document: classProfileDocument, ui: classUi },
  { id: "mako", document: makoProfileDocument, ui: makoUi },
  { id: "lame", document: lameProfileDocument, ui: lameUi },
] as const;

const profileOf = (document: unknown): ProductProfile => {
  const parsed = parseProductProfile(document);
  if (!parsed.ok) throw new Error(`profile failed validation: ${JSON.stringify(parsed.diagnostics)}`);
  return parsed.profile;
};

/** The texts of the Ph2 organizer toasts and hints (a proposal, Q-D10). */
const ORGANIZER_TEXTS = {
  "organizer.hintOpenDrawer": "Click ‘Open Drawer’ on a drawer to add divider columns.",
  "organizer.lockedZone": "Drain area — dividers can't be placed here.",
  "organizer.trimmed": "{n} column(s) no longer fit and were removed.",
  "organizer.drawerRemoved": "{n} column(s) were removed with the drawer.",
  "organizer.drawerFull": "This drawer is full.",
  "organizer.unavailable": "Dividers aren't available for this cabinet size.",
  "organizer.placeFailed": "Couldn't place the column. Try again.",
  "organizer.maxPositions": "A column holds up to 5 inserts.",
  "organizer.typeChanged": "Dividers were removed because the cabinet type changed.",
  "organizer.columnRemoved": "Column removed.",
  "organizer.cleared": "Dividers removed.",
  "organizer.undoHint": "Use Undo to bring them back.",
  "organizer.oakPending": "Oak organizers are not available yet.",
  "organizer.updateRequired": "These dividers were saved by a newer version. Reload the page to edit them.",
};

describe.each(COLLECTIONS)("$id drawer organizer data", ({ document, ui }) => {
  describe("product profile", () => {
    it("parses without diagnostics and points at the ROW-MTL-43 organizer profile", () => {
      const parsed = parseProductProfile(document);

      expect(parsed.ok ? [] : parsed.diagnostics).toEqual([]);
      expect(profileOf(document).ruleData.drawerOrganizers).toEqual({ profile: "ROW-MTL-43" });
    });

    it("opens the feature for readOrganizerRules", () => {
      expect(readOrganizerRules(profileOf(document))).toMatchObject({ profileId: "ROW-MTL-43" });
    });

    it("declares DividersOption: None or Customize, starting at None", () => {
      const attribute = profileOf(document).attributes.find(({ attributeId }) => attributeId === "DividersOption");

      expect(attribute).toEqual({
        attributeId: "DividersOption",
        scope: "global",
        initialValue: "None",
        noneValue: "None",
        options: [
          { value: "None", label: "None", order: 10 },
          { value: "Customize", label: "Customize", order: 20 },
        ],
      });
    });

    it("keeps DividersStyle as the Metal and Oak catalog", () => {
      const attribute = profileOf(document).attributes.find(({ attributeId }) => attributeId === "DividersStyle");

      expect(attribute?.scope).toBe("drawer");
      expect(attribute?.options?.map(({ value }) => value)).toEqual(["Metal", "Oak"]);
    });

    it("declares each attribute once", () => {
      const ids = profileOf(document).attributes.map(({ attributeId }) => attributeId);

      expect(new Set(ids).size).toBe(ids.length);
    });

    it("carries the organizer texts and no other organizer key", () => {
      const { messages } = profileOf(document);
      const organizerMessages = Object.fromEntries(
        Object.entries(messages).filter(([key]) => key.startsWith("organizer.")),
      );

      expect(organizerMessages).toEqual(ORGANIZER_TEXTS);
    });

    it.each([
      ["a section that is not an object", "organizer"],
      ["a section without profile", {}],
      ["a blank profile", { profile: "  " }],
      ["a profile that is not a string", { profile: 43 }],
    ])("reports %s as ruleData.invalid_section", (_what, broken) => {
      const parsed = parseProductProfile({
        ...document,
        ruleData: { ...document.ruleData, drawerOrganizers: broken },
      });

      expect(parsed.ok).toBe(false);
      expect(!parsed.ok && parsed.diagnostics.map(({ code }) => code)).toContain("ruleData.invalid_section");
      expect(!parsed.ok && parsed.diagnostics.map(({ dataPath }) => dataPath).join(" ")).toContain(
        "/ruleData/drawerOrganizers",
      );
    });
  });

  describe("ui.json", () => {
    it("is valid", () => {
      const result = validateCustomizationSchema(ui);

      expect(result.ok ? [] : result.diagnostics).toEqual([]);
    });

    it.each(["prebuilt", "custom"] as const)(
      "puts the Accessories step of the %s flow between countertop and faucet-holes",
      (flow) => {
        const steps = ui.flows[flow].steps;
        const ids = steps.map(({ stepId }) => stepId);
        const at = ids.indexOf("accessories");

        expect(at).toBeGreaterThan(-1);
        expect(ids[at - 1]).toBe("countertop");
        expect(ids[at + 1]).toBe("faucet-holes");
        expect(steps[at]).toEqual({ stepId: "accessories", path: `/${flow}/accessories`, screen: "accessories" });
      },
    );

    it("declares the Accessories step with the Drawer Dividers section", () => {
      expect(ui.steps.accessories).toEqual({ label: "Accessories", kind: "fields", sectionIds: ["dividers"] });
      expect(ui.sections.dividers).toEqual({
        label: "Drawer Dividers",
        defaultOpen: true,
        fields: [
          {
            attributeId: "DividersOption",
            control: "swatches",
            hints: { Customize: "Click the ⊕ button to place a divider column. Select added columns to customize it." },
          },
        ],
      });
    });

    it("has no material field: Metal and Oak are not chosen in the MVP (Q-D5)", () => {
      expect(JSON.stringify(ui.sections.dividers)).not.toContain("DividersStyle");
    });

    it("declares the organizer block", () => {
      expect(ui.drawerOrganizers).toEqual({ panelTitle: "Divider Options", mobileLayout: "M2" });
    });

    it("points every field of the Accessories step at an attribute of the profile", () => {
      const attributeIds = new Set(profileOf(document).attributes.map(({ attributeId }) => attributeId));
      const fields = ui.steps.accessories.sectionIds.flatMap(
        (id) => (ui.sections as Record<string, { fields: { attributeId: string }[] }>)[id].fields,
      );

      expect(fields.every(({ attributeId }) => attributeIds.has(attributeId))).toBe(true);
    });

    it("accepts the optional overrides of the block", () => {
      const result = validateCustomizationSchema({
        ...ui,
        drawerOrganizers: {
          panelTitle: "Divider Options",
          customizeLabel: "Edit positions",
          presets: { "preset-1": { label: "Back Pair" }, empty: {} },
          mobileLayout: "M1",
        },
      });

      expect(result.ok).toBe(true);
    });

    it("accepts a schema without the block", () => {
      const withoutBlock = Object.fromEntries(Object.entries(ui).filter(([key]) => key !== "drawerOrganizers"));

      expect(validateCustomizationSchema(withoutBlock).ok).toBe(true);
    });

    it.each([
      ["a block that is not an object", "Divider Options", "drawerOrganizers"],
      ["a block that is an array", [], "drawerOrganizers"],
      ["a panelTitle that is not a string", { panelTitle: 1 }, "drawerOrganizers.panelTitle"],
      ["a customizeLabel that is not a string", { customizeLabel: false }, "drawerOrganizers.customizeLabel"],
      ["presets that are not an object", { presets: [] }, "drawerOrganizers.presets"],
      ["a preset that is not an object", { presets: { "preset-1": "Back" } }, "drawerOrganizers.presets.preset-1"],
      [
        "a preset label that is not a string",
        { presets: { "preset-1": { label: 2 } } },
        "drawerOrganizers.presets.preset-1.label",
      ],
      ["a mobileLayout other than M1 or M2", { mobileLayout: "M3" }, "drawerOrganizers.mobileLayout"],
    ])("reports %s as invalid-schema at %s", (_what, broken, dataPath) => {
      const result = validateCustomizationSchema({ ...ui, drawerOrganizers: broken });

      expect(result.ok).toBe(false);
      expect(!result.ok && result.diagnostics).toContainEqual(
        expect.objectContaining({ code: "invalid-schema", dataPath }),
      );
    });

    it("reports every broken field of the block, not only the first", () => {
      const result = validateCustomizationSchema({
        ...ui,
        drawerOrganizers: { panelTitle: 1, customizeLabel: 2, mobileLayout: "M0" },
      });

      expect(!result.ok && result.diagnostics.map(({ dataPath }) => dataPath).sort()).toEqual([
        "drawerOrganizers.customizeLabel",
        "drawerOrganizers.mobileLayout",
        "drawerOrganizers.panelTitle",
      ]);
    });
  });
});

// Tricot (local testing; Q-K12 is still open and its divider SKU is missing, Q-N2): the same organizer data as the
// three collections above, but its Accessories step is `side-panels`, where Drawer Dividers sit under Side Panels.
describe("Tricot drawer organizer data", () => {
  it("parses without diagnostics and opens the feature with the ROW-MTL-43 profile", () => {
    const parsed = parseProductProfile(tricotProfileDocument);

    expect(parsed.ok ? [] : parsed.diagnostics).toEqual([]);
    expect(profileOf(tricotProfileDocument).ruleData.drawerOrganizers).toEqual({ profile: "ROW-MTL-43" });
    expect(readOrganizerRules(profileOf(tricotProfileDocument))).toMatchObject({ profileId: "ROW-MTL-43" });
  });

  it("carries the organizer texts and declares each attribute once", () => {
    const { messages, attributes } = profileOf(tricotProfileDocument);
    const organizerMessages = Object.fromEntries(
      Object.entries(messages).filter(([key]) => key.startsWith("organizer.")),
    );
    const ids = attributes.map(({ attributeId }) => attributeId);

    expect(organizerMessages).toEqual(ORGANIZER_TEXTS);
    expect(ids).toEqual(expect.arrayContaining(["DividersOption", "DividersStyle"]));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has a valid ui.json with Drawer Dividers after Side Panels on the side-panels step and the organizer block", () => {
    const result = validateCustomizationSchema(tricotUi);

    expect(result.ok ? [] : result.diagnostics).toEqual([]);
    expect(tricotUi.steps["side-panels"].sectionIds).toEqual(["side-panels", "dividers"]);
    expect(tricotUi.sections.dividers.fields.map(({ attributeId }) => attributeId)).toEqual(["DividersOption"]);
    expect(tricotUi.drawerOrganizers).toEqual({ panelTitle: "Divider Options", mobileLayout: "M2" });
  });
});
