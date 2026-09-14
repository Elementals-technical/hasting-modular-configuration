import type { ProductProfile } from "@/entities/collection";
import { buildBookMatchingSku, type BookMatchingSkuInput } from "@/shared/lib/sku";

/**
 * Book matching availability and charge.
 *
 * The cabinet families, the drawer styles that allow vertical matching and the minimum run
 * of adjacent drawer cabinets come from `ruleData.bookMatching` of the active collection. A
 * collection without that section does not offer book matching.
 */

// Grain option values mapped to the SKU direction; the SKU format belongs to D.
const GRAIN_HORIZONTAL = "GrainHorizontal";
const GRAIN_VERTICAL = "GrainVertical";

export const REASON_BOOK_MATCHING_NOT_IN_COLLECTION = "bookMatching.notInCollection";
const REASON_SELECT_GRAIN = "grain.selectDirection";
const REASON_HORIZONTAL_NEEDS_ADJACENT = "grain.horizontalNeedsAdjacentCabinets";
const REASON_VERTICAL_DRAWER_STYLES = "grain.verticalRequiresTwoDrawers";
const REASON_BOOK_MATCHING_UNAVAILABLE = "grain.bookMatchingUnavailable";

type BookMatchingDirection = BookMatchingSkuInput["direction"];
type BookMatchingParams = NonNullable<ProductProfile["ruleData"]["bookMatching"]>;

export type BookMatchingCabinetInput = {
  name?: string | null;
  drawers?: string | null;
};

export type BookMatchingAvailability = {
  available: boolean;
  reason?: string;
  /** Stable code of `reason`, for control flow. */
  reasonCode?: string;
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

/** Reason text of the active collection; the code itself when the collection has none. */
const resolveMessage = (
  profile: ProductProfile | null,
  reasonCode: string,
  params: Record<string, string | number> = {},
): string =>
  (profile?.messages[reasonCode] ?? reasonCode).replace(/\{(\w+)\}/g, (placeholder, name: string) =>
    Object.hasOwn(params, name) ? String(params[name]) : placeholder,
  );

const normalizeCabinetToken = (value: string) => value.toLowerCase().replace(/[\s_]+/g, "-");

/**
 * A short code (SB, OSS) must be the whole name; a family name may sit inside a runtime id
 * such as "Sink-Base-80".
 */
const matchesCabinetAlias = (name: string, alias: string): boolean => {
  const normalized = normalizeCabinetToken(name);
  const compact = normalized.replace(/-/g, "");
  const normalizedAlias = normalizeCabinetToken(alias);
  const compactAlias = normalizedAlias.replace(/-/g, "");

  if (compactAlias.length <= 3) return compact === compactAlias;

  return normalized.includes(normalizedAlias) || compact.includes(compactAlias);
};

const normalizeCabinetKind = (
  name: string | null | undefined,
  params: BookMatchingParams,
): "drawer" | "open" | null => {
  if (!name) return null;

  if (params.openCabinetAliases.some((alias) => matchesCabinetAlias(name, alias))) return "open";
  if (params.drawerCabinetAliases.some((alias) => matchesCabinetAlias(name, alias))) return "drawer";

  return null;
};

/** Canonical Drawers option of a legacy or scene spelling, compared case-insensitively. */
const resolveDrawerStyle = (profile: ProductProfile | null, drawers?: string | null): string | null => {
  const normalized = drawers?.trim().toUpperCase();
  if (!normalized) return null;

  const options = profile?.attributes.find((attribute) => attribute.attributeId === "Drawers")?.options ?? [];
  const option = options.find(
    ({ value, aliases }) =>
      value.toUpperCase() === normalized || aliases?.some((alias) => alias.toUpperCase() === normalized),
  );

  return option?.value ?? null;
};

const parseDrawerCount = (value?: string | null): number => {
  if (!value) return 0;

  const match = value.match(/^(\d+)/);
  if (!match) return 0;

  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const normalizeBookMatchingDirection = (grainDirection?: string | null): BookMatchingDirection | null => {
  if (grainDirection === GRAIN_HORIZONTAL) return "H";
  if (grainDirection === GRAIN_VERTICAL) return "V";
  return null;
};

export const isBookMatchingEligibleCabinet = (name: string | null | undefined, params: BookMatchingParams): boolean =>
  normalizeCabinetKind(name, params) === "drawer";

export const countBookMatchingEligibleCabinets = (
  cabinets: readonly BookMatchingCabinetInput[],
  params: BookMatchingParams,
): number =>
  cabinets.reduce((count, cabinet) => count + (isBookMatchingEligibleCabinet(cabinet.name, params) ? 1 : 0), 0);

/** Runs of adjacent drawer cabinets, in composition order. */
const getContiguousEligibleGroups = (
  cabinets: readonly BookMatchingCabinetInput[],
  params: BookMatchingParams,
): BookMatchingCabinetInput[][] => {
  const groups: BookMatchingCabinetInput[][] = [];
  let current: BookMatchingCabinetInput[] = [];

  cabinets.forEach((cabinet) => {
    if (isBookMatchingEligibleCabinet(cabinet.name, params)) {
      current.push(cabinet);
      return;
    }

    if (current.length > 0) groups.push(current);
    current = [];
  });

  if (current.length > 0) groups.push(current);

  return groups;
};

export const hasAdjacentBookMatchingEligibleCabinets = (
  cabinets: readonly BookMatchingCabinetInput[],
  params: BookMatchingParams,
): boolean =>
  getContiguousEligibleGroups(cabinets, params).some(
    (group) => group.length >= params.horizontalMinimumAdjacentDrawerCabinets,
  );

const hasIncompatibleVerticalBookMatchingCabinets = (
  cabinets: readonly BookMatchingCabinetInput[],
  params: BookMatchingParams,
  profile: ProductProfile | null,
): boolean =>
  cabinets.some((cabinet) => {
    if (!isBookMatchingEligibleCabinet(cabinet.name, params)) return false;

    const style = resolveDrawerStyle(profile, cabinet.drawers);
    return style !== null && !params.verticalAllowedDrawerStyles.includes(style);
  });

export const deriveBookMatchingAvailability = ({
  grainDirection,
  cabinets,
  profile,
}: {
  grainDirection?: string | null;
  cabinets: readonly BookMatchingCabinetInput[];
  profile: ProductProfile | null;
}): BookMatchingAvailability => {
  const direction = normalizeBookMatchingDirection(grainDirection);
  const params = profile?.ruleData.bookMatching;

  const unavailable = (reasonCode: string, messageParams?: Record<string, string | number>) => ({
    available: false,
    reason: resolveMessage(profile, reasonCode, messageParams),
    reasonCode,
    direction,
  });

  if (!params) return unavailable(REASON_BOOK_MATCHING_NOT_IN_COLLECTION);

  if (!direction) return unavailable(REASON_SELECT_GRAIN);

  if (direction === "V") {
    if (hasIncompatibleVerticalBookMatchingCabinets(cabinets, params, profile)) {
      return unavailable(REASON_VERTICAL_DRAWER_STYLES);
    }

    return { available: true, direction };
  }

  if (hasAdjacentBookMatchingEligibleCabinets(cabinets, params)) {
    return { available: true, direction };
  }

  return unavailable(REASON_HORIZONTAL_NEEDS_ADJACENT, { count: params.horizontalMinimumAdjacentDrawerCabinets });
};

export const deriveBookMatchingChargeInfo = ({
  grainDirection,
  bookMatching,
  materialSku,
  cabinets,
  profile,
}: {
  grainDirection?: string | null;
  bookMatching?: string | null;
  materialSku?: string | null;
  cabinets: readonly BookMatchingCabinetInput[];
  profile: ProductProfile | null;
}): BookMatchingChargeInfo => {
  const params = profile?.ruleData.bookMatching;
  const availability = deriveBookMatchingAvailability({
    grainDirection,
    cabinets,
    profile,
  });
  const chargeableCabinets = !params
    ? []
    : availability.direction === "H"
      ? getContiguousEligibleGroups(cabinets, params)
          .filter((group) => group.length >= params.horizontalMinimumAdjacentDrawerCabinets)
          .flat()
      : cabinets.filter((cabinet) => isBookMatchingEligibleCabinet(cabinet.name, params));
  const eligibleCabinetCount = chargeableCabinets.length;
  const parsedDrawerQty = chargeableCabinets.reduce((sum, cabinet) => sum + parseDrawerCount(cabinet.drawers), 0);
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
    reason:
      availability.reason ??
      (!availability.available ? resolveMessage(profile, REASON_BOOK_MATCHING_UNAVAILABLE) : undefined),
    direction: availability.direction,
    sku,
    drawerQty,
    applies: bookMatching === "enabled" && availability.available && drawerQty > 0,
  };
};
