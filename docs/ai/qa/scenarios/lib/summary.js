() => {
  // Read-only: Summary page lines (name / spec / finish / price) and total.
  const t = document.body.innerText;
  const i = t.indexOf('Your Configuration');
  const j = t.indexOf('Total List Price', i);
  return { total: (t.slice(j).match(/\$[\d,]+(\.\d+)?/) || [null])[0], block: i >= 0 ? t.slice(i, j > 0 ? j : i + 4000).slice(0, 4000) : t.slice(0, 3000) };
}
