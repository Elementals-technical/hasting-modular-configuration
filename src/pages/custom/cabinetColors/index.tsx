import { useLocation, useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";

import { getActiveProductProfile } from "@/entities/configuration/model/store/selectors";
import { selectBookMatchingState, selectFlutingState } from "@/entities/product/model/store/derivedSelectors";
import {
  getGrainDirection,
  getPlacedCabinetStyles,
  getSelectedProducts,
} from "@/entities/product/model/store/selectors";
import { useAppSelector } from "@/shared/hooks/store/redux";
import { usePlayCanvasReady } from "@/shared/hooks/usePlayCanvasReady";
import { deriveBookMatchingAvailability } from "@/shared/lib/bookMatching";
import { ConfiguratorAccordionGroup, ConfiguratorAccordionItem } from "@/shared/ui/Accordion/ConfiguratorAccordion";
import { useCompactAccordionViewport } from "@/shared/ui/Accordion/useCompactAccordionViewport";
import { useSyncedAccordionValue } from "@/shared/ui/Accordion/useSyncedAccordionValue";
import { getOrderedProductIds } from "@/utils/functions/playcanvas/getOrderedProductIds";
import { useCabinetColorSections } from "@/widgets";

export const CustomCabinetColorsPage = () => {
  const { key: locationKey } = useLocation();
  const activeProfile = useAppSelector(getActiveProductProfile);
  const selectedProducts = useAppSelector(getSelectedProducts);
  const placedCabinetStyles = useAppSelector(getPlacedCabinetStyles);
  const activeGrainDirection = useAppSelector(getGrainDirection);
  const isPlayCanvasReady = usePlayCanvasReady();
  const selectorBookMatchingState = useAppSelector(selectBookMatchingState);
  const flutingState = useAppSelector(selectFlutingState);
  const [bookMatchingState, setBookMatchingState] = useState(selectorBookMatchingState);

  const accordions = useCabinetColorSections({
    stepId: "cabinet-colors",
    flow: "custom",
    flutingState,
    bookMatchingState,
  });

  useEffect(() => {
    if (!isPlayCanvasReady || selectedProducts.length === 0) {
      setBookMatchingState(selectorBookMatchingState);
      return;
    }

    const orderedProductIds = getOrderedProductIds(selectedProducts);
    const cabinets = (orderedProductIds.length > 0 ? orderedProductIds : selectedProducts).map((productId) => ({
      name: productId,
      drawers: placedCabinetStyles[productId] ?? null,
    }));

    const availability = deriveBookMatchingAvailability({
      grainDirection: activeGrainDirection,
      cabinets,
      profile: activeProfile,
    });

    setBookMatchingState({
      enabled: availability.available,
      reason: availability.reason,
    });
  }, [
    selectorBookMatchingState,
    isPlayCanvasReady,
    selectedProducts,
    activeGrainDirection,
    placedCabinetStyles,
    activeProfile,
  ]);

  const defaultValue = accordions.find((section) => section.defaultOpen)?.sectionId;

  const [searchParams] = useSearchParams();
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
