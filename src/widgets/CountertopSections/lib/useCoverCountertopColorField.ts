import { useCallback, useMemo } from "react";

import { sceneValueOf, semanticValueOf, useActiveCollection, type FieldRuntimeState } from "@/entities/collection";
import { getActiveProductProfile, getActiveRuntimeBindings } from "@/entities/configuration";
import { useHistoryStep } from "@/entities/history/lib/useHistoryStep";
import { resolveConfiguratorOptions } from "@/features/collectionCustomization/lib/resolveSectionState";
import { useAppSelector } from "@/shared/hooks/store/redux";
import { CABINET_COVER_COLOR_ATTRIBUTE_ID } from "@/shared/lib/sku";

import { useCabinetCoverColor } from "./useCabinetCoverColor";

/** Lower's independent colour field; the scene publishes its applied finish for pricing. */
export const useCoverCountertopColorField = (enabled: boolean) => {
  const profile = useAppSelector(getActiveProductProfile);
  const bindings = useAppSelector(getActiveRuntimeBindings);
  const configurator = useActiveCollection((collection) => collection.catalog.configurator);
  const cover = useActiveCollection((collection) => collection.catalog.skuProfile?.cabinetCover ?? null);
  // A collection offers Lower when its SKU profile carries the cover contract.
  const color = useCabinetCoverColor(enabled && Boolean(cover));
  // The Lower comes in every one of the Upper's colours; the Upper's own rules judge only its slab.
  const options = useMemo(
    () => (cover ? resolveConfiguratorOptions(profile, CABINET_COVER_COLOR_ATTRIBUTE_ID, configurator) : []),
    [configurator, cover, profile],
  );
  // The scene knows the Upper's colours under the countertop binding's names, and so the Lower's.
  // A pick is one undo step. The Lower's colour lives only in the scene, so the step is written when
  // the pick repainted the slabs; the colour it follows by default (useLowerCountertopDefaultColor) takes none.
  const { changeColor } = color;
  const { run: runStep } = useHistoryStep();
  const changeLowerColor = useCallback(
    async (value: string) => {
      await runStep(
        () => changeColor(sceneValueOf(bindings, CABINET_COVER_COLOR_ATTRIBUTE_ID, value)),
        (repainted) => repainted,
      );
    },
    [bindings, changeColor, runStep],
  );
  // A material that is one of the Upper's colours reads as itself, any other by its binding.
  const value =
    color.color === null || options.some((option) => option.value === color.color)
      ? color.color
      : semanticValueOf(bindings, CABINET_COVER_COLOR_ATTRIBUTE_ID, color.color);
  const field: FieldRuntimeState = {
    attributeId: "CoverCountertopColor",
    value,
    options,
    // Shown once the scene reports a cover and the contract leaves a colour to pick.
    visible: color.available && options.length > 0,
    enabled: !color.processing,
  };
  return { ...color, changeColor: changeLowerColor, field };
};
