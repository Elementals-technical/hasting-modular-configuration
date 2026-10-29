import type { CabinetEntry, StableCabinetKey } from "@/entities/configuration";
import type { DrawerName, DrawerOrganizersRead } from "@/entities/configuration/model/drawerOrganizers";

import { parseOrganizerLineId } from "./organizerLines";
import type { PricingLine } from "./types";

/**
 * Summary items of the Ph2 drawer organizers: one per priced drawer line. The item carries its line and not a
 * price; the page prices it as `priceOfLines([line], line.quantity)`.
 */
export type OrganizerSummaryItem = {
  id: string;
  title: "Drawer Organizer";
  subtitle: string;
  sku: string;
  copyable: true;
  showInfo: true;
  description: Record<string, string>;
  lineIds: [string];
  line: PricingLine;
};

const DRAWER_WORDS: Record<DrawerName, { subtitle: string; description: string }> = {
  Top: { subtitle: "Top drawer", description: "Top" },
  Bot: { subtitle: "Bottom drawer", description: "Bottom" },
};

/** The size of one column's tray (ROW-MTL-43). */
const TRAY_SIZE = { Width: "3.9″", Height: "2″", Depth: "16.9″" };

type ShownLine = { line: PricingLine; stableKey: StableCabinetKey; drawer: DrawerName; style: string };

export const buildOrganizerSummaryItems = ({
  lines,
  readModel,
  cabinets,
  labelOf,
}: {
  lines: readonly PricingLine[];
  readModel: Readonly<Record<StableCabinetKey, DrawerOrganizersRead>>;
  cabinets: readonly CabinetEntry[];
  labelOf: (attributeId: string, value: string) => string | null;
}): OrganizerSummaryItem[] => {
  // Only the lines of a drawer that has a set in the read-model (the divider lines of USH are not organizer lines).
  const shown = lines.flatMap<ShownLine>((line) => {
    const address = line.group === "divider" ? parseOrganizerLineId(line.id) : null;
    if (!address) return [];

    const { stableKey, drawer } = address;
    const read = readModel[stableKey];
    const set = read?.status === "ok" ? read.value[drawer] : undefined;
    return set ? [{ line, stableKey, drawer, style: set.style }] : [];
  });

  const severalCabinets = new Set(shown.map(({ stableKey }) => stableKey)).size > 1;

  return shown.map(({ line, stableKey, drawer, style }) => {
    const material = labelOf("DividersStyle", style) ?? style;
    const cabinet = cabinets.find((entry) => entry.stableKey === stableKey);
    const cabinetNumber = severalCabinets && cabinet ? ` · Cabinet ${cabinet.index + 1}` : "";

    return {
      id: `accessories-organizer-${stableKey}-${drawer}`,
      title: "Drawer Organizer",
      subtitle: `${material} × ${line.quantity} · ${DRAWER_WORDS[drawer].subtitle}${cabinetNumber}`,
      sku: line.sku,
      copyable: true,
      showInfo: true,
      description: {
        "Product Category": "Drawer Organizer",
        Material: material,
        Columns: String(line.quantity),
        Drawer: DRAWER_WORDS[drawer].description,
        ...TRAY_SIZE,
      },
      lineIds: [line.id],
      line,
    };
  });
};
