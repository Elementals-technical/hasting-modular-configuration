import {
  CUSTOMIZATION_FLOW_IDS,
  CUSTOMIZATION_SCREEN_IDS,
  PLAYER_MENU_ITEM_IDS,
  PLAYER_MENU_RESIZE_IDS,
  STYLE_SIDEBAR_FIELD_IDS,
  type CustomizationSchema,
  type CustomizationSchemaDiagnostic,
  type CustomizationSchemaDiagnosticCode,
  type ValidateCustomizationSchemaResult,
} from "../../model/customizationSchema";

type UnknownRecord = Record<string, unknown>;

const VALID_KINDS = new Set(["preset-picker", "cabinet-builder", "fields", "summary"]);
const VALID_CONTROLS = new Set(["swatches", "options-grid", "checkbox", "colors"]);
const VALID_SCREENS = new Set<string>(CUSTOMIZATION_SCREEN_IDS);
const VALID_MENU_ITEMS = new Set<string>(PLAYER_MENU_ITEM_IDS);
const VALID_MENU_RESIZE_IDS = new Set<string>(PLAYER_MENU_RESIZE_IDS);
const VALID_SIDEBAR_FIELDS = new Set<string>(STYLE_SIDEBAR_FIELD_IDS);

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;

const validateOptionalBoolean = (
  value: unknown,
  dataPath: string,
  message: string,
  diagnostics: CustomizationSchemaDiagnostic[],
) => {
  if (value !== undefined && typeof value !== "boolean") {
    diagnostics.push({ code: "invalid-schema", dataPath, message });
  }
};

const validateFlows = (flows: UnknownRecord, steps: UnknownRecord, diagnostics: CustomizationSchemaDiagnostic[]) => {
  for (const flowId of CUSTOMIZATION_FLOW_IDS) {
    const flow = flows[flowId];

    if (!isRecord(flow) || !isNonEmptyString(flow.entryStepId) || !Array.isArray(flow.steps)) {
      diagnostics.push({
        code: "invalid-schema",
        dataPath: `flows.${flowId}`,
        message: "flow must have entryStepId and steps",
      });
      continue;
    }

    if (!isRecord(steps[flow.entryStepId])) {
      diagnostics.push({
        code: "missing-entry-step",
        dataPath: `flows.${flowId}.entryStepId`,
        message: `entryStepId "${flow.entryStepId}" is not defined in steps`,
      });
    }

    const seenPaths = new Set<string>();

    flow.steps.forEach((ref: unknown, index: number) => {
      if (!isRecord(ref) || !isNonEmptyString(ref.stepId) || !isNonEmptyString(ref.path) || !ref.path.startsWith("/")) {
        diagnostics.push({
          code: "invalid-schema",
          dataPath: `flows.${flowId}.steps[${index}]`,
          message: "step ref must have a non-empty stepId and an absolute path",
        });
        return;
      }

      if (!isRecord(steps[ref.stepId])) {
        diagnostics.push({
          code: "unknown-step-id",
          dataPath: `flows.${flowId}.steps[${index}].stepId`,
          message: `stepId "${ref.stepId}" is not defined in steps`,
        });
      }

      if (ref.screen !== undefined && (typeof ref.screen !== "string" || !VALID_SCREENS.has(ref.screen))) {
        diagnostics.push({
          code: "unsupported-screen",
          dataPath: `flows.${flowId}.steps[${index}].screen`,
          message: `"${String(ref.screen)}" is not a supported screen`,
        });
      }

      if (seenPaths.has(ref.path)) {
        diagnostics.push({
          code: "duplicate-route",
          dataPath: `flows.${flowId}.steps[${index}].path`,
          message: `path "${ref.path}" is already used earlier in this flow`,
        });
      }

      seenPaths.add(ref.path);
    });
  }
};

const validateSteps = (steps: UnknownRecord, sections: UnknownRecord, diagnostics: CustomizationSchemaDiagnostic[]) => {
  for (const [stepId, step] of Object.entries(steps)) {
    if (!isRecord(step) || !isNonEmptyString(step.label)) {
      diagnostics.push({ code: "invalid-schema", dataPath: `steps.${stepId}`, message: "step must have a label" });
      continue;
    }

    if (typeof step.kind !== "string" || !VALID_KINDS.has(step.kind)) {
      diagnostics.push({
        code: "unsupported-kind",
        dataPath: `steps.${stepId}.kind`,
        message: `"${String(step.kind)}" is not a supported screen kind`,
      });
    }

    if (step.headerPrefix !== undefined && step.headerPrefix !== null && typeof step.headerPrefix !== "string") {
      diagnostics.push({
        code: "invalid-schema",
        dataPath: `steps.${stepId}.headerPrefix`,
        message: "headerPrefix must be a string or null",
      });
    }

    if (step.sectionIds !== undefined && !Array.isArray(step.sectionIds)) {
      diagnostics.push({
        code: "invalid-schema",
        dataPath: `steps.${stepId}.sectionIds`,
        message: "sectionIds must be an array",
      });
    }

    validateOptionalBoolean(step.enabled, `steps.${stepId}.enabled`, "enabled must be a boolean", diagnostics);

    if (step.kind !== "fields" && step.kind !== "cabinet-builder") continue;

    const sectionIds = Array.isArray(step.sectionIds) ? step.sectionIds : [];

    sectionIds.forEach((sectionId: unknown, index: number) => {
      if (typeof sectionId !== "string" || !isRecord(sections[sectionId])) {
        diagnostics.push({
          code: "unknown-section-id",
          dataPath: `steps.${stepId}.sectionIds[${index}]`,
          message: `sectionId "${String(sectionId)}" is not defined in sections`,
        });
      }
    });
  }
};

const validateSections = (sections: UnknownRecord, diagnostics: CustomizationSchemaDiagnostic[]) => {
  for (const [sectionId, section] of Object.entries(sections)) {
    if (!isRecord(section) || !isNonEmptyString(section.label) || !Array.isArray(section.fields)) {
      diagnostics.push({
        code: "invalid-schema",
        dataPath: `sections.${sectionId}`,
        message: "section must have a label and fields array",
      });
      continue;
    }

    validateOptionalBoolean(
      section.defaultOpen,
      `sections.${sectionId}.defaultOpen`,
      "defaultOpen must be a boolean",
      diagnostics,
    );
    validateOptionalBoolean(section.enabled, `sections.${sectionId}.enabled`, "enabled must be a boolean", diagnostics);

    if (section.labelWhenVessel !== undefined && !isNonEmptyString(section.labelWhenVessel)) {
      diagnostics.push({
        code: "invalid-schema",
        dataPath: `sections.${sectionId}.labelWhenVessel`,
        message: "labelWhenVessel must be a non-empty string",
      });
    }

    const fieldTabs = section.fieldTabs;
    if (
      fieldTabs !== undefined &&
      !(isRecord(fieldTabs) && (fieldTabs.label === undefined || isNonEmptyString(fieldTabs.label)))
    ) {
      diagnostics.push({
        code: "invalid-schema",
        dataPath: `sections.${sectionId}.fieldTabs`,
        message: "fieldTabs must be { label? } with a non-empty label",
      });
    }

    section.fields.forEach((field: unknown, index: number) => {
      const path = `sections.${sectionId}.fields[${index}]`;
      const control = isRecord(field) ? field.control : undefined;
      const isValid =
        isRecord(field) &&
        isNonEmptyString(field.attributeId) &&
        typeof control === "string" &&
        VALID_CONTROLS.has(control);

      if (!isValid) {
        diagnostics.push({
          code: "unsupported-control",
          dataPath: `${path}.control`,
          message: `"${String(control)}" is not a supported field control`,
        });
        return;
      }

      for (const reference of ["optionsRef", "availabilityRef"] as const) {
        if (field[reference] !== undefined && !isNonEmptyString(field[reference])) {
          diagnostics.push({
            code: "invalid-schema",
            dataPath: `${path}.${reference}`,
            message: `${reference} must be a non-empty string`,
          });
        }
      }

      if (
        field.hints !== undefined &&
        (!isRecord(field.hints) || !Object.values(field.hints).every(isNonEmptyString))
      ) {
        diagnostics.push({
          code: "invalid-schema",
          dataPath: `${path}.hints`,
          message: "hints must map option values to non-empty strings",
        });
      }

      if (field.toggle !== undefined && !(isRecord(field.toggle) && isNonEmptyString(field.toggle.label))) {
        diagnostics.push({
          code: "invalid-schema",
          dataPath: `${path}.toggle`,
          message: "toggle must be { label } with a non-empty label",
        });
      }

      if (field.autoSelect !== undefined && field.autoSelect !== "firstAllowed") {
        diagnostics.push({
          code: "invalid-schema",
          dataPath: `${path}.autoSelect`,
          message: 'autoSelect must be "firstAllowed"',
        });
      }

      const tab = field.tab;
      if (
        tab !== undefined &&
        !(isRecord(tab) && isNonEmptyString(tab.label) && (tab.icon === undefined || isNonEmptyString(tab.icon)))
      ) {
        diagnostics.push({
          code: "invalid-schema",
          dataPath: `${path}.tab`,
          message: "tab must be { label, icon? } with a non-empty label and icon",
        });
      } else if (tab === undefined && fieldTabs !== undefined) {
        // A field without a tab could never be reached in a section that shows one field at a time.
        diagnostics.push({
          code: "invalid-schema",
          dataPath: `${path}.tab`,
          message: "a field of a section with fieldTabs must name its tab",
        });
      }
    });
  }
};

/** Pictures of options, by attribute and option value; every reference is a non-empty string. */
const validateOptionImages = (optionImages: unknown, diagnostics: CustomizationSchemaDiagnostic[]) => {
  if (optionImages === undefined) return;

  if (!isRecord(optionImages)) {
    diagnostics.push({
      code: "invalid-schema",
      dataPath: "optionImages",
      message: "optionImages must be an object keyed by attributeId",
    });
    return;
  }

  for (const [attributeId, byValue] of Object.entries(optionImages)) {
    if (!isRecord(byValue)) {
      diagnostics.push({
        code: "invalid-schema",
        dataPath: `optionImages.${attributeId}`,
        message: "attribute images must be an object keyed by option value",
      });
      continue;
    }

    for (const [value, reference] of Object.entries(byValue)) {
      if (!isNonEmptyString(reference)) {
        diagnostics.push({
          code: "invalid-schema",
          dataPath: `optionImages.${attributeId}.${value}`,
          message: "image reference must be a non-empty string",
        });
      }
    }
  }
};

/**
 * Variant pictures: ordered rows naming an option value, the attribute values it applies under
 * and the reference. An empty `when` would match every card and hide `optionImages`, so the
 * unconditional picture has to stay there.
 */
const validateOptionImageVariants = (optionImageVariants: unknown, diagnostics: CustomizationSchemaDiagnostic[]) => {
  if (optionImageVariants === undefined) return;

  if (!isRecord(optionImageVariants)) {
    diagnostics.push({
      code: "invalid-schema",
      dataPath: "optionImageVariants",
      message: "optionImageVariants must be an object keyed by attributeId",
    });
    return;
  }

  for (const [attributeId, rows] of Object.entries(optionImageVariants)) {
    if (!Array.isArray(rows)) {
      diagnostics.push({
        code: "invalid-schema",
        dataPath: `optionImageVariants.${attributeId}`,
        message: "attribute variants must be an array of rows",
      });
      continue;
    }

    rows.forEach((row: unknown, index: number) => {
      const dataPath = `optionImageVariants.${attributeId}[${index}]`;

      if (!isRecord(row)) {
        diagnostics.push({ code: "invalid-schema", dataPath, message: "variant must be an object" });
        return;
      }

      if (!isNonEmptyString(row.value)) {
        diagnostics.push({
          code: "invalid-schema",
          dataPath: `${dataPath}.value`,
          message: "variant value must be a non-empty option value",
        });
      }

      if (!isNonEmptyString(row.image)) {
        diagnostics.push({
          code: "invalid-schema",
          dataPath: `${dataPath}.image`,
          message: "image reference must be a non-empty string",
        });
      }

      if (!isRecord(row.when)) {
        diagnostics.push({
          code: "invalid-schema",
          dataPath: `${dataPath}.when`,
          message: "when must be an object of attributeId to expected value",
        });
        return;
      }

      if (Object.keys(row.when).length === 0) {
        diagnostics.push({
          code: "invalid-schema",
          dataPath: `${dataPath}.when`,
          message: "when must name at least one attribute; an unconditional picture belongs in optionImages",
        });
      }

      for (const [conditionId, expected] of Object.entries(row.when)) {
        // "" is a meaningful expectation: it matches an attribute that is not set.
        if (typeof expected !== "string") {
          diagnostics.push({
            code: "invalid-schema",
            dataPath: `${dataPath}.when.${conditionId}`,
            message: "when value must be a string",
          });
        }
      }
    });
  }
};

const validateCountertopSettings = (countertop: unknown, diagnostics: CustomizationSchemaDiagnostic[]) => {
  if (countertop === undefined) return;
  if (!isRecord(countertop)) {
    diagnostics.push({ code: "invalid-schema", dataPath: "countertop", message: "countertop must be an object" });
    return;
  }
  const limits = countertop.lengthLimitsIn;
  const valid =
    limits === undefined ||
    (isRecord(limits) &&
    typeof limits.min === "number" &&
    typeof limits.max === "number" &&
    Number.isFinite(limits.min) &&
    Number.isFinite(limits.max) &&
    limits.min > 0 &&
    limits.max >= limits.min);
  if (!valid) {
    diagnostics.push({
      code: "invalid-schema",
      dataPath: "countertop.lengthLimitsIn",
      message: "countertop.lengthLimitsIn must be { min, max } in inches with 0 < min <= max",
    });
  }
  const presets = countertop.lengthPresetsIn;
  if (
    presets !== undefined &&
    !(
      Array.isArray(presets) &&
      presets.every((preset) => typeof preset === "number" && Number.isFinite(preset) && preset > 0)
    )
  ) {
    diagnostics.push({
      code: "invalid-schema",
      dataPath: "countertop.lengthPresetsIn",
      message: "countertop.lengthPresetsIn must be an array of positive lengths in inches",
    });
  }
};

const VALID_ORGANIZER_MOBILE_LAYOUTS = new Set(["M1", "M2"]);

/** The optional `drawerOrganizers` block: wording of the panel and of the preset cards, and the mobile layout. */
const validateDrawerOrganizers = (block: unknown, diagnostics: CustomizationSchemaDiagnostic[]) => {
  if (block === undefined) return;
  if (!isRecord(block)) {
    diagnostics.push({
      code: "invalid-schema",
      dataPath: "drawerOrganizers",
      message: "drawerOrganizers must be an object",
    });
    return;
  }

  (["panelTitle", "customizeLabel"] as const).forEach((field) => {
    if (block[field] !== undefined && typeof block[field] !== "string") {
      diagnostics.push({
        code: "invalid-schema",
        dataPath: `drawerOrganizers.${field}`,
        message: `drawerOrganizers.${field} must be a string`,
      });
    }
  });

  if (block.mobileLayout !== undefined && !VALID_ORGANIZER_MOBILE_LAYOUTS.has(block.mobileLayout as string)) {
    diagnostics.push({
      code: "invalid-schema",
      dataPath: "drawerOrganizers.mobileLayout",
      message: "drawerOrganizers.mobileLayout must be M1 or M2",
    });
  }

  const presets = block.presets;
  if (presets === undefined) return;
  if (!isRecord(presets)) {
    diagnostics.push({
      code: "invalid-schema",
      dataPath: "drawerOrganizers.presets",
      message: "drawerOrganizers.presets must be an object of preset id to { label }",
    });
    return;
  }
  Object.entries(presets).forEach(([presetId, preset]) => {
    const dataPath = `drawerOrganizers.presets.${presetId}`;
    if (!isRecord(preset)) {
      diagnostics.push({ code: "invalid-schema", dataPath, message: "a preset must be an object with an optional label" });
    } else if (preset.label !== undefined && typeof preset.label !== "string") {
      diagnostics.push({ code: "invalid-schema", dataPath: `${dataPath}.label`, message: "a preset label must be a string" });
    }
  });
};

/**
 * A list the interface shows in the declared order: every entry is one of `validIds`, named once.
 */
const validateOrderedIds = (
  value: unknown,
  dataPath: string,
  validIds: ReadonlySet<string>,
  unknown: { code: CustomizationSchemaDiagnosticCode; of: string },
  diagnostics: CustomizationSchemaDiagnostic[],
) => {
  if (value === undefined) return;
  if (!Array.isArray(value)) {
    diagnostics.push({ code: "invalid-schema", dataPath, message: `${dataPath} must be an array` });
    return;
  }
  const seen = new Set<string>();
  value.forEach((id: unknown, index: number) => {
    if (typeof id !== "string" || !validIds.has(id)) {
      diagnostics.push({
        code: unknown.code,
        dataPath: `${dataPath}[${index}]`,
        message: `"${String(id)}" is not ${unknown.of}`,
      });
      return;
    }
    if (seen.has(id)) {
      diagnostics.push({
        code: "invalid-schema",
        dataPath: `${dataPath}[${index}]`,
        message: `"${id}" is listed twice`,
      });
    }
    seen.add(id);
  });
};

/** Attribute ids, each once. Whether the collection has them is its runtime contract's to say. */
/** An attribute id, or the id with the values the cabinet must hold (`PerCabinetAttribute`). */
const perCabinetAttributeIdOf = (entry: unknown): string | null => {
  if (isNonEmptyString(entry)) return entry;
  if (!isRecord(entry) || !isNonEmptyString(entry.attributeId) || !isRecord(entry.when)) return null;
  if (entry.label !== undefined && !isNonEmptyString(entry.label)) return null;

  const conditions = Object.entries(entry.when);
  return conditions.length > 0 && conditions.every(([, value]) => typeof value === "string") ? entry.attributeId : null;
};

const validateAttributeIds = (entries: unknown, dataPath: string, diagnostics: CustomizationSchemaDiagnostic[]) => {
  if (entries === undefined) return;

  const ids = Array.isArray(entries) ? entries.map(perCabinetAttributeIdOf) : [null];
  if (ids.includes(null) || new Set(ids).size !== ids.length) {
    diagnostics.push({
      code: "invalid-schema",
      dataPath,
      message: `${dataPath} must be an array of attribute ids, each listed once, alone or as { attributeId, label?, when }`,
    });
  }
};

const validateStyleSidebar = (styleSidebar: unknown, diagnostics: CustomizationSchemaDiagnostic[]) => {
  if (styleSidebar === undefined) return;
  if (!isRecord(styleSidebar)) {
    diagnostics.push({ code: "invalid-schema", dataPath: "styleSidebar", message: "styleSidebar must be an object" });
    return;
  }
  validateAttributeIds(styleSidebar.attributes, "styleSidebar.attributes", diagnostics);
  validateOrderedIds(
    styleSidebar.fields,
    "styleSidebar.fields",
    VALID_SIDEBAR_FIELDS,
    { code: "unknown-sidebar-field", of: "a selector of the style sidebar" },
    diagnostics,
  );
};

/** Each model is a card of its own, and a height names the one card the composition stands for. */
const validateCabinetStyle = (cabinetStyle: unknown, diagnostics: CustomizationSchemaDiagnostic[]) => {
  if (cabinetStyle === undefined) return;
  if (!isRecord(cabinetStyle)) {
    diagnostics.push({ code: "invalid-schema", dataPath: "cabinetStyle", message: "cabinetStyle must be an object" });
    return;
  }
  const styles = cabinetStyle.heightStyles;
  if (styles === undefined) return;
  if (!Array.isArray(styles)) {
    diagnostics.push({
      code: "invalid-schema",
      dataPath: "cabinetStyle.heightStyles",
      message: "cabinetStyle.heightStyles must be an array of height styles",
    });
    return;
  }
  const ids = new Set<string>();
  const heights = new Set<number>();
  styles.forEach((style: unknown, index: number) => {
    const dataPath = `cabinetStyle.heightStyles[${index}]`;
    if (!isRecord(style) || !isNonEmptyString(style.id)) {
      diagnostics.push({
        code: "invalid-schema",
        dataPath: `${dataPath}.id`,
        message: "a height style must have a non-empty id",
      });
      return;
    }
    if (ids.has(style.id)) {
      diagnostics.push({
        code: "invalid-schema",
        dataPath: `${dataPath}.id`,
        message: `"${style.id}" is listed twice`,
      });
    }
    ids.add(style.id);
    if (style.label !== undefined && !isNonEmptyString(style.label)) {
      diagnostics.push({
        code: "invalid-schema",
        dataPath: `${dataPath}.label`,
        message: "label must be a non-empty string",
      });
    }
    const styleHeights = style.heights;
    if (
      !Array.isArray(styleHeights) ||
      styleHeights.length === 0 ||
      !styleHeights.every((height) => typeof height === "number" && Number.isFinite(height) && height > 0)
    ) {
      diagnostics.push({
        code: "invalid-schema",
        dataPath: `${dataPath}.heights`,
        message: "heights must be a non-empty array of positive heights in cm",
      });
      return;
    }
    styleHeights.forEach((height: number, heightIndex: number) => {
      if (heights.has(height)) {
        diagnostics.push({
          code: "invalid-schema",
          dataPath: `${dataPath}.heights[${heightIndex}]`,
          message: `${height} cm is already named by a height style`,
        });
      }
      heights.add(height);
    });
  });
};

const validatePlayerMenu = (playerMenu: unknown, diagnostics: CustomizationSchemaDiagnostic[]) => {
  if (playerMenu === undefined) return;
  if (!isRecord(playerMenu)) {
    diagnostics.push({ code: "invalid-schema", dataPath: "playerMenu", message: "playerMenu must be an object" });
    return;
  }
  validateOrderedIds(
    playerMenu.resize,
    "playerMenu.resize",
    VALID_MENU_RESIZE_IDS,
    { code: "unknown-menu-item", of: "a size the Resize item of the player menu changes" },
    diagnostics,
  );
  validateAttributeIds(playerMenu.attributes, "playerMenu.attributes", diagnostics);
  const hidden = playerMenu.hidden;
  if (hidden === undefined) return;
  if (!Array.isArray(hidden)) {
    diagnostics.push({
      code: "invalid-schema",
      dataPath: "playerMenu.hidden",
      message: "playerMenu.hidden must be an array of menu item ids",
    });
    return;
  }
  hidden.forEach((itemId, index) => {
    if (typeof itemId !== "string" || !VALID_MENU_ITEMS.has(itemId)) {
      diagnostics.push({
        code: "unknown-menu-item",
        dataPath: `playerMenu.hidden[${index}]`,
        message: `"${String(itemId)}" is not an item of the player menu`,
      });
    }
  });
};

export const validateCustomizationSchema = (input: unknown): ValidateCustomizationSchemaResult => {
  if (!isRecord(input) || !isRecord(input.flows) || !isRecord(input.steps) || !isRecord(input.sections)) {
    return {
      ok: false,
      diagnostics: [
        { code: "invalid-schema", dataPath: "$", message: "schema must have flows, steps and sections objects" },
      ],
    };
  }

  const diagnostics: CustomizationSchemaDiagnostic[] = [];

  if (!isNonEmptyString(input.collectionId)) {
    diagnostics.push({
      code: "invalid-schema",
      dataPath: "collectionId",
      message: "collectionId must be a non-empty string",
    });
  }

  validateFlows(input.flows, input.steps, diagnostics);
  validateSteps(input.steps, input.sections, diagnostics);
  validateSections(input.sections, diagnostics);
  validateOptionImages(input.optionImages, diagnostics);
  validateOptionImageVariants(input.optionImageVariants, diagnostics);
  validateCountertopSettings(input.countertop, diagnostics);
  validatePlayerMenu(input.playerMenu, diagnostics);
  validateStyleSidebar(input.styleSidebar, diagnostics);
  validateDrawerOrganizers(input.drawerOrganizers, diagnostics);
  validateCabinetStyle(input.cabinetStyle, diagnostics);

  if (diagnostics.length > 0) return { ok: false, diagnostics };

  return { ok: true, schema: input as unknown as CustomizationSchema };
};
