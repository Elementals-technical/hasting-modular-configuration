import {
  CUSTOMIZATION_FLOW_IDS,
  CUSTOMIZATION_SCREEN_IDS,
  type CustomizationSchema,
  type CustomizationSchemaDiagnostic,
  type ValidateCustomizationSchemaResult,
} from "../../model/customizationSchema";

type UnknownRecord = Record<string, unknown>;

const VALID_KINDS = new Set(["preset-picker", "cabinet-builder", "fields", "summary"]);
const VALID_CONTROLS = new Set(["swatches", "options-grid", "checkbox", "colors"]);
const VALID_SCREENS = new Set<string>(CUSTOMIZATION_SCREEN_IDS);

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
    });
  }
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

  if (diagnostics.length > 0) return { ok: false, diagnostics };

  return { ok: true, schema: input as unknown as CustomizationSchema };
};
