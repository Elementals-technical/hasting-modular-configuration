/**
 * Level 'list': the array ConfiguratorAPI.presetProducts takes — cabinets left -> right in one row, no positions.
 * This is what the UI's public/collections/<slug>/presets.json keeps in `presetProducts` for every collection.
 * Example: [{ name: 'Sink-Base', Width: 60 }, { name: 'Open-Shelf', Width: 50 }].
 * No expand(): a list is loaded by presetProducts (legacy SceneManager or the modular runtime decides), not by importPreset.
 */
import { PRESET_LEVELS, defineFormat } from '../preset-formats.mjs';

const isCabinetItem = item => item !== null && typeof item === 'object' && typeof item.name === 'string' && item.name.trim() !== '';

export const PRESET_PRODUCTS_FORMAT = defineFormat({
    id: 'preset-products',
    level: PRESET_LEVELS.LIST,
    // An empty array is not a preset: there is nothing to load.
    matches: document => Array.isArray(document) && document.length > 0 && document.every(isCabinetItem)
});
