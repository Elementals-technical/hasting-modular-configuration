import type { StableCabinetKey } from "@/entities/configuration";
import type { DrawerName } from "@/entities/configuration/model/drawerOrganizers";

/** A drawer of a cabinet. The stable key outlives undo and restore, a runtime id does not. */
export type OrganizerAddress = { cabinetKey: StableCabinetKey; drawer: DrawerName };

/** A column of a drawer: `slot` is the signed 10 cm step from the drawer centre. */
export type ColumnAddress = OrganizerAddress & { slot: number };

export type OrganizerDrawerKey = `${StableCabinetKey}:${DrawerName}`;

export const organizerDrawerKey = (address: OrganizerAddress): OrganizerDrawerKey =>
  `${address.cabinetKey}:${address.drawer}`;

export type PanelMode = "closed" | "presets" | "editor";
