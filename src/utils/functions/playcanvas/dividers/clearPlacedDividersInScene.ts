import { getConfig } from "../getConfig";
import { createDividerUiTraceId, recordDividerUiDebug, warnDividerUiDebug } from "./dividerUiDebug";
import { removeDividerFromSlot } from "./removeDividerFromSlot";
import type { OccupiedSlotInfo } from "./setOnOccupiedSlotClick";
import type { DrawerType } from "./wrapShowTopView";

type DividerConfigKey = "TopDrawerDividers" | "BotDrawerDividers";

type DrawerConfigDescriptor = {
  configKey: DividerConfigKey;
  drawerType: DrawerType;
};

const DIVIDER_CONFIGS: readonly DrawerConfigDescriptor[] = [
  { configKey: "TopDrawerDividers", drawerType: "Top" },
  { configKey: "BotDrawerDividers", drawerType: "Bot" },
];

const DIVIDER_TYPES = new Set(["A", "B", "C"]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readString = (value: unknown): string | null => {
  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return null;
};

const readNumber = (value: unknown): number | null => {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
};

const resolveTopDrawerType = (config: Record<string, unknown>): DrawerType => {
  const topDrawerType = readString(config.topDrawerType);
  return topDrawerType === "TopFull" ? "TopFull" : "Top";
};

const resolveDividerType = (slot: Record<string, unknown>, other: Record<string, unknown> | null): string | null => {
  const candidates = [slot.value, slot.dividerType, slot.placementType, other?.value, other?.dividerType, other?.placementType];
  const type = candidates.map(readString).find((value): value is string => Boolean(value && DIVIDER_TYPES.has(value)));

  return type ?? null;
};

const buildPosition = (slot: Record<string, unknown>, other: Record<string, unknown> | null) => {
  const rawPosition = isRecord(slot.position) ? slot.position : null;
  const start = readNumber(slot.start) ?? readNumber(other?.start) ?? readNumber(rawPosition?.start);
  const center = readNumber(slot.center) ?? readNumber(other?.center) ?? readNumber(rawPosition?.center);
  const end = readNumber(slot.end) ?? readNumber(other?.end) ?? readNumber(rawPosition?.end);

  return start !== null || center !== null || end !== null
    ? {
        start: start ?? center ?? end ?? 0,
        center: center ?? start ?? end ?? 0,
        end: end ?? center ?? start ?? 0,
      }
    : undefined;
};

const collectOccupiedDividerSlotsFromConfig = (
  cabinetId: string,
  config: Record<string, unknown>,
): OccupiedSlotInfo[] =>
  DIVIDER_CONFIGS.flatMap(({ configKey, drawerType }) => {
    const resolvedDrawerType = configKey === "TopDrawerDividers" ? resolveTopDrawerType(config) : drawerType;
    const drawerConfig = config[configKey];
    if (!isRecord(drawerConfig) || !isRecord(drawerConfig.zones)) return [];

    return Object.entries(drawerConfig.zones).flatMap(([zone, zoneConfig]) => {
      if (!isRecord(zoneConfig) || !Array.isArray(zoneConfig.slots)) return [];

      return zoneConfig.slots.flatMap((slot, slotIndex) => {
        if (!isRecord(slot)) return [];

        const other = isRecord(slot.other) ? slot.other : null;
        const dividerType = resolveDividerType(slot, other);
        const slotState = readString(other?.type);
        const slotValue = readString(slot.value) ?? readString(other?.value);
        const isOccupied =
          slotState === "occupied" ||
          Boolean(dividerType) ||
          Boolean(slotValue && slotValue !== "empty" && slotValue !== "none");

        if (!isOccupied) return [];

        const stateId = readString(slot.stateId) ?? readString(other?.stateId) ?? "";
        const zoneIndex = readNumber(slot.zoneIndex) ?? readNumber(other?.zoneIndex) ?? slotIndex;
        const resolvedKey = readString(slot.key) ?? readString(other?.key) ?? stateId;
        const key = resolvedKey || `${zone}-${slotIndex}`;
        const position = buildPosition(slot, other);

        return [
          {
            cabinetId,
            drawerType: resolvedDrawerType,
            zone,
            key,
            isOccupied: true,
            stateId,
            dividerType: dividerType ?? slotValue ?? "",
            zoneIndex,
            position,
            slot,
            debugRequestId: createDividerUiTraceId("ui-clear-divider"),
          },
        ];
      });
    });
  });

export async function getOccupiedDividerSlotsInScene(productIds: string[]): Promise<OccupiedSlotInfo[]> {
  const uniqueProductIds = Array.from(new Set(productIds.filter(Boolean)));
  const slots: OccupiedSlotInfo[] = [];

  for (const productId of uniqueProductIds) {
    const config = await getConfig(productId);
    if (!isRecord(config)) continue;

    slots.push(...collectOccupiedDividerSlotsFromConfig(productId, config));
  }

  return slots;
}

export async function clearPlacedDividersInScene(
  productIds: string[],
  preloadedSlots?: OccupiedSlotInfo[],
): Promise<{ cleared: number; total: number }> {
  const slots = preloadedSlots ?? (await getOccupiedDividerSlotsInScene(productIds));

  recordDividerUiDebug("API.clearPlacedDividersInScene", "Start clearing scene dividers", {
    productIds,
    total: slots.length,
  });

  let cleared = 0;

  for (const slot of slots) {
    const result = await removeDividerFromSlot(slot);
    if (result) cleared += 1;
  }

  if (cleared !== slots.length) {
    warnDividerUiDebug("API.clearPlacedDividersInScene", "Some scene dividers were not cleared", {
      productIds,
      cleared,
      total: slots.length,
    });
  }

  recordDividerUiDebug("API.clearPlacedDividersInScene", "Finished clearing scene dividers", {
    productIds,
    cleared,
    total: slots.length,
  });

  return { cleared, total: slots.length };
}
