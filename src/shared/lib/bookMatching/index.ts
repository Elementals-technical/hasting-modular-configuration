import { buildBookMatchingSku, type BookMatchingSkuInput } from "@/shared/lib/sku";

const GRAIN_HORIZONTAL = "GrainHorizontal";
const GRAIN_VERTICAL = "GrainVertical";

const SELECT_GRAIN_REASON = "Select grain direction first.";
const HORIZONTAL_GRAIN_REASON = "Horizontal grain requires at least 2 adjacent drawer cabinets.";
const VERTICAL_GRAIN_REASON = "Vertical book matching is only available for 2 drawer cabinet styles.";
const BOOK_MATCHING_UNAVAILABLE_REASON = "Book matching is not available.";

const SINGLE_DRAWER_VALUES = new Set(["1", "1D", "1DW", "1+INNER", "1DWID"]);
const DOUBLE_DRAWER_VALUES = new Set(["2", "2D", "2DW"]);

type BookMatchingDirection = BookMatchingSkuInput["direction"];
type BookMatchingDrawerStyle = "single" | "double";

export type BookMatchingCabinetInput = {
  name?: string | null;
  drawers?: string | null;
};

export type BookMatchingAvailability = {
  available: boolean;
  reason?: string;
  direction: BookMatchingDirection | null;
};

export type BookMatchingChargeInfo = {
  eligibleCabinetCount: number;
  available: boolean;
  reason?: string;
  direction: BookMatchingDirection | null;
  sku: string | null;
  drawerQty: number;
  applies: boolean;
};

const normalizeCabinetToken = (value: string) => value.toLowerCase().replace(/[\s_]+/g, "-");

const normalizeCabinetKind = (name?: string | null): "drawer" | "open" | null => {
  if (!name) return null;

  const normalized = normalizeCabinetToken(name);
  const compact = normalized.replace(/-/g, "");

  if (
    normalized.includes("open-shelf") ||
    normalized.includes("openshelf") ||
    normalized.includes("side-shelf") ||
    normalized.includes("sideshelf") ||
    compact === "os" ||
    compact === "oss"
  ) {
    return "open";
  }

  if (
    normalized.includes("sink-base") ||
    normalized.includes("sinkbase") ||
    normalized.includes("sink-cabinet") ||
    normalized.includes("sinkcabinet") ||
    normalized.includes("side-cabinet") ||
    normalized.includes("sidecabinet") ||
    compact === "sb" ||
    compact === "sc"
  ) {
    return "drawer";
  }

  return null;
};

const parseDrawerCount = (value?: string | null): number => {
  if (!value) return 0;

  const match = value.match(/^(\d+)/);
  if (!match) return 0;

  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeBookMatchingDrawerStyle = (drawers?: string | null): BookMatchingDrawerStyle | null => {
  const normalized = drawers?.trim().toUpperCase();
  if (!normalized) return null;

  if (SINGLE_DRAWER_VALUES.has(normalized)) return "single";
  if (DOUBLE_DRAWER_VALUES.has(normalized)) return "double";

  return null;
};

export const normalizeBookMatchingDirection = (grainDirection?: string | null): BookMatchingDirection | null => {
  if (grainDirection === GRAIN_HORIZONTAL) return "H";
  if (grainDirection === GRAIN_VERTICAL) return "V";
  return null;
};

export const isBookMatchingEligibleCabinet = (name?: string | null): boolean => {
  return normalizeCabinetKind(name) === "drawer";
};

export const countBookMatchingEligibleCabinets = (cabinets: readonly BookMatchingCabinetInput[]): number =>
  cabinets.reduce((count, cabinet) => count + (isBookMatchingEligibleCabinet(cabinet.name) ? 1 : 0), 0);

export const hasAdjacentBookMatchingEligibleCabinets = (cabinets: readonly BookMatchingCabinetInput[]): boolean => {
  for (let index = 0; index < cabinets.length - 1; index += 1) {
    if (
      isBookMatchingEligibleCabinet(cabinets[index]?.name) &&
      isBookMatchingEligibleCabinet(cabinets[index + 1]?.name)
    ) {
      return true;
    }
  }

  return false;
};

const hasIncompatibleVerticalBookMatchingCabinets = (cabinets: readonly BookMatchingCabinetInput[]): boolean =>
  cabinets.some(
    (cabinet) =>
      isBookMatchingEligibleCabinet(cabinet.name) && normalizeBookMatchingDrawerStyle(cabinet.drawers) === "single",
  );

export const deriveBookMatchingAvailability = ({
  grainDirection,
  cabinets,
}: {
  grainDirection?: string | null;
  cabinets: readonly BookMatchingCabinetInput[];
}): BookMatchingAvailability => {
  const direction = normalizeBookMatchingDirection(grainDirection);

  if (!direction) {
    return {
      available: false,
      reason: SELECT_GRAIN_REASON,
      direction: null,
    };
  }

  if (direction === "V") {
    if (hasIncompatibleVerticalBookMatchingCabinets(cabinets)) {
      return {
        available: false,
        reason: VERTICAL_GRAIN_REASON,
        direction,
      };
    }

    return {
      available: true,
      direction,
    };
  }

  if (hasAdjacentBookMatchingEligibleCabinets(cabinets)) {
    return {
      available: true,
      direction,
    };
  }

  return {
    available: false,
    reason: HORIZONTAL_GRAIN_REASON,
    direction,
  };
};

export const deriveBookMatchingChargeInfo = ({
  grainDirection,
  bookMatching,
  materialSku,
  cabinets,
}: {
  grainDirection?: string | null;
  bookMatching?: string | null;
  materialSku?: string | null;
  cabinets: readonly BookMatchingCabinetInput[];
}): BookMatchingChargeInfo => {
  const eligibleCabinets = cabinets.filter((cabinet) => isBookMatchingEligibleCabinet(cabinet.name));
  const eligibleCabinetCount = eligibleCabinets.length;
  const availability = deriveBookMatchingAvailability({
    grainDirection,
    cabinets,
  });
  const parsedDrawerQty = eligibleCabinets.reduce((sum, cabinet) => sum + parseDrawerCount(cabinet.drawers), 0);
  const drawerQty = availability.available ? parsedDrawerQty || eligibleCabinetCount : 0;
  const sku = availability.direction
    ? buildBookMatchingSku({
        direction: availability.direction,
        materialSku,
      })
    : null;

  return {
    eligibleCabinetCount,
    available: availability.available,
    reason: availability.reason ?? (!availability.available ? BOOK_MATCHING_UNAVAILABLE_REASON : undefined),
    direction: availability.direction,
    sku,
    drawerQty,
    applies: bookMatching === "enabled" && availability.available && drawerQty > 0,
  };
};
