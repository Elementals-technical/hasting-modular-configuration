import { useMemo } from "react";

import { useActiveCollection } from "@/entities/collection";
import { readOrganizerRules } from "@/features/drawerOrganizers/model/rules";
import { ConfiguratorAccordionGroup, ConfiguratorAccordionItem } from "@/shared/ui/Accordion/ConfiguratorAccordion";
import { useAccessoriesSections } from "@/widgets";
import { useOrganizerAccessoriesSections } from "@/widgets/AccessoriesSections/ui/OrganizerAccessories";

/** The accessories step of both flows. */
export const AccessoriesPage = ({ stepId }: { stepId: string }) => {
  // The gate is worked out from the collection this page already has, not read from the store: the store gets
  // the profile in an effect after the first render, so on a cold load straight onto this step it would still
  // say "no organizers" and the first commit would start the scene's drawer buttons for a moment.
  const profile = useActiveCollection((collection) => collection.catalog.productProfile ?? null);
  const organizersEnabled = useMemo(() => readOrganizerRules(profile) !== null, [profile]);
  // A new collection starts the page over: its sections, its default open section and what the hooks hold.
  const collectionId = useActiveCollection((collection) => collection.id);

  return organizersEnabled ? (
    <OrganizerAccessoriesPage key={collectionId} stepId={stepId} />
  ) : (
    <LegacyAccessoriesPage key={collectionId} stepId={stepId} />
  );
};

// Two thin components instead of one with a ternary: the two kinds of page take their sections from different
// hooks, and a hook cannot be called conditionally (rules of hooks). Each one calls its own hook and hands the
// result to the same accordion.

/** USH and every collection without Ph2 organizers: the scene's own drawer buttons. */
const LegacyAccessoriesPage = ({ stepId }: { stepId: string }) => {
  const sections = useAccessoriesSections(stepId);
  return <AccessoriesAccordions {...sections} />;
};

/** Class, Mako, Lame: the organizers' sections; the scene's drawer buttons are not started. */
const OrganizerAccessoriesPage = ({ stepId }: { stepId: string }) => {
  const sections = useOrganizerAccessoriesSections(stepId);
  return <AccessoriesAccordions {...sections} />;
};

/** What both hooks return: the sections, what to do when one opens, and the Side Panels confirmation. */
type AccessoriesAccordionsProps = ReturnType<typeof useAccessoriesSections>;

const AccessoriesAccordions = ({ accordions, onSectionChange, sidePanelSyncModal }: AccessoriesAccordionsProps) => (
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
