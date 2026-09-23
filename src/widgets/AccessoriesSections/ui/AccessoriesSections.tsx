import { useEffect, useMemo, useState } from "react";

import { useActiveCollection } from "@/entities/collection";
import { useHistorySnapshot } from "@/entities/history/lib/useHistorySnapshot";
import { getTowelBarColor, getTowelBarOption } from "@/entities/product/model/store/selectors";
import { ProductOptionsGrid } from "@/entities/product/ui/ProductOptionsGrid/ProductOptionsGrid";
import {
  FieldControl,
  useCustomizationStepSections,
  type ResolvedCustomizationField,
} from "@/features/collectionCustomization";
import { useChangeAttribute } from "@/features/configurationCommands";
import { SidePanelNoticeBox, SidePanelSyncConfirmModal } from "@/features/sidePanel";
import { useAppSelector } from "@/shared/hooks/store/redux";
import { setConfigBatch } from "@/utils/functions/playcanvas/setConfigBatch";

import { buildTowelBarColorOptions } from "../lib/towelBarColorOptions";
import { useDividersState } from "../lib/useDividersState";
import { useSidePanelState } from "../lib/useSidePanelState";

import s from "./AccessoriesSections.module.scss";

import type { ReactNode } from "react";

export type AccessoriesAccordion = { sectionId: string; label: string; defaultOpen: boolean; content: ReactNode };

/** Accessories sections for both flows; the divider section drives the drawer buttons of the scene. */
export const useAccessoriesSections = (stepId: string) => {
  const saveSnapshot = useHistorySnapshot();
  const { change } = useChangeAttribute();
  const sections = useCustomizationStepSections(stepId);
  const fieldOf = (attributeId: string) =>
    sections.flatMap((section) => section.fields).find(({ definition }) => definition.attributeId === attributeId)
      ?.field;
  const dividersSectionId = sections.find((section) =>
    section.fields.some(({ definition }) => definition.attributeId === "DividersOption"),
  )?.sectionId;
  const [openSectionId, setOpenSectionId] = useState<string | null>(
    () => sections.find((section) => section.defaultOpen)?.sectionId ?? null,
  );

  const configuratorGroups = useActiveCollection((collection) => collection.catalog.configurator.groups);
  const towelBarOption = useAppSelector(getTowelBarOption);
  const towelBarColor = useAppSelector(getTowelBarColor);
  const sidePanels = useSidePanelState(fieldOf("SidePanels"));
  const dividers = useDividersState({
    styleField: fieldOf("DividersStyle"),
    isSectionOpen: openSectionId === dividersSectionId,
  });
  const towelBarColorOptions = useMemo(() => buildTowelBarColorOptions(configuratorGroups), [configuratorGroups]);

  // The scene clears the towel bar itself once "None" is chosen.
  useEffect(() => {
    if (towelBarOption === "None") void setConfigBatch({}, { TowelBar: "None", TowelBarSide: "both" });
  }, [towelBarOption]);

  const changeAttribute = (attributeId: "TowelBarOption" | "TowelBarColor") => async (value: string) => {
    if (!value) return;
    await saveSnapshot();
    await change({ attributeId, value, scope: "global" });
  };

  const onSectionChange = (sectionId: string) => {
    setOpenSectionId(sectionId || null);
    dividers.onSectionToggle(sectionId === dividersSectionId);
  };

  const renderField = ({ definition, field }: ResolvedCustomizationField): ReactNode => {
    switch (definition.attributeId) {
      case "SidePanels":
        return sidePanels.blockMessage ? (
          <p key={definition.attributeId} className={s.message}>
            {sidePanels.blockMessage}
          </p>
        ) : (
          <div key={definition.attributeId}>
            {sidePanels.notice && <SidePanelNoticeBox notice={sidePanels.notice} />}
            <ProductOptionsGrid
              data={sidePanels.options}
              handleAdd={sidePanels.changeGroove}
              activeValue={sidePanels.activeValue}
              variant="accessory"
            />
          </div>
        );

      case "DividersOption":
        return (
          <FieldControl
            key={definition.attributeId}
            control={definition.control}
            field={{ ...field, value: dividers.selection }}
            onChange={(value) => void dividers.changeOption(value)}
          />
        );

      case "DividersStyle":
        return (
          <div key={definition.attributeId} className={s.dividerStyles}>
            <div className={s.dividerTypeHeader}>
              <p className={s.dividerTypeLabel}>Divider type</p>
              {!dividers.hasSelectedType && (
                <p className={s.dividerHint}>Select a Divider type first to show placement points.</p>
              )}
            </div>
            {dividers.warning && (
              <p role="alert" className={s.dividerWarning}>
                {dividers.warning}
              </p>
            )}
            <ProductOptionsGrid
              data={dividers.styleOptions}
              handleAdd={(value) => void dividers.changeStyle(value)}
              activeValue={dividers.style}
              variant="accessory"
            />
            <p className={s.openDrawerHint}>Click 'Open Drawer' in your design to add dividers.</p>
          </div>
        );

      case "TowelBarOption":
        return (
          <FieldControl
            key={definition.attributeId}
            control={definition.control}
            field={field}
            onChange={changeAttribute("TowelBarOption")}
          />
        );

      case "TowelBarColor":
        return (
          <ProductOptionsGrid
            key={definition.attributeId}
            data={towelBarColorOptions}
            handleAdd={changeAttribute("TowelBarColor")}
            activeValue={towelBarColor}
            groupByDesc
          />
        );

      default:
        return null;
    }
  };

  const accordions: AccessoriesAccordion[] = sections.flatMap((section) => {
    const visibleFields = section.fields.filter(({ field }) => field.visible);
    if (!visibleFields.length) return [];
    return [
      {
        sectionId: section.sectionId,
        label: section.label,
        defaultOpen: section.defaultOpen,
        content: visibleFields.map(renderField),
      },
    ];
  });

  const sidePanelSyncModal = (
    <SidePanelSyncConfirmModal
      pendingChange={sidePanels.pendingSync}
      onCancel={sidePanels.cancelSync}
      onConfirm={sidePanels.confirmSync}
    />
  );

  return { accordions, onSectionChange, sidePanelSyncModal };
};
