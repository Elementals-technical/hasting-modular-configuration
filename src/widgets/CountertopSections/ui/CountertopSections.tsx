import { useCallback, useMemo } from "react";

import { selectAttribute } from "@/entities/collection";
import { useHistorySnapshot } from "@/entities/history/lib/useHistorySnapshot";
import {
  setActiveBasinStyle,
  setCountertopColorSku,
  setCountertopStyle,
  setVesselColor,
} from "@/entities/product/model/store/slice";
import {
  ProductOptionsGrid,
  type ProductOptionMetadata,
} from "@/entities/product/ui/ProductOptionsGrid/ProductOptionsGrid";
import {
  FieldControl,
  useCustomizationStepSections,
  type ResolvedCustomizationField,
} from "@/features/collectionCustomization";
import { useChangeAttribute } from "@/features/configurationCommands";
import {
  filterThicknessValuesByCountertopRules,
  findCountertopSkuByColorName,
} from "@/features/configurator-rule-core/countertop";
import { openSwatchOrder } from "@/features/swatchOrder";
import { useAppDispatch } from "@/shared/hooks/store/redux";
import { trackModularOrderFreeSwatchesClick } from "@/shared/lib/analytics/modularKeyEvents";
import { ViewModePanel } from "@/shared/ui/ViewModePanel/ViewModePanel";
import { setConfigBatch } from "@/utils/functions/playcanvas/setConfigBatch";

import { VESSEL_SINK_NONE_OPTION_VALUE } from "../lib/countertopColorOptions";
import { useBasinState } from "../lib/useBasinState";
import { useCountertopColorState } from "../lib/useCountertopColorState";
import { useCountertopContext } from "../lib/useCountertopContext";
import { useCountertopResets } from "../lib/useCountertopResets";
import { useVesselColorState } from "../lib/useVesselColorState";
import { MaterialFilterRow } from "./MaterialFilterRow";

import type { ReactNode } from "react";

type CountertopSectionsArgs = { stepId: string; flow: "prebuilt" | "custom" };

export type CountertopAccordion = { sectionId: string; label: string; defaultOpen: boolean; content: ReactNode };

/** Countertop sections for both flows; colour SKU and basin apply stay here until D02 and a basin command. */
export const useCountertopSections = ({ stepId, flow }: CountertopSectionsArgs): CountertopAccordion[] => {
  const dispatch = useAppDispatch();
  const saveSnapshot = useHistorySnapshot();
  const { change } = useChangeAttribute();
  const sections = useCustomizationStepSections(stepId);
  const fieldOf = (attributeId: string) =>
    sections.flatMap((section) => section.fields).find(({ definition }) => definition.attributeId === attributeId)
      ?.field;

  const context = useCountertopContext();
  const { activeBasinStyle, activeCountertopColor, activeProfile, activeThickness, isVesselStyle, sinkBaseCabinetId } =
    context;
  const colorState = useCountertopColorState(context);
  const vesselState = useVesselColorState({
    context,
    vesselColorOptions: colorState.vesselColorOptions,
    defaultMaterialFilters: colorState.defaultMaterialFilters,
  });
  const basinState = useBasinState({
    context,
    styleField: fieldOf("CountertopStyle"),
    basinField: fieldOf("sinkType"),
  });
  const thicknessField = fieldOf("Thickness");
  const allowedThicknessValues = useMemo(() => {
    const values = (thicknessField?.options ?? []).map((option) => option.value);
    return new Set(
      filterThicknessValuesByCountertopRules({ values, allowedThicknesses: context.ruleState.allowedThicknesses }).map(
        String,
      ),
    );
  }, [context.ruleState.allowedThicknesses, thicknessField]);

  const changeThickness = useCallback(
    async (thickness: string) => {
      await saveSnapshot();
      await change({ attributeId: "Thickness", value: thickness, scope: "countertop" });
    },
    [change, saveSnapshot],
  );

  const changeCountertopColor = async (colorName: string, _config?: unknown, metadata?: ProductOptionMetadata) => {
    if (!colorName || !colorState.isColorCompatible(colorName)) return;
    await saveSnapshot();
    const result = await change({ attributeId: "CountertopColor", value: colorName, scope: "countertop" });
    if (result.status !== "applied") return;
    dispatch(
      setCountertopColorSku(metadata?.sku ?? findCountertopSkuByColorName(context.configuratorGroups, colorName)),
    );
  };

  const changeVesselColor = async (colorName: string) => {
    if (!colorName || !sinkBaseCabinetId) return;
    const option = vesselState.findOptionByValue(colorName);
    if (option && !vesselState.isCompatibleWithSinkStyle(option)) return;
    await saveSnapshot();
    const result = await change({
      attributeId: "VesselColor",
      value: colorName,
      scope: "basin",
      sinkBaseId: sinkBaseCabinetId,
    });
    if (result.status === "applied") vesselState.setActiveVesselColor(colorName);
  };

  // The vessel cutout: the scene keeps the profile's noneValue for sinkType where state keeps "no basin chosen".
  const applyVesselCutout = useCallback(async () => {
    const noneValue = selectAttribute(activeProfile, "sinkType")?.noneValue;
    if (!noneValue || !sinkBaseCabinetId) return;
    await change({ attributeId: "sinkType", value: noneValue, scope: "basin", sinkBaseId: sinkBaseCabinetId });
  }, [activeProfile, change, sinkBaseCabinetId]);

  const { syncColorWithSinkStyle } = vesselState;
  const { applyIntegratedBasin } = basinState;

  // A vessel goes on every preset product; custom has no presets and uses the composition.
  const applyVesselBasin = useCallback(
    async (basinStyle: string) => {
      await (context.presetNames.length
        ? Promise.all(
            context.presetNames.map((name) => setConfigBatch({ productType: name }, { sinkType: basinStyle })),
          )
        : setConfigBatch(context.selectedProducts, { sinkType: basinStyle }));
      await syncColorWithSinkStyle(basinStyle);
      dispatch(setActiveBasinStyle(basinStyle));
    },
    [context.presetNames, context.selectedProducts, dispatch, syncColorWithSinkStyle],
  );

  const applyBasin = useCallback(
    (basinStyle: string) =>
      basinStyle.startsWith("Vessel_") ? applyVesselBasin(basinStyle) : applyIntegratedBasin(basinStyle),
    [applyIntegratedBasin, applyVesselBasin],
  );

  useCountertopResets({
    context,
    allowedThicknessValues,
    availableBasinOptions: basinState.availableBasinOptions,
    hasSinkBase: basinState.hasSinkBase,
    isActiveStyleAvailable: basinState.isActiveStyleAvailable,
    changeThickness,
    applyBasin,
  });

  const changeBasin = async (basinStyle: string) => {
    const option = basinState.basinOptions.find((item) => (item.name ?? item.title) === basinStyle);
    if (option?.isAvailable === false) return;
    await saveSnapshot();

    const isNone = basinStyle === VESSEL_SINK_NONE_OPTION_VALUE;
    if (isNone || basinStyle.startsWith("Vessel_")) {
      if (!isVesselStyle) dispatch(setCountertopStyle("Vessel"));
      // "None" and a second click on the chosen vessel leave an empty cutout.
      if (isNone || activeBasinStyle === basinStyle) return applyVesselCutout();
    }
    await applyBasin(basinStyle);
  };

  const changeCountertopStyle = async (styleValue: string) => {
    const style = basinState.styleOptions.find((option) => option.value === styleValue)?.label ?? styleValue;
    await saveSnapshot();
    dispatch(setCountertopStyle(style));

    if (style.toLowerCase() === "vessel") {
      await setConfigBatch({ productType: "Sink-Base" }, { sinkType: "Vessel" });
      dispatch(setActiveBasinStyle(""));
    } else {
      await setConfigBatch({ productType: "Sink-Base" }, { VesselColor: "" });
      dispatch(setVesselColor(""));
    }
  };

  const orderSwatches = () => {
    trackModularOrderFreeSwatchesClick({
      cta_location: "countertop_color",
      configurator_flow: flow,
      product_element: "Countertop Color",
    });
    dispatch(openSwatchOrder("Countertop Color"));
  };

  const renderBasin = () => {
    if (!activeCountertopColor) return <div>Select a material first to enable basin styles.</div>;
    if (!activeThickness) return <div>Select a thickness first to enable basin styles.</div>;
    if (!basinState.hasSinkBase) return <div>Select a cabinet type with sink support to enable basin styles.</div>;
    if (!basinState.basinOptions.length && basinState.isBasinSelectionVesselStyle) {
      return <div>No vessel sink styles available for the selected material.</div>;
    }
    return (
      <ProductOptionsGrid
        handleAdd={changeBasin}
        data={basinState.basinOptions}
        activeValue={basinState.activeBasinOptionValue}
      />
    );
  };

  const renderField = ({ definition, field }: ResolvedCustomizationField): ReactNode => {
    switch (definition.attributeId) {
      case "CountertopColor":
        return (
          <div key={definition.attributeId}>
            <ViewModePanel
              onOrderSwatches={orderSwatches}
              fullModeTitle="Countertop Color"
              fullModeOptions={colorState.fullModeOptions}
              fullModeActiveValue={activeCountertopColor}
              onFullModeSelect={changeCountertopColor}
              fullModeGroupByDesc
              fullModeMaterialFilterOptions={colorState.fullModeMaterials}
              fullModeColorFilterOptions={colorState.filters.colors}
              fullModeLookFilterOptions={colorState.filters.looks}
              fullModeTierFilterOptions={colorState.tierOptions}
            />
            <MaterialFilterRow
              filters={colorState.filters}
              tiers={colorState.tierOptions}
              selection={colorState.selection}
              onChange={colorState.setSelection}
            />
            <ProductOptionsGrid
              data={colorState.visibleOptions}
              handleAdd={changeCountertopColor}
              activeValue={activeCountertopColor}
              groupByDesc
            />
          </div>
        );

      case "Thickness":
        return (
          <FieldControl
            key={definition.attributeId}
            control={definition.control}
            field={{
              ...field,
              options: field.options.map((option) => ({
                ...option,
                enabled: allowedThicknessValues.has(option.value),
              })),
            }}
            onChange={(value) => void changeThickness(value)}
          />
        );

      case "CountertopStyle":
        return (
          <FieldControl
            key={definition.attributeId}
            control={definition.control}
            field={{ ...field, value: basinState.activeStyleValue, options: basinState.styleOptions }}
            onChange={(value) => void changeCountertopStyle(value)}
          />
        );

      case "sinkType":
        return <div key={definition.attributeId}>{renderBasin()}</div>;

      case "VesselColor":
        return (
          <div key={definition.attributeId}>
            <MaterialFilterRow
              filters={vesselState.filters}
              tiers={vesselState.tierOptions}
              selection={vesselState.selection}
              onChange={vesselState.setSelection}
            />
            <ProductOptionsGrid
              data={vesselState.visibleOptions}
              handleAdd={changeVesselColor}
              activeValue={vesselState.activeVesselColor}
              groupByDesc
            />
          </div>
        );

      default:
        return null;
    }
  };

  return sections.flatMap((section) => {
    const visibleFields = section.fields.filter(({ field }) => field.visible);
    if (!visibleFields.length) return [];

    // The basin section lists vessel sinks while the style is vessel, and the collection may
    // name that list differently.
    const listsBasins = visibleFields.some(({ definition }) => definition.attributeId === "sinkType");
    const label =
      listsBasins && basinState.isBasinSelectionVesselStyle
        ? (section.labelWhenVessel ?? section.label)
        : section.label;

    return [
      {
        sectionId: section.sectionId,
        label,
        defaultOpen: section.defaultOpen,
        content: visibleFields.map(renderField),
      },
    ];
  });
};
