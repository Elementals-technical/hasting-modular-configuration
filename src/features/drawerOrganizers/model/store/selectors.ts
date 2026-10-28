import { createSelector } from "@reduxjs/toolkit";

import type { RootState } from "@/app/store";
import {
  getActiveProductProfile,
  getCabinetEntries,
  getDimensionsByCabinet,
  getOrganizersByCabinet,
} from "@/entities/configuration/model/store/selectors";
import type { OrganizerSet } from "@/entities/configuration/model/drawerOrganizers";
import { getDividersOption, getPlacedCabinetStyles } from "@/entities/product/model/store/selectors";

import { readOrganizerRules } from "../rules";
import type { OrganizerAddress } from "../types";

import type { DrawerOrganizersUiState } from "./slice";

/** The organizer rules of the active collection (one object per profile), or null without the feature. */
export const selectOrganizerRules = createSelector([getActiveProductProfile], (profile) => readOrganizerRules(profile));

/** The one gate of the feature: the collection declares `ruleData.drawerOrganizers`. */
export const selectOrganizersEnabled = (state: RootState): boolean => selectOrganizerRules(state) !== null;

export const selectOrganizersUi = (state: RootState): DrawerOrganizersUiState => state.rootStateUI.drawerOrganizersUi;

/**
 * For each placed cabinet (by runtime id), one compact string of what decides the capacity of its drawers in
 * the scene: `<Width>|<Height>|<Drawers>`, e.g. `{ "rt-1": "60|52|2D" }`. A part nobody has recorded yet is
 * empty. Width and Height are the sizes read back from the scene (`dimensionsByCabinet`), Drawers is the
 * cabinet's drawer style. InnerDrawer is not a value of its own in the UI: Class sets it only through the
 * Drawers token (`1DWID` = inner drawer on), so the style covers it. The object is rebuilt when any cabinet's
 * input changes; `useOrganizerRuntime` compares the strings per cabinet and reads a product again from the
 * scene only when its own string differs from the one it read last.
 */
export const selectOrganizerInputKeys = createSelector(
  [getCabinetEntries, getDimensionsByCabinet, getPlacedCabinetStyles],
  (cabinets, dimensionsByCabinet, drawersByRuntimeId): Record<string, string> =>
    Object.fromEntries(
      cabinets.map(({ runtimeId, stableKey }) => {
        const size = dimensionsByCabinet[stableKey];
        return [runtimeId, `${size?.width ?? ""}|${size?.height ?? ""}|${drawersByRuntimeId[runtimeId] ?? ""}`];
      }),
    ),
);

/** The set of a drawer as the scene holds it, or null when it has no columns (or cannot be read). */
export const selectOrganizerSet = (state: RootState, address: OrganizerAddress): OrganizerSet | null => {
  const entry = getOrganizersByCabinet(state)[address.cabinetKey];
  return entry?.status === "ok" ? (entry.value[address.drawer] ?? null) : null;
};

/** The set of the drawer in view, or null when no drawer is in view or it has no columns. */
export const selectViewSet = (state: RootState): OrganizerSet | null => {
  const { view } = selectOrganizersUi(state);
  return view ? selectOrganizerSet(state, view) : null;
};

/** Columns of a drawer (by default the one in view). */
export const selectColumnCount = (state: RootState, address?: OrganizerAddress): number => {
  const target = address ?? selectOrganizersUi(state).view;
  return target ? (selectOrganizerSet(state, target)?.columns.length ?? 0) : 0;
};

/** Whether any placed cabinet holds organizer columns (a stored set always has at least one). */
export const selectHasOrganizerColumns = (state: RootState): boolean =>
  Object.values(getOrganizersByCabinet(state)).some((entry) => entry.status === "ok");

/**
 * The Drawer Dividers option as the page shows it: Customize while the scene holds columns (after a
 * restore too, concept §3.4), otherwise the stored option. Derived, never written back.
 */
export const selectEffectiveDividersOption = (state: RootState) =>
  selectHasOrganizerColumns(state) ? "Customize" : getDividersOption(state);

/** Mobile M1: the 3D view grows while the panel is open. */
export const selectOrganizerFocus = (state: RootState): boolean => {
  const { panel, layout } = selectOrganizersUi(state);
  return panel !== "closed" && layout === "m1";
};
