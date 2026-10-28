import { COMPACT_PRESET_FORMAT, compactFromExactPreset, expandCompactPreset } from '../../cabinet-placement/compact-preset.mjs';
import { defineFormat, PRESET_LEVELS } from '../preset-formats.mjs';
import { hasRows, hasColumnItem } from './compact-document.mjs';

const ULH_COMPACT_V1_FORMAT = defineFormat({
    id: COMPACT_PRESET_FORMAT,
    level: PRESET_LEVELS.ROWS,
    matches (document) {
        if (!hasRows(document)) return false;
        if (document.format === COMPACT_PRESET_FORMAT) return true;
        // No format written: rows without columns are the v1 shape.
        return document.format === undefined && !hasColumnItem(document);
    },
    expand: (document, context)=>expandCompactPreset(document, context),
    compact (exact, context) {
        const document = compactFromExactPreset(exact, context);
        // The scene has columns: v1 cannot hold them, the caller must ask for urban-compact-v2.
        if (document.format !== COMPACT_PRESET_FORMAT) {
            const error = new Error(`PRESET_NOT_COMPACTABLE: columns need ${document.format}`);
            error.code = 'PRESET_NOT_COMPACTABLE';
            throw error;
        }
        return document;
    }
});

export { ULH_COMPACT_V1_FORMAT };
