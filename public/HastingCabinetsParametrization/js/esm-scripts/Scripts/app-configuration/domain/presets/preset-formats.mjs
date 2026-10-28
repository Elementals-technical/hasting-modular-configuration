/**
 * Preset format registry: every stored preset format is one record, so a new format is one file plus one line.
 *
 * Three levels — what a preset document knows about the scene:
 *   'list'  — cabinets left -> right in one row, no positions. Loaded by ConfiguratorAPI.presetProducts. Every collection.
 *   'rows'  — rows (and UD columns) in cm with shared fields; positions follow from widths, gaps and elevations.
 *             Expands to 'exact'. Modular collections only (ULH, UD — modular-collections.mjs).
 *   'exact' — positions in metres, row layouts, the countertop source and feature settings: a saved scene.
 *             Modular collections only.
 *
 * Who reads it: cabinet-local-runtime.mjs (composition.importPreset / exportPreset) and the dev-panel presets section.
 *
 * How to add a format: write formats/<format-id>.mjs with defineFormat({...}) and add it to default-preset-formats.mjs.
 * How to change a format without breaking stored presets: keep the old record registered and give the new version its
 * own id; the old record's expand() turns an old document into the current 'exact', so old presets keep opening.
 */ const PRESET_LEVELS = Object.freeze({
    LIST: 'list',
    ROWS: 'rows',
    EXACT: 'exact'
});
const KNOWN_LEVELS = Object.values(PRESET_LEVELS);
function fail(code, detail) {
    const error = new Error(detail ? `${code}: ${detail}` : code);
    error.code = code;
    throw error;
}
/**
 * One format record. Checked here, once, when the format file is loaded — a broken record fails at import time,
 * not when a customer opens a preset.
 *   id        — the value a document carries (e.g. 'ulh-compact-v1'); unique in a registry.
 *   level     — one of PRESET_LEVELS.
 *   matches   — document => boolean: is this document in this format? Must not throw.
 *   expand    — (document, context) => portable preset v2 'exact'. Required for 'rows'; 'exact' returns the document.
 *               'list' has none: it is loaded by presetProducts, not by composition.importPreset.
 *   compact   — (exact, context) => document in this format; optional (a format that cannot be exported has none).
 * Example: defineFormat({ id: 'ulh-compact-v1', level: 'rows', matches: d => d?.format === 'ulh-compact-v1', expand, compact }).
 */ function defineFormat(record) {
    // 1. Identity: the id is what stored documents carry, the level says which loader handles them.
    if (typeof record?.id !== 'string' || !record.id.trim()) throw new TypeError('Preset format: id is required');
    if (!KNOWN_LEVELS.includes(record.level)) throw new TypeError(`Preset format ${record.id}: unknown level ${record.level}`);
    if (typeof record.matches !== 'function') throw new TypeError(`Preset format ${record.id}: matches() is required`);
    // 2. A 'rows' or 'exact' document is imported through 'exact', so it must be able to produce one.
    const importsThroughExact = record.level !== PRESET_LEVELS.LIST;
    if (importsThroughExact && typeof record.expand !== 'function') {
        throw new TypeError(`Preset format ${record.id}: expand() is required for level ${record.level}`);
    }
    // 3. Optional export.
    if (record.compact !== undefined && typeof record.compact !== 'function') {
        throw new TypeError(`Preset format ${record.id}: compact must be a function`);
    }
    return Object.freeze({
        ...record
    });
}
/**
 * A registry over a fixed list of format records (no registration after creation: the list is the whole truth).
 * resolve(document) -> the one record whose matches() accepts the document.
 *   No record     -> throws PRESET_FORMAT_UNKNOWN (the document is not a preset we know).
 *   Two or more   -> throws PRESET_FORMAT_AMBIGUOUS (two records claim it: a bug in their matches()).
 * get(id) -> the record with this id, or throws PRESET_FORMAT_UNKNOWN.
 * Example: registry.resolve({ format: 'urban-compact-v2', rows: [...] }).level -> 'rows'.
 */ function createPresetFormatRegistry(formats) {
    // 1. Every id once: a document must name exactly one format.
    const byId = new Map();
    for (const format of formats){
        if (byId.has(format.id)) throw new TypeError(`Preset format registry: duplicate id ${format.id}`);
        byId.set(format.id, format);
    }
    function resolve(document) {
        // 2. Ask every format; exactly one may claim the document.
        const claiming = formats.filter((format)=>format.matches(document));
        if (claiming.length === 0) fail('PRESET_FORMAT_UNKNOWN');
        if (claiming.length > 1) fail('PRESET_FORMAT_AMBIGUOUS', claiming.map((format)=>format.id).join(', '));
        return claiming[0];
    }
    function get(id) {
        const format = byId.get(id);
        if (!format) fail('PRESET_FORMAT_UNKNOWN', String(id));
        return format;
    }
    return Object.freeze({
        resolve,
        get,
        list: ()=>[
                ...formats
            ]
    });
}

export { PRESET_LEVELS, createPresetFormatRegistry, defineFormat };
