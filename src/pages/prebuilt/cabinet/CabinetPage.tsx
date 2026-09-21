import { useMemo } from "react";

import { getActiveProductProfile } from "@/entities/configuration/model/store/selectors";
import { selectBookMatchingState, selectFlutingState } from "@/entities/product/model/store/derivedSelectors";
import {
  getCabinetColorMaterial,
  getProductsPresets,
  getSelectedSceneProduct,
} from "@/entities/product/model/store/selectors";
import { flutingRule } from "@/features/configurator-rule-core/options";
import { useAppSelector } from "@/shared/hooks/store/redux";
import { ConfiguratorAccordionGroup, ConfiguratorAccordionItem } from "@/shared/ui/Accordion/ConfiguratorAccordion";
import { useCabinetColorSections } from "@/widgets";

export const CabinetPage = () => {
  const activeProfile = useAppSelector(getActiveProductProfile);
  const presetsProducts = useAppSelector(getProductsPresets);
  const cabinetMaterial = useAppSelector(getCabinetColorMaterial);
  const selectedSceneProduct = useAppSelector(getSelectedSceneProduct);
  const bookMatchingState = useAppSelector(selectBookMatchingState);
  const selectorFlutingState = useAppSelector(selectFlutingState);

  const flutingState = useMemo(() => {
    if (selectorFlutingState.available) return selectorFlutingState;

    // Trust the selector when user already clicked a cabinet in the scene
    if (selectedSceneProduct) return selectorFlutingState;

    // Fall back to presets for drawer info (same pattern as AccessoriesPage)
    const firstPreset = presetsProducts[0];
    if (!firstPreset) return selectorFlutingState;

    return flutingRule(
      {
        targetPart: "CABINET",
        material: cabinetMaterial,
      },
      activeProfile,
    );
  }, [selectorFlutingState, selectedSceneProduct, presetsProducts, cabinetMaterial, activeProfile]);

  const accordions = useCabinetColorSections({ stepId: "cabinet", flow: "prebuilt", flutingState, bookMatchingState });

  return (
    <ConfiguratorAccordionGroup
      defaultValue={accordions.find((section) => section.defaultOpen)?.sectionId}
      collapseDefaultOnCompact
    >
      {accordions.map(({ sectionId, label, content }) => (
        <ConfiguratorAccordionItem key={sectionId} value={sectionId} title={label}>
          {content}
        </ConfiguratorAccordionItem>
      ))}
    </ConfiguratorAccordionGroup>
  );
};
