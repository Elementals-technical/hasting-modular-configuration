import { useCallback } from "react";

import { normalizeOptionValue, selectDefaultValue } from "@/entities/collection";
import { getActiveProductProfile, getCabinetEntries } from "@/entities/configuration";
import { useHistoryStep } from "@/entities/history/lib/useHistoryStep";
import { getActiveCabinetRule, getCountertopStyle } from "@/entities/product/model/store/selectors";
import { useChangeAttribute } from "@/features/configurationCommands";
import { selectSinkBasesUnavailableWithIntegrated } from "@/features/configurator-rule-core/countertop";
import { useAppSelector } from "@/shared/hooks/store/redux";
import { isUnavailableWithIntegrated } from "@/shared/config/configurator/typeCabinetCatalog";

/** A cabinet the integrated countertop leaves out: its type, drawer style and width. */
export type VesselCountertopRequest = { cabinetType: string; drawers: string; widthCm: number };

/**
 * The vessel countertop a cabinet may need. Only a collection that judges its countertop by the matrix
 * (`ruleData.countertopCompatibility`: Tricot) leaves cabinets out of an integrated one, at a width with
 * a drawer style (table 592 `60:1DWID`), as its commands do. The style cards and the width selector ask
 * before choosing such a cabinet to add, a drawer switch before taking a placed one to such a style, the
 * scene's menu before resizing a placed one to such a width, and each switches the countertop once the
 * user approves.
 */
export const useVesselCountertop = () => {
  const profile = useAppSelector(getActiveProductProfile);
  const countertopStyle = useAppSelector(getCountertopStyle);
  const activeCabinetRule = useAppSelector(getActiveCabinetRule);
  const { change, getState } = useChangeAttribute();
  const { run: runStep } = useHistoryStep();

  // The preset entry records the style as the scene names it ("Integrated").
  const isRuledIntegrated =
    Boolean(profile?.ruleData.countertopCompatibility) &&
    normalizeOptionValue(
      profile,
      "CountertopStyle",
      countertopStyle || selectDefaultValue(profile, "CountertopStyle"),
    ) === "integrated";

  /** Whether the cabinet being added, in `drawers` at `widthCm`, needs the vessel countertop. */
  const needsVessel = useCallback(
    (drawers: string | null, widthCm: number | null) =>
      isRuledIntegrated && isUnavailableWithIntegrated(activeCabinetRule, widthCm, drawers),
    [activeCabinetRule, isRuledIntegrated],
  );

  /** What to ask before a placed cabinet is resized to `widthCm` with its drawers: null where none is needed. */
  const resizeRequest = useCallback(
    (runtimeId: string, widthCm: number): VesselCountertopRequest | null => {
      if (!isRuledIntegrated) return null;

      const state = getState();
      const cabinet = getCabinetEntries(state).find((entry) => entry.runtimeId === runtimeId);
      const [leftOut] = cabinet
        ? selectSinkBasesUnavailableWithIntegrated(state, { sinkBases: [cabinet], widthCm })
        : [];
      return leftOut ? { cabinetType: leftOut.cabinetType, drawers: leftOut.drawers, widthCm } : null;
    },
    [getState, isRuledIntegrated],
  );

  /** What to ask before every placed drawer cabinet switches to `drawers`: null where none is needed. */
  const switchRequest = useCallback(
    (drawers: string): VesselCountertopRequest | null => {
      if (!isRuledIntegrated) return null;

      const [leftOut] = selectSinkBasesUnavailableWithIntegrated(getState(), { drawers });
      return leftOut ? { cabinetType: leftOut.cabinetType, drawers: leftOut.drawers, widthCm: leftOut.widthCm } : null;
    },
    [getState, isRuledIntegrated],
  );

  /** The countertop and every Sink Base on it take the vessel cutout, as one undo step. */
  const switchToVessel = useCallback(async (): Promise<boolean> => {
    const switched = await runStep(() =>
      change({ attributeId: "CountertopStyle", value: "vessel", scope: "countertop" }),
    );
    if (switched.status === "applied" || switched.status === "partial") return true;

    console.error("[CabinetBuilder] Failed to switch to a vessel countertop", switched);
    return false;
  }, [change, runStep]);

  return { needsVessel, resizeRequest, switchRequest, switchToVessel };
};
