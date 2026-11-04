// Shared harness: isolated system Chrome, non-GET blocked, Summary never opened.
const { chromium } = require(process.env.REPO + "/node_modules/@playwright/test");

const HOSTS = { local: process.env.LOCAL_URL, base: process.env.BASE_URL, staging: "https://hasting-modular-phase-2-staging-ar3wz.ondigitalocean.app" };

const launch = () =>
  chromium.launch({
    channel: "chrome",
    headless: true,
    args: ["--use-angle=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"],
  });

const open = async (browser, viewport = { width: 1600, height: 1000 }) => {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const net = { blocked: [], configurators: new Set(), prices: [], consoleErrors: [] };
  await context.route("**/*", (route) => {
    const request = route.request();
    if (["GET", "HEAD", "OPTIONS"].includes(request.method())) return route.continue();
    net.blocked.push(`${request.method()} ${new URL(request.url()).pathname}`);
    return route.abort();
  });
  const page = await context.newPage();
  page.on("response", async (response) => {
    const url = new URL(response.url());
    const configurator = url.pathname.match(/\/configurators\/(\d+)$/);
    if (configurator) net.configurators.add(Number(configurator[1]));
    if (url.pathname.endsWith("/pricing-v2/resolve")) {
      const body = await response.json().catch(() => null);
      net.prices.push({
        at: Date.now(),
        sku: url.searchParams.get("sku"),
        status: response.status(),
        price: body?.price ?? body?.data?.price ?? body?.total ?? null,
        body: body && JSON.stringify(body).slice(0, 160),
      });
    }
  });
  page.on("console", (message) => {
    if (message.type() === "error") net.consoleErrors.push(message.text().slice(0, 200));
  });
  return { context, page, net };
};

/** Opens a prebuilt model, waits for its price, and for ?preset=, which otherwise sends the app back to Model. */
const openPreset = async (page, env, collection, index) => {
  await page.goto(`${HOSTS[env]}/prebuilt/model?collectionId=${collection}`, { waitUntil: "domcontentloaded", timeout: 120000 });
  const skip = page.getByRole("button", { name: "Skip", exact: true });
  await skip.waitFor({ state: "visible", timeout: 30000 }).then(() => skip.click()).catch(() => {});
  await page.waitForTimeout(2000);
  const card = page.locator('img[src*="/collections/"]').nth(index);
  await card.waitFor({ state: "visible", timeout: 60000 });
  const preset = decodeURIComponent((await card.getAttribute("src")).split("/").pop());
  await card.click();
  await page.waitForFunction(() => /Price \$[1-9]/.test(document.body.innerText.replace(/\s+/g, " ")), null, { timeout: 180000 }).catch(() => {});
  await page.waitForURL(/[?&]preset=/, { timeout: env === "staging" ? 15000 : 150000 }).catch(() => {});
  await settle(page);
  return preset;
};

const total = (page) =>
  page.evaluate(() => (document.body.innerText.replace(/\s+/g, " ").match(/Price \$[\d,.]+/) || [null])[0]);

/** Waits until the total has stopped changing for `quiet` ms. */
const settle = async (page, quiet = 6000, limit = 60000) => {
  let last = await total(page);
  let since = Date.now();
  const from = Date.now();
  while (Date.now() - from < limit) {
    await page.waitForTimeout(1000);
    const now = await total(page);
    if (now !== last) {
      last = now;
      since = Date.now();
    }
    if (Date.now() - since >= quiet) break;
  }
  return last;
};

const goToStep = async (page, name) => {
  await page.locator('nav[aria-label="Configurator steps"] a', { hasText: name }).first().evaluate((el) => el.click());
  await page.waitForTimeout(5000);
};

const dumpOptions = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll("button[aria-pressed][aria-label]")]
      .filter((button) => !button.getAttribute("aria-label").startsWith("Preview") && button.closest("section"))
      .map((button) => ({
        name: button.getAttribute("aria-label"),
        pressed: button.getAttribute("aria-pressed") === "true",
        disabled: button.getAttribute("aria-disabled") === "true",
        group: button.closest("section")?.querySelector('[class*="groupTitle"]')?.textContent ?? null,
        region: button.closest('[role="region"]')?.getAttribute("aria-label") ?? null,
      })),
  );

const summarise = (options) => {
  const by = {};
  for (const option of options) {
    const key = `${option.region ?? "?"} / ${option.group ?? "?"}`;
    by[key] ??= { total: 0, disabled: 0 };
    by[key].total += 1;
    if (option.disabled) by[key].disabled += 1;
  }
  return by;
};

/** The materials the scene's meshes wear now, read from the PlayCanvas app in its iframe. */
const sceneMaterials = async (page) => {
  for (const frame of page.frames()) {
    const names = await frame
      .evaluate(() => {
        const app = window.pc?.Application?.getApplication?.() ?? window.pc?.app ?? null;
        if (!app) return null;
        const found = new Set();
        for (const render of app.root.findComponents("render")) {
          if (!render.entity.enabled) continue;
          for (const mesh of render.meshInstances ?? []) if (mesh.material?.name) found.add(mesh.material.name);
        }
        return [...found];
      })
      .catch(() => null);
    if (names) return names;
  }
  return null;
};

module.exports = { HOSTS, launch, open, openPreset, settle, total, goToStep, dumpOptions, summarise, sceneMaterials };
