import type { CustomizationFlowId, CustomizationSchema, CustomizationScreenId } from "@/entities/collection";

/**
 * Where a flow of the collection lets the user edit something: the step, its path and, when the
 * value lives in a section, that section. Read from ui.json, so a collection that names its steps
 * and sections differently (USH `countertop-custom`, Class `countertop`) needs no code of its own.
 */
export type CustomizationTarget = {
  stepId: string;
  path: string;
  sectionId?: string;
};

const enabledStepRefs = (schema: CustomizationSchema, flowId: CustomizationFlowId) =>
  schema.flows[flowId].steps.filter((ref) => {
    const definition = schema.steps[ref.stepId];
    return definition !== undefined && definition.enabled !== false;
  });

/** The first enabled step of the flow whose enabled section shows a field of the attribute. */
export const resolveAttributeTarget = (
  schema: CustomizationSchema | null | undefined,
  flowId: CustomizationFlowId,
  attributeId: string,
): CustomizationTarget | null => {
  if (!schema) return null;

  for (const ref of enabledStepRefs(schema, flowId)) {
    for (const sectionId of schema.steps[ref.stepId].sectionIds ?? []) {
      const section = schema.sections[sectionId];
      if (section && section.enabled !== false && section.fields.some((field) => field.attributeId === attributeId)) {
        return { stepId: ref.stepId, path: ref.path, sectionId };
      }
    }
  }

  return null;
};

/** The first enabled step of the flow that a screen of its own renders, e.g. the accessories page. */
export const resolveScreenTarget = (
  schema: CustomizationSchema | null | undefined,
  flowId: CustomizationFlowId,
  screen: CustomizationScreenId,
): CustomizationTarget | null => {
  if (!schema) return null;

  const ref = enabledStepRefs(schema, flowId).find((step) => step.screen === screen);
  return ref ? { stepId: ref.stepId, path: ref.path } : null;
};

/**
 * The Upper / Lower tab a countertop colour step opens on, named in the URL so the player menu can
 * lead to the Lower one (`?level=lower`); the step opens on the Upper when nothing names a level.
 */
export const COUNTERTOP_LEVEL_PARAM = "level";
export type CountertopLevel = "upper" | "lower";
export const isCountertopLevel = (value: string | null | undefined): value is CountertopLevel =>
  value === "upper" || value === "lower";

/**
 * The URL of a target; a section is opened through `?accordion=`, as the step pages read it, and
 * anything the caller adds (the countertop level) rides along as a query of its own.
 */
export const toTargetUrl = (
  { path, sectionId }: CustomizationTarget,
  params?: Readonly<Record<string, string>>,
): string => {
  const query = new URLSearchParams(sectionId ? { accordion: sectionId } : {});
  for (const [key, value] of Object.entries(params ?? {})) query.set(key, value);
  const search = query.toString();
  return search ? `${path}?${search}` : path;
};
