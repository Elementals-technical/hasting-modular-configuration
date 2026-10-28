/** Product role is metadata, not an entity-name or array-order decision. */ function getCountertopRole(snapshot, productType = null) {
    const read = (key)=>snapshot instanceof Map || typeof snapshot?.get === 'function' ? snapshot.get(key) : snapshot?.[key];
    const has = (key)=>snapshot instanceof Map ? snapshot.has(key) : snapshot && typeof snapshot.has === 'function' ? snapshot.has(key) : Object.prototype.hasOwnProperty.call(snapshot ?? {}, key);
    const explicit = read('CountertopRole');
    const generated = read('generatedBy') === 'cabinet-cover-v1';
    if (has('CountertopRole')) {
        // 'tandemTop': the clone of a thin basin top on a sink base set apart (tandem/tandem-countertops.mjs).
        if (explicit === 'tandemTop') return generated ? 'unknown' : 'tandemTop';
        if (explicit !== 'basinTop' && explicit !== 'cabinetCover') return 'unknown';
        if (generated && explicit === 'basinTop') return 'unknown';
        return explicit;
    }
    if (generated) return 'cabinetCover';
    return (productType ?? read('productType')) === 'Top_Solid' ? 'basinTop' : 'unknown';
}
/** A tandem top (the clone of a thin basin top on a sink base set apart): a product, but never THE basin top. */ function isTandemCountertopProduct(snapshot) {
    return getCountertopRole(snapshot) === 'tandemTop';
}
/** Ownership guard also recognizes older cover snapshots whose role metadata is absent or inconsistent. */ function isCabinetCoverProduct(snapshot, productType = null) {
    const read = (key)=>snapshot instanceof Map || typeof snapshot?.get === 'function' ? snapshot.get(key) : snapshot?.[key];
    return getCountertopRole(snapshot, productType) === 'cabinetCover' || productType === 'Cabinet_Cover' || read('productType') === 'Cabinet_Cover' || read('generatedBy') === 'cabinet-cover-v1';
}
/** Resolve all candidates before selecting one, so insertion order cannot pick a basin. */ function resolveBasinTopProduct(products) {
    const entries = products instanceof Map ? [
        ...products.entries()
    ] : products && typeof products === 'object' ? Object.entries(products) : [];
    const candidates = entries.filter(([, snapshot])=>getCountertopRole(snapshot) === 'basinTop').sort(([left], [right])=>String(left) < String(right) ? -1 : String(left) > String(right) ? 1 : 0);
    const candidateIds = candidates.map(([id])=>id);
    if (candidates.length === 1) {
        const [productId, snapshot] = candidates[0];
        return {
            status: 'found',
            productId,
            snapshot,
            candidateIds
        };
    }
    return {
        status: candidates.length ? 'ambiguous' : 'missing',
        productId: null,
        snapshot: null,
        candidateIds
    };
}

export { getCountertopRole, isCabinetCoverProduct, isTandemCountertopProduct, resolveBasinTopProduct };
