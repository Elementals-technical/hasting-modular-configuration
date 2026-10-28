import { COLUMNS_PRESET_FORMAT, compactFromExactPreset, expandCompactPreset } from '../../cabinet-placement/compact-preset.mjs';
import { defineFormat, PRESET_LEVELS } from '../preset-formats.mjs';
import { hasRows, hasColumnItem } from './compact-document.mjs';

const URBAN_COMPACT_V2_FORMAT = defineFormat({
    id: COLUMNS_PRESET_FORMAT,
    level: PRESET_LEVELS.ROWS,
    matches (document) {
        if (!hasRows(document)) return false;
        if (document.format === COLUMNS_PRESET_FORMAT) return true;
        // No format written: a column in any row means the v2 shape.
        return document.format === undefined && hasColumnItem(document);
    },
    expand: (document, context)=>expandCompactPreset(document, context),
    // compactFromExactPreset writes v1 when the scene has no columns; asked for v2, label it v2 (same content).
    compact: (exact, context)=>({
            ...compactFromExactPreset(exact, context),
            format: COLUMNS_PRESET_FORMAT
        })
});

export { URBAN_COMPACT_V2_FORMAT };
