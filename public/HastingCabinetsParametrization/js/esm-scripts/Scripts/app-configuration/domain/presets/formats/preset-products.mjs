import { defineFormat, PRESET_LEVELS } from '../preset-formats.mjs';

const isCabinetItem = (item)=>item !== null && typeof item === 'object' && typeof item.name === 'string' && item.name.trim() !== '';
const PRESET_PRODUCTS_FORMAT = defineFormat({
    id: 'preset-products',
    level: PRESET_LEVELS.LIST,
    // An empty array is not a preset: there is nothing to load.
    matches: (document)=>Array.isArray(document) && document.length > 0 && document.every(isCabinetItem)
});

export { PRESET_PRODUCTS_FORMAT };
