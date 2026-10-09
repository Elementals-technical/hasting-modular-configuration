import type { RootState } from "@/app/store";
import { normalizeOptionValue, selectDefaultValue } from "@/entities/collection";
import { getActiveProductProfile, getAttributeValue, getCabinetEntries } from "@/entities/configuration";
import { getCabinetColorMaterial } from "@/entities/product/model/store/selectors";
import { flutingRule } from "@/features/configurator-rule-core/options/rules/flutingRule";

const PATTERN = "DrawerPanelFluting";

/**
 * The pattern a cabinet added to the composition is placed with, for a collection whose patterns
 * depend on the cabinet material (Tricot: Loden on Lacquer Matte, the other four on Wood Veneer).
 *
 * The composition's pattern, read at its first cabinet, else the collection's default, when the
 * current material takes it; otherwise the first pattern the material takes. A collection whose
 * patterns do not depend on the material places its cabinets without one, as before: null.
 */
export const resolveNewCabinetPattern = (state: RootState): string | null => {
  const profile = getActiveProductProfile(state);
  if (!profile?.ruleData.fluting?.eligibleMaterialAliasesByValue) return null;

  const [first] = getCabinetEntries(state);
  const placed = first ? getAttributeValue(state, PATTERN, { scope: "cabinet", cabinetId: first.stableKey }) : null;
  const candidates = [placed, selectDefaultValue(profile, PATTERN)]
    .map((value) => (value === null || value === undefined ? null : normalizeOptionValue(profile, PATTERN, value)))
    .filter((value): value is string => Boolean(value));

  const allowed = flutingRule({ material: getCabinetColorMaterial(state) ?? undefined, targetPart: "CABINET" }, profile)
    .options.filter(({ enabled }) => enabled)
    .map(({ value }) => value);
  // Before a material is known every pattern is still possible: the composition's is kept.
  if (allowed.length === 0) return candidates[0] ?? null;

  return candidates.find((value) => allowed.includes(value)) ?? allowed[0];
};
