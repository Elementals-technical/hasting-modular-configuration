import { useActiveCollection } from "@/entities/collection";
import { useAttributeChangeHandler } from "@/features/configurationCommands";
import {
  FieldControl,
  useCustomizationSectionFields,
  type ResolvedCustomizationField,
} from "@/features/collectionCustomization";
import { ConfiguratorAccordionGroup, ConfiguratorAccordionItem } from "@/shared/ui/Accordion/ConfiguratorAccordion";

import s from "./FieldsStepPage.module.scss";

const SectionField = ({ definition, field }: ResolvedCustomizationField) => {
  const { onChange, notice } = useAttributeChangeHandler(definition.attributeId);

  return (
    <>
      <FieldControl control={definition.control} field={field} onChange={onChange} />
      {notice && <div className={s.notice}>{notice}</div>}
    </>
  );
};

const SectionFields = ({ sectionId }: { sectionId: string }) => {
  const fields = useCustomizationSectionFields(sectionId);

  return (
    <>
      {fields.map(({ definition, field }) => (
        <SectionField key={definition.attributeId} definition={definition} field={field} />
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
          <SectionFields sectionId={sectionId} />
        </ConfiguratorAccordionItem>
      ))}
    </ConfiguratorAccordionGroup>
  );
};
