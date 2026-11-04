// Step C: one colour on a fresh page: what happens to the scene, the thickness, the basin and the price.
const fs = require("node:fs");
const path = require("node:path");
const lib = require("./ulh10-lib.cjs");

const { OUT, RUNS } = process.env;

const readField = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll("[aria-pressed]")]
      .filter((el) => !el.closest("section") && !(el.getAttribute("aria-label") ?? "").startsWith("Preview") && el.getAttribute("aria-label") !== "Open canvas full mode")
      .map((el) => `${el.getAttribute("aria-pressed") === "true" ? "*" : ""}${el.getAttribute("aria-disabled") === "true" ? "!" : ""}${el.getAttribute("aria-label") ?? el.textContent.trim().slice(0, 30)}`),
  );

(async () => {
  const browser = await lib.launch();
  // RUNS: env|collection|preset index|colour label[|group title], separated by ;
  for (const run of RUNS.split(";")) {
    const [env, collection, index, label, group] = run.split("|");
    const tag = `${env}-${collection}-${label.replace(/\W+/g, "_")}`;
    const dir = path.join(OUT, `c-${tag}`);
    fs.mkdirSync(dir, { recursive: true });
    const { context, page, net } = await lib.open(browser);
    const logs = [];
    page.on("pageerror", (error) => logs.push(`pageerror: ${String(error).slice(0, 300)}`));
    page.on("console", (message) => {
      if (["error", "warning"].includes(message.type())) logs.push(`${message.type()}: ${message.text().slice(0, 300)}`);
    });
    const result = { env, collection, label };
    try {
      await lib.openPreset(page, env, collection, Number(index));
      await lib.goToStep(page, "Countertop");
      result.before = await lib.sceneMaterials(page);
      result.totalBefore = await lib.total(page);
      await page.waitForTimeout(Number(process.env.WAIT_FIRST ?? 20000));
      result.picks = [];
      const openSection = async (title) => {
        await page.getByRole("button", { name: title, exact: true }).first().click({ timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(600);
      };
      for (const pick of label.split(",")) {
        logs.length = 0;
        const row = { pick };
        const mark = net.prices.length;
        const button = page.locator(`button[aria-pressed][aria-label="${pick}"]`).first();
        if (!(await button.count())) await openSection("Countertop Color");
        await button.scrollIntoViewIfNeeded({ timeout: 10000 });
        row.disabledBefore = (await button.getAttribute("aria-disabled")) === "true";
        await button.click({ timeout: 8000 });
        const samples = [];
        for (let second = 5; second <= Number(process.env.PICK_WAIT ?? 45); second += 5) {
          await page.waitForTimeout(5000);
          samples.push(`${second}s ${(await lib.total(page))?.replace("Total List Price ", "")} ${(await lib.sceneMaterials(page))?.length ?? "-"}`);
        }
        row.samples = samples.join(" | ");
        row.pressed = (await button.getAttribute("aria-pressed")) === "true";
        row.scene = await lib.sceneMaterials(page);
        row.skus = net.prices.slice(mark).map(({ sku, price }) => `${sku} = ${price}`);
        row.logs = [...new Set(logs)].filter((line) => !line.includes("same key")).slice(0, 12);
        await page.screenshot({ path: path.join(dir, `pick-${pick.replace(/\W+/g, "_")}.png`) });
        await openSection("Thickness");
        row.thickness = await readField(page);
        await openSection("Basin style");
        row.basin = await readField(page);
        await page.screenshot({ path: path.join(dir, `basin-${pick.replace(/\W+/g, "_")}.png`) });
        await page.waitForTimeout(Number(process.env.AFTER ?? 0));
        row.after = `${await lib.total(page)} ${JSON.stringify(await lib.sceneMaterials(page))}`;
        result.picks.push(row);
      }
    } catch (error) {
      result.error = String(error).slice(0, 300);
      await page.screenshot({ path: path.join(dir, "99-error.png") }).catch(() => {});
    }
    result.blocked = [...new Set(net.blocked)];
    fs.writeFileSync(path.join(dir, "result.json"), JSON.stringify(result, null, 1));
    console.log(JSON.stringify(result));
    await context.close();
  }
  await browser.close();
})();
