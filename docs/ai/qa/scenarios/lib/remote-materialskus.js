async () => {
  // Read-only GETs of the remote collection sources the ULH loader uses; reports where `materialSkus` occurs.
  const urls = ['https://renderadmin.vivid3d.tech/configurators/4?serialize=true&view=full', 'https://renderadmin.vivid3d.tech/datatables/589', 'https://renderadmin.vivid3d.tech/datatables/580'];
  const out = [];
  for (const u of urls) {
    try {
      const r = await fetch(u, { cache: 'force-cache' });
      const t = await r.text();
      const hits = [];
      let i = t.indexOf('materialSkus');
      while (i >= 0 && hits.length < 3) { hits.push(t.slice(Math.max(0, i - 160), i + 220)); i = t.indexOf('materialSkus', i + 1); }
      let updated = null;
      try { const j = JSON.parse(t); updated = j.updatedAt ?? j.updated_at ?? j.data?.updatedAt ?? j.data?.updated_at ?? null; } catch (e) {}
      out.push({ url: u.replace('https://renderadmin.vivid3d.tech', ''), status: r.status, bytes: t.length, updatedAt: updated, materialSkusHits: hits.length, context: hits });
    } catch (e) { out.push({ url: u, error: String(e) }); }
  }
  return out;
}
