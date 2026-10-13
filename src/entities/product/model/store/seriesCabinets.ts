import { createSelector } from "@reduxjs/toolkit";

import type { RootState } from "@/app/store";
import { getCabinetEntries, getValuesByAttributeId } from "@/entities/configuration";
import { findPlacedCabinetRule, heightsOfDrawerStyle } from "@/features/configurator-rule-core/cabinetBuilder";
import {
  findCabinetRule,
  SERIES_ATTRIBUTE_ID,
  type TypeCabinetRuleConfig,
} from "@/shared/config/configurator/typeCabinetCatalog";

/**
 * The placed cabinets another series supplies (an Urban Standard Height side cabinet in an Urban
 * Duplex composition). The state holds the series of a cabinet at the cabinet; the rule of its
 * series says which widths, drawer styles and heights it comes in.
 */
export type PlacedSeriesCabinet = {
  runtimeId: string;
  /** The rule of the cabinet's type as its series supplies it. */
  rule: TypeCabinetRuleConfig;
  drawers: string | null;
};

const NO_CABINETS: PlacedSeriesCabinet[] = [];

export const selectPlacedSeriesCabinets = createSelector(
  [
    (state: RootState) => state.rootStateUI.product.cabinetCatalog,
    (state: RootState) => state.rootStateUI.product.placedCabinetStyles,
    getCabinetEntries,
    (state: RootState) => getValuesByAttributeId(state)[SERIES_ATTRIBUTE_ID],
  ],
  (catalog, placedCabinetStyles, cabinets, recorded): PlacedSeriesCabinet[] => {
    if (!recorded?.length) return NO_CABINETS;

    const placed = cabinets.flatMap(({ runtimeId, stableKey }): PlacedSeriesCabinet[] => {
      const series = recorded.find(({ target }) => target.scope === "cabinet" && target.cabinetId === stableKey)?.value;
      if (typeof series !== "string") return [];

      const rule = findCabinetRule(catalog, findPlacedCabinetRule(catalog, runtimeId)?.code, series);
      return rule?.series ? [{ runtimeId, rule, drawers: placedCabinetStyles[runtimeId] ?? null }] : [];
    });

    return placed.length > 0 ? placed : NO_CABINETS;
  },
);

/**
 * The heights the composition may take with the cabinets of other series it holds: those each
 * of them comes in with its drawers. Null while it holds none, and the collection's own rules
 * decide alone.
 */
export const selectPlacedSeriesHeights = createSelector([selectPlacedSeriesCabinets], (placed): number[] | null => {
  if (placed.length === 0) return null;

  const lists = placed.map(
    ({ rule, drawers }) => (drawers ? heightsOfDrawerStyle(rule, drawers) : null) ?? rule.heights,
  );
  return lists[0].filter((height) => lists.every((heights) => heights.includes(height)));
});
