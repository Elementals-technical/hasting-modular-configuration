import { defineConfig, devices } from "@playwright/test";

/**
 * UI end-to-end checks. Two ways to run them, by the PlayCanvas scene the UI shows:
 *
 *   npm run e2e:local   the scene on the LOCAL PlayCanvas sources: `npm run dev:pc-local` (vite.playcanvas-local.ts:
 *                       the export in .env.pc-local.local + scripts from the PlayCanvas repo src)
 *   npm run e2e:dev     the scene as the UI ships it: `npm run dev`, the export in public/HastingCabinetsParametrization
 *
 * One collection = one project (e2e/<collection>/): `npm run e2e:local -- --project=ulh`.
 * A dev server already running on the port is reused; the tests check that it serves the requested mode
 * (support/configurator.ts, expectSceneMode) and stop with a clear message otherwise.
 * E2E_BASE_URL runs them against another UI (stage): no server is started and the mode is not checked.
 */
const MODES = { local: "dev:pc-local", dev: "dev" } as const;
type Mode = keyof typeof MODES;

// Set here, read by the tests: the workers inherit the environment of this process.
const mode = (process.env.E2E_MODE ??= "dev") as Mode;
if (!(mode in MODES)) throw new Error(`E2E_MODE=${mode}: expected "local" or "dev"`);

const external = process.env.E2E_BASE_URL;
const port = Number(process.env.E2E_PORT ?? 5173);
const baseURL = external ?? `http://localhost:${port}`;

export default defineConfig({
  // One WebGL scene at a time: the scenes are heavy.
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 30_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    // WebGL without a GPU (headless, CI).
    launchOptions: { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] },
  },
  projects: [
    { name: "ulh", testDir: "./e2e/ulh" },
    // { name: "ud", testDir: "./e2e/ud" }, — one entry per collection folder
  ],
  webServer: external
    ? undefined
    : {
        command: `npm run ${MODES[mode]} -- --port ${port} --strictPort`,
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
