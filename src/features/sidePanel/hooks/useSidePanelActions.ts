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
      (groove: GrooveType, side: "left" | "right" | "both") => applyGroove(dispatch, groove, side),
      [dispatch],
    ),

    deleteSide: useCallback(
      (side: SidePanelSide) => deleteSide(dispatch, side),
      [dispatch],
    ),

    autoRemoveSide: useCallback(
      (side: SidePanelSide) => autoRemoveSide(dispatch, side),
      [dispatch],
    ),

    autoRestoreSide: useCallback(
      (side: SidePanelSide, groove: GrooveType) => autoRestoreSide(dispatch, side, groove),
      [dispatch],
    ),

    bootBothSides: useCallback(
      (groove: GrooveType) => bootBothSides(dispatch, groove),
      [dispatch],
    ),

    autoRemoveBoth: useCallback(
      () => autoRemoveBoth(dispatch),
      [dispatch],
    ),
  };
}
