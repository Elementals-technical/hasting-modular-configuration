/**
 * Centralized configurator/collection defaults.
 *
 * These values were previously duplicated as local constants across several pages
 * and hooks. Keep this module the single source of truth for configurator-wide
 * defaults so that future collections can override them in one place.
 *
 * NOTE: the Redux product slice (`entities/product/model/store/slice.ts`) still
 * declares its own copies of these defaults in `createInitialState`. That coupling
 * is intentionally left untouched for now (highest blast radius) and is guarded by
 * `defaults.test.ts`, which asserts the slice defaults stay in sync with these.
 */

/** Hastings configurator id used for catalog/datatable queries. */
export const CONFIGURATOR_ID = 4;

/** Datatable id backing the cabinet matrix used by the custom builder. */
export const MATRIX_CABINET_DATATABLE_ID = 439;

export const DEFAULT_CABINET_COLOR = "Pulpis Chiaro TKH";
export const DEFAULT_COUNTERTOP_COLOR = "Cacao Orinoco FF MT";
export const DEFAULT_SINK_TYPE = "Top_Tekorlux_Rectangular";
