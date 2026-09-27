import type { AttributeValue, ScopedValue, StableCabinetKey } from "./types";

const isSet = (value: AttributeValue): boolean =>
  value !== null && (typeof value !== "string" || value.trim().length > 0);

/**
 * The value an attribute holds for the whole composition.
 *
 * A value recorded at cabinets is read at the first one: a field and a model record the
 * composition's value there (`resolveChangeRequest`, `replayValues`), while the other cabinets
 * may still carry what a model put on them — the legs of a Mako model whose Leg Color was
 * switched off. A value recorded at any other address is the first one set.
 */
export const compositionValueOf = (
  entries: readonly ScopedValue[] | undefined,
  firstCabinetId: StableCabinetKey | undefined,
): AttributeValue | undefined => {
  if (!entries) return undefined;

  if (entries.some(({ target }) => target.scope === "cabinet")) {
    return entries.find(({ target }) => target.scope === "cabinet" && target.cabinetId === firstCabinetId)?.value;
  }

  return entries.find(({ value }) => isSet(value))?.value;
};
