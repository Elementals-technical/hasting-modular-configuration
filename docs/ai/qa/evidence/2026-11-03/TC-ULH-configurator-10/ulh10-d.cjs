// Step D: all 89 countertop colours, one after another: scene material, final SKU, price. Stops waiting once the scene wears it and the prices are quiet.
const fs = require("node:fs");
const path = require("node:path");
const lib = require("./ulh10-lib.cjs");

const { REPO, OUT } = process.env;
const configurator = JSON.parse(fs.readFileSync(`${REPO}/src/entities/collection/__tests__/fixtures/remote/configurator-10.json`));
const bindings = JSON.parse(fs.readFileSync(`${REPO}/public/collections/urban-low-height/runtime-bindings.json`));
const overrides = bindings.bindings.find(({ attributeId }) => attributeId === "CountertopColor").values.overrides;
const variants = configurator.availableOptions
  .find(({ proxyName }) => proxyName === "Select Countertop Color")
  .options.flatMap(({ variants: list }) => list)
  .filter(({ metadata }) => metadata.sku);

(async () => {
  const browser = await lib.launch();
  const dir = path.join(OUT, process.env.DIR ?? "d-local");
  fs.mkdirSync(dir, { recursive: true });
  const { context, page, net } = await lib.open(browser);
  const rows = [];
  await lib.openPreset(page, "local", "urban-low-height", 0);
  await lib.goToStep(page, "Countertop");
  await page.waitForTimeout(30000);
  const sorted = [...variants].sort((a, b) => String(a.metadata.Material).localeCompare(String(b.metadata.Material)));
  const only = process.env.ONLY ? new Set(JSON.parse(fs.readFileSync(process.env.ONLY))) : null;
  const order = only ? sorted.filter(({ name }) => only.has(name)) : sorted;
  for (const { name, metadata } of order) {
    const label = metadata.label ?? name;
    const expected = overrides[name] ?? name;
    const row = { name, label, material: metadata.Material, sku: metadata.sku, code: metadata.codeColor, expected };
    const mark = net.prices.length;
    const started = Date.now();
    const button = page.locator(`button[aria-pressed][aria-label="${label}"]`).first();
    try {
      await button.scrollIntoViewIfNeeded({ timeout: 30000 });
      row.disabled = (await button.getAttribute("aria-disabled")) === "true";
      await button.click({ timeout: 30000 });
      let quietSince = Date.now();
      let seen = net.prices.length;
      let lastTotal = null;
      while (Date.now() - started < 90000) {
        await page.waitForTimeout(1000);
        const now = await lib.total(page);
        if (net.prices.length !== seen || now !== lastTotal) {
          seen = net.prices.length;
          lastTotal = now;
          quietSince = Date.now();
        }
        const scene = (await lib.sceneMaterials(page)) ?? [];
        row.inScene = scene.includes(expected);
        row.cabinetInScene = scene.includes("Rox Black TKQ");
        if (row.inScene && net.prices.length > mark && Date.now() - quietSince > 9000 && !scene.includes("BoolMat")) break;
      }
      row.seconds = Math.round((Date.now() - started) / 1000);
      row.total = await lib.total(page);
      row.pressed = (await button.getAttribute("aria-pressed")) === "true";
      const prices = net.prices.slice(mark).filter(({ sku }) => sku?.startsWith("CT-"));
      row.final = Object.fromEntries(prices.slice(-3).map(({ sku, price }) => [sku, price]));
    } catch (error) {
      row.error = String(error).slice(0, 200);
    }
    rows.push(row);
    fs.writeFileSync(path.join(dir, "rows.json"), JSON.stringify(rows, null, 1));
    console.log(JSON.stringify({ n: rows.length, name, disabled: row.disabled, inScene: row.inScene, cabinet: row.cabinetInScene, pressed: row.pressed, s: row.seconds, total: row.total, final: Object.keys(row.final ?? {}).join(" "), error: row.error }));
    if (row.total === "Total List Price $0.00" || row.cabinetInScene === false) await page.screenshot({ path: path.join(dir, `odd-${rows.length}.png`) });
  }
  fs.writeFileSync(path.join(dir, "net.json"), JSON.stringify({ blocked: [...new Set(net.blocked)], configurators: [...net.configurators], consoleErrors: [...new Set(net.consoleErrors)] }, null, 1));
  await context.close();
  await browser.close();
})();
