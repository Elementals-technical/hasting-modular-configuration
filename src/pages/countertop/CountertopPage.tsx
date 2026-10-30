import { useLocation, useSearchParams } from "react-router-dom";

import { useCollectionNavigation } from "@/features/collectionCustomization";
import { ConfiguratorAccordionGroup, ConfiguratorAccordionItem } from "@/shared/ui/Accordion/ConfiguratorAccordion";
import { useCompactAccordionViewport } from "@/shared/ui/Accordion/useCompactAccordionViewport";
import { useSyncedAccordionValue } from "@/shared/ui/Accordion/useSyncedAccordionValue";
import { useCountertopSections } from "@/widgets";

/** The countertop step of both flows; the quick editor opens a section through `?accordion=`. */
export const CountertopPage = ({ stepId }: { stepId: string }) => {
  const { key: locationKey } = useLocation();
  const [searchParams] = useSearchParams();
  const flow = useCollectionNavigation()?.flowId ?? "prebuilt";
  const accordions = useCountertopSections({ stepId, flow });
  const defaultValue = accordions.find((section) => section.defaultOpen)?.sectionId;
  const isCompactAccordionViewport = useCompactAccordionViewport();
  const { value: accordionValue, onValueChange: setAccordionValue } = useSyncedAccordionValue({
    values: accordions.map((section) => section.sectionId),
    defaultValue,
    requestedValue: searchParams.get("accordion"),
    requestKey: locationKey,
    collapseByDefault: isCompactAccordionViewport && accordions.length > 1,
  });

  return (
    <ConfiguratorAccordionGroup defaultValue={defaultValue} value={accordionValue} onValueChange={setAccordionValue}>
      {accordions.map(({ sectionId, label, content }) => (
        <ConfiguratorAccordionItem key={sectionId} value={sectionId} title={label}>
          {content}
        </ConfiguratorAccordionItem>
      ))}
    </ConfiguratorAccordionGroup>
  );
};
