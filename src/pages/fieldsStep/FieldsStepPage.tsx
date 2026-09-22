import { useActiveCollection } from "@/entities/collection";
import { getActiveProductProfile } from "@/entities/configuration";
import { selectConfiguratorSection, useAttributeChangeHandler } from "@/features/configurationCommands";
import {
  ColorField,
  FieldControl,
  useCollectionNavigation,
  useCustomizationSectionFields,
  type ResolvedCustomizationField,
} from "@/features/collectionCustomization";
import { openSwatchOrder } from "@/features/swatchOrder";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/store/redux";
import { trackModularOrderFreeSwatchesClick } from "@/shared/lib/analytics/modularKeyEvents";
import { ConfiguratorAccordionGroup, ConfiguratorAccordionItem } from "@/shared/ui/Accordion/ConfiguratorAccordion";

import s from "./FieldsStepPage.module.scss";

type SectionRef = { sectionId: string; label: string };

type SectionFieldProps = ResolvedCustomizationField & { section: SectionRef };

/** A colour field as the Urban colour screens show it: its pictures, filters, full mode and swatch order. */
const ColorSectionField = ({
  definition,
  field,
  section,
  onChange,
}: SectionFieldProps & { onChange: (value: string) => void }) => {
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

  return <ColorField field={field} title={section.label} onChange={onChange} onOrderSwatches={orderSwatches} />;
};

const SectionField = (props: SectionFieldProps) => {
  const { definition, field } = props;
  const { onChange, notice } = useAttributeChangeHandler(definition.attributeId);

  return (
    <>
      {definition.control === "colors" ? (
        <ColorSectionField {...props} onChange={onChange} />
      ) : (
        <FieldControl control={definition.control} field={field} onChange={onChange} />
      )}
      {notice && <div className={s.notice}>{notice}</div>}
    </>
  );
};

const SectionFields = ({ section }: { section: SectionRef }) => {
  const fields = useCustomizationSectionFields(section.sectionId);

  return (
    <>
      {fields.map(({ definition, field }) => (
        <SectionField key={definition.attributeId} definition={definition} field={field} section={section} />
      ))}
    </>
  );
};

export const FieldsStepPage = ({ stepId }: { stepId: string }) => {
  const schema = useActiveCollection((collection) => collection.catalog.customization);
  const sectionIds = schema?.steps[stepId]?.sectionIds ?? [];
  const sections = sectionIds.flatMap((sectionId) => {
    const section = schema?.sections[sectionId];
    return section ? [{ sectionId, ...section }] : [];
  });

  return (
    <ConfiguratorAccordionGroup
      defaultValue={sections.find((section) => section.defaultOpen)?.sectionId}
      collapseDefaultOnCompact
    >
      {sections.map(({ sectionId, label }) => (
        <ConfiguratorAccordionItem key={sectionId} value={sectionId} title={label}>
          <SectionFields section={{ sectionId, label }} />
        </ConfiguratorAccordionItem>
      ))}
    </ConfiguratorAccordionGroup>
  );
};
