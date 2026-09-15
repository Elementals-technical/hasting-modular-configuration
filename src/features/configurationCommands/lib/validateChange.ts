import type { ProductProfile } from "@/entities/collection";
import { normalizeOptionValue, selectAttribute, selectMessage, selectOptions } from "@/entities/collection";
import type { AttributeValue } from "@/entities/configuration";

import type { AttributeChange, ChangeBlockedReason, ChangeErrorCode } from "../model/types";

/**
 * Validation gates, in order. The order itself is part of the contract:
 *
 *   1. is the attribute known to the active collection
 *   2. is it addressed at the scope the collection declares
 *   3. is the value a member of its catalog
 *   4. do the current rules allow it
 *
 * Steps 1–3 are pure membership checks against the profile. Step 4 needs the rule
 * result and lives in the orchestrator, because it depends on current state.
 */

export type ValidationVerdict =
  | { ok: true }
  | { ok: false; kind: "error"; code: ChangeErrorCode; message: string }
  | ({ ok: false; kind: "blocked" } & ChangeBlockedReason);

/** Reason code for a value that is not part of the attribute catalog. */
export const REASON_VALUE_NOT_IN_CATALOG = "change.valueNotInCatalog";

const asString = (value: AttributeValue): string | null => (typeof value === "string" ? value : null);

export const validateChange = (change: AttributeChange, profile: ProductProfile | null): ValidationVerdict => {
  if (!profile) {
    return {
      ok: false,
      kind: "error",
      code: "no-active-profile",
      message: "no active collection profile",
    };
  }

  const attribute = selectAttribute(profile, change.attributeId);

  if (!attribute) {
    return {
      ok: false,
      kind: "error",
      code: "unknown-attribute",
      message: `attribute "${change.attributeId}" is not declared by collection "${profile.collectionId}"`,
    };
  }

  if (attribute.scope !== change.scope) {
    return {
      ok: false,
      kind: "error",
      code: "scope-mismatch",
      message: `attribute "${change.attributeId}" is ${attribute.scope}-scoped, received ${change.scope}`,
    };
  }

  // An attribute whose options come from an external source has no closed catalog to
  // check against; A validates those values while loading them.
  const options = selectOptions(profile, change.attributeId);

  if (options.length > 0) {
    const value = asString(change.value);
    // A declared alias is a member too ("2.375" is Thickness "2.4"). The direct check stays
    // first because an empty string is a legitimate member that normalization rejects.
    const isMember =
      value !== null &&
      (options.some((option) => option.value === value) ||
        normalizeOptionValue(profile, change.attributeId, value) !== null);

    if (!isMember) {
      return {
        ok: false,
        kind: "blocked",
        attributeId: change.attributeId,
        reasonCode: REASON_VALUE_NOT_IN_CATALOG,
        reason: selectMessage(profile, REASON_VALUE_NOT_IN_CATALOG),
      };
    }
  }

  return { ok: true };
};
