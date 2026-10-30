import type { PricingLine } from "./types";

const TANDEM_COUNTERTOP_LINE_PREFIX = "countertop:tandem:";

/** Tandem vanities: the order line of tandem countertop `index` (the clone of the top on a sink base set apart). */
export const tandemCountertopLineId = (index: number) => `${TANDEM_COUNTERTOP_LINE_PREFIX}${index}`;

/**
 * Summary items of the tandem countertops: each one is the main countertop item (same finish, thickness, depth)
 * with its own width and price.
 * Example: lines [countertop:tandem:0 at 90 cm] -> one item "countertop-tandem-0" with Width 90.
 */
export const tandemCountertopItems = <Item extends { id: string; description?: Record<string, unknown> }>(
  mainItem: Item,
  lines: ReadonlyArray<PricingLine>,
  priceOfLine: (line: PricingLine) => Partial<Item>,
): Item[] =>
  lines
    .filter(({ id }) => id.startsWith(TANDEM_COUNTERTOP_LINE_PREFIX))
    .map((line, index) => ({
      ...mainItem,
      id: `countertop-tandem-${index}`,
      ...priceOfLine(line),
      description: { ...mainItem.description, Width: line.widthCm },
    }));
