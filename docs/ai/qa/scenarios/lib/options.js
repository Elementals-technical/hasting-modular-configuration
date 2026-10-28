() => {
  // Read-only: option-like controls in the right panel (by screen region) with selected/disabled state.
  const txt = (s) => (s || '').replace(/\s+/g, ' ').trim();
  const minX = innerWidth * 0.62;
  const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.left >= minX && getComputedStyle(e).visibility !== 'hidden'; };
  const sel = 'button,[role=button],[role=radio],[role=option],[role=tab],[role=checkbox],[role=switch],input,select,[aria-pressed],[aria-checked],[aria-selected]';
  const items = [...document.querySelectorAll(sel)].filter(vis).map((e) => {
    const label = txt(e.getAttribute('aria-label') || e.innerText || e.value || e.title || e.closest('label')?.innerText || e.querySelector('img')?.alt);
    const selected = e.getAttribute('aria-pressed') === 'true' || e.getAttribute('aria-checked') === 'true' || e.getAttribute('aria-selected') === 'true' || e.checked === true || /(^|[-_ ])(active|selected|checked|current)([-_ A-Z]|$)/.test(e.className || '');
    const disabled = e.disabled === true || e.getAttribute('aria-disabled') === 'true' || /disabled/i.test(e.className || '');
    return (selected ? '[x] ' : '[ ] ') + (disabled ? '(disabled) ' : '') + (e.type === 'number' ? `number=${e.value} ` : '') + label.slice(0, 80);
  }).filter((s) => s.length > 4);
  const texts = [...document.querySelectorAll('h1,h2,h3,h4,h5,legend,p,span')].filter(vis).map((e) => txt(e.innerText)).filter((s) => s && s.length < 60 && /^[A-Z]/.test(s));
  return { header: txt([...document.querySelectorAll('button,div')].find((e) => /^Select /.test(txt(e.innerText)) && txt(e.innerText).length < 40)?.innerText), labels: [...new Set(texts)].slice(0, 40), controls: [...new Set(items)].slice(0, 150) };
}
