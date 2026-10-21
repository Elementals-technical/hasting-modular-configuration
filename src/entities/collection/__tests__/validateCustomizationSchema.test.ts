import { describe, expect, it } from "vitest";

import uiJson from "../../../../public/collections/urban-standard-height/ui.json";
import { validateCustomizationSchema } from "../lib/customization/validateCustomizationSchema";

describe("validateCustomizationSchema", () => {
  it("accepts the real USH ui.json", () => {
    const result = validateCustomizationSchema(uiJson);

    expect(result.ok).toBe(true);
  });

  it("rejects an unknown entryStepId", () => {
    const broken = {
      ...uiJson,
      flows: { ...uiJson.flows, prebuilt: { ...uiJson.flows.prebuilt, entryStepId: "ghost" } },
    };

    const result = validateCustomizationSchema(broken);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ code: "missing-entry-step" }));
  });

  it("rejects an unknown stepId referenced from a flow", () => {
    const broken = {
      ...uiJson,
      flows: {
        ...uiJson.flows,
        prebuilt: {
          ...uiJson.flows.prebuilt,
          steps: [...uiJson.flows.prebuilt.steps, { stepId: "ghost", path: "/prebuilt/ghost" }],
        },
      },
    };

    const result = validateCustomizationSchema(broken);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ code: "unknown-step-id" }));
  });

  it("rejects a duplicate route within the same flow", () => {
    const broken = {
      ...uiJson,
      flows: {
        ...uiJson.flows,
        prebuilt: {
          ...uiJson.flows.prebuilt,
          steps: [...uiJson.flows.prebuilt.steps, { stepId: "model", path: "/prebuilt/model" }],
        },
      },
    };

    const result = validateCustomizationSchema(broken);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ code: "duplicate-route" }));
  });

  it("rejects an unsupported screen kind", () => {
    const broken = { ...uiJson, steps: { ...uiJson.steps, model: { ...uiJson.steps.model, kind: "wizard" } } };

    const result = validateCustomizationSchema(broken);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ code: "unsupported-kind" }));
  });

  it("rejects a screen binding the router does not know", () => {
    const broken = {
      ...uiJson,
      flows: {
        ...uiJson.flows,
        prebuilt: {
          ...uiJson.flows.prebuilt,
          steps: [{ stepId: "model", path: "/prebuilt/model", screen: "prebuilt-wizard" }],
        },
      },
    };

    const result = validateCustomizationSchema(broken);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ code: "unsupported-screen" }));
  });

  it("rejects a sectionId that is not defined in sections", () => {
    const broken = {
      ...uiJson,
      steps: { ...uiJson.steps, cabinet: { ...uiJson.steps.cabinet, sectionIds: ["ghost-section"] } },
    };

    const result = validateCustomizationSchema(broken);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ code: "unknown-section-id" }));
  });

  it("rejects an unsupported field control", () => {
    const broken = {
      ...uiJson,
      sections: {
        ...uiJson.sections,
        "cabinet-color": {
          ...uiJson.sections["cabinet-color"],
          fields: [{ attributeId: "CabinetColor", control: "slider" }],
        },
      },
    };

    const result = validateCustomizationSchema(broken);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ code: "unsupported-control" }));
  });

  it("accepts a schema with no optionImages and one that declares them", () => {
    expect(validateCustomizationSchema({ ...uiJson, optionImages: undefined }).ok).toBe(true);
    expect(
      validateCustomizationSchema({
        ...uiJson,
        optionImages: { sinkType: { Top_HPLPrisma: "images/basin/prisma.jpg" } },
      }).ok,
    ).toBe(true);
  });

  it("rejects optionImages that is not a record of records of references", () => {
    const notARecord = validateCustomizationSchema({ ...uiJson, optionImages: [] });
    const attributeNotARecord = validateCustomizationSchema({ ...uiJson, optionImages: { sinkType: "x.jpg" } });
    const emptyReference = validateCustomizationSchema({
      ...uiJson,
      optionImages: { sinkType: { Top_HPLPrisma: "  " } },
    });

    expect(notARecord.ok).toBe(false);
    expect(notARecord.ok === false && notARecord.diagnostics).toEqual([
      { code: "invalid-schema", dataPath: "optionImages", message: expect.any(String) },
    ]);
    expect(attributeNotARecord.ok === false && attributeNotARecord.diagnostics[0]?.dataPath).toBe(
      "optionImages.sinkType",
    );
    expect(emptyReference.ok === false && emptyReference.diagnostics[0]?.dataPath).toBe(
      "optionImages.sinkType.Top_HPLPrisma",
    );
  });

  it("accepts a schema with no optionImageVariants and one that declares them", () => {
    expect(validateCustomizationSchema({ ...uiJson, optionImageVariants: undefined }).ok).toBe(true);
    expect(
      validateCustomizationSchema({
        ...uiJson,
        optionImageVariants: {
          CabinetType: [{ value: "Sink-Base", when: { Drawers: "2" }, image: "images/cabinet/x.png" }],
        },
      }).ok,
    ).toBe(true);
  });

  it("accepts an empty string in when, which matches an attribute that is not set", () => {
    expect(
      validateCustomizationSchema({
        ...uiJson,
        optionImageVariants: { Drawers: [{ value: "2", when: { LegColor: "" }, image: "images/cabinet/x.png" }] },
      }).ok,
    ).toBe(true);
  });

  it("rejects optionImageVariants that is not a record of row arrays", () => {
    const notARecord = validateCustomizationSchema({ ...uiJson, optionImageVariants: [] });
    const notAnArray = validateCustomizationSchema({ ...uiJson, optionImageVariants: { CabinetType: {} } });

    expect(notARecord.ok === false && notARecord.diagnostics).toEqual([
      { code: "invalid-schema", dataPath: "optionImageVariants", message: expect.any(String) },
    ]);
    expect(notAnArray.ok === false && notAnArray.diagnostics[0]?.dataPath).toBe("optionImageVariants.CabinetType");
  });

  it("names the offending row and field of a broken variant", () => {
    const rowOf = (row: unknown) =>
      validateCustomizationSchema({
        ...uiJson,
        optionImageVariants: {
          CabinetType: [{ value: "Sink-Base", when: { Drawers: "2" }, image: "images/cabinet/ok.png" }, row],
        },
      });

    const missingValue = rowOf({ when: { Drawers: "2" }, image: "images/cabinet/x.png" });
    const emptyImage = rowOf({ value: "Sink-Base", when: { Drawers: "2" }, image: "  " });
    const whenNotARecord = rowOf({ value: "Sink-Base", when: [], image: "images/cabinet/x.png" });
    const whenNotAString = rowOf({ value: "Sink-Base", when: { Drawers: 2 }, image: "images/cabinet/x.png" });

    expect(missingValue.ok === false && missingValue.diagnostics[0]?.dataPath).toBe(
      "optionImageVariants.CabinetType[1].value",
    );
    expect(emptyImage.ok === false && emptyImage.diagnostics[0]?.dataPath).toBe(
      "optionImageVariants.CabinetType[1].image",
    );
    expect(whenNotARecord.ok === false && whenNotARecord.diagnostics[0]?.dataPath).toBe(
      "optionImageVariants.CabinetType[1].when",
    );
    expect(whenNotAString.ok === false && whenNotAString.diagnostics[0]?.dataPath).toBe(
      "optionImageVariants.CabinetType[1].when.Drawers",
    );
  });

  it("rejects an empty when, which would match every card and hide optionImages", () => {
    const result = validateCustomizationSchema({
      ...uiJson,
      optionImageVariants: { CabinetType: [{ value: "Sink-Base", when: {}, image: "images/cabinet/x.png" }] },
    });

    expect(result.ok === false && result.diagnostics[0]?.dataPath).toBe("optionImageVariants.CabinetType[0].when");
  });

  it("rejects a non-boolean enabled on a step", () => {
    const broken = {
      ...uiJson,
      steps: { ...uiJson.steps, accessories: { ...uiJson.steps.accessories, enabled: "no" } },
    };

    const result = validateCustomizationSchema(broken);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "invalid-schema", dataPath: "steps.accessories.enabled" }),
    );
  });

  it("rejects a non-boolean enabled on a section", () => {
    const broken = {
      ...uiJson,
      sections: { ...uiJson.sections, "towel-bar": { ...uiJson.sections["towel-bar"], enabled: "no" } },
    };

    const result = validateCustomizationSchema(broken);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "invalid-schema", dataPath: "sections.towel-bar.enabled" }),
    );
  });

  it("rejects field hints that are not strings", () => {
    const broken = {
      ...uiJson,
      sections: {
        ...uiJson.sections,
        "faucet-holes-amount": {
          ...uiJson.sections["faucet-holes-amount"],
          fields: [{ attributeId: "FaucetHolesAmount", control: "swatches", hints: { "1": 1 } }],
        },
      },
    };

    const result = validateCustomizationSchema(broken);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "invalid-schema", dataPath: "sections.faucet-holes-amount.fields[0].hints" }),
    );
  });

  it("rejects a field switch without the text above it", () => {
    const broken = {
      ...uiJson,
      sections: {
        ...uiJson.sections,
        "faucet-holes-amount": {
          ...uiJson.sections["faucet-holes-amount"],
          fields: [{ attributeId: "FaucetHolesAmount", control: "swatches", toggle: { label: "" } }],
        },
      },
    };

    const result = validateCustomizationSchema(broken);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "invalid-schema", dataPath: "sections.faucet-holes-amount.fields[0].toggle" }),
    );
  });

  /** The faucet section with these fields' tabs: a tabbed section when `fieldTabs` is given. */
  const withFieldTabs = (fieldTabs: unknown, tabs: unknown[]) => ({
    ...uiJson,
    sections: {
      ...uiJson.sections,
      "faucet-holes-amount": {
        ...uiJson.sections["faucet-holes-amount"],
        ...(fieldTabs === undefined ? {} : { fieldTabs }),
        fields: tabs.map((tab, index) => ({
          attributeId: index === 0 ? "FaucetHolesAmount" : "Thickness",
          control: "swatches",
          ...(tab === undefined ? {} : { tab }),
        })),
      },
    },
  });

  it("accepts a section that shows one field at a time, each field naming its tab", () => {
    const panels = [{ label: "Base Panel", icon: "images/panel/base-panel.svg" }, { label: "Lateral Panel" }];

    expect(validateCustomizationSchema(withFieldTabs({ label: "Select Panel, Then Color" }, panels)).ok).toBe(true);
    // The line above the tabs is optional.
    expect(validateCustomizationSchema(withFieldTabs({}, panels)).ok).toBe(true);
  });

  it.each([
    ["fieldTabs that is not an object", "tabs", [{ label: "A" }, { label: "B" }], "fieldTabs"],
    ["an empty line above the tabs", { label: " " }, [{ label: "A" }, { label: "B" }], "fieldTabs"],
    ["a tab without its text", {}, [{ label: "" }, { label: "B" }], "fields[0].tab"],
    ["a tab picture that is not a reference", {}, [{ label: "A", icon: 5 }, { label: "B" }], "fields[0].tab"],
    // It could never be reached: the section shows the field of the chosen tab only.
    ["a field without a tab in a tabbed section", {}, [{ label: "A" }, undefined], "fields[1].tab"],
  ])("rejects %s", (_name, fieldTabs, tabs, where) => {
    const result = validateCustomizationSchema(withFieldTabs(fieldTabs, tabs));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "invalid-schema", dataPath: `sections.faucet-holes-amount.${where}` }),
    );
  });

  it("accepts a field that keeps its value allowed, and no other autoSelect", () => {
    const withAutoSelect = (autoSelect: unknown) => ({
      ...uiJson,
      sections: {
        ...uiJson.sections,
        "faucet-holes-amount": {
          ...uiJson.sections["faucet-holes-amount"],
          fields: [{ attributeId: "FaucetHolesAmount", control: "swatches", autoSelect }],
        },
      },
    });

    expect(validateCustomizationSchema(withAutoSelect("firstAllowed")).ok).toBe(true);

    const result = validateCustomizationSchema(withAutoSelect("lastAllowed"));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "invalid-schema",
        dataPath: "sections.faucet-holes-amount.fields[0].autoSelect",
      }),
    );
  });

  it("rejects a section label for the vessel style that is not a string", () => {
    const broken = {
      ...uiJson,
      sections: { ...uiJson.sections, "basin-style": { ...uiJson.sections["basin-style"], labelWhenVessel: 3 } },
    };

    const result = validateCustomizationSchema(broken);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "invalid-schema", dataPath: "sections.basin-style.labelWhenVessel" }),
    );
  });

  it("accepts a schema without playerMenu and one that hides menu items", () => {
    expect(validateCustomizationSchema({ ...uiJson, playerMenu: {} }).ok).toBe(true);
    expect(validateCustomizationSchema({ ...uiJson, playerMenu: { hidden: ["duplicate", "vessel-color"] } }).ok).toBe(
      true,
    );
  });

  it("names a hidden item the player menu does not have", () => {
    const result = validateCustomizationSchema({ ...uiJson, playerMenu: { hidden: ["duplicate", "Duplicate"] } });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.diagnostics).toEqual([
      expect.objectContaining({ code: "unknown-menu-item", dataPath: "playerMenu.hidden[1]" }),
    ]);
  });

  it("rejects a playerMenu that is not an object of a hidden list", () => {
    for (const [playerMenu, dataPath] of [
      [["duplicate"], "playerMenu"],
      [{ hidden: "duplicate" }, "playerMenu.hidden"],
    ] as const) {
      const result = validateCustomizationSchema({ ...uiJson, playerMenu });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.diagnostics).toContainEqual(expect.objectContaining({ code: "invalid-schema", dataPath }));
    }
  });

  it("accepts the sizes the Resize item offers and the selectors of the style sidebar, in any order", () => {
    expect(validateCustomizationSchema({ ...uiJson, playerMenu: { resize: ["Width", "Depth", "Height"] } }).ok).toBe(
      true,
    );
    expect(validateCustomizationSchema({ ...uiJson, styleSidebar: {} }).ok).toBe(true);
    expect(
      validateCustomizationSchema({ ...uiJson, styleSidebar: { fields: ["Height", "Width", "Depth", "Handle"] } }).ok,
    ).toBe(true);
  });

  it("accepts the cabinet values the style sidebar and the menu change for one cabinet alone", () => {
    expect(
      validateCustomizationSchema({
        ...uiJson,
        styleSidebar: { fields: ["Width", "Depth"], attributes: ["LateralPanelSide"] },
        playerMenu: { attributes: ["LateralPanelSide"] },
      }).ok,
    ).toBe(true);
  });

  it("accepts such a value with what the cabinet must hold to be offered it", () => {
    const ownCabinetsOnly = [{ attributeId: "LateralPanelSide", when: { Series: "URDPX" } }];

    expect(
      validateCustomizationSchema({
        ...uiJson,
        styleSidebar: { attributes: ownCabinetsOnly },
        playerMenu: { attributes: [...ownCabinetsOnly, "Other"] },
      }).ok,
    ).toBe(true);
  });

  it("rejects such a list that is not attribute ids, each once", () => {
    for (const [override, dataPath] of [
      [{ styleSidebar: { attributes: "LateralPanelSide" } }, "styleSidebar.attributes"],
      [{ styleSidebar: { attributes: ["LateralPanelSide", ""] } }, "styleSidebar.attributes"],
      [{ playerMenu: { attributes: ["LateralPanelSide", "LateralPanelSide"] } }, "playerMenu.attributes"],
      [{ playerMenu: { attributes: [1] } }, "playerMenu.attributes"],
      // A condition names values; one without any is no condition, and an id still stands once.
      [{ playerMenu: { attributes: [{ attributeId: "LateralPanelSide" }] } }, "playerMenu.attributes"],
      [{ playerMenu: { attributes: [{ attributeId: "LateralPanelSide", when: {} }] } }, "playerMenu.attributes"],
      [
        { playerMenu: { attributes: [{ attributeId: "LateralPanelSide", when: { Series: 1 } }] } },
        "playerMenu.attributes",
      ],
      [
        {
          styleSidebar: {
            attributes: ["LateralPanelSide", { attributeId: "LateralPanelSide", when: { Series: "URDPX" } }],
          },
        },
        "styleSidebar.attributes",
      ],
    ] as const) {
      const result = validateCustomizationSchema({ ...uiJson, ...override });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.diagnostics).toContainEqual(expect.objectContaining({ code: "invalid-schema", dataPath }));
    }
  });

  it("names a size Resize does not change and a selector the style sidebar does not have", () => {
    const result = validateCustomizationSchema({
      ...uiJson,
      playerMenu: { resize: ["Width", "Handle"] },
      styleSidebar: { fields: ["Width", "height"] },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.diagnostics).toEqual([
      expect.objectContaining({ code: "unknown-menu-item", dataPath: "playerMenu.resize[1]" }),
      expect.objectContaining({ code: "unknown-sidebar-field", dataPath: "styleSidebar.fields[1]" }),
    ]);
  });

  it("rejects a list that is not an array or names an entry twice", () => {
    for (const [override, dataPath] of [
      [{ styleSidebar: ["Height"] }, "styleSidebar"],
      [{ styleSidebar: { fields: "Height" } }, "styleSidebar.fields"],
      [{ styleSidebar: { fields: ["Height", "Height"] } }, "styleSidebar.fields[1]"],
      [{ playerMenu: { resize: "Height" } }, "playerMenu.resize"],
      [{ playerMenu: { resize: ["Width", "Width"] } }, "playerMenu.resize[1]"],
    ] as const) {
      const result = validateCustomizationSchema({ ...uiJson, ...override });

      expect(result.ok, dataPath).toBe(false);
      if (result.ok) return;
      expect(result.diagnostics).toContainEqual(expect.objectContaining({ code: "invalid-schema", dataPath }));
    }
  });

  it("accepts the height models of the cabinet style cards", () => {
    for (const cabinetStyle of [
      {},
      {
        heightStyles: [
          { id: "standard", heights: [38, 35] },
          { id: "slim", label: "Slim", heights: [28, 25] },
        ],
      },
    ]) {
      expect(validateCustomizationSchema({ ...uiJson, cabinetStyle }).ok).toBe(true);
    }
  });

  it("rejects a height model without an id, a label or heights of its own", () => {
    const standard = { id: "standard", heights: [38, 35] };

    for (const [cabinetStyle, dataPath] of [
      [[], "cabinetStyle"],
      [{ heightStyles: {} }, "cabinetStyle.heightStyles"],
      [{ heightStyles: [{ id: "", heights: [38] }] }, "cabinetStyle.heightStyles[0].id"],
      [{ heightStyles: [standard, { id: "standard", heights: [28] }] }, "cabinetStyle.heightStyles[1].id"],
      [{ heightStyles: [standard, { id: "slim", label: "", heights: [28] }] }, "cabinetStyle.heightStyles[1].label"],
      [{ heightStyles: [standard, { id: "slim", label: 3, heights: [28] }] }, "cabinetStyle.heightStyles[1].label"],
      [{ heightStyles: [{ id: "slim", heights: [] }] }, "cabinetStyle.heightStyles[0].heights"],
      [{ heightStyles: [{ id: "slim", heights: ["28"] }] }, "cabinetStyle.heightStyles[0].heights"],
      [{ heightStyles: [{ id: "slim", heights: [0] }] }, "cabinetStyle.heightStyles[0].heights"],
      // A height stands for one card: the composition at 35 cm cannot be of two models.
      [{ heightStyles: [standard, { id: "slim", heights: [35, 25] }] }, "cabinetStyle.heightStyles[1].heights[0]"],
    ] as const) {
      const result = validateCustomizationSchema({ ...uiJson, cabinetStyle });

      expect(result.ok, dataPath).toBe(false);
      if (result.ok) return;
      expect(result.diagnostics).toContainEqual(expect.objectContaining({ code: "invalid-schema", dataPath }));
    }
  });

  it("rejects a non-object input", () => {
    const result = validateCustomizationSchema(null);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ code: "invalid-schema" }));
  });
});
