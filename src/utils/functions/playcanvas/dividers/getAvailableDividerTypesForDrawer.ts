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

type DividerZone = {
  slots?: DividerSlot[];
};

const DIVIDER_TYPES: readonly DividerType[] = ["A", "B", "C"];

const isDividerType = (value: unknown): value is DividerType =>
  typeof value === "string" && DIVIDER_TYPES.some((type) => type === value);

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
  const config = (await getConfig(cabinetId)) as Record<string, unknown> | null;
  if (!config) return null;

  const configKey = drawerType === "Bot" ? "BotDrawerDividers" : "TopDrawerDividers";
  const drawerConfig = config[configKey] as { zones?: Record<string, DividerZone> } | undefined;
  const zones = drawerConfig?.zones;
  if (!zones) return null;

  let availableForEverySlot: Set<DividerType> | null = null;
  let hasAddableSlot = false;

  Object.values(zones).forEach((zone) => {
    zone.slots?.forEach((slot) => {
      const slotType = slot.other?.type;
      const isAddableSlot = slotType === "ghost" || slot.value === "empty";
      if (!isAddableSlot) return;

      hasAddableSlot = true;
      const availableTypes = Array.isArray(slot.other?.availableTypes) ? slot.other.availableTypes : [];
      const slotAvailableTypes = new Set<DividerType>();

      availableTypes.forEach((type) => {
        if (isDividerType(type)) slotAvailableTypes.add(type);
      });

      if (!availableForEverySlot) {
        availableForEverySlot = slotAvailableTypes;
        return;
      }

      availableForEverySlot.forEach((type) => {
        if (!slotAvailableTypes.has(type)) {
          availableForEverySlot?.delete(type);
        }
      });
    });
  });

  return hasAddableSlot ? (availableForEverySlot ?? new Set<DividerType>()) : new Set<DividerType>();
}
