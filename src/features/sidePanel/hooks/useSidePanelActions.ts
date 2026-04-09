import { useCallback } from "react";
import { useAppDispatch } from "@/shared/hooks/store/redux";
import {
  applyGroove,
  deleteSide,
  autoRemoveSide,
  autoRestoreSide,
  bootBothSides,
  autoRemoveBoth,
  type SidePanelSide,
  type GrooveType,
} from "../lib/sidePanelService";

/**
 * Hook that provides side panel actions bound to dispatch.
 * Use in React components instead of calling service functions directly.
 */
export function useSidePanelActions() {
  const dispatch = useAppDispatch();

  return {
    applyGroove: useCallback(
      (groove: GrooveType, side: "left" | "right" | "both", cabinetCount?: number) => applyGroove(dispatch, groove, side, cabinetCount),
      [dispatch],
    ),

    deleteSide: useCallback(
      (side: SidePanelSide, cabinetCount?: number) => deleteSide(dispatch, side, cabinetCount),
      [dispatch],
    ),

    autoRemoveSide: useCallback(
      (side: SidePanelSide, cabinetCount?: number) => autoRemoveSide(dispatch, side, cabinetCount),
      [dispatch],
    ),

    autoRestoreSide: useCallback(
      (side: SidePanelSide, groove: GrooveType, cabinetCount?: number) => autoRestoreSide(dispatch, side, groove, cabinetCount),
      [dispatch],
    ),

    bootBothSides: useCallback(
      (groove: GrooveType, cabinetCount?: number) => bootBothSides(dispatch, groove, cabinetCount),
      [dispatch],
    ),

    autoRemoveBoth: useCallback(
      (cabinetCount?: number) => autoRemoveBoth(dispatch, cabinetCount),
      [dispatch],
    ),
  };
}
