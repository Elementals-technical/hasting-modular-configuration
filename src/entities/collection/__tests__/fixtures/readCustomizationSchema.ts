import { validateCustomizationSchema, type CustomizationSchema } from "@/entities/collection";

export const readCustomizationSchema = (document: unknown): CustomizationSchema => {
  const result = validateCustomizationSchema(document);
  if (!result.ok) throw new Error(`Expected a valid ui schema, got diagnostics: ${JSON.stringify(result.diagnostics)}`);

  return result.schema;
};
