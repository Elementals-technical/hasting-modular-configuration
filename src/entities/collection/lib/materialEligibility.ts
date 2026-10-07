import type { ProductProfile } from "../model/productProfile";
import { normalizeOptionValue } from "./productProfileSelectors";

/** Shared by field availability, commands and pricing so an API price cannot approve an invalid pattern. */
export const isPatternMaterialAllowed = (
  profile: ProductProfile | null,
  value: string,
  material: string | null | undefined,
): boolean => {
  const rule = profile?.ruleData.fluting;
  const canonical = normalizeOptionValue(profile, "DrawerPanelFluting", value) ?? value;
  const aliases = rule?.eligibleMaterialAliasesByValue?.[canonical];
  if (!rule?.eligibleMaterialAliasesByValue) return true;
  return Boolean(aliases?.some((alias) => alias.trim().toUpperCase() === material?.trim().toUpperCase()));
};
