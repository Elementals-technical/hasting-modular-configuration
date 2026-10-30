import type { SkuSeries } from "./skuProfile";

/**
 * SKU series of the collections whose prices can be requested.
 *
 * A collection that is not listed here has no pricing SKUs: it gets an explicit
 * `no-sku-series` status instead of borrowing the USH series.
 */
export const SKU_SERIES_BY_COLLECTION: Readonly<Record<string, SkuSeries>> = {
  "urban-standard-height": {
    cabinet: "URSTD",
    openShelf: "UROS",
    openSideShelf: "UROSS",
    sidePanel: "URSP",
    divider: "URDIV",
    towelBar: "URTWLBR",
    bookMatching: "URBMG",
    countertopPrefix: "UR",
    countertopDefaultMaterial: "FX",
    fallback: "X",
  },
};
