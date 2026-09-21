import { useCallback, useEffect, useMemo } from "react";

import { useActiveCollection } from "@/entities/collection";
import { getActiveProductProfile } from "@/entities/configuration/model/store/selectors";
import { getIsHistoryRestoring } from "@/entities/history/model/store/selectors";
import {
  getBookMatching,
  getCabinetColor,
  getCabinetColorFinish,
  getCabinetColorMaterial,
  getProductsPresets,
} from "@/entities/product/model/store/selectors";
import {
  setBookMatching,
  setCabinetColor,
  setCabinetColorFinish,
  setCabinetColorMaterial,
  setCabinetColorSku,
  setHandleGrooveColorSku,
} from "@/entities/product/model/store/slice";
import {
  ColorField,
  FieldControl,
  useCustomizationStepSections,
  type ResolvedCustomizationField,
} from "@/features/collectionCustomization";
import { resolveColorTraits, useAttributeChangeHandler } from "@/features/configurationCommands";
import { openSwatchOrder } from "@/features/swatchOrder";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/store/redux";
import { trackModularOrderFreeSwatchesClick } from "@/shared/lib/analytics/modularKeyEvents";

import { drawerPanelFlutingOptionImages, grainDirectionOptionImages } from "../lib/optionImages";

import s from "./CabinetColorSections.module.scss";

import type { FieldOptionState, FieldRuntimeState } from "@/entities/collection";
import type { ReactNode } from "react";

type Availability = { available: boolean; reason?: string };

type CabinetColorSectionsArgs = {
  stepId: string;
  flow: "prebuilt" | "custom";
  flutingState: Availability;
  bookMatchingState: { enabled: boolean; reason?: string };
};

type CabinetColorAccordion = {
  sectionId: string;
  label: string;
  defaultOpen: boolean;
  content: ReactNode;
};

const withImages = (field: FieldRuntimeState, images: Record<string, string>): FieldRuntimeState => ({
  ...field,
  options: field.options.map((option) => ({ ...option, image: images[option.value] })),
});

const unavailable = (key: string, reason?: string) => (
  <div key={key} className={s.disabledMessage}>
    {reason ?? "Not available."}
  </div>
);

/** Color step sections for both flows. SKU stays here until D02, book matching until DEV-05. */
export const useCabinetColorSections = ({
  stepId,
  flow,
  flutingState,
  bookMatchingState,
}: CabinetColorSectionsArgs) => {
  const dispatch = useAppDispatch();
  const activeProfile = useAppSelector(getActiveProductProfile);
  const configurator = useActiveCollection((collection) => collection.catalog.configurator);
  const cabinetMaterial = useAppSelector(getCabinetColorMaterial);
  const cabinetFinish = useAppSelector(getCabinetColorFinish);
  const activeBookMatching = useAppSelector(getBookMatching);
  const activeCabinetColor = useAppSelector(getCabinetColor);
  const presets = useAppSelector(getProductsPresets);
  const isHistoryRestoring = useAppSelector(getIsHistoryRestoring);
  const sections = useCustomizationStepSections(stepId);
  const cabinetColor = useAttributeChangeHandler("CabinetColor");
  const grooveColor = useAttributeChangeHandler("HandleGrooveColor");
  const fluting = useAttributeChangeHandler("DrawerPanelFluting");
  const grainDirection = useAttributeChangeHandler("GrainDirection");

  const cabinetColorOptions: FieldOptionState[] = useMemo(
    () =>
      sections.flatMap((section) => section.fields).find(({ definition }) => definition.attributeId === "CabinetColor")
        ?.field.options ?? [],
    [sections],
  );
  const skuOf = useCallback(
    (colorName: string) => cabinetColorOptions.find((option) => option.value === colorName)?.traits?.sku ?? "",
    [cabinetColorOptions],
  );

  // Preset or restored colour: prebuilt records it, both flows read its material and finish.
  useEffect(() => {
    if (!cabinetColorOptions.length || (flow === "custom" && cabinetMaterial)) return;

    const presetColor =
      flow === "prebuilt" && !isHistoryRestoring
        ? presets.find((preset) => typeof preset.CabinetColor === "string" && preset.CabinetColor)?.CabinetColor
        : undefined;
    const targetColor = presetColor || activeCabinetColor;
    if (!targetColor || !cabinetColorOptions.some((option) => option.value === targetColor)) return;

    if (presetColor && presetColor !== activeCabinetColor) {
      dispatch(setCabinetColor(presetColor));
      dispatch(setCabinetColorSku(skuOf(presetColor)));
    }

    const traits = resolveColorTraits(targetColor, configurator, activeProfile);
    if (traits?.material && traits.material !== cabinetMaterial) dispatch(setCabinetColorMaterial(traits.material));
    if (traits?.finish && traits.finish !== cabinetFinish) dispatch(setCabinetColorFinish(traits.finish));
  }, [
    activeCabinetColor,
    activeProfile,
    cabinetColorOptions,
    cabinetFinish,
    cabinetMaterial,
    configurator,
    dispatch,
    flow,
    isHistoryRestoring,
    presets,
    skuOf,
  ]);

  useEffect(() => {
    if (activeProfile && !bookMatchingState.enabled && activeBookMatching) dispatch(setBookMatching(""));
  }, [activeProfile, bookMatchingState.enabled, activeBookMatching, dispatch]);

  const handleChangeColor = async (colorName: string) => {
    const result = await cabinetColor.onChange(colorName);
    if (result.status !== "applied") return;

    dispatch(setCabinetColorSku(skuOf(colorName)));
    if (result.plan.some((change) => change.attributeId === "HandleGrooveColor")) {
      dispatch(setHandleGrooveColorSku(skuOf(colorName)));
    }
  };

  const handleChangeGrooveColor = async (colorName: string) => {
    const result = await grooveColor.onChange(colorName);
    if (result.status === "applied") dispatch(setHandleGrooveColorSku(skuOf(colorName)));
  };

  const handleOrderCabinetSwatches = () => {
    trackModularOrderFreeSwatchesClick({
      cta_location: "cabinet_color",
      configurator_flow: flow,
      product_element: "Cabinet Color",
    });
    dispatch(openSwatchOrder("Cabinet Color"));
  };

  const bookMatchingTooltip = !bookMatchingState.enabled ? (bookMatchingState.reason ?? "Not available.") : undefined;

  const renderField = ({ definition, field }: ResolvedCustomizationField) => {
    switch (definition.attributeId) {
      case "CabinetColor":
        return (
          <ColorField
            key={definition.attributeId}
            field={field}
            title="Cabinet Color"
            onChange={handleChangeColor}
            onOrderSwatches={handleOrderCabinetSwatches}
            filterClassName={s.innerRow}
          />
        );

      case "HandleGrooveColor":
        return (
          <ColorField
            key={definition.attributeId}
            field={field}
            title="Handle Groove Color"
            onChange={handleChangeGrooveColor}
            onOrderSwatches={handleOrderCabinetSwatches}
            filterClassName={s.innerRow}
            sortByTitle
          />
        );

      case "DrawerPanelFluting":
        return flutingState.available ? (
          <FieldControl
            key={definition.attributeId}
            control={definition.control}
            field={withImages(field, drawerPanelFlutingOptionImages)}
            onChange={fluting.onChange}
          />
        ) : (
          unavailable(definition.attributeId, flutingState.reason)
        );

      case "GrainDirection":
        return field.enabled ? (
          <FieldControl
            key={definition.attributeId}
            control={definition.control}
            field={withImages(field, grainDirectionOptionImages)}
            onChange={grainDirection.onChange}
          />
        ) : (
          unavailable(definition.attributeId, field.disabledReason)
        );

      case "BookMatching":
        return (
          <div key={definition.attributeId}>
            <div
              className={bookMatchingTooltip ? s.checkboxOptionTooltip : undefined}
              data-tooltip={bookMatchingTooltip}
              aria-label={bookMatchingTooltip}
            >
              <FieldControl
                control={definition.control}
                field={field}
                onChange={(value) => dispatch(setBookMatching(value))}
                label="Book Matching"
                className={`${s.checkboxOption} ${!field.enabled ? s.checkboxOptionDisabled : ""}`}
              />
            </div>
            <div className={s.checkboxHelper}>Create an exclusive, uninterrupted look and bookmatch your pattern</div>
          </div>
        );

      default:
        return null;
    }
  };

  const accordions: CabinetColorAccordion[] = sections.flatMap((section) => {
    const fields = section.fields.filter(({ field }) => field.visible);
    if (!fields.length) return [];

    const grainField = fields.find(({ definition }) => definition.attributeId === "GrainDirection");
    // Grain unavailable: only its reason is shown.
    const shown = grainField && !grainField.field.enabled ? [grainField] : fields;

    return [
      {
        sectionId: section.sectionId,
        label: section.label,
        defaultOpen: section.defaultOpen,
        content: shown.map(renderField),
      },
    ];
  });

  return accordions;
};
