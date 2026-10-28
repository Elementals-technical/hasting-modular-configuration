/** Browser-side named preset storage. The serialized value is the portable API
 * artifact, not a scene snapshot or a runtime composition ID. */ function createCabinetPresetLibrary({ storage, namespace = 'ulh-portable-presets:v2:' } = {}) {
    if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function' || typeof storage.removeItem !== 'function' || typeof storage.key !== 'function' || typeof namespace !== 'string' || !namespace) throw new TypeError('Invalid preset storage');
    const key = (name)=>{
        if (typeof name !== 'string' || !name.trim() || name.length > 120) throw new TypeError('Invalid preset name');
        return namespace + encodeURIComponent(name.trim());
    };
    const read = (name)=>{
        const value = storage.getItem(key(name));
        if (value === null) return null;
        const parsed = JSON.parse(value);
        if (parsed?.presetSchemaVersion !== 2 || parsed.presetLayout?.layoutMode !== 'exact') {
            throw new TypeError('Unsupported stored preset');
        }
        return parsed;
    };
    return Object.freeze({
        save (name, preset, { replace = false } = {}) {
            const target = key(name);
            if (!replace && storage.getItem(target) !== null) throw new Error('PRESET_NAME_EXISTS');
            if (preset?.presetSchemaVersion !== 2 || preset.presetLayout?.layoutMode !== 'exact') {
                throw new TypeError('Invalid portable preset');
            }
            storage.setItem(target, JSON.stringify(preset));
        },
        get: read,
        list () {
            const names = [];
            for(let index = 0; index < storage.length; index++){
                const item = storage.key(index);
                if (item?.startsWith(namespace)) names.push(decodeURIComponent(item.slice(namespace.length)));
            }
            return names.sort((a, b)=>a.localeCompare(b));
        },
        remove (name) {
            storage.removeItem(key(name));
        }
    });
}

export { createCabinetPresetLibrary };
