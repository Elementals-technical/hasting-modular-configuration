import { isVesselBasin } from "@/entities/collection";
// Not the countertop barrel: its hooks reach the command layer, which imports this file.
import {
  isMaterialCompatibleWithVesselStyle,
  isPreferredVesselFinish,
} from "@/features/configurator-rule-core/countertop/vesselCompatibility";
import { extractColorCode } from "@/shared/lib/sku";

import { buildConfiguratorOptions } from "./buildConfiguratorOptions";
import { resolveConfiguratorOptions } from "./resolveSectionState";

import type { FieldOptionState, ProductProfile } from "@/entities/collection";
import type { ConfiguratorGroupCatalog } from "@/entities/collection/model/types";

type VesselStyle = string | null | undefined;

/** One option as the vessel compatibility predicates judge it: the materials it is listed under and its colour code. */
export const finishOf = (
  profile: ProductProfile | null,
  vesselStyle: VesselStyle,
  { value, traits }: FieldOptionState,
) => ({
  vesselStyle,
  materialTokens: traits?.materials ?? [],
  colorCode: extractColorCode(value),
  profile,
});

/**
 * The colours of the chosen vessel, as the USH countertop step offers them: those its compatibility
 * allows by the material a colour is listed under and its colour code, its default finish first.
 */
export const resolveVesselColorOptions = (
  profile: ProductProfile | null,
  configurator: ConfiguratorGroupCatalog | null,
  vesselStyle: VesselStyle,
): { allowed: FieldOptionState[]; preferredValue: string | undefined } => {
  const allowed = resolveConfiguratorOptions(profile, "VesselColor", configurator).filter((option) =>
    isMaterialCompatibleWithVesselStyle(finishOf(profile, vesselStyle, option)),
  );

  return {
    allowed,
    preferredValue: allowed.find((option) => isPreferredVesselFinish(finishOf(profile, vesselStyle, option)))?.value,
  };
};

/**
 * Whether a colour outside the vessel section is one the vessel takes, judged by the material each
 * section lists it under: Urban Standard Height offers HPL and Porcelain from Countertop Color. A colour
 * the vessel section lists is that section's to judge, so another section cannot bring it back.
 */
const isAllowedFromAnotherSection = (
  profile: ProductProfile | null,
  configurator: ConfiguratorGroupCatalog | null,
  vesselStyle: VesselStyle,
  color: string,
): boolean =>
  !resolveConfiguratorOptions(profile, "VesselColor", configurator).some(({ value }) => value === color) &&
  Boolean(
    configurator?.groups
      .flatMap((group) => buildConfiguratorOptions(group))
      .some(
        (option) =>
          option.value === color && isMaterialCompatibleWithVesselStyle(finishOf(profile, vesselStyle, option)),
      ),
  );

/**
 * The colour a basin takes when it is picked: the current one if the vessel allows it, else the
 * vessel's default finish, else the first it allows. Null leaves the colour alone: the basin is no
 * vessel (the empty cutout, an integrated basin), or nothing tells which colours the vessel allows.
 */
export const resolveVesselColorForBasin = ({
  profile,
  configurator,
  vesselStyle,
  current,
}: {
  profile: ProductProfile | null;
  configurator: ConfiguratorGroupCatalog | null;
  vesselStyle: VesselStyle;
  current: string | null | undefined;
}): string | null => {
  if (!isVesselBasin(profile, vesselStyle)) return null;

  const { allowed, preferredValue } = resolveVesselColorOptions(profile, configurator, vesselStyle);
  const [firstAllowed] = allowed;
  if (!firstAllowed) return null;

  if (
    current &&
    (allowed.some(({ value }) => value === current) ||
      isAllowedFromAnotherSection(profile, configurator, vesselStyle, current))
  ) {
    return current;
  }

  return preferredValue ?? firstAllowed.value;
};
