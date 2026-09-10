import type {
  OptionCapabilities,
  ProductProfile,
  ProfileAttribute,
  ProfileOption,
} from "../model/productProfile";

/**
 * Pure readers over a validated ProductProfile.
 * Consumers use these instead of local constants, so adding an option is a data change.
 */

export const selectAttribute = (profile: ProductProfile | null, attributeId: string): ProfileAttribute | null =>
  profile?.attributes.find((attribute) => attribute.attributeId === attributeId) ?? null;

/** Catalog of an attribute in profile order. Empty when the collection does not declare it. */
export const selectOptions = (profile: ProductProfile | null, attributeId: string): ProfileOption[] =>
  selectAttribute(profile, attributeId)?.options ?? [];

export const selectOptionValues = (profile: ProductProfile | null, attributeId: string): string[] =>
  selectOptions(profile, attributeId).map((option) => option.value);

export const selectOption = (
  profile: ProductProfile | null,
  attributeId: string,
  value: string | null | undefined,
): ProfileOption | null => {
  if (!value) return null;
  return selectOptions(profile, attributeId).find((option) => option.value === value) ?? null;
};

/** Membership check against the active catalog. An unknown string never becomes an allowed option. */
export const isKnownOption = (
  profile: ProductProfile | null,
  attributeId: string,
  value: string | null | undefined,
): boolean => selectOption(profile, attributeId, value) !== null;

/**
 * Capability lookup. Replaces name whitelists such as URBAN_HANDLES:
 * an option that declares the capability gets the behaviour regardless of its id.
 */
export const hasCapability = (
  profile: ProductProfile | null,
  attributeId: string,
  value: string | null | undefined,
  capability: keyof OptionCapabilities,
): boolean => selectOption(profile, attributeId, value)?.capabilities?.[capability] === true;

/** Options whose capability flag matches `expected`, in catalog order. */
export const selectOptionsByCapability = (
  profile: ProductProfile | null,
  attributeId: string,
  capability: keyof OptionCapabilities,
  expected: boolean,
): ProfileOption[] =>
  selectOptions(profile, attributeId).filter((option) => (option.capabilities?.[capability] === true) === expected);

/**
 * Resolves a legacy runtime/table spelling to the canonical option value.
 * Returns null when the value belongs to no option of this attribute.
 */
export const normalizeOptionValue = (
  profile: ProductProfile | null,
  attributeId: string,
  raw: unknown,
): string | null => {
  if (typeof raw !== "string") return null;

  const trimmed = raw.trim();
  if (!trimmed) return null;

  const options = selectOptions(profile, attributeId);

  const direct = options.find((option) => option.value === trimmed);
  if (direct) return direct.value;

  const aliased = options.find((option) => option.aliases?.some((alias) => alias === trimmed));
  return aliased?.value ?? null;
};

export const selectInitialValue = (profile: ProductProfile | null, attributeId: string): string =>
  selectAttribute(profile, attributeId)?.initialValue ?? "";

/**
 * Value substituted while nothing is selected but a concrete value is needed for computation.
 * Deliberately separate from `initialValue`: USH starts Handle empty yet computes heights as topcut.
 */
export const selectEffectiveFallback = (profile: ProductProfile | null, attributeId: string): string | null =>
  selectAttribute(profile, attributeId)?.effectiveFallbackValue ?? null;

export const selectResetValue = (profile: ProductProfile | null, attributeId: string): string | null =>
  selectAttribute(profile, attributeId)?.resetValue ?? null;

/** Reason text for a stable reason code. B owns display and translation; this is the legacy fallback. */
export const selectMessage = (profile: ProductProfile | null, reasonCode: string): string =>
  profile?.messages[reasonCode] ?? reasonCode;
