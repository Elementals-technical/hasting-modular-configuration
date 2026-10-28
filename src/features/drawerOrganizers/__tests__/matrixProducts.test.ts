import { describe, expect, it } from "vitest";

import class579 from "../../../entities/collection/__tests__/fixtures/remote/datatable-579.json";
import mako581 from "../../../entities/collection/__tests__/fixtures/remote/datatable-581.json";
import tricot592 from "../../../entities/collection/__tests__/fixtures/remote/datatable-592.json";
import lame596 from "../../../entities/collection/__tests__/fixtures/remote/datatable-596.json";

import matrixFixture from "./fixtures/contract/matrix.v1.json";

/**
 * The products the shared matrix holds are the cabinet tables of Class, Mako, Tricot and Lame: the
 * collection, the type, the width, the drawer style and the height. A product the table offers and the
 * matrix lacks would run in 3D without a carrier or zone check; one the matrix holds and the table
 * lacks would be checked for nothing. A difference is reported to the log, never fixed in the fixture.
 */

type TableRow = Record<string, string>;
type Table = { id: number; rows: TableRow[] };

const TABLES: { collection: string; table: Table }[] = [
  { collection: "class", table: class579 },
  { collection: "mako", table: mako581 },
  { collection: "tricot", table: tricot592 },
  { collection: "lame", table: lame596 },
];

/** Tricot spells the drawer styles of its table with a handle suffix; the matrix uses the common words. */
const DRAWER_WORDS: Record<string, string> = { "1DW": "1", "2DW": "2", "1DWID": "1+inner" };

const TYPES: Record<string, string> = { "Sink-Base": "SB", "Sink-Cabinet": "SC" };

type Product = {
  collection: string;
  type: string;
  width: number;
  drawers: string;
  height: number;
  table: number;
  notWithIntegratedTop: boolean;
};

const keyOf = (p: Product) =>
  [p.collection, p.type, p.width, p.drawers, p.height, p.table, p.notWithIntegratedTop].join("|");

/** `"2:52|1:40"` -> `{ "2": 52, "1": 40 }`. */
const pairsOf = (text: string | undefined) =>
  Object.fromEntries(
    (text ?? "")
      .split("|")
      .filter(Boolean)
      .map((pair) => pair.split(":")),
  ) as Record<string, string>;

const productsOfTables = (): Product[] =>
  TABLES.flatMap(({ collection, table }) =>
    table.rows
      .filter((row) => row.is_open === "FALSE")
      .flatMap((row) => {
        const heights = pairsOf(row.forced_height_cm);
        const blocked = new Set((row.unavailable_with_integrated ?? "").split("|").filter(Boolean));
        return row.widths_cm.split("|").flatMap((width) =>
          row.drawer_configs.split("|").map((drawers) => ({
            collection,
            type: TYPES[row.cabinet_type],
            width: Number(width),
            drawers: DRAWER_WORDS[drawers] ?? drawers,
            height: Number(heights[drawers]),
            table: table.id,
            notWithIntegratedTop: blocked.has(`${width}:${drawers}`),
          })),
        );
      }),
  );

describe("matrix.v1 products", () => {
  it("reads the four cabinet tables: no open shelf, every type known, every drawer style with a forced height", () => {
    const rows = TABLES.flatMap(({ table }) => table.rows);

    expect(TABLES.map(({ table }) => table.id)).toEqual([579, 581, 592, 596]);
    expect(rows.every((row) => row.is_open === "FALSE")).toBe(true);
    expect(rows.every((row) => TYPES[row.cabinet_type] !== undefined)).toBe(true);
    expect(productsOfTables().every(({ height }) => Number.isFinite(height))).toBe(true);
  });

  it("is the set of products of the tables 579, 581, 592 and 596", () => {
    const fromTables = productsOfTables().map(keyOf).sort();
    const fromFixture = (matrixFixture.products as Product[]).map(keyOf).sort();

    expect(fromFixture).toEqual(fromTables);
  });

  it("holds 90 products, each once", () => {
    const keys = (matrixFixture.products as Product[]).map(keyOf);

    expect(keys).toHaveLength(90);
    expect(new Set(keys).size).toBe(90);
  });

  it("has the widths of the tables", () => {
    const widths = [...new Set(productsOfTables().map(({ width }) => width))].sort((a, b) => a - b);

    expect(matrixFixture.widths.map(({ width }) => width)).toEqual(widths);
  });

  it("describes a carrier for every kind of product (collection, type, drawer style, height) and for no other", () => {
    const kindOf = ({
      collection,
      type,
      drawers,
      height,
    }: {
      collection: string;
      type: string;
      drawers: string;
      height: number;
    }) => [collection, type, drawers, height].join("|");
    const kinds = new Set(productsOfTables().map(kindOf));

    expect(new Set(matrixFixture.classes.map(kindOf))).toEqual(kinds);
  });
});
