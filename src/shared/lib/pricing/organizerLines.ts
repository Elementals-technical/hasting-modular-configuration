import type { CabinetEntry, StableCabinetKey } from "@/entities/configuration";
import type {
  DrawerName,
  DrawerOrganizersRead,
  OrganizerColumn,
} from "@/entities/configuration/model/drawerOrganizers";

import type { PricingGap, PricingLine } from "./types";

/**
 * Order lines of the Ph2 drawer organizers (concept §6.4). One line per drawer; its quantity is the number
 * of columns, each a ROW-MTL-43 tray. The read-model already holds what 3D normalised, so nothing here
 * knows widths, locked zones or profiles.
 */

export type OrganizerPricingPolicy = {
  /** SKU of one column by organizer style (`sku-profile.dividers`); a style without one is not priced. */
  skuByStyle: Readonly<Record<string, string>>;
  /** Whether a column with no inserts (Empty) is billed. */
  billEmptyColumns: boolean;
};

/** Not confirmed with the client (Q-K2): an Empty column is billed until the answer comes. */
export const ORGANIZER_BILL_EMPTY_COLUMNS = true;

const DRAWERS: readonly DrawerName[] = ["Top", "Bot"];

const UNREADABLE_GAP: PricingGap = {
  group: "divider",
  blocksTotal: true,
  owner: "input",
  reason: "The drawer organizers of this cabinet cannot be read (saved by a newer version or damaged).",
};

const noSkuGap = (style: string): PricingGap => ({
  group: "divider",
  blocksTotal: true,
  owner: "product",
  reason: `No SKU for ${style} drawer organizers in this collection.`,
});

/** Ends in the drawer name, so it never equals a USH divider line (`divider:<cabinet>:<index>`). */
export const organizerLineId = (stableKey: StableCabinetKey, drawer: DrawerName) => `divider:${stableKey}:${drawer}`;

// The pattern of `organizerLineId` above: change one, change the other (a round-trip test holds them together).
const ORGANIZER_LINE_ID = /^divider:(.+):(Top|Bot)$/;

/**
 * The cabinet and the drawer an organizer line id names (the reverse of `organizerLineId`), or null for any
 * other id: a USH divider line ends in a slot index. The drawer is what follows the last colon, so a stable
 * key that holds a colon still reads back whole (today's keys are `cab-<n>` and have none).
 * Example: `parseOrganizerLineId("divider:cab-3:Bot")` → `{ stableKey: "cab-3", drawer: "Bot" }`.
 */
export const parseOrganizerLineId = (id: string): { stableKey: StableCabinetKey; drawer: DrawerName } | null => {
  const match = ORGANIZER_LINE_ID.exec(id);
  if (!match) return null;

  return { stableKey: match[1], drawer: match[2] as DrawerName };
};

const billedColumns = (columns: readonly OrganizerColumn[], billEmptyColumns: boolean) =>
  billEmptyColumns ? columns.length : columns.filter(({ positions }) => positions.length > 0).length;

/**
 * Lines and gaps for the organizers of the cabinets, cabinets by `index`, a cabinet's drawers Top then Bot.
 * A cabinet without organizers adds nothing. One that cannot be read (a newer version, damaged data) adds one
 * blocking gap and is never priced as empty. A style without a SKU adds no line, one blocking gap per style.
 */
export const buildOrganizerLines = (
  readModel: Readonly<Record<StableCabinetKey, DrawerOrganizersRead>>,
  cabinets: readonly CabinetEntry[],
  policy: OrganizerPricingPolicy,
): { lines: PricingLine[]; gaps: PricingGap[] } => {
  const lines: PricingLine[] = [];
  const gaps: PricingGap[] = [];
  const stylesWithoutSku = new Set<string>();
  let unreadableNamed = false;

  for (const cabinet of [...cabinets].sort((a, b) => a.index - b.index)) {
    const read = readModel[cabinet.stableKey];
    if (read === undefined || read.status === "absent") continue;

    if (read.status !== "ok") {
      if (!unreadableNamed) gaps.push(UNREADABLE_GAP);
      unreadableNamed = true;
      continue;
    }

    for (const drawer of DRAWERS) {
      const set = read.value[drawer];
      if (set === undefined) continue;

      const quantity = billedColumns(set.columns, policy.billEmptyColumns);
      if (quantity === 0) continue;

      const sku = policy.skuByStyle[set.style];
      if (!sku) {
        if (!stylesWithoutSku.has(set.style)) gaps.push(noSkuGap(set.style));
        stylesWithoutSku.add(set.style);
        continue;
      }

      lines.push({
        id: organizerLineId(cabinet.stableKey, drawer),
        group: "divider",
        sku,
        quantity,
        sourceId: cabinet.runtimeId,
      });
    }
  }

  return { lines, gaps };
};
