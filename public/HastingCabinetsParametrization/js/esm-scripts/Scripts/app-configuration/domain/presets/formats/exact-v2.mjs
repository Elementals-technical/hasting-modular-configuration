import { defineFormat, PRESET_LEVELS } from '../preset-formats.mjs';

const EXACT_SCHEMA_VERSION = 2;
const EXACT_V2_FORMAT = defineFormat({
    id: 'exact-v2',
    level: PRESET_LEVELS.EXACT,
    matches: (document)=>document?.presetSchemaVersion === EXACT_SCHEMA_VERSION && document?.presetLayout?.layoutMode === 'exact',
    // Already the import shape; instantiateExactPreset validates it.
    expand: (document)=>document,
    compact: (exact)=>exact
});

export { EXACT_V2_FORMAT };
