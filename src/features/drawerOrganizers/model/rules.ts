import { selectRuleData } from "@/entities/collection/lib/productProfileSelectors";
import type { ProductProfile } from "@/entities/collection/model/productProfile";
import type { DrawerDerived } from "@/entities/configuration/model/drawerOrganizers";

import { ORGANIZER_PROFILES, type OrganizerProfileTable } from "./presets";

export type OrganizerRules = OrganizerProfileTable & { profileId: string };

/**
 * The organizer rules of the collection, or null when it does not offer Ph2 organizers. This is the one
 * gate of the feature in the UI: `organizersEnabled = readOrganizerRules(profile) !== null` for the page,
 * the layer, the price and the Summary. The table serves the SVG before 3D reports its first state; at run
 * time the limits come from `derived.profile`, and a test compares the two.
 * A profile id the table does not know closes the feature and logs it.
 */
export const readOrganizerRules = (profile: ProductProfile | null): OrganizerRules | null => {
  const id = selectRuleData(profile, "drawerOrganizers")?.profile;
  if (id === undefined) return null;

  if (!Object.hasOwn(ORGANIZER_PROFILES, id)) {
    console.warn("[drawerOrganizers] unknown organizer profile", id);
    return null;
  }

  return { ...ORGANIZER_PROFILES[id], profileId: id };
};

/**
 * Whether the user can edit a drawer: it exists, 3D offers dividers for it, and it has room for a column.
 * The one place for this decision on the UI side; it is the same definition 3D gives a frame entry as
 * `eligible`. `undefined` (the drawer was never read) is not editable.
 * Example: `{ exists: true, offered: true, capacity: 0 }` (full of locks) is not editable, `capacity: 5` is.
 */
export const isDrawerEditable = (derived: DrawerDerived | undefined): boolean =>
  Boolean(derived && derived.exists && derived.offered && derived.capacity > 0);
