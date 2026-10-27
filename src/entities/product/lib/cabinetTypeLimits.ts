const REASON_SINK_BASE_LIMIT = "cabinet.sinkBaseLimit";
const REASON_SIDE_SHELF_LIMIT = "cabinet.sideShelfLimit";

/** Why no more cabinets of a type can be added: its reason code, and the text while a collection has none. */
export type CabinetTypeLimit = { code: string; text: string };

/**
 * A vanity takes at most two Sink Bases and two Side Shelves, in every collection. The texts are the
 * Urban Standard Height configurator's; a collection words them its own way in its `messages`.
 */
const CABINET_TYPE_LIMITS: Readonly<Record<string, CabinetTypeLimit & { max: number }>> = {
  "Sink-Base": {
    max: 2,
    code: REASON_SINK_BASE_LIMIT,
    text: "Vanity configurations allow a maximum of two Sink Base units.",
  },
  "Side-Shelf": {
    max: 2,
    code: REASON_SIDE_SHELF_LIMIT,
    text: "Vanity configurations allow a maximum of two Side Shelf units.",
  },
};

/** The cabinet types the placed cabinets (`placedTypes`, one per cabinet) hold as many of as a vanity takes. */
export const cabinetTypesAtLimit = (
  placedTypes: readonly (string | null)[],
): Readonly<Partial<Record<string, CabinetTypeLimit>>> =>
  Object.fromEntries(
    Object.entries(CABINET_TYPE_LIMITS)
      .filter(([cabinetType, { max }]) => placedTypes.filter((type) => type === cabinetType).length >= max)
      .map(([cabinetType, { code, text }]) => [cabinetType, { code, text }]),
  );
