import { useLocation, useSearchParams } from "react-router-dom";

import { getActiveProductProfile } from "@/entities/configuration";
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

  const orderSwatches = () => {
    const configuratorSection = selectConfiguratorSection(profile, definition.attributeId);

    trackModularOrderFreeSwatchesClick({
      cta_location: section.sectionId.replace(/-/g, "_"),
      configurator_flow: flowId,
      product_element: configuratorSection ?? section.label,
    });
    dispatch(openSwatchOrder(configuratorSection ?? undefined));
  };

  // The countertop rules and price tell a colour two materials list (an MT lacquer, as Tekorlux and as
  // Glass MT) by the SKU of the swatch picked, which the USH countertop step records the same way.
  const select = async (value: string, sku?: string) => {
    const result = await onChange(value);
    if (definition.attributeId === "CountertopColor" && result.status === "applied") {
      dispatch(setCountertopColorSku(sku ?? ""));
    }
  };

  return <ColorField field={field} title={section.label} onChange={select} onOrderSwatches={orderSwatches} />;
};

const SectionField = (props: SectionFieldProps) => {
  const { definition, field } = props;
  const { onChange, notice } = useAttributeChangeHandler(definition.attributeId);

  return (
    <>
      {field.toggle && <FieldToggle toggle={field.toggle} onChange={onChange} />}
      {definition.control === "colors" ? (
        <ColorSectionField {...props} onChange={onChange} />
      ) : (
        <FieldControl control={definition.control} field={field} onChange={onChange} />
      )}
      {field.hint && <p className={s.hint}>{field.hint}</p>}
      {notice && <div className={s.notice}>{notice}</div>}
    </>
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
        {sections.map(({ sectionId, label: sectionLabel, labelWhenVessel, fields }) => {
          const label = isVesselStyle ? (labelWhenVessel ?? sectionLabel) : sectionLabel;

          return (
            <ConfiguratorAccordionItem key={sectionId} value={sectionId} title={label}>
              {fields.map(({ definition, field }) => (
                <SectionField
                  key={definition.attributeId}
                  definition={definition}
                  field={field}
                  section={{ sectionId, label }}
                />
              ))}
            </ConfiguratorAccordionItem>
          );
        })}
      </ConfiguratorAccordionGroup>
    </>
  );
};
