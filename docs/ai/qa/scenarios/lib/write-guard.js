// QA write-guard (navigate_page initScript, agent tab only): blocks every non-GET/HEAD/OPTIONS request
// from the top document (fetch, XHR, sendBeacon) and records it in window.__blockedWrites.
// Needed because the Summary page saves the configuration automatically (POST /modular/configurations/store).
(() => {
  if (window.__qaWriteGuard) return;
  window.__qaWriteGuard = true;
  window.__blockedWrites = [];
  const isWrite = (m) => m && !/^(GET|HEAD|OPTIONS)$/i.test(m);
  const note = (method, url) => window.__blockedWrites.push({ method: String(method).toUpperCase(), url: String(url).split('?')[0].slice(0, 160), at: new Date().toISOString() });
  const origFetch = window.fetch.bind(window);
  window.fetch = (input, init = {}) => {
    const url = typeof input === 'string' ? input : input?.url;
    const method = init.method || (typeof input === 'object' && input?.method) || 'GET';
    if (isWrite(method)) { note(method, url); return Promise.reject(new TypeError('blocked by QA write-guard')); }
    return origFetch(input, init);
  };
  const open = XMLHttpRequest.prototype.open;
  const send = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (m, u, ...rest) { this.__qaM = m; this.__qaU = u; return open.call(this, m, u, ...rest); };
  XMLHttpRequest.prototype.send = function (body) { if (isWrite(this.__qaM)) { note(this.__qaM, this.__qaU); this.abort(); return; } return send.call(this, body); };
  if (navigator.sendBeacon) navigator.sendBeacon = (url) => { note('BEACON', url); return true; };
})();
