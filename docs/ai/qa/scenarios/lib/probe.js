async () => {
  // Read-only probe: DOM summary + scene getters. Never calls setters.
  const txt = (s) => (s || '').replace(/\s+/g, ' ').trim();
  const out = { url: location.pathname + location.search };
  const body = txt(document.body.innerText);
  const price = body.match(/Total List Price\s*\$[\d,]+(\.\d+)?/);
  out.price = price ? price[0].replace('Total List Price', '').trim() : null;
  out.step = txt(document.querySelector('[aria-current="page"]')?.innerText) || null;
  out.dialogs = [...document.querySelectorAll('[role="dialog"],[role="alertdialog"]')].map((d) => txt(d.innerText).slice(0, 160));
  out.alerts = [...document.querySelectorAll('[role="alert"],[role="status"],[class*="toast" i],[class*="tooltip" i]')].map((d) => txt(d.innerText)).filter(Boolean).slice(0, 5);
  const w = document.querySelector('iframe')?.contentWindow;
  const api = w?.ConfiguratorAPI;
  out.sceneReady = !!api?.composition;
  if (!api) return out;
  const pick = (o, keys) => Object.fromEntries(keys.filter((k) => o && o[k] !== undefined).map((k) => [k, o[k]]));
  try {
    const all = api.composition.getAllProducts?.() ?? {};
    const order = api.composition.getOrderProductIds?.() ?? null;
    out.order = order ? JSON.stringify(order).slice(0, 200) : null;
    const KEEP = ['CabinetType', 'productType', 'Width', 'Depth', 'Height', 'DrawerStyle', 'Style', 'Handle', 'HandleType', 'CabinetColor', 'HandleGrooveColor', 'LegColor', 'CabinetPattern', 'DrawerPanelFluting', 'LateralPanelSide', 'Series', 'SidePanel', 'SidePanels', 'sinkType', 'SinkType', 'CountertopColor', 'CountertopMaterial', 'Thickness', 'BasinStyle', 'VesselColor'];
    out.products = Object.entries(all).slice(0, 10).map(([id, cfg]) => {
      const c = cfg?.config ?? cfg ?? {};
      const kept = Object.fromEntries(Object.entries(c).filter(([k]) => KEEP.some((x) => k.toLowerCase() === x.toLowerCase())));
      return { id: id.slice(0, 36), n: Object.keys(c).length, cfg: kept };
    });
  } catch (e) { out.productsErr = String(e).slice(0, 200); }
  try {
    const ct = await api.countertop.getState();
    out.countertop = pick(ct, ['productId', 'placementState', 'attached', 'moved', 'canResize', 'thickness', 'autoLength', 'customLength', 'size', 'lengthLimitsM', 'offset']);
  } catch (e) { out.ctErr = String(e).slice(0, 200); }
  try { const cv = await api.cabinetCover.getState(); out.coverEntries = cv?.service?.entries?.length ?? null; } catch (e) { out.coverErr = String(e).slice(0, 120); }
  return out;
}
