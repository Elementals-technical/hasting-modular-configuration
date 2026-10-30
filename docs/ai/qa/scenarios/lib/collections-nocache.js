// QA harness (agent tab only): simulates the proposed loader fix — collection JSON fetched with cache:'no-cache'
// (forces revalidation, so a heuristically-fresh stale copy is not used). Combine with write-guard.js.
(() => {
  if (window.__qaCollectionsNoCache) return;
  window.__qaCollectionsNoCache = true;
  const prev = window.fetch.bind(window);
  window.fetch = (input, init = {}) => {
    const url = typeof input === 'string' ? input : input?.url;
    if (url && url.includes('/collections/')) return prev(input, { ...init, cache: 'no-cache' });
    return prev(input, init);
  };
})();
