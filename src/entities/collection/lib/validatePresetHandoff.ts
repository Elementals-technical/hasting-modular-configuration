import { z } from "zod";

import type { CollectionPreset } from "../model/schemas";

const handoffSchema = z.array(
  z
    .object({
      sourceModel: z.string().min(1),
      img: z.string().trim().min(1),
      basinPositions: z.array(z.object({ cabinetIndex: z.number().int().nonnegative() }).passthrough()),
      presetProducts: z
        .array(
          z
            .object({
              name: z.string().min(1),
              Width: z.number().positive(),
              Height: z.number().positive(),
              Depth: z.number().positive(),
              Drawers: z.string().min(1),
            })
            .passthrough(),
        )
        .min(1),
    })
    .strict(),
);

export type HandoffModule = {
  name: string;
  widths: readonly number[];
  heights: readonly number[];
  depths: readonly number[];
  drawers: readonly string[];
  hasSink: boolean;
};

/** Checks source coverage and confirmed module facts; nominal model names never become BOM recipes. */
export const validatePresetHandoff = (
  presets: readonly CollectionPreset[],
  input: unknown,
  modules: readonly HandoffModule[],
): string[] => {
  const result = handoffSchema.safeParse(input);
  if (!result.success) return result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
  const errors: string[] = [],
    seen = new Set<string>();
  const masters = new Map(presets.map((preset) => [preset.sourceModel, preset]));
  for (const entry of result.data) {
    const master = masters.get(entry.sourceModel);
    if (!master) errors.push(`Unknown source model: ${entry.sourceModel}`);
    if (seen.has(entry.sourceModel)) errors.push(`Duplicate source model: ${entry.sourceModel}`);
    seen.add(entry.sourceModel);
    for (const product of entry.presetProducts) {
      const module = modules.find(({ name }) => name === product.name);
      if (
        !module ||
        !module.widths.includes(product.Width) ||
        !module.heights.includes(product.Height) ||
        !module.depths.includes(product.Depth) ||
        !module.drawers.includes(product.Drawers)
      ) {
        errors.push(`Unsupported module in ${entry.sourceModel}: ${product.name}`);
      }
    }
    const drawers = entry.presetProducts.map((product) => product.Drawers);
    if (
      (master?.style.includes("2_drawer") && !drawers.includes("2")) ||
      (master?.style.includes("1_drawer") && !drawers.some((value) => ["1", "1+inner"].includes(value)))
    )
      errors.push(`Drawer filter mismatch: ${entry.sourceModel}`);
    for (const { cabinetIndex } of entry.basinPositions) {
      const product = entry.presetProducts[cabinetIndex];
      if (!product || !modules.find(({ name }) => name === product.name)?.hasSink)
        errors.push(`Invalid basin position: ${entry.sourceModel}`);
    }
    const sinks = entry.basinPositions.length;
    if (
      (master?.style.includes("single_basin") && sinks !== 1) ||
      (master?.style.includes("double_basin") && sinks !== 2)
    )
      errors.push(`Basin filter mismatch: ${entry.sourceModel}`);
  }
  for (const preset of presets)
    if (!preset.sourceModel || !seen.has(preset.sourceModel))
      errors.push(`Missing source model: ${preset.sourceModel ?? preset.id}`);
  return errors;
};
