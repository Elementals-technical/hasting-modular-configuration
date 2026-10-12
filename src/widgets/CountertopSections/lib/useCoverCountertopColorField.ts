import { useMemo } from "react";

import { useActiveCollection, type FieldRuntimeState } from "@/entities/collection";
import { getActiveProductProfile } from "@/entities/configuration";
import { resolveConfiguratorOptions } from "@/features/collectionCustomization/lib/resolveSectionState";
import { useAppSelector } from "@/shared/hooks/store/redux";

import { buildCoverColorOptions } from "./coverColorOptions";
import { useCabinetCoverColor } from "./useCabinetCoverColor";

/** Lower's independent cabinet-material field; the scene publishes its applied finish for pricing. */
export const useCoverCountertopColorField = (enabled: boolean) => {
  const profile = useAppSelector(getActiveProductProfile);
  const configurator = useActiveCollection((collection) => collection.catalog.configurator);
  const skuProfile = useActiveCollection((collection) => collection.catalog.skuProfile ?? null);
  const color = useCabinetCoverColor(enabled && profile?.collectionId === "urban-low-height");
  const options = useMemo(
    () => buildCoverColorOptions(resolveConfiguratorOptions(profile, "CabinetColor", configurator), skuProfile),
    [configurator, profile, skuProfile],
  );
  const field: FieldRuntimeState = {
    attributeId: "CoverCountertopColor",
    value: color.color,
    options,
    visible: color.available,
    enabled: !color.processing,
  };
  return { ...color, field };
};
