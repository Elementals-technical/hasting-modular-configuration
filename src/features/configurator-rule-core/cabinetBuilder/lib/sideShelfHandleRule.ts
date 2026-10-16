import { hasCapability, selectOptionsByCapability, type ProductProfile } from "@/entities/collection";

/**
 * An open side shelf and the handle of the cabinets it stands beside.
 *
 * The shelf has no drawer front to cut a groove into, so it goes with a handle without one
 * (push-to-open). That holds only where the collection offers such a handle: Urban Duplex has
 * the Upper Groove alone and still sells the shelf beside its cabinets (price list, models), so
 * there the shelf is not tied to the handle.
 *
 * Read from the option capability `supportsGrooveColor`, so no handle or collection is named.
 */

/** The collection has a handle the cabinets can switch to for a side shelf. */
const hasHandleWithoutGroove = (profile: ProductProfile | null): boolean =>
  selectOptionsByCapability(profile, "Handle", "supportsGrooveColor", false).length > 0;

/** A side shelf cannot be added while the cabinets have `handle`. */
export const isSideShelfBlockedByHandle = (
  profile: ProductProfile | null,
  handle: string | null | undefined,
): boolean =>
  Boolean(handle) && hasHandleWithoutGroove(profile) && hasCapability(profile, "Handle", handle, "supportsGrooveColor");

/** A change from `previousHandle` to `nextHandle` takes away the handle the placed side shelves need. */
export const isLeavingSideShelfHandle = (
  profile: ProductProfile | null,
  previousHandle: string | null | undefined,
  nextHandle: string | null | undefined,
): boolean =>
  hasHandleWithoutGroove(profile) &&
  !hasCapability(profile, "Handle", previousHandle ?? null, "supportsGrooveColor") &&
  hasCapability(profile, "Handle", nextHandle, "supportsGrooveColor");
