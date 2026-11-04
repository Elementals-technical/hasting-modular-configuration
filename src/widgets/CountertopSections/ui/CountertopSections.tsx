import { useCallback, useMemo, useState } from "react";

import { selectAttribute } from "@/entities/collection";
import { useHistoryStep } from "@/entities/history/lib/useHistoryStep";
import { setCountertopColorSku } from "@/entities/product/model/store/slice";
import {
  ProductOptionsGrid,
  type ProductOptionMetadata,
} from "@/entities/product/ui/ProductOptionsGrid/ProductOptionsGrid";
import {
  FieldControl,
  useCustomizationStepSections,
  type ResolvedCustomizationField,
} from "@/features/collectionCustomization";
import { useChangeAttribute, type AttributeChange, type ChangePreview } from "@/features/configurationCommands";
import {
  filterThicknessValuesByCountertopRules,
  findCountertopSkuByColorName,
} from "@/features/configurator-rule-core/countertop";
import { openSwatchOrder } from "@/features/swatchOrder";
import { useAppDispatch } from "@/shared/hooks/store/redux";
import { trackModularOrderFreeSwatchesClick } from "@/shared/lib/analytics/modularKeyEvents";
import { AttentionPopup } from "@/shared/ui/Popups/ui/AttentionPopup/AttentionPopup";
import { ViewModePanel } from "@/shared/ui/ViewModePanel/ViewModePanel";

import { VESSEL_SINK_NONE_OPTION_VALUE } from "../lib/countertopColorOptions";
import { useBasinState } from "../lib/useBasinState";
import { useCountertopColorState } from "../lib/useCountertopColorState";
import { useCountertopContext } from "../lib/useCountertopContext";
import { useCountertopResets } from "../lib/useCountertopResets";
import { useVesselColorState } from "../lib/useVesselColorState";
import { MaterialFilterRow } from "./MaterialFilterRow";

import type { ReactNode } from "react";
import { FieldStack } from "@/shared/ui/FieldStack/FieldStack";

type CountertopSectionsArgs = { stepId: string; flow: "prebuilt" | "custom" };

export type CountertopAccordion = { sectionId: string; label: string; defaultOpen: boolean; content: ReactNode };

/** Countertop sections for both flows; colour SKU and basin apply stay here until D02 and a basin command. */
export const useCountertopSections = ({ stepId, flow }: CountertopSectionsArgs): CountertopAccordion[] => {
  const dispatch = useAppDispatch();
  // A pick on the step is one undo step, written once it changed the configuration.
  const { run: runStep } = useHistoryStep();
  const { change, confirm } = useChangeAttribute();
  const [pendingChange, setPendingChange] = useState<ChangePreview | null>(null);
  const changeFromUser = useCallback(async (request: AttributeChange) => {
    const result = await runStep(() => change({ ...request, userInitiated: true }));
    setPendingChange(result.status === "confirmation-required" ? result.preview : null);
    return result;
  }, [change, runStep]);
  const sections = useCustomizationStepSections(stepId);
  const fieldOf = (attributeId: string) =>
    sections.flatMap((section) => section.fields).find(({ definition }) => definition.attributeId === attributeId)
      ?.field;

  const context = useCountertopContext();
  const { activeBasinStyle, activeCountertopColor, activeProfile, activeThickness, sinkBaseCabinetId } =
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
    (thickness: string) => changeFromUser({ attributeId: "Thickness", value: thickness, scope: "countertop" }),
    [changeFromUser],
  );

  // A thickness the rules pick for the countertop: their change, not the user's, so it takes no undo step.
  const resetThickness = useCallback(
    (thickness: string) => change({ attributeId: "Thickness", value: thickness, scope: "countertop" }),
    [change],
  );

  const changeCountertopColor = async (colorName: string, _config?: unknown, metadata?: ProductOptionMetadata) => {
    if (!colorName || !colorState.isColorCompatible(colorName)) return;
    const result = await changeFromUser({ attributeId: "CountertopColor", value: colorName, scope: "countertop" });
    if (result.status !== "applied") return;
    dispatch(
      setCountertopColorSku(metadata?.sku ?? findCountertopSkuByColorName(context.configuratorGroups, colorName)),
    );
  };

  const changeVesselColor = async (colorName: string) => {
    if (!colorName || !sinkBaseCabinetId) return;
    const option = vesselState.findOptionByValue(colorName);
    if (option && !vesselState.isCompatibleWithSinkStyle(option)) return;
    // Names no Sink Base: the colour reaches every one, as the basin does.
    const result = await changeFromUser({ attributeId: "VesselColor", value: colorName, scope: "basin" });
    if (result.status === "applied") vesselState.setActiveVesselColor(colorName);
  };

  const applyBasin = useCallback(
    async (basinStyle: string) => { await change({ attributeId: "sinkType", value: basinStyle, scope: "basin" }); },
    [change],
  );

  useCountertopResets({
    context,
    allowedThicknessValues,
    availableBasinOptions: basinState.availableBasinOptions,
    hasSinkBase: basinState.hasSinkBase,
    isActiveStyleAvailable: basinState.isActiveStyleAvailable,
    resetThickness,
    applyBasin,
  });

  const changeBasin = async (basinStyle: string) => {
    const option = basinState.basinOptions.find((item) => (item.name ?? item.title) === basinStyle);
    if (option?.isAvailable === false) return;

    const isCutout = basinStyle === VESSEL_SINK_NONE_OPTION_VALUE || (basinStyle.startsWith("Vessel_") && activeBasinStyle === basinStyle);
    const result = await changeFromUser({
      attributeId: "sinkType", value: isCutout ? selectAttribute(activeProfile, "sinkType")?.noneValue ?? "" : basinStyle,
      scope: "basin",
    });
    // The colour the vessel took may sit behind the active filter of the colour grid.
    if (result.status === "applied" && result.plan.some(({ attributeId }) => attributeId === "VesselColor")) {
      vesselState.setSelection({});
    }
  };

  const changeCountertopStyle = async (styleValue: string) => {
    await changeFromUser({ attributeId: "CountertopStyle", value: styleValue, scope: "countertop" });
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
        // The stored style may be in the scene's spelling ("Integrated"): it is marked as the option the basins
        // follow, matched case-insensitively.
        return (
          <FieldControl
            key={definition.attributeId}
            control={definition.control}
            field={{ ...field, value: basinState.activeStyleValue }}
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

  const firstVisibleSection = sections.find((section) => section.fields.some(({ field }) => field.visible))?.sectionId;
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
        content: <FieldStack>{visibleFields.map(renderField)}{section.sectionId === firstVisibleSection && (
          <AttentionPopup
            isOpening={pendingChange !== null}
            setIsOpening={(open) => { if (!open) setPendingChange(null); }}
            content={<p>{pendingChange?.reasons[0]?.reason}</p>}
            onConfirm={() => {
              if (!pendingChange) return;
              void runStep(() => confirm(pendingChange)).then((result) => setPendingChange(result.status === "confirmation-required" ? result.preview : null));
            }}
          />
        )}</FieldStack>,
      },
    ];
  });
};
