() => {
  // Click the visible element whose text matches __TEXT__ (mode __MODE__: exact | prefix | contains), right panel first.
  const want = __TEXT__, mode = __MODE__;
  const txt = (s) => (s || '').replace(/\s+/g, ' ').trim();
  const vis = (e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && r.bottom > 0 && r.top < innerHeight; };
  const match = (s) => (mode === 'exact' ? s === want : mode === 'prefix' ? s.startsWith(want) : s.includes(want));
  const rank = { BUTTON: 0, A: 1, INPUT: 1, LABEL: 2 };
  const all = [...document.querySelectorAll('button,a,[role=button],[role=option],[role=radio],[role=tab],[role=menuitem],label,li,[tabindex],div,span,p')]
    .filter((e) => vis(e) && match(txt(e.innerText || e.getAttribute('aria-label') || e.value)));
  if (!all.length) return 'NOT FOUND: ' + want;
  all.sort((a, b) => (a.innerText.length - b.innerText.length) || ((rank[a.tagName] ?? 3) - (rank[b.tagName] ?? 3)));
  const el = all[0].closest('button,a,[role=button],[role=option],[role=radio],[role=tab],label') || all[0];
  if (el.disabled || el.getAttribute('aria-disabled') === 'true') return 'DISABLED: ' + txt(el.innerText).slice(0, 60);
  el.scrollIntoView({ block: 'center' });
  el.click();
  return 'clicked: ' + txt(el.innerText || el.getAttribute('aria-label')).slice(0, 70) + ' <' + el.tagName + '>';
}
