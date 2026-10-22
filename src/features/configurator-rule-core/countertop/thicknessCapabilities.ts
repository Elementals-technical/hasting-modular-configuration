import { selectOptions, type ProductProfile, type ProfileOption } from "@/entities/collection";

import { parseThicknessValue } from "./parse";

/** Matrix values and profile options name a thickness exactly; a scene mesh may not (see the movement mode). */
const EXACT_TOLERANCE_IN = 0.001;

/**
 * The profile's Thickness option nearest to `thicknessIn` (inches), by its value or an alias, when it lies
 * closer than `toleranceIn`. The nearest, not the first: the thin options stand 0.025–0.125″ apart.
 */
export const findThicknessOption = (
  profile: ProductProfile | null | undefined,
  thicknessIn: number,
  toleranceIn = EXACT_TOLERANCE_IN,
): ProfileOption | null => {
  let nearest: { option: ProfileOption; distanceIn: number } | null = null;

  for (const option of selectOptions(profile ?? null, "Thickness")) {
    for (const spelling of [option.value, ...(option.aliases ?? [])]) {
      const valueIn = parseThicknessValue(spelling);
      if (valueIn === null) continue;
      const distanceIn = Math.abs(valueIn - thicknessIn);
      if (distanceIn < toleranceIn && (!nearest || distanceIn < nearest.distanceIn)) nearest = { option, distanceIn };
    }
  }

  return nearest?.option ?? null;
};

/**
 * Whether a top of this thickness may carry its basin off its Sink Base: only a top that lifts does
 * (`countertopLifts`; client rule 22.10, a floating top is 5⅛″ or 5½″).
 */
export const canThicknessFloat = (profile: ProductProfile | null | undefined, thicknessIn: number): boolean =>
  findThicknessOption(profile, thicknessIn)?.capabilities?.countertopLifts === true;
