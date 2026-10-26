import { expect, type Frame, type Page } from "@playwright/test";
import { COLLECTIONS, readPreset, type CollectionKey } from "./collections";
import { createSceneReader } from "./scene";

/**
 * The PlayCanvas iframe through its ConfiguratorAPI: the same calls the UI makes, without pointer gestures.
 * Every call runs inside the iframe (frame.evaluate). Positions are world metres.
 */

export type Vec3 = { x: number; y: number; z: number };
export type Cabinet = { id: string; definitionId: string; positionM: Vec3; selection: Record<string, unknown> };
export type DraftState = {
  canApply: boolean;
  candidateRevision: number;
  validation: { status: string; reasons: { code: string; message?: string }[] };
};
export type CountertopState = {
  productId: string | null;
  placementState: string;
  offset: { x: number; y: number };
  size: { length: number };
  /** Metres (5⅛″ = 0.130). */
  thickness: number;
  validation: { status: string; reasons: string[] };
  sink: { owner: "cabinet" | "countertop" | null };
};
export type CountertopEnd = "left" | "right";
export type CoverSegment = { cabinetIds: string[]; xMinM: number; xMaxM: number };

const SCENE_PATH = "/HastingCabinetsParametrization/";

/**
 * A collection's builder with a fixture loaded (e2e/fixtures/<collection>/<fixture>.json).
 * Returns `configurator` (ConfiguratorAPI: state and commands) and `scene` (geometry of the rendered scene).
 */
export async function openPreset(page: Page, collection: CollectionKey, fixture: string) {
  const { collectionId, builderPath } = COLLECTIONS[collection];
  await page.goto(`${builderPath}?collectionId=${encodeURIComponent(collectionId)}`);
  const frame = await sceneFrame(page);
  await expectSceneMode(page);
  const configurator = createConfigurator(frame);
  await configurator.importPreset(readPreset(collection, fixture));
  await expect.poll(() => configurator.cabinets().then((list) => list.length), { message: `cabinets of ${fixture}` })
    .toBeGreaterThan(0);
  return { configurator, scene: createSceneReader(frame, configurator) };
}

/** A configuration saved on the backend (needs the dev backend): for a quick check of a reported configId. */
export async function openConfiguration(page: Page, configId: string, collection: CollectionKey) {
  const { collectionId } = COLLECTIONS[collection];
  await page.goto(`/custom?configId=${encodeURIComponent(configId)}&collectionId=${encodeURIComponent(collectionId)}`);
  const frame = await sceneFrame(page);
  await expectSceneMode(page);
  const configurator = createConfigurator(frame);
  await expect.poll(() => configurator.cabinets().then((list) => list.length), { timeout: 90_000, message: `configuration ${configId}` })
    .toBeGreaterThan(0);
  return { configurator, scene: createSceneReader(frame, configurator) };
}

/** The scene iframe once its ConfiguratorAPI answers. */
async function sceneFrame(page: Page): Promise<Frame> {
  const frameOf = () => page.frames().find((frame) => frame.url().includes(SCENE_PATH));
  await expect.poll(() => Boolean(frameOf()), { timeout: 60_000, message: "PlayCanvas iframe" }).toBe(true);
  const frame = frameOf()!;
  await expect
    .poll(
      () =>
        frame
          .evaluate(async () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const api = (window as any).ConfiguratorAPI;
            return Boolean(api?.cabinets && (await api.cabinets.getCapabilities()).ok);
          })
          .catch(() => false),
      { timeout: 90_000, message: "ConfiguratorAPI ready" },
    )
    .toBe(true);
  return frame;
}

/**
 * e2e:local must run the PlayCanvas scripts from the repo, e2e:dev the export as it is: a dev server reused from
 * the other mode would test the wrong code. The local bridge marks its scripts with X-PC-Local-Source: repo.
 */
async function expectSceneMode(page: Page) {
  const mode = process.env.E2E_MODE;
  if (!mode || process.env.E2E_BASE_URL) return;
  const response = await page.request.get(`${SCENE_PATH}js/esm-scripts/Scripts/app-configuration/bridge/global-bridge.mjs`);
  const source = response.headers()["x-pc-local-source"];
  if (mode === "local") {
    expect(source, "e2e:local needs `npm run dev:pc-local` on the port (another dev server is running?)").toBe("repo");
  } else {
    expect(source, "e2e:dev needs `npm run dev` on the port, not dev:pc-local").toBeUndefined();
  }
}

/**
 * How a ConfiguratorAPI method takes the active scope ({ apiInstanceId, compositionId }):
 * - plain:   no scope (countertop.getState, cabinetCover.getState);
 * - scope:   as its first argument (cabinets.getState(scope), cabinetPlacement.cancel(scope, sessionId));
 * - merged:  inside its request object (cabinetPlacement.updateDraft);
 * - command: inside its request object with a request id and the composition revision it expects
 *            (cabinetPlacement.beginMove / apply, composition.importCompactPreset).
 */
type Mode = "plain" | "scope" | "merged" | "command";

export function createConfigurator(frame: Frame) {
  const call = <T>(path: string, mode: Mode, ...args: unknown[]) =>
    frame.evaluate(
      async ({ path, mode, args }) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const api = (window as any).ConfiguratorAPI;
        if (!api?.cabinets) throw new Error("ConfiguratorAPI is not ready");
        const caps = await api.cabinets.getCapabilities();
        const scope = { apiInstanceId: caps.data.apiInstanceId, compositionId: caps.data.activeCompositionId };
        const keys = path.split(".");
        const owner = keys.slice(0, -1).reduce((o, key) => o?.[key], api);
        const method = owner?.[keys[keys.length - 1]];
        if (typeof method !== "function") throw new Error(`ConfiguratorAPI.${path} is not available`);
        // A command right after another one (a preset import, an Apply) may find the composition still settling:
        // it answers a retryable error (COMPOSITION_BUSY). It is sent again, with a fresh revision, for up to 15 s.
        for (let attempt = 0; ; attempt++) {
          let callArgs = args;
          if (mode === "scope") callArgs = [scope, ...args];
          if (mode === "merged") callArgs = [{ ...scope, ...(args[0] as object) }, ...args.slice(1)];
          if (mode === "command") {
            const state = await api.composition.getState(scope);
            callArgs = [{ ...scope, requestId: `e2e-${Date.now()}-${Math.random()}`,
              expectedCompositionRevision: state.context.dependencies.compositionRevision, ...(args[0] as object) }, ...args.slice(1)];
          }
          const result = await method.apply(owner, callArgs);
          // Commands answer { ok, data | error }; plain getters answer the state itself.
          if (!(result && typeof result === "object" && "ok" in result)) return result;
          if (result.ok) return result.data;
          if (result.error?.retryable && attempt < 60) {
            await new Promise((resolve) => setTimeout(resolve, 250));
            continue;
          }
          throw new Error(`ConfiguratorAPI.${path}: ${JSON.stringify(result.error)}`);
        }
      },
      { path, mode, args },
    ) as Promise<T>;

  return {
    cabinets: async () => (await call<{ cabinets: Cabinet[] }>("cabinets.getState", "scope")).cabinets,
    /** The composition revision: a draft goes stale (Apply off) when it changes. It is in the answer's
     *  `context`, beside `data`, so it is read directly. */
    revision: () =>
      frame.evaluate(async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const api = (window as any).ConfiguratorAPI;
        const caps = await api.cabinets.getCapabilities();
        const state = await api.composition.getState({ apiInstanceId: caps.data.apiInstanceId, compositionId: caps.data.activeCompositionId });
        return state.context.dependencies.compositionRevision as number;
      }),
    countertop: () => call<CountertopState>("countertop.getState", "plain"),
    /** What releasing a Resize ▸ Length handle commits: the `side` end moves to make `lengthM`, the other end stays. */
    resizeCountertopFrom: (side: CountertopEnd, lengthM: number) =>
      call<CountertopState>("countertop.resizeFrom", "plain", side, lengthM),
    coverEntries: async () =>
      (await call<{ service: { entries: { productId: string; segment: CoverSegment }[] } }>("cabinetCover.getState", "plain"))
        .service.entries,
    covers: async () =>
      (await call<{ service: { entries: { segment: CoverSegment }[] } }>("cabinetCover.getState", "plain")).service.entries.map(
        (entry) => entry.segment,
      ),
    importPreset: (preset: unknown) => call("composition.importCompactPreset", "command", { preset }),
    /** A cabinet moved in a draft (beginMove + one updateDraft to `positionM`); the session stays open. */
    async moveDraft(productId: string, positionM: Vec3) {
      const sessionId = `e2e-move-${Date.now()}`;
      const begun = await call<DraftState>("cabinetPlacement.beginMove", "command", { sessionId, productId });
      const draft = await call<DraftState>("cabinetPlacement.updateDraft", "merged", {
        sessionId, expectedCandidateRevision: begun.candidateRevision, placement: { kind: "free", frameId: "wall", positionM },
      });
      return {
        draft,
        apply: () => call("cabinetPlacement.apply", "command", { sessionId, expectedCandidateRevision: draft.candidateRevision }),
        cancel: () => call("cabinetPlacement.cancel", "scope", sessionId),
      };
    },
  };
}

export type Configurator = ReturnType<typeof createConfigurator>;

/** The scene settles asynchronously after a commit (layout rules, covers): wait for a condition, not for a time. */
export const eventually = <T>(read: () => Promise<T>, message?: string) =>
  expect.poll(read, { timeout: 30_000, intervals: [250, 500, 1000], message });

export const near = (actual: number, expected: number, toleranceM = 1e-3) => Math.abs(actual - expected) <= toleranceM;
