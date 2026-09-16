import type { SkuPriceEntry } from "@/entities/product/model/store/priceStore";

import type { PricingLine, PricingLineGroup } from "./types";

/**
 * Summary items priced from the order lines (D02).
 *
 * Both Summary pages show the lines `usePriceCalculation` priced instead of building their own
 * SKUs, so an item, the bottom bar and the quote print cannot disagree. A page keeps only the
 * look of an item (title, swatch, description); SKU, price and pieces come from here.
 */

/** How a price cell reads: still loading, no price (missing or failed), or a price. */
export type SummaryPriceState = "loading" | "missing" | "ready";

export type SummaryLinePart = {
  line: PricingLine;
  entry: SkuPriceEntry | null;
  /** Pieces of the line the item stands for; the line quantity when one item shows all of them. */
  pieces?: number;
};

export type SummaryLinePrice = {
  sku?: string;
  /** Lines the item shows, so every line is shown once. */
  lineIds: string[];
  /** Formatted as the Summary pages and the quote print read it: `"$0"` when there is no price. */
  price: string;
  priceState?: SummaryPriceState;
};

export type SummaryPricedItem = {
  id: string;
  title: string;
  sku?: string;
  price: string;
  priceState?: SummaryPriceState;
  lineIds?: string[];
  copyable?: boolean;
};

export type SummaryPricedSection = { id: string; title: string; items: SummaryPricedItem[] };

export const formatSummaryPrice = (value?: number | null) => {
  if (typeof value !== "number") return "$0";
  return value.toLocaleString("en-US", { style: "currency", currency: "USD" });
};

export const resolveSummaryLinePrice = (parts: readonly SummaryLinePart[]): SummaryLinePrice => {
  if (parts.length === 0) return { lineIds: [], price: "$0" };

  const statuses = parts.map(({ entry }) => entry?.status);
  const priceState: SummaryPriceState = statuses.some((status) => status === undefined || status === "loading")
    ? "loading"
    : statuses.every((status) => status === "ready")
      ? "ready"
      : "missing";
  const value = parts.reduce(
    (sum, { entry, pieces = 1 }) => sum + (entry?.status === "ready" ? entry.value * pieces : 0),
    0,
  );

  return {
    sku: parts[0].line.sku,
    lineIds: parts.map(({ line }) => line.id),
    price: priceState === "ready" ? formatSummaryPrice(value) : "$0",
    priceState,
  };
};

const CABINET_SECTION = { id: "cabinet", title: "Cabinet" };
const COUNTERTOP_SECTION = { id: "countertop", title: "Countertop" };
const ACCESSORIES_SECTION = { id: "accessories", title: "Accessories" };

const SECTION_BY_GROUP: Record<PricingLineGroup, { id: string; title: string }> = {
  cabinet: CABINET_SECTION,
  openShelf: CABINET_SECTION,
  sideShelf: CABINET_SECTION,
  bookMatching: { id: "cabinet-options", title: "Cabinet Options" },
  countertop: COUNTERTOP_SECTION,
  basin: COUNTERTOP_SECTION,
  holeCut: COUNTERTOP_SECTION,
  vessel: { id: "basin", title: "Vessel" },
  faucetHoles: { id: "faucet", title: "Faucet" },
  towelBar: ACCESSORIES_SECTION,
  sidePanel: ACCESSORIES_SECTION,
  divider: ACCESSORIES_SECTION,
};

const TITLE_BY_GROUP: Record<PricingLineGroup, string> = {
  cabinet: "Cabinet",
  openShelf: "Open Shelf",
  sideShelf: "Open Side Shelf",
  bookMatching: "Book Matching",
  countertop: "Countertop",
  basin: "Basin",
  holeCut: "Vessel Cutout",
  vessel: "Vessel",
  faucetHoles: "Faucet Holes",
  towelBar: "Towel Bar",
  sidePanel: "Side Panel",
  divider: "Dividers",
};

/**
 * Adds an item for every line no Summary item shows, so the items always add up to the total.
 * A line lands here only when a page has no look for it; it is logged to be given one.
 */
export const appendUncoveredLines = (
  sections: SummaryPricedSection[],
  lines: readonly PricingLine[],
  entryOf: (sku: string) => SkuPriceEntry | null,
) => {
  const shownLineIds = new Set(sections.flatMap(({ items }) => items.flatMap(({ lineIds = [] }) => lineIds)));

  lines
    .filter(({ id }) => !shownLineIds.has(id))
    .forEach((line) => {
      console.warn("[Summary] line without item", line.id, line.sku);
      const target = SECTION_BY_GROUP[line.group];
      let section = sections.find(({ id }) => id === target.id);
      if (!section) {
        section = { ...target, items: [] };
        sections.push(section);
      }
      section.items.push({
        id: `line-${line.id}`,
        title: TITLE_BY_GROUP[line.group],
        copyable: true,
        ...resolveSummaryLinePrice([{ line, entry: entryOf(line.sku), pieces: line.quantity }]),
      });
    });
};
