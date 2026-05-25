import type { DividerType } from "./getAvailableDividerTypesForDrawer";
import type { DrawerType } from "./wrapShowTopView";

export type RuntimePlacedDivider = {
  key: string;
  cabinetId: string;
  drawerType: DrawerType;
  zone: string;
  type: DividerType;
};

type DividerSlot = {
  key?: unknown;
  value?: unknown;
  dividerType?: unknown;
  position?: unknown;
  other?: {
    type?: unknown;
    value?: unknown;
    dividerType?: unknown;
  };
};

const DIVIDER_TYPES: readonly DividerType[] = ["A", "B", "C"];

const DRAWER_DIVIDER_CONFIGS: readonly { configKey: string; drawerType: DrawerType }[] = [
  { configKey: "TopDrawerDividers", drawerType: "Top" },
  { configKey: "BotDrawerDividers", drawerType: "Bot" },
];

const isDividerType = (value: unknown): value is DividerType =>
  typeof value === "string" && DIVIDER_TYPES.some((type) => type === value);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const getKeyPart = (value: unknown): string | null => {
  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return null;
};

const getPositionKey = (position: unknown): string | null => {
  if (!isRecord(position)) return null;

  const start = getKeyPart(position.start);
  const center = getKeyPart(position.center);
  const end = getKeyPart(position.end);
  const parts = [start, center, end].filter((part): part is string => part !== null);

  return parts.length > 0 ? parts.join(":") : null;
};

const resolvePlacedDividerType = (slot: DividerSlot): DividerType | null => {
  const candidates = [slot.value, slot.dividerType, slot.other?.dividerType, slot.other?.type, slot.other?.value];

  return candidates.find(isDividerType) ?? null;
};

const buildRuntimeDividerKey = (
  cabinetId: string,
  drawerType: DrawerType,
  zone: string,
  slot: DividerSlot,
  slotIndex: number,
): string => {
  const slotKey = getKeyPart(slot.key) ?? `slot-${slotIndex}`;
  const positionKey = getPositionKey(slot.position);

  return [cabinetId, drawerType, zone, slotKey, positionKey].filter((part): part is string => part !== null).join("::");
};

export const collectPlacedDividersForDrawer = (
  cabinetId: string,
  drawerType: DrawerType,
  zones: Record<string, unknown>,
): RuntimePlacedDivider[] =>
  Object.entries(zones).flatMap(([zone, zoneConfig]) => {
    if (!isRecord(zoneConfig)) return [];

    const zoneSlots = zoneConfig.slots;
    if (!Array.isArray(zoneSlots)) return [];

    return zoneSlots.flatMap((slot, slotIndex) => {
      if (!isRecord(slot)) return [];

      const other = isRecord(slot.other) ? slot.other : undefined;
      const dividerSlot: DividerSlot = {
        key: slot.key,
        value: slot.value,
        dividerType: slot.dividerType,
        position: slot.position,
        other,
      };
      const dividerType = resolvePlacedDividerType(dividerSlot);

      if (!dividerType) return [];

      return [
        {
          key: buildRuntimeDividerKey(cabinetId, drawerType, zone, dividerSlot, slotIndex),
          cabinetId,
          drawerType,
          zone,
          type: dividerType,
        },
      ];
    });
  });

export const collectPlacedDividersFromConfig = (
  cabinetId: string,
  config: unknown,
): RuntimePlacedDivider[] => {
  if (!isRecord(config)) return [];

  return DRAWER_DIVIDER_CONFIGS.flatMap(({ configKey, drawerType }) => {
    const drawerConfig = config[configKey];
    if (!isRecord(drawerConfig)) return [];

    const zones = drawerConfig.zones;
    if (!isRecord(zones)) return [];

    return collectPlacedDividersForDrawer(cabinetId, drawerType, zones);
  });
};
