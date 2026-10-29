() => {
  // Read-only: find the active-collection error object in React state (fiber walk from the error card).
  const h1 = [...document.querySelectorAll('h1')].find((e) => /Collection unavailable/.test(e.innerText));
  if (!h1) return { error: null, note: 'no error screen' };
  const key = Object.keys(h1).find((k) => k.startsWith('__reactFiber$'));
  let fiber = h1[key];
  const seen = [];
  const found = [];
  const scan = (v, depth, path) => {
    if (!v || typeof v !== 'object' || depth > 5 || seen.includes(v)) return;
    seen.push(v);
    if (v.status === 'error' && v.error) found.push({ path, error: JSON.parse(JSON.stringify(v.error, (k, x) => (typeof x === 'function' ? undefined : x))) });
    for (const [k, x] of Object.entries(v)) if (!k.startsWith('_') && k !== 'children') scan(x, depth + 1, path + '.' + k);
  };
  for (let i = 0; fiber && i < 60 && !found.length; i++, fiber = fiber.return) {
    let hook = fiber.memoizedState;
    for (let j = 0; hook && j < 40; j++, hook = hook.next) scan(hook.memoizedState, 0, `fiber${i}.hook${j}`);
    scan(fiber.memoizedProps, 0, `fiber${i}.props`);
  }
  return found.length ? JSON.stringify(found[0]).slice(0, 4000) : { error: 'not found in state' };
}
