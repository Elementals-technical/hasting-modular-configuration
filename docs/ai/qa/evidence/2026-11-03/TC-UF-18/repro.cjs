// UF-18 reproduction: isolated system Chrome (temp profile), every non-GET request blocked, Summary never opened.
const { chromium } = require(process.env.REPO + "/node_modules/@playwright/test");
const fs = require("node:fs");
const path = require("node:path");

const OUT = process.env.OUT;
const STAGING = "https://hasting-modular-phase-2-staging-ar3wz.ondigitalocean.app";
const P98 = "https://hasting-modular-phase-2-p98qb.ondigitalocean.app";
const COLOURS = [
  "Bianco 0B MT",
  "Carbone 43 MT",
  "Metallizzato Copper M7 MT",
  "Metallizzato Creta M6 MT",
  "Nero 03 MT",
];
const RUNS = JSON.parse(process.env.RUNS);

const run = async (browser, { label, host, collection, viewport }) => {
  const dir = path.join(OUT, label);
  fs.mkdirSync(dir, { recursive: true });
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const blocked = [];
  await context.route("**/*", (route) => {
    const request = route.request();
    if (["GET", "HEAD", "OPTIONS"].includes(request.method())) return route.continue();
    blocked.push(`${request.method()} ${new URL(request.url()).host}${new URL(request.url()).pathname}`);
    return route.abort();
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
  const result = { label, host: new URL(host).host, collection, viewport, steps: [] };
  const step = (s) => {
    result.steps.push(s);
    console.log(`[${label}] ${s}`);
  };
  try {
    await page.goto(`${host}/prebuilt/model?collectionId=${collection}`, { waitUntil: "domcontentloaded", timeout: 90000 });
    const html = await page.content();
    result.bundle = (html.match(/index-[A-Za-z0-9_-]+\.js/) || [])[0];
    const skip = page.getByRole("button", { name: "Skip", exact: true });
    await skip.waitFor({ state: "visible", timeout: 30000 }).then(() => skip.click()).then(() => step("walkthrough skipped")).catch(() => step("no walkthrough"));
    await page.waitForTimeout(2000);

    const card = page.locator('img[src*="/collections/"]').first();
    await card.waitFor({ state: "visible", timeout: 60000 });
    result.preset = (await card.getAttribute("src")).split("/").pop();
    await card.click();
    step(`preset clicked: ${decodeURIComponent(result.preset)}`);
    const priceReady = await page
      .waitForFunction(() => /\$[1-9]/.test(document.body.innerText.match(/Total List Price[\s\S]{0,40}/)?.[0] ?? ""), null, { timeout: 120000 })
      .then(() => true)
      .catch(() => false);
    result.priceLoaded = priceReady;
    step(`price loaded: ${priceReady}`);

    await page.locator('nav[aria-label="Configurator steps"] a', { hasText: "Accessories" }).first().evaluate((el) => el.click());
    await page.waitForTimeout(4000);
    step(`url: ${new URL(page.url()).pathname}`);
    const towel = page.getByRole("button", { name: "Towel Bar", exact: true });
    await towel.waitFor({ state: "visible", timeout: 30000 });
    // The only section of a model is open by default: a click would close it.
    if ((await towel.getAttribute("aria-expanded")) !== "true") await towel.click();
    await page.waitForTimeout(1500);
    const left = page.getByRole("button", { name: "Left", exact: true });
    await left.waitFor({ state: "visible", timeout: 15000 });
    await left.click();
    step("Towel Bar: Left");
    await page.locator(`button[aria-label="${COLOURS[0]}"]`).waitFor({ state: "visible", timeout: 30000 });
    await page.waitForTimeout(2500);

    result.cards = await page.evaluate((names) => {
      return names.map((name) => {
        const button = document.querySelector(`button[aria-label="${name}"]`);
        const card = button?.parentElement;
        const img = button?.querySelector("img");
        const rect = button?.querySelector('[class*="image"]')?.getBoundingClientRect();
        return {
          colour: name,
          card: Boolean(button),
          previewButton: Boolean(document.querySelector(`button[aria-label="Preview ${name}"]`)),
          visual: img ? "image" : button?.querySelector('[class*="colorSwatch"]') ? "hex" : "none",
          imageLoaded: img ? img.complete && img.naturalWidth > 0 : null,
          materialClass: /materialOption/.test(card?.className ?? ""),
          titleVisible: Boolean(button?.querySelector('[class*="title"]')?.offsetParent),
          box: rect ? `${Math.round(rect.width)}x${Math.round(rect.height)}` : null,
        };
      });
    }, COLOURS);
    await page.screenshot({ path: path.join(dir, "01-towel-colours.png") });

    const firstHexCard = page.locator(`button[aria-label="Nero 03 MT"]`);
    await firstHexCard.hover().catch(() => {});
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(dir, "02-hover-nero.png") });
    const metallic = page.locator(`button[aria-label="Metallizzato Copper M7 MT"]`);
    await metallic.hover().catch(() => {});
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(dir, "03-hover-copper.png") });

    const preview = page.locator(`button[aria-label="Preview Nero 03 MT"]`);
    if (await preview.count()) {
      await firstHexCard.hover().catch(() => {});
      await preview.click({ timeout: 5000 }).catch((e) => step(`preview click failed: ${String(e).slice(0, 120)}`));
      await page.waitForTimeout(800);
      await page.screenshot({ path: path.join(dir, "04-preview-nero-modal.png") });
    }
  } catch (error) {
    result.error = String(error).slice(0, 400);
    await page.screenshot({ path: path.join(dir, "99-error.png") }).catch(() => {});
    step(`ERROR ${result.error}`);
  }
  result.blockedWrites = [...new Set(blocked)];
  result.pageErrors = [...new Set(errors)].slice(0, 5);
  fs.writeFileSync(path.join(dir, "result.json"), JSON.stringify(result, null, 2));
  await context.close();
  return result;
};

(async () => {
  const browser = await chromium.launch({
    channel: "chrome",
    headless: true,
    args: ["--use-angle=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"],
  });
  console.log("chrome", browser.version());
  for (const spec of RUNS) {
    const host = spec.env === "p98qb" ? P98 : STAGING;
    await run(browser, { ...spec, host, viewport: spec.viewport ?? { width: 1600, height: 900 } });
  }
  await browser.close();
})();
