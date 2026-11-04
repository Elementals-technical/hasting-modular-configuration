// Steps E-I: the other colour groups, the presets against staging, USH as a control, mobile and the custom flow.
const fs = require("node:fs");
const path = require("node:path");
const lib = require("./ulh10-lib.cjs");

const { OUT, STEPS } = process.env;
const steps = STEPS.split(",");
const log = (name, value) => console.log(JSON.stringify({ step: name, ...value }));
const shotDir = (name) => {
  const dir = path.join(OUT, name);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
};

const openSection = async (page, title) => {
  await page.getByRole("button", { name: title, exact: true }).first().click({ timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(800);
};

/** Waits for the scene and the prices to go quiet after a pick. */
const quiet = async (page, net, ms = 9000, limit = 80000) => {
  let seen = net.prices.length;
  let last = await lib.total(page);
  let since = Date.now();
  const from = Date.now();
  while (Date.now() - from < limit) {
    await page.waitForTimeout(1000);
    const now = await lib.total(page);
    if (net.prices.length !== seen || now !== last) {
      seen = net.prices.length;
      last = now;
      since = Date.now();
    }
    if (Date.now() - since > ms) break;
  }
  return last;
};

const skusSince = (net, mark) => [...new Set(net.prices.slice(mark).map(({ sku, price }) => `${sku} = ${price}`))];

const swatches = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll("button[aria-pressed][aria-label]")]
      .filter((button) => !button.getAttribute("aria-label").startsWith("Preview") && button.getAttribute("aria-label") !== "Open canvas full mode")
      .map((button) => ({
        name: button.getAttribute("aria-label"),
        pressed: button.getAttribute("aria-pressed") === "true",
        disabled: button.getAttribute("aria-disabled") === "true",
        group: button.closest("section")?.querySelector('[class*="groupTitle"]')?.textContent ?? null,
        preview: Boolean(document.querySelector(`button[aria-label="Preview ${CSS.escape(button.getAttribute("aria-label"))}"]`)),
      })),
  );

const countByGroup = (options) => {
  const by = {};
  for (const { group, disabled } of options) {
    by[group ?? "(none)"] ??= [0, 0];
    by[group ?? "(none)"][0] += 1;
    if (disabled) by[group ?? "(none)"][1] += 1;
  }
  return by;
};

const pick = async (page, label, timeout = 30000) => {
  const button = page.locator(`button[aria-pressed][aria-label="${label}"]`).first();
  await button.scrollIntoViewIfNeeded({ timeout });
  await button.click({ timeout });
};

(async () => {
  const browser = await lib.launch();

  if (steps.includes("E")) {
    const dir = shotDir("e-local");
    const { context, page, net } = await lib.open(browser);
    const out = {};
    try {
      await lib.openPreset(page, "local", "urban-low-height", 0);
      await page.waitForTimeout(25000);
      await lib.goToStep(page, "Color");
      await page.waitForTimeout(3000);
      await page.screenshot({ path: path.join(dir, "01-color.png") });
      const cabinet = await swatches(page);
      out.cabinet = { total: cabinet.length, byGroup: countByGroup(cabinet) };

      let mark = net.prices.length;
      await pick(page, "Blu Pavone A6 GL");
      out.afterCabinet = { total: await quiet(page, net), skus: skusSince(net, mark).filter((s) => s.startsWith("VAN-")), inScene: (await lib.sceneMaterials(page))?.includes("Blu Pavone A6 GL") };

      await openSection(page, "Handle Groove Color (Optional)");
      await page.screenshot({ path: path.join(dir, "02-groove.png") });
      const groove = await swatches(page);
      out.groove = { total: groove.length, byGroup: countByGroup(groove), first: groove.slice(0, 2).map(({ name }) => name) };
      mark = net.prices.length;
      await pick(page, "Castagno Malto 1C2");
      out.afterGroove = { total: await quiet(page, net), skus: skusSince(net, mark).filter((s) => s.startsWith("VAN-")) };

      await lib.goToStep(page, "Countertop");
      await openSection(page, "Countertop Style");
      await page.screenshot({ path: path.join(dir, "03-style.png") });
      out.styles = await swatches(page);
      mark = net.prices.length;
      const vesselStyle = page.getByRole("button", { name: /^Vessel/ }).first();
      await vesselStyle.click({ timeout: 15000 }).catch((error) => {
        out.styleError = String(error).slice(0, 160);
      });
      out.afterStyle = { total: await quiet(page, net), skus: skusSince(net, mark).filter((s) => s.startsWith("CT-")) };
      await openSection(page, "Basin style");
      await page.screenshot({ path: path.join(dir, "04-vessel-basin.png") });
      out.vessels = (await swatches(page)).map(({ name, pressed, disabled }) => `${pressed ? "*" : ""}${disabled ? "!" : ""}${name}`);
      for (const [vessel, colour] of [["Vessel Blade 11", "Gloss White OCB"], ["Vessel Urban Modo", "Matte Black T1D"], ["Vessel Acquarius", "Agata BD MT"]]) {
        mark = net.prices.length;
        await openSection(page, "Basin style");
        if (!(await page.locator(`button[aria-pressed][aria-label="${vessel}"]`).count())) await openSection(page, "Basin style");
        await pick(page, vessel).catch((error) => {
          out[`${vessel} error`] = String(error).slice(0, 160);
        });
        await quiet(page, net);
        await openSection(page, "Vessel Color");
        const colours = await swatches(page);
        const row = { colours: colours.length, byGroup: countByGroup(colours) };
        await page.screenshot({ path: path.join(dir, `05-${vessel.replace(/\W+/g, "_")}.png`) });
        if (colours.some(({ name }) => name === colour)) {
          await pick(page, colour).catch((error) => {
            row.pickError = String(error).slice(0, 160);
          });
          row.total = await quiet(page, net);
        }
        row.skus = skusSince(net, mark).filter((s) => s.startsWith("CT-"));
        row.inScene = (await lib.sceneMaterials(page))?.includes(colour);
        out[vessel] = row;
      }

      await lib.goToStep(page, "Accessories");
      await openSection(page, "Towel Bar");
      mark = net.prices.length;
      await page.getByRole("button", { name: "Left", exact: true }).first().click({ timeout: 15000 });
      await page.waitForTimeout(2500);
      await quiet(page, net);
      await page.screenshot({ path: path.join(dir, "06-towel.png") });
      out.towel = (await swatches(page)).filter(({ name }) => /M6|M7|0B|43|03|Nero|Bianco|Carbone|Copper|Creta/.test(name)).map(({ name, preview }) => `${name}${preview ? " [preview]" : ""}`);
      out.towelSkus = skusSince(net, mark);
    } catch (error) {
      out.error = String(error).slice(0, 300);
      await page.screenshot({ path: path.join(dir, "99-error.png") }).catch(() => {});
    }
    out.blocked = [...new Set(net.blocked)];
    out.configurators = [...net.configurators];
    fs.writeFileSync(path.join(dir, "result.json"), JSON.stringify(out, null, 1));
    log("E", out);
    await context.close();
  }

  if (steps.includes("V")) {
    const dir = shotDir("v-vessel");
    const index = Number(process.env.WIDE_INDEX);
    const out = {};
    const { context, page, net } = await lib.open(browser);
    try {
      out.preset = await lib.openPreset(page, "local", "urban-low-height", index);
      await page.waitForTimeout(25000);
      await lib.goToStep(page, "Countertop");
      await openSection(page, "Countertop Style");
      out.styles = await swatches(page);
      let mark = net.prices.length;
      await page.locator('button[aria-pressed][aria-label="Vessel"]').first().click({ timeout: 15000 });
      out.afterStyle = { total: await quiet(page, net), skus: skusSince(net, mark).filter((s) => s.startsWith("CT-")) };
      await openSection(page, "Vessel Sink Style");
      await page.screenshot({ path: path.join(dir, "01-vessel-basins.png") });
      out.vessels = (await swatches(page)).map(({ name, pressed, disabled }) => `${pressed ? "*" : ""}${disabled ? "!" : ""}${name}`);
      for (const [vessel, colour] of [["Vessel Blade 11", "Gloss White OCB"], ["Vessel Urban Modo", "Matte Black T1D"], ["Vessel Acquarius", "Agata BD MT"]]) {
        mark = net.prices.length;
        if (!(await page.locator(`button[aria-pressed][aria-label="${vessel}"]`).count())) {
          await openSection(page, "Vessel Sink Style");
        }
        const row = {};
        await pick(page, vessel).catch((error) => {
          row.error = String(error).slice(0, 160);
        });
        await quiet(page, net);
        await openSection(page, "Vessel Color");
        const colours = await swatches(page);
        row.colours = colours.length;
        row.enabled = colours.filter(({ disabled }) => !disabled).length;
        row.byGroup = countByGroup(colours);
        row.sample = colours.slice(0, 7).map(({ name, pressed, disabled }) => `${pressed ? "*" : ""}${disabled ? "!" : ""}${name}`);
        await page.screenshot({ path: path.join(dir, `02-${vessel.replace(/\W+/g, "_")}.png`) });
        if (colours.some(({ name }) => name === colour)) {
          await pick(page, colour).catch((error) => {
            row.pickError = String(error).slice(0, 160);
          });
          row.total = await quiet(page, net);
        }
        row.skus = skusSince(net, mark).filter((s) => !s.startsWith("VAN-"));
        row.inScene = (await lib.sceneMaterials(page))?.includes(colour);
        row.headers = await page.evaluate(() => [...document.querySelectorAll("button[aria-expanded]")].map((button) => `${button.getAttribute("aria-expanded") === "true" ? "+" : "-"}${button.textContent.trim().slice(0, 30)}`));
        out[vessel] = row;
      }
    } catch (error) {
      out.error = String(error).slice(0, 300);
      await page.screenshot({ path: path.join(dir, "99-error.png") }).catch(() => {});
    }
    out.blocked = [...new Set(net.blocked)];
    log("V", out);
    await context.close();
  }

  if (steps.includes("M")) {
    const dir = shotDir("m-matte-white");
    const out = {};
    const { context, page, net } = await lib.open(browser);
    try {
      await lib.openPreset(page, "local", "urban-low-height", Number(process.env.WIDE_INDEX));
      await page.waitForTimeout(25000);
      await lib.goToStep(page, "Countertop");
      await pick(page, "Aosta Green Marble Lucidato TR4");
      out.porcelain = await quiet(page, net, 15000);
      let mark = net.prices.length;
      await pick(page, "Matte White");
      out.total = await quiet(page, net, 20000, 120000);
      out.skus = skusSince(net, mark).filter((s) => s.startsWith("CT-"));
      out.inScene = (await lib.sceneMaterials(page))?.includes("Solid Surface Matte White");
      await openSection(page, "Thickness");
      out.thickness = (await swatches(page)).map(({ name, pressed, disabled }) => `${pressed ? "*" : ""}${disabled ? "!" : ""}${name}`);
      await page.screenshot({ path: path.join(dir, "01-thickness.png") });
      await openSection(page, "Basin style");
      const basins = await swatches(page);
      out.basins = basins.map(({ name, pressed, disabled }) => `${pressed ? "*" : ""}${disabled ? "!" : ""}${name}`);
      await page.screenshot({ path: path.join(dir, "02-basins.png") });
      out.perBasin = {};
      for (const { name, disabled, pressed } of basins) {
        if (disabled || pressed) continue;
        mark = net.prices.length;
        await pick(page, name).catch(() => {});
        const total = await quiet(page, net, 12000, 70000);
        out.perBasin[name] = { total, skus: skusSince(net, mark).filter((s) => s.startsWith("CT-")), inScene: (await lib.sceneMaterials(page))?.includes("Solid Surface Matte White") };
      }
    } catch (error) {
      out.error = String(error).slice(0, 300);
      await page.screenshot({ path: path.join(dir, "99-error.png") }).catch(() => {});
    }
    out.blocked = [...new Set(net.blocked)];
    log("M", out);
    await context.close();
  }

  if (steps.includes("F")) {
    const rows = [];
    for (const index of [0, 12, 25, 38, 53, 58]) {
      const row = { index };
      for (const env of ["local", "base"]) {
        const { context, page, net } = await lib.open(browser);
        try {
          row.preset = await lib.openPreset(page, env, "urban-low-height", index);
          row.url = new URL(page.url()).search;
          await page.waitForTimeout(15000);
          row[env] = { total: await quiet(page, net, 15000, 90000), configurators: [...net.configurators], consoleErrors: [...new Set(net.consoleErrors)].map((line) => line.slice(0, 90)) };
          row[`${env}Skus`] = [...new Set(net.prices.map(({ sku }) => sku))].sort();
          row[`${env}Prices`] = Object.fromEntries(net.prices.map(({ sku, price }) => [sku, price]));
          await page.screenshot({ path: path.join(shotDir("f-presets"), `${env}-${index}.png`) });
        } catch (error) {
          row[env] = { error: String(error).slice(0, 200) };
        }
        await context.close();
      }
      row.sameSkus = JSON.stringify(row.localSkus) === JSON.stringify(row.baseSkus);
      rows.push(row);
      fs.writeFileSync(path.join(shotDir("f-presets"), "rows.json"), JSON.stringify(rows, null, 1));
      log("F", { index, preset: row.preset, local: row.local, base: row.base, sameSkus: row.sameSkus, onlyLocal: (row.localSkus ?? []).filter((s) => !(row.baseSkus ?? []).includes(s)).slice(0, 6), onlyBase: (row.baseSkus ?? []).filter((s) => !(row.localSkus ?? []).includes(s)).slice(0, 6) });
    }
  }

  if (steps.includes("G")) {
    for (const env of ["local", "staging"]) {
      const { context, page, net } = await lib.open(browser);
      const out = { env };
      try {
        out.preset = await lib.openPreset(page, env, "urban-standard-height", 0);
        await page.waitForTimeout(15000);
        out.total = await quiet(page, net, 8000, 60000);
        out.configurators = [...net.configurators];
        await lib.goToStep(page, "Countertop");
        await page.waitForTimeout(3000);
        const options = await swatches(page);
        out.countertop = { total: options.length, byGroup: countByGroup(options) };
        out.skus = [...new Set(net.prices.map(({ sku }) => sku))].sort();
        await page.screenshot({ path: path.join(shotDir("g-ush"), `${env}.png`) });
      } catch (error) {
        out.error = String(error).slice(0, 200);
      }
      log("G", out);
      await context.close();
    }
  }

  if (steps.includes("H")) {
    const dir = shotDir("h-mobile");
    const { context, page, net } = await lib.open(browser, { width: 390, height: 844 });
    const out = {};
    try {
      await lib.openPreset(page, "local", "urban-low-height", 0);
      await page.waitForTimeout(20000);
      await lib.goToStep(page, "Countertop");
      await page.waitForTimeout(3000);
      await openSection(page, "Countertop Color");
      await page.waitForTimeout(1500);
      const options = await swatches(page);
      out.countertop = { total: options.length, byGroup: countByGroup(options) };
      out.overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      await page.screenshot({ path: path.join(dir, "01-countertop.png") });
      await lib.goToStep(page, "Accessories");
      await openSection(page, "Towel Bar");
      await page.getByRole("button", { name: "Left", exact: true }).first().click({ timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(4000);
      await page.screenshot({ path: path.join(dir, "02-towel.png") });
      out.towelPreviews = await page.evaluate(() => [...document.querySelectorAll('button[aria-label^="Preview"]')].map((button) => button.getAttribute("aria-label")));
    } catch (error) {
      out.error = String(error).slice(0, 200);
    }
    out.blocked = [...new Set(net.blocked)];
    out.configurators = [...net.configurators];
    log("H", out);
    await context.close();
  }

  if (steps.includes("I")) {
    const dir = shotDir("i-custom");
    const { context, page, net } = await lib.open(browser);
    const out = {};
    try {
      await page.goto(`${lib.HOSTS.local}/custom/cabinet-builder?collectionId=urban-low-height&preset=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
      const skip = page.getByRole("button", { name: "Skip", exact: true });
      await skip.waitFor({ state: "visible", timeout: 30000 }).then(() => skip.click()).catch(() => {});
      await page.waitForFunction(() => /Total List Price \$[1-9]/.test(document.body.innerText.replace(/\s+/g, " ")), null, { timeout: 180000 }).catch(() => {});
      await page.waitForTimeout(25000);
      out.total = await lib.total(page);
      out.url = new URL(page.url()).pathname;
      await page.screenshot({ path: path.join(dir, "01-builder.png") });
      await lib.goToStep(page, "Countertop");
      await page.waitForTimeout(3000);
      out.urlStep = new URL(page.url()).pathname;
      const options = await swatches(page);
      out.countertop = { total: options.length, byGroup: countByGroup(options) };
      await page.screenshot({ path: path.join(dir, "02-countertop.png") });
      const mark = net.prices.length;
      await pick(page, "Calacatta 259");
      out.afterPick = { total: await quiet(page, net), skus: skusSince(net, mark).filter((s) => s.startsWith("CT-")), inScene: (await lib.sceneMaterials(page))?.includes("Calacatta 259") };
    } catch (error) {
      out.error = String(error).slice(0, 240);
      await page.screenshot({ path: path.join(dir, "99-error.png") }).catch(() => {});
    }
    out.blocked = [...new Set(net.blocked)];
    out.configurators = [...net.configurators];
    log("I", out);
    await context.close();
  }

  await browser.close();
})();
