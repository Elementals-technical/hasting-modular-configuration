() => {
  // Read-only: section headings in the right panel and controls that follow each heading (names only, de-duplicated).
  const txt = (s) => (s || '').replace(/\s+/g, ' ').trim();
  const minX = innerWidth * 0.62;
  const els = [...document.querySelectorAll('h1,h2,h3,h4,h5,legend,button,[role=radio],[role=option],[role=tab],[role=checkbox],[role=switch],input,label')]
    .filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.left >= minX; });
  const out = [];
  let cur = null;
  for (const e of els) {
    const t = txt(e.getAttribute('aria-label') || e.innerText || e.value);
    if (!t || /^Preview /.test(t)) continue;
    if (/^H\d|LEGEND/.test(e.tagName) || (e.tagName === 'BUTTON' && e.getAttribute('aria-expanded') !== null)) { cur = { section: t.slice(0, 50), items: [] }; out.push(cur); continue; }
    const on = e.getAttribute('aria-pressed') === 'true' || e.getAttribute('aria-checked') === 'true' || e.getAttribute('aria-selected') === 'true' || e.checked === true || /(^|[-_ ])(active|selected|checked)([-_ A-Z]|$)/.test(e.className || '');
    const off = e.disabled || e.getAttribute('aria-disabled') === 'true';
    if (cur && cur.items.length < 14) cur.items.push((on ? '*' : '') + (off ? '~' : '') + t.slice(0, 40));
  }
  return out.filter((s) => s.items.length || /Thickness|Style|Handle|Leg|Pattern|Side|Frame/i.test(s.section));
}
