/**
 * Level 'exact', format 'exact-v2': portable preset v2 with layoutMode 'exact' (positions in metres).
 * Captured by captureExactPreset, loaded by instantiateExactPreset (domain/cabinet-placement/portable-preset.mjs);
 * the browser preset library (bridge/clients/cabinet-preset-library.mjs) stores only this format.
 * The document carries no `format` field: it is recognised by presetSchemaVersion 2 + presetLayout.layoutMode 'exact'.
 */
import { PRESET_LEVELS, defineFormat } from '../preset-formats.mjs';

const EXACT_SCHEMA_VERSION = 2;

export const EXACT_V2_FORMAT = defineFormat({
    id: 'exact-v2',
    level: PRESET_LEVELS.EXACT,
    matches: document => document?.presetSchemaVersion === EXACT_SCHEMA_VERSION && document?.presetLayout?.layoutMode === 'exact',
    // Already the import shape; instantiateExactPreset validates it.
    expand: document => document,
    compact: exact => exact
});
