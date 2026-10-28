async () => {
  const w = document.querySelector('iframe')?.contentWindow;
  const api = w?.ConfiguratorAPI;
  const out = { url: location.href, apiKeys: api ? Object.keys(api).sort() : null };
  if (!api?.cabinets) return out;
  const caps = await api.cabinets.getCapabilities();
  const scope = { apiInstanceId: caps.data.apiInstanceId, compositionId: caps.data.activeCompositionId };
  const cab = await api.cabinets.getState(scope);
  const first = (cab?.data?.cabinets ?? cab?.cabinets ?? [])[0];
  out.cabinetsShape = { top: Object.keys(cab ?? {}), dataKeys: Object.keys(cab?.data ?? {}), count: (cab?.data?.cabinets ?? cab?.cabinets ?? []).length, firstKeys: first ? Object.keys(first) : null, first: first ? JSON.stringify(first).slice(0, 900) : null };
  try { const ct = await api.countertop?.getState?.(); out.countertop = JSON.stringify(ct).slice(0, 900); } catch (e) { out.ctErr = String(e); }
  try { const cv = await api.cabinetCover?.getState?.(); out.cover = JSON.stringify(cv).slice(0, 300); } catch (e) { out.cvErr = String(e); }
  try { const ids = api.composition?.getOrderProductIds?.(); out.orderIds = ids; } catch (e) { out.orderErr = String(e); }
  return out;
}
