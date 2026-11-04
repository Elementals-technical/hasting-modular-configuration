// Step A: what the Countertop step of Urban Low Height offers on configurator 10, on both builds.
const fs = require("node:fs");
const path = require("node:path");
const lib = require("./ulh10-lib.cjs");

const OUT = process.env.OUT;

(async () => {
  const browser = await lib.launch();
  for (const env of process.env.ENVS.split(",")) {
    const dir = path.join(OUT, `a-${env}`);
    fs.mkdirSync(dir, { recursive: true });
    const { context, page, net } = await lib.open(browser);
    const result = { env };
    try {
      result.preset = await lib.openPreset(page, env, "urban-low-height", 0);
      result.modelTotal = await lib.total(page);
      await lib.goToStep(page, "Countertop");
      result.path = new URL(page.url()).pathname;
      await page.screenshot({ path: path.join(dir, "01-countertop.png") });
      result.panel = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, " ").slice(0, 900);
      const options = await lib.dumpOptions(page);
      result.summary = lib.summarise(options);
      result.options = options;
      result.filters = await page.evaluate(() =>
        [...document.querySelectorAll("[data-filter]")].map((el) => ({ filter: el.getAttribute("data-filter"), text: el.textContent.trim().slice(0, 40) })),
      );
      const material = page.locator('[data-filter="material"], [data-filter="Material"]').first();
      if (await material.count()) {
        await material.locator("button, [role=combobox]").first().click({ timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(800);
        result.materialFilter = await page.evaluate(() =>
          [...document.querySelectorAll('[role="listbox"] [role="option"], [role="listbox"] li, [role="menu"] [role="menuitem"]')].map((el) => el.textContent.trim()),
        );
        await page.screenshot({ path: path.join(dir, "02-material-filter.png") });
        await page.keyboard.press("Escape");
      }
      result.scene = await lib.sceneMaterials(page);
    } catch (error) {
      result.error = String(error).slice(0, 400);
      await page.screenshot({ path: path.join(dir, "99-error.png") }).catch(() => {});
    }
    result.configurators = [...net.configurators];
    result.blocked = [...new Set(net.blocked)];
    result.prices = net.prices.map(({ sku, price, status }) => ({ sku, price, status }));
    result.consoleErrors = [...new Set(net.consoleErrors)].slice(0, 12);
    fs.writeFileSync(path.join(dir, "result.json"), JSON.stringify(result, null, 2));
    console.log(
      JSON.stringify(
        { env, preset: result.preset, modelTotal: result.modelTotal, path: result.path, error: result.error, configurators: result.configurators, summary: result.summary, filters: result.filters, materialFilter: result.materialFilter, scene: result.scene?.length, consoleErrors: result.consoleErrors, blocked: result.blocked, prices: result.prices.slice(0, 8) },
        null,
        1,
      ),
    );
    await context.close();
  }
  await browser.close();
})();
