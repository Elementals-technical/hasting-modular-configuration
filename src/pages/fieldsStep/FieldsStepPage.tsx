import { useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";

import { useActiveCollection } from "@/entities/collection";
import { getActiveProductProfile } from "@/entities/configuration";
import { getConfiguratorProductElement } from "@/entities/configurator/lib/configuratorGroupKind";
import { getCountertopStyle } from "@/entities/product/model/store/selectors";
import { setCountertopColorSku } from "@/entities/product/model/store/slice";
import {
  selectConfiguratorSection,
  useAttributeChangeHandler,
  useFieldAutoSelect,
  type ChangeResult,
} from "@/features/configurationCommands";
import {
  ColorField,
  FieldControl,
  FieldToggle,
  useCollectionNavigation,
  useCustomizationStepSections,
  type ResolvedCustomizationField,
} from "@/features/collectionCustomization";
import { openSwatchOrder } from "@/features/swatchOrder";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/store/redux";
import { trackModularOrderFreeSwatchesClick } from "@/shared/lib/analytics/modularKeyEvents";
import { ConfiguratorAccordionGroup, ConfiguratorAccordionItem } from "@/shared/ui/Accordion/ConfiguratorAccordion";
import { useCompactAccordionViewport } from "@/shared/ui/Accordion/useCompactAccordionViewport";
import { useSyncedAccordionValue } from "@/shared/ui/Accordion/useSyncedAccordionValue";
import { FieldStack } from "@/shared/ui/FieldStack/FieldStack";
import { SegmentedTabPanel, SegmentedTabs, type SegmentedTab } from "@/shared/ui/SegmentedTabs/SegmentedTabs";
import { CountertopColorLevelPicker } from "@/widgets/CountertopSections/ui/CountertopColorLevelPicker";
import { useCoverCountertopColorField } from "@/widgets/CountertopSections/lib/useCoverCountertopColorField";

import s from "./FieldsStepPage.module.scss";

type SectionRef = { sectionId: string; label: string };

type SectionFieldProps = ResolvedCustomizationField & { section: SectionRef };

/** A colour field as the Urban colour screens show it: its pictures, filters, full mode and swatch order. */
const ColorSectionField = ({
  definition,
  field,
  section,
  onChange,
}: SectionFieldProps & { onChange: (value: string) => Promise<ChangeResult> }) => {
  const dispatch = useAppDispatch();
  const profile = useAppSelector(getActiveProductProfile);
  const flowId = useCollectionNavigation()?.flowId;
  // The cover contract names the flows that offer Lower (Urban Freestanding: also custom, where its
  // short cabinet is added); prebuilt only when it names none.
  const lowerFlows = useActiveCollection((collection) => collection.catalog.skuProfile?.cabinetCover?.flows);
  const offersLower = Boolean(flowId && (lowerFlows ?? ["prebuilt"]).includes(flowId));
  const coverColor = useCoverCountertopColorField(definition.attributeId === "CountertopColor" && offersLower);

  const orderSwatches = () => {
    const configuratorSection = selectConfiguratorSection(profile, definition.attributeId);
    // The swatch order knows a group by its element ("Select Countertop Color" -> "Countertop Color").
    const productElement = configuratorSection ? getConfiguratorProductElement(configuratorSection) : null;

    trackModularOrderFreeSwatchesClick({
      cta_location: section.sectionId.replace(/-/g, "_"),
      configurator_flow: flowId,
      product_element: productElement ?? section.label,
    });
    dispatch(openSwatchOrder(productElement ?? undefined));
  };

  // The countertop rules and price tell a colour two materials list (an MT lacquer, as Tekorlux and as
  // Glass MT) by the SKU of the swatch picked, which the USH countertop step records the same way.
  const select = async (value: string, sku?: string) => {
    const result = await onChange(value);
    if (definition.attributeId === "CountertopColor" && result.status === "applied") {
      dispatch(setCountertopColorSku(sku ?? ""));
    }
  };

  return (
    <CountertopColorLevelPicker
      lowerField={coverColor.field}
      processing={coverColor.processing}
      error={coverColor.error}
      onLowerChange={coverColor.changeColor}
      onOrderSwatches={orderSwatches}
    >
      <ColorField field={field} title={section.label} onChange={select} onOrderSwatches={orderSwatches} />
    </CountertopColorLevelPicker>
  );
};

const SectionField = (props: SectionFieldProps) => {
  const { definition, field } = props;
  const { onChange, notice } = useAttributeChangeHandler(definition.attributeId);

  return (
    <div>
      {field.toggle && <FieldToggle toggle={field.toggle} onChange={onChange} />}
      {definition.control === "colors" ? (
        <ColorSectionField {...props} onChange={onChange} />
      ) : (
        <FieldControl control={definition.control} field={field} onChange={onChange} />
      )}
      {field.hint && <p className={s.hint}>{field.hint}</p>}
      {notice && <div className={s.notice}>{notice}</div>}
    </div>
  );
};

type SectionFieldTabsProps = {
  section: SectionRef;
  /** The line above the tabs, e.g. "Select Panel, Then Color". */
  caption?: string;
  /** The visible fields of the section, each with its tab. */
  fields: ResolvedCustomizationField[];
};

/**
 * The fields of a section that shows one at a time (`fieldTabs`): their tabs and, under them, the
 * field chosen. A field is drawn when its tab is first chosen and kept afterwards: each keeps its
 * filters, and the step draws one colour grid on entry rather than all of them.
 */
const SectionFieldTabs = ({ section, caption, fields }: SectionFieldTabsProps) => {
  const fieldIds = fields.map(({ definition }) => definition.attributeId);
  const [chosen, setChosen] = useState(fieldIds[0]);
  const [opened, setOpened] = useState<readonly string[]>([fieldIds[0]]);
  // A field its rules hide gives the place to the first one left.
  const active = fieldIds.includes(chosen) ? chosen : fieldIds[0];

  const choose = (attributeId: string) => {
    setChosen(attributeId);
    setOpened((previous) => [...new Set([...previous, active, attributeId])]);
  };

  const tabs: SegmentedTab[] = fields.map(({ definition }) => ({
    value: definition.attributeId,
    label: definition.tab?.label ?? definition.attributeId,
    icon: definition.tab?.icon && <img src={definition.tab.icon} alt="" />,
  }));

  return (
    <div>
      {caption && <p className={s.tabsCaption}>{caption}</p>}
      <SegmentedTabs label={caption ?? section.label} tabs={tabs} value={active} onValueChange={choose}>
        {fields.map(({ definition, field }) => {
          const { attributeId } = definition;

          return (
            <SegmentedTabPanel key={attributeId} value={attributeId} keepMounted={opened.includes(attributeId)}>
              <SectionField
                definition={definition}
                field={field}
                // The field is named by its tab: the full mode and the swatch order show it.
                section={{ sectionId: section.sectionId, label: definition.tab?.label ?? section.label }}
              />
            </SegmentedTabPanel>
          );
        })}
      </SegmentedTabs>
    </div>
  );
};

/**
 * Keeps a field that declares `autoSelect` on a value its rules allow while the step is open. It
 * stands beside the accordion: a closed section does not mount its fields.
 */
const FieldAutoSelect = ({ definition, field }: ResolvedCustomizationField) => {
  useFieldAutoSelect(field, definition.autoSelect);
  return null;
};

export const FieldsStepPage = ({ stepId }: { stepId: string }) => {
  const { key: locationKey } = useLocation();
  const [searchParams] = useSearchParams();
  // Sections with no visible field are skipped; their values stay recorded.
  const sections = useCustomizationStepSections(stepId).filter((section) =>
    section.fields.some(({ field }) => field.visible),
  );
  const isVesselStyle = useAppSelector(getCountertopStyle)?.trim().toLowerCase() === "vessel";
  const isCompactAccordionViewport = useCompactAccordionViewport();
  // The in-scene menu opens a section through `?accordion=`, as on the countertop step.
  const { value: accordionValue, onValueChange: setAccordionValue } = useSyncedAccordionValue({
    values: sections.map((section) => section.sectionId),
    defaultValue: sections.find((section) => section.defaultOpen)?.sectionId,
    requestedValue: searchParams.get("accordion"),
    requestKey: locationKey,
    collapseByDefault: isCompactAccordionViewport && sections.length > 1,
  });

  return (
    <>
      {sections.flatMap(({ sectionId, fields }) =>
        fields
          .filter(({ definition }) => definition.autoSelect)
          .map(({ definition, field }) => (
            <FieldAutoSelect key={`${sectionId}:${definition.attributeId}`} definition={definition} field={field} />
          )),
      )}
      <ConfiguratorAccordionGroup
        defaultValue={sections.find((section) => section.defaultOpen)?.sectionId}
        value={accordionValue}
        onValueChange={setAccordionValue}
      >
        {sections.map(({ sectionId, label: sectionLabel, labelWhenVessel, fieldTabs, fields }) => {
          const label = isVesselStyle ? (labelWhenVessel ?? sectionLabel) : sectionLabel;
          const visibleFields = fields.filter(({ field }) => field.visible);

          return (
            <ConfiguratorAccordionItem key={sectionId} value={sectionId} title={label}>
              {/* One field left needs no tabs: it is shown as the field of any section. */}
              {fieldTabs && visibleFields.length > 1 ? (
                <SectionFieldTabs section={{ sectionId, label }} caption={fieldTabs.label} fields={visibleFields} />
              ) : (
                <FieldStack>
                  {visibleFields.map(({ definition, field }) => (
                    <SectionField
                      key={definition.attributeId}
                      definition={definition}
                      field={field}
                      section={{ sectionId, label }}
                    />
                  ))}
                </FieldStack>
              )}
            </ConfiguratorAccordionItem>
          );
        })}
      </ConfiguratorAccordionGroup>
    </>
  );
};
