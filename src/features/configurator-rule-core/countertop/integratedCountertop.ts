import type { RootState } from "@/app/store";
import { normalizeOptionValue, selectDefaultValue } from "@/entities/collection";
import type { CabinetEntry } from "@/entities/configuration";
import {
  getActiveProductProfile,
  getAttributeValue,
  getCabinetEntries,
  getDimensionsByCabinet,
  isSinkBase,
} from "@/entities/configuration/model/store/selectors";
import { isUnavailableWithIntegrated } from "@/shared/config/configurator/typeCabinetCatalog";

import { findPlacedCabinetRule } from "../cabinetBuilder/lib/placedCabinetRule";

/** Why an integrated countertop takes the Sink Bases it leaves out to other drawers. */
export const INTEGRATED_DRAWERS_REASON = "countertop.integratedDrawers";

export type SinkBaseUnavailableWithIntegrated = {
  cabinet: CabinetEntry;
  /** Its cabinet type, drawers and width, as the rule judged them. */
  cabinetType: string;
  drawers: string;
  widthCm: number;
  /** The drawers of its own style group an integrated countertop takes instead, or null where it offers none. */
  integratedDrawers: string | null;
};

/** What a change brings in place of each Sink Base's own drawers or width. */
type JudgedSinkBases = {
  /** The Sink Bases to judge: every placed one by default. */
  sinkBases?: readonly CabinetEntry[];
  drawers?: string;
  widthCm?: number;
};

/**
 * The placed Sink Bases an integrated countertop leaves out (`unavailableWithIntegrated`; Tricot table
 * 592 `60:1DWID`: 60 cm with an inner drawer), each with the drawers of its own group (`drawerStyleGroups`)
 * it takes instead: 1 Drawer for an inner drawer. Only a collection that judges its countertop by the
 * matrix (`ruleData.countertopCompatibility`) leaves any out.
 */
export const selectSinkBasesUnavailableWithIntegrated = (
  state: RootState,
  {
    sinkBases = getCabinetEntries(state).filter((c) => isSinkBase(state, c.runtimeId)),
    drawers,
    widthCm,
  }: JudgedSinkBases = {},
): SinkBaseUnavailableWithIntegrated[] => {
  const profile = getActiveProductProfile(state);
  if (!profile?.ruleData.countertopCompatibility) return [];

  const { cabinetCatalog, placedCabinetStyles } = state.rootStateUI.product;
  const dimensions = getDimensionsByCabinet(state);

  return sinkBases.flatMap((cabinet) => {
    const rule = findPlacedCabinetRule(cabinetCatalog, cabinet.runtimeId);
    const width = widthCm ?? dimensions[cabinet.stableKey]?.width;
    const raw =
      drawers ??
      String(
        getAttributeValue(state, "Drawers", { scope: "cabinet", cabinetId: cabinet.stableKey }) ??
          placedCabinetStyles[cabinet.runtimeId] ??
          selectDefaultValue(profile, "Drawers"),
      );
    const own = normalizeOptionValue(profile, "Drawers", raw) ?? raw;
    if (!rule || typeof width !== "number" || !isUnavailableWithIntegrated(rule, width, own)) return [];

    const integratedDrawers =
      profile.ruleData.drawerStyleGroups
        ?.find((group) => group.includes(own))
        ?.find(
          (other) => other !== own && rule.drawers.includes(other) && !isUnavailableWithIntegrated(rule, width, other),
        ) ?? null;

    return [{ cabinet, cabinetType: rule.code, drawers: own, widthCm: width, integratedDrawers }];
  });
};
