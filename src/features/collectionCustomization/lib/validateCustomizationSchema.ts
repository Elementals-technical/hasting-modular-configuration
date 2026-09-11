import type { CustomizationSchema } from "@/entities/collection";

import type { CustomizationSchemaDiagnostic, ValidateCustomizationSchemaResult } from "../model/types";

type UnknownRecord = Record<string, unknown>;

const VALID_FLOW_IDS = ["prebuilt", "custom"] as const;
const VALID_KINDS = new Set(["preset-picker", "cabinet-builder", "fields", "summary"]);
const VALID_CONTROLS = new Set(["swatches", "options-grid", "checkbox"]);

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const validateFlows = (flows: UnknownRecord, steps: UnknownRecord, diagnostics: CustomizationSchemaDiagnostic[]) => {
  for (const flowId of VALID_FLOW_IDS) {
    const flow = flows[flowId];

    if (!isRecord(flow) || typeof flow.entryStepId !== "string" || !Array.isArray(flow.steps)) {
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
      if (!isRecord(ref) || typeof ref.stepId !== "string" || typeof ref.path !== "string") {
        diagnostics.push({
          code: "invalid-schema",
          dataPath: `flows.${flowId}.steps[${index}]`,
          message: "step ref must have stepId and path",
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
    if (!isRecord(step) || typeof step.label !== "string") {
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

    if (step.kind !== "fields") continue;

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
    if (!isRecord(section) || !Array.isArray(section.fields)) {
      diagnostics.push({
        code: "invalid-schema",
        dataPath: `sections.${sectionId}`,
        message: "section must have a fields array",
      });
      continue;
    }

    section.fields.forEach((field: unknown, index: number) => {
      const control = isRecord(field) ? field.control : undefined;
      const isValid =
        isRecord(field) &&
        typeof field.attributeId === "string" &&
        typeof control === "string" &&
        VALID_CONTROLS.has(control);

      if (!isValid) {
        diagnostics.push({
          code: "unsupported-control",
          dataPath: `sections.${sectionId}.fields[${index}].control`,
          message: `"${String(control)}" is not a supported field control`,
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

  validateFlows(input.flows, input.steps, diagnostics);
  validateSteps(input.steps, input.sections, diagnostics);
  validateSections(input.sections, diagnostics);

  if (diagnostics.length > 0) return { ok: false, diagnostics };

  return { ok: true, schema: input as unknown as CustomizationSchema };
};
