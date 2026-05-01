import { getConfig } from "../getConfig";
import type { DrawerType } from "./wrapShowTopView";

export type DividerType = "A" | "B" | "C";

type DividerSlot = {
  value?: unknown;
  other?: {
    type?: unknown;
    availableTypes?: unknown;
  };
};

const DIVIDER_TYPES: readonly DividerType[] = ["A", "B", "C"];

const isDividerType = (value: unknown): value is DividerType =>
  typeof value === "string" && DIVIDER_TYPES.some((type) => type === value);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const getSlotAvailableTypes = (slot: DividerSlot): DividerType[] => {
  const availableTypes = Array.isArray(slot.other?.availableTypes) ? slot.other.availableTypes : [];

  return availableTypes.filter(isDividerType);
};

const getAddableDividerSlots = (zones: Record<string, unknown>): DividerSlot[] =>
  Object.values(zones).flatMap((zone) => {
    if (!isRecord(zone)) return [];

    const zoneSlots = zone.slots;
    if (!Array.isArray(zoneSlots)) return [];

    return zoneSlots.filter((slot): slot is DividerSlot => {
      if (!isRecord(slot)) return false;

      const other = isRecord(slot.other) ? slot.other : undefined;
      const slotType = other?.type;

      return slotType === "ghost" || slot.value === "empty";
    });
  });

export const collectAvailableDividerTypesForDrawer = (zones: Record<string, unknown>): Set<DividerType> => {
  const availableTypes = new Set<DividerType>();

  getAddableDividerSlots(zones).forEach((slot) => {
    getSlotAvailableTypes(slot).forEach((type) => availableTypes.add(type));
  });

  return availableTypes;
};

export const getDividerTypeFromOptionTitle = (title: string): DividerType | null => {
  if (title.trim() === "Option A") return "A";
  if (title.trim() === "Option B") return "B";
  if (title.trim() === "Option C") return "C";
  return null;
};

export async function getAvailableDividerTypesForDrawer(
  cabinetId: string,
  drawerType: DrawerType,
): Promise<Set<DividerType> | null> {
  const config: unknown = await getConfig(cabinetId);
  if (!isRecord(config)) return null;

  const configKey = drawerType === "Bot" ? "BotDrawerDividers" : "TopDrawerDividers";
  const drawerConfig = config[configKey];
  if (!isRecord(drawerConfig)) return null;

  const zones = drawerConfig.zones;
  if (!isRecord(zones)) return null;

  return collectAvailableDividerTypesForDrawer(zones);
}
