import { useCallback, useEffect, useRef } from "react";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/store/redux";
import { getSidePanelsOption, getSidePanelLeftStatus, getSidePanelRightStatus } from "../model/selectors";
import { enforceSidePanelEligibility } from "../lib/sidePanelEnforce";

/**
 * Hook that manages SP enforce lifecycle:
 * - Provides refs for stale-closure-safe access to SP state
 * - Auto-enforces when cabinet count changes (300ms debounce)
 * - Exposes `enforce` for manual calls (e.g. after swap)
 */
export function useSidePanelEnforce(productIdsLength: number) {
  const dispatch = useAppDispatch();
  const spGroove = useAppSelector(getSidePanelsOption);
  const spLeft = useAppSelector(getSidePanelLeftStatus);
  const spRight = useAppSelector(getSidePanelRightStatus);

  const spGrooveRef = useRef(spGroove);
  const spLeftRef = useRef(spLeft);
  const spRightRef = useRef(spRight);
  spGrooveRef.current = spGroove;
  spLeftRef.current = spLeft;
  spRightRef.current = spRight;

  const enforce = useCallback(async () => {
    await enforceSidePanelEligibility(
      dispatch,
      spGrooveRef.current || "",
      spLeftRef.current || "none",
      spRightRef.current || "none",
      productIdsLength,
    );
  }, [dispatch, productIdsLength]);

  const lengthRef = useRef(productIdsLength);
  useEffect(() => {
    if (productIdsLength === lengthRef.current) return;
    lengthRef.current = productIdsLength;
    const timerId = setTimeout(() => enforce(), 300);
    return () => clearTimeout(timerId);
  }, [productIdsLength, enforce]);

  return { enforce, spGrooveRef, spLeftRef, spRightRef };
}
