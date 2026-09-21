import type {
  OptionCapabilities,
  ProductProfile,
  ProfileAttribute,
  ProfileOption,
  ProfileRuleData,
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
/**
 * The basins of one kind, integrated or vessel, in catalog order. The attribute's noneValue
 * (the vessel cutout without a basin) is a scene token, not a basin, so it is left out.
 */
export const selectBasinOptions = (
  profile: ProductProfile | null,
  category: "integrated" | "vessel",
): ProfileOption[] => {
  const noneValue = selectAttribute(profile, "sinkType")?.noneValue;
  return selectOptions(profile, "sinkType").filter(
    (option) => option.category === category && option.value !== noneValue,
  );
};

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

/**
 * The spelling legacy state stores for a canonical option value: its first alias
 * (Drawers "1" -> "1D"). The value itself when the option declares no alias.
 */
export const selectLegacySpelling = (profile: ProductProfile | null, attributeId: string, value: string): string =>
  selectOption(profile, attributeId, value)?.aliases?.[0] ?? value;

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

/** Values substituted into `{name}` placeholders of a message. */
export type MessageParams = Record<string, string | number>;

/**
 * Reason text for a stable reason code. B owns display and translation; this is the legacy fallback.
 * A placeholder without a matching param is left as written, so a missing value is visible.
 */
export const selectMessage = (profile: ProductProfile | null, reasonCode: string, params?: MessageParams): string => {
  const template = profile?.messages[reasonCode] ?? reasonCode;
  if (!params) return template;

  return template.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
    Object.hasOwn(params, name) ? String(params[name]) : placeholder,
  );
};

/**
 * The collection's text for a reason code, or the legacy English text while a collection
 * declares none. A page passes the wording it used to hardcode, so a collection without the
 * message reads as before instead of showing the bare code (DEV-08).
 */
export const selectMessageOr = (
  profile: ProductProfile | null,
  reasonCode: string,
  fallback: string,
  params?: MessageParams,
): string => {
  const text = selectMessage(profile, reasonCode, params);
  return text === reasonCode ? fallback : text;
};

/**
 * Parameters of one rule. `undefined` when the collection does not declare the section:
 * the rule then treats the feature as not offered, never as USH.
 */
export const selectRuleData = <K extends keyof ProfileRuleData>(
  profile: ProductProfile | null,
  section: K,
): ProfileRuleData[K] | undefined => profile?.ruleData[section];

/**
 * Whether a drawer style may not be placed with the cabinets already placed.
 *
 * Styles of different `drawerStyleGroups` cannot be mixed. When the placed cabinets already
 * span several groups, the group listed last decides (USH: one two-drawer cabinet makes the
 * composition two-drawer). A collection without groups has no such restriction.
 */
export const isDrawerStyleMixingRestricted = (
  profile: ProductProfile | null,
  placedValues: readonly string[],
  candidate: string,
): boolean => {
  const groups = profile?.ruleData.drawerStyleGroups;
  if (!groups?.length) return false;

  const groupOf = (value: string): number => {
    const canonical = normalizeOptionValue(profile, "Drawers", value) ?? value;
    return groups.findIndex((group) => group.includes(canonical));
  };

  const candidateGroup = groupOf(candidate);
  if (candidateGroup === -1) return false;

  const placedGroups = placedValues.map(groupOf).filter((group) => group !== -1);
  if (placedGroups.length === 0) return false;

  return candidateGroup !== Math.max(...placedGroups);
};
