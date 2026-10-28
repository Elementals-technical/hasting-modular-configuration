import { createPresetFormatRegistry } from './preset-formats.mjs';
import { PRESET_PRODUCTS_FORMAT } from './formats/preset-products.mjs';
import { ULH_COMPACT_V1_FORMAT } from './formats/ulh-compact-v1.mjs';
import { URBAN_COMPACT_V2_FORMAT } from './formats/urban-compact-v2.mjs';
import { EXACT_V2_FORMAT } from './formats/exact-v2.mjs';

const DEFAULT_PRESET_FORMATS = createPresetFormatRegistry([
    PRESET_PRODUCTS_FORMAT,
    ULH_COMPACT_V1_FORMAT,
    URBAN_COMPACT_V2_FORMAT,
    EXACT_V2_FORMAT
]);

export { DEFAULT_PRESET_FORMATS };
