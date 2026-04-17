import { useEffect, useRef } from "react";

import { useAppSelector } from "@/shared/hooks/store/redux";
import {
  getSelectedProducts,
  getSelectedDimensions,
  getSidePanelsOption,
  getSidePanelLeftStatus,
  getSidePanelRightStatus,
} from "@/entities/product/model/store/selectors";
import { getIsHistoryRestoring } from "@/entities/history/model/store/selectors";
import { computeAndShowFullDimensions } from "@/utils/functions/playcanvas/refreshFullDimensions";

const DEBOUNCE_MS = 400;

export function useFullDimensionsRefresh(isEnabled: boolean, onEmptyScene?: () => void) {
  const productIds = useAppSelector(getSelectedProducts);
  const selectedDimensions = useAppSelector(getSelectedDimensions);
  const isRestoring = useAppSelector(getIsHistoryRestoring);
  const sidePanelsOption = useAppSelector(getSidePanelsOption);
  const sidePanelLeft = useAppSelector(getSidePanelLeftStatus);
  const sidePanelRight = useAppSelector(getSidePanelRightStatus);

  const generationRef = useRef(0);
  const onEmptySceneRef = useRef(onEmptyScene);
  onEmptySceneRef.current = onEmptyScene;

  useEffect(() => {
    if (!isEnabled || isRestoring) return;

    const timer = setTimeout(async () => {
      const gen = ++generationRef.current;

      const didShow = await computeAndShowFullDimensions();

      if (gen !== generationRef.current) return;

      if (!didShow) {
        onEmptySceneRef.current?.();
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [isEnabled, isRestoring, productIds, selectedDimensions, sidePanelsOption, sidePanelLeft, sidePanelRight]);
}
