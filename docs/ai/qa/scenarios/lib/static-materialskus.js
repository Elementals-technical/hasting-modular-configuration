async () => {
  // Read-only: compare the ULH collection files as the browser cache serves them vs a no-store fetch.
  const files = ['manifest.json', 'sku-profile.json', 'product-profile.json', 'ui.json', 'runtime-bindings.json', 'presets.json'];
  const out = [];
  for (const f of files) {
    const u = '/collections/urban-low-height/' + f;
    const row = { file: f };
    for (const mode of ['default', 'no-store']) {
      try {
        const r = await fetch(u, { cache: mode });
        const t = await r.text();
        row[mode] = { status: r.status, bytes: t.length, materialSkus: (t.match(/materialSkus/g) || []).length, etag: r.headers.get('etag'), lastModified: r.headers.get('last-modified'), age: r.headers.get('age'), cf: r.headers.get('cf-cache-status') };
      } catch (e) { row[mode] = String(e); }
    }
    out.push(row);
  }
  return out;
}
