import { useCallback, useEffect, useMemo } from "react";

import { useActiveCollection } from "@/entities/collection";
import { getActiveProductProfile } from "@/entities/configuration/model/store/selectors";
import { getIsHistoryRestoring } from "@/entities/history/model/store/selectors";
import {
  getCabinetColor,
  getCabinetColorFinish,
  getCabinetColorMaterial,
  getProductsPresets,
} from "@/entities/product/model/store/selectors";
import { setCabinetColorSku, setHandleGrooveColorSku } from "@/entities/product/model/store/slice";
import {
  ColorField,
  FieldControl,
  useCustomizationStepSections,
  type ResolvedCustomizationField,
} from "@/features/collectionCustomization";
import { resolveColorTraits, useAttributeChangeHandler, useChangeAttribute } from "@/features/configurationCommands";
import { openSwatchOrder } from "@/features/swatchOrder";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/store/redux";
import { trackModularOrderFreeSwatchesClick } from "@/shared/lib/analytics/modularKeyEvents";

import { drawerPanelFlutingOptionImages, grainDirectionOptionImages } from "../lib/optionImages";

import s from "./CabinetColorSections.module.scss";

import type { FieldOptionState, FieldRuntimeState } from "@/entities/collection";
import type { ReactNode } from "react";

import { useReasonText } from "@/shared/lib/reasonText";

import { UnavailableMessage, VALUE_UNAVAILABLE_REASON_CODE } from "./UnavailableMessage";

type Availability = { available: boolean; reason?: string; reasonCode?: string };

type CabinetColorSectionsArgs = {
  stepId: string;
  flow: "prebuilt" | "custom";
  flutingState: Availability;
  bookMatchingState: { enabled: boolean; reason?: string; reasonCode?: string };
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

/** Color step sections for both flows. SKU stays here until D02. */
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
  const activeCabinetColor = useAppSelector(getCabinetColor);
  const presets = useAppSelector(getProductsPresets);
  const isHistoryRestoring = useAppSelector(getIsHistoryRestoring);
  const sections = useCustomizationStepSections(stepId);
  const cabinetColor = useAttributeChangeHandler("CabinetColor");
  const grooveColor = useAttributeChangeHandler("HandleGrooveColor");
  const fluting = useAttributeChangeHandler("DrawerPanelFluting");
  const grainDirection = useAttributeChangeHandler("GrainDirection");
  const bookMatching = useAttributeChangeHandler("BookMatching");
  const { record } = useChangeAttribute();
  const reasonText = useReasonText();

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

    // The scene already shows this colour: it is recorded without a scene call, and the
    // command records its material and finish with it.
    const isNewColor = Boolean(presetColor) && presetColor !== activeCabinetColor;
    const traits = resolveColorTraits(targetColor, configurator, activeProfile);
    const lacksTraits =
      (Boolean(traits?.material) && traits?.material !== cabinetMaterial) ||
      (Boolean(traits?.finish) && traits?.finish !== cabinetFinish);
    if (!isNewColor && !lacksTraits) return;

    record({ CabinetColor: targetColor });
    // The SKU is a pricing input (D), not a value the command records.
    if (isNewColor) dispatch(setCabinetColorSku(skuOf(targetColor)));
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
    record,
    skuOf,
  ]);

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

  const bookMatchingTooltip = !bookMatchingState.enabled
    ? reasonText({ code: bookMatchingState.reasonCode ?? VALUE_UNAVAILABLE_REASON_CODE, text: bookMatchingState.reason })
    : undefined;

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
          <UnavailableMessage
            key={definition.attributeId}
            reason={flutingState.reason}
            reasonCode={flutingState.reasonCode}
          />
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
          <UnavailableMessage
            key={definition.attributeId}
            reason={field.disabledReason}
            reasonCode={field.reasonCode}
            reasonParams={field.reasonParams}
          />
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
                onChange={bookMatching.onChange}
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
