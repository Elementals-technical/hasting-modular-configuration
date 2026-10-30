import type { CustomizationSchema } from "../../model/customizationSchema";

/** Uses collection UI vocabulary in summary without collection-specific page branches. */
export const resolveAttributeLabel = (
  schema: CustomizationSchema | null | undefined,
  attributeId: string,
  fallback: string,
): string =>
  Object.values(schema?.sections ?? {}).find(
    ({ fields }) => fields.length === 1 && fields[0].attributeId === attributeId,
  )?.label ?? fallback;
