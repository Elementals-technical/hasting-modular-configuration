import { ConfiguratorAccordionGroup, ConfiguratorAccordionItem } from "@/shared/ui/Accordion/ConfiguratorAccordion";
import { useAccessoriesSections } from "@/widgets";

/** The accessories step of both flows. */
export const AccessoriesPage = ({ stepId }: { stepId: string }) => {
  const { accordions, onSectionChange, sidePanelSyncModal } = useAccessoriesSections(stepId);

  return (
    <>
      <ConfiguratorAccordionGroup
        defaultValue={accordions.find((section) => section.defaultOpen)?.sectionId}
        onValueChange={onSectionChange}
        collapseDefaultOnCompact
      >
        {accordions.map(({ sectionId, label, content }) => (
          <ConfiguratorAccordionItem key={sectionId} value={sectionId} title={label}>
            {content}
          </ConfiguratorAccordionItem>
        ))}
      </ConfiguratorAccordionGroup>
      {sidePanelSyncModal}
    </>
  );
};
