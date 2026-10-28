import { useEffect, useRef, type ReactNode } from "react";

import { ProductOptionsGrid } from "@/entities/product/ui/ProductOptionsGrid/ProductOptionsGrid";
import {
  useCustomizationStepSections,
  FieldControl,
  type ResolvedCustomizationField,
} from "@/features/collectionCustomization";
import { useOrganizerSection, type OrganizerSection } from "@/features/drawerOrganizers/lib/useOrganizerSection";
import { DRAWER_LABELS } from "@/features/drawerOrganizers/ui/drawerLabels";
import { SidePanelNoticeBox, SidePanelSyncConfirmModal } from "@/features/sidePanel";
import { FieldStack } from "@/shared/ui/FieldStack/FieldStack";

import { useSidePanelState } from "../lib/useSidePanelState";

import type { AccessoriesAccordion } from "./AccessoriesSections";

import s from "./OrganizerAccessories.module.scss";

const DIVIDERS_OPTION = "DividersOption";
const SIDE_PANELS = "SidePanels";
const CUSTOMIZE = "Customize";

const columnCount = (columns: number) => (columns === 1 ? "1 column" : `${columns} columns`);

/**
 * The Drawer Dividers option for a collection with Ph2 organizers: the None | Customize choice, the hint
 * that follows the state, the counter of the open drawer's columns and, when there are two materials to
 * choose from, the material chips. Everything it shows comes from `useOrganizerSection`.
 */
const DividersOptionField = ({ field, section }: { field: ResolvedCustomizationField; section: OrganizerSection }) => {
  const { definition } = field;
  const counterText = section.counter
    ? `${columnCount(section.counter.columns)} · ${DRAWER_LABELS[section.counter.drawer]} drawer`
    : "";

  return (
    <div className={s.dividersOption}>
      <FieldControl
        control={definition.control}
        field={{ ...field.field, value: section.option }}
        onChange={(value) => void section.changeOption(value)}
      />
      {section.hint && (
        <p className={s.hint} data-testid="organizer-hint">
          {section.hint}
        </p>
      )}
      {/* Always in the page, so a screen reader hears the count change. */}
      <p className={s.counter} aria-live="polite" data-testid="organizer-counter">
        {counterText}
      </p>
      {section.option === CUSTOMIZE && section.showStyles && (
        <div className={s.styles} role="group" aria-label="Divider material">
          {section.styles.map(({ value, label, available, reason, selected }) => (
            <button
              key={value}
              type="button"
              className={s.styleChip}
              aria-pressed={selected}
              disabled={!available}
              title={reason ?? undefined}
              onClick={() => void section.changeStyle(value)}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * Accessories sections of a collection with Ph2 drawer organizers: the same result as `useAccessoriesSections`
 * (`{ accordions, onSectionChange, sidePanelSyncModal }`), but the divider section is the organizers' and the
 * scene's old drawer buttons (`useDividersState`, `installDrawerWidgets`) are never started.
 * The Side Panels field (Tricot, Q-O6) renders exactly as on the legacy page.
 */
export const useOrganizerAccessoriesSections = (stepId: string) => {
  const sections = useCustomizationStepSections(stepId);
  const fieldOf = (attributeId: string) =>
    sections.flatMap((section) => section.fields).find(({ definition }) => definition.attributeId === attributeId);

  const dividersSectionId = sections.find((section) =>
    section.fields.some(({ definition }) => definition.attributeId === DIVIDERS_OPTION),
  )?.sectionId;
  const opensWithDividers = sections.find((section) => section.defaultOpen)?.sectionId === dividersSectionId;

  const dividers = useOrganizerSection({ field: fieldOf(DIVIDERS_OPTION)?.definition ?? null });
  // Called for every collection, as the hook rules ask; a collection without the field gets an empty block.
  const sidePanels = useSidePanelState(fieldOf(SIDE_PANELS)?.field);

  // The layer shows its controls only while this section is open: told when the page opens, and when it is left.
  const toggleSection = useRef(dividers.onSectionToggle);
  useEffect(() => {
    toggleSection.current = dividers.onSectionToggle;
  });
  useEffect(() => {
    toggleSection.current(dividersSectionId !== undefined && opensWithDividers);
    return () => toggleSection.current(false);
  }, [dividersSectionId, opensWithDividers]);

  const onSectionChange = (sectionId: string) => dividers.onSectionToggle(sectionId === dividersSectionId);

  const renderField = (field: ResolvedCustomizationField): ReactNode => {
    switch (field.definition.attributeId) {
      case SIDE_PANELS:
        return sidePanels.blockMessage ? (
          <p key={field.definition.attributeId} className={s.message}>
            {sidePanels.blockMessage}
          </p>
        ) : (
          <div key={field.definition.attributeId}>
            {sidePanels.notice && <SidePanelNoticeBox notice={sidePanels.notice} />}
            <ProductOptionsGrid
              data={sidePanels.options}
              handleAdd={sidePanels.changeGroove}
              activeValue={sidePanels.activeValue}
              variant="accessory"
            />
          </div>
        );

      case DIVIDERS_OPTION:
        return <DividersOptionField key={field.definition.attributeId} field={field} section={dividers} />;

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
        content: <FieldStack>{visibleFields.map(renderField)}</FieldStack>,
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
