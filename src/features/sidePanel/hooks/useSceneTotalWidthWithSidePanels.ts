import { useAppSelector } from "@/shared/hooks/store/redux";
import { useSceneTotalWidth } from "@/shared/hooks/useSceneTotalWidth";
import { calcTotalCountertopWidthCm } from "@/entities/countertop/lib/calcCountertopWidth";

import { getSidePanelLeftStatus, getSidePanelRightStatus } from "../model/selectors";

export const useSceneTotalWidthWithSidePanels = (
  productIds: string[],
  fallbackWidth: number | null = null,
): number | null => {
  const cabinetSum = useSceneTotalWidth(productIds, fallbackWidth);
  const left = useAppSelector(getSidePanelLeftStatus);
  const right = useAppSelector(getSidePanelRightStatus);
  if (cabinetSum === null) return null;
  return calcTotalCountertopWidthCm(cabinetSum, left, right);
};
