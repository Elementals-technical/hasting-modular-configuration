import type { Frame } from "@playwright/test";
import type { Configurator, Vec3 } from "./configurator";

/**
 * Geometry of the rendered PlayCanvas scene: world bounding boxes (AABB) of what is visible, read from the
 * scene graph inside the iframe. The ConfiguratorAPI says what the scene THINKS (a state); this says where the
 * meshes ARE — a top that rests on a cabinet, a cover over a cabinet, a gap, an overlap. Units: world metres.
 */

export type Box = { min: Vec3; max: Vec3 };

/** Tolerance of "touching": 2 mm, the contact tolerance of the placement rules (urban.pack.mjs contactM). */
export const CONTACT_M = 0.002;

export function createSceneReader(frame: Frame, configurator: Configurator) {
  /**
   * World AABB of the visible meshes of entity `name` and its descendants, or null when it has none.
   * `body`: leave out the sink subtree (a node whose name ends with SinkPoint / Sink_Point): an integrated basin
   * reaches the top's upper face, so the cabinet's own top is the body's top, not the basin's.
   */
  const boxOf = (name: string, body = false) =>
    frame.evaluate(
      ({ name, body }) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const w = window as any;
        const app = w.pc?.Application?.getApplication?.() ?? w.ConfiguratorAPI?.getSelectTool?.()?.app;
        const root = app?.root?.findByName(name);
        if (!root) return null;
        const min = [Infinity, Infinity, Infinity];
        const max = [-Infinity, -Infinity, -Infinity];
        let meshes = 0;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const visit = (entity: any) => {
          if (!entity.enabled || (body && /sink_?point$/i.test(entity.name))) return;
          if (entity.render?.enabled) {
            for (const instance of entity.render.meshInstances ?? []) {
              if (!instance.visible) continue;
              const lo = instance.aabb.getMin();
              const hi = instance.aabb.getMax();
              [lo.x, lo.y, lo.z].forEach((v: number, i: number) => (min[i] = Math.min(min[i], v)));
              [hi.x, hi.y, hi.z].forEach((v: number, i: number) => (max[i] = Math.max(max[i], v)));
              meshes++;
            }
          }
          for (const child of entity.children) visit(child);
        };
        visit(root);
        if (!meshes) return null;
        return { min: { x: min[0], y: min[1], z: min[2] }, max: { x: max[0], y: max[1], z: max[2] } };
      },
      { name, body },
    ) as Promise<Box | null>;

  const required = async (what: string, box: Promise<Box | null>) => {
    const found = await box;
    if (!found) throw new Error(`${what}: nothing visible in the scene`);
    return found;
  };

  return {
    /** Any entity by its scene name (a cabinet's name is its id). */
    box: (name: string) => required(name, boxOf(name)),
    /** A cabinet without its sink: the surface a top or a cover rests on. */
    cabinetBody: (cabinetId: string) => required(`cabinet ${cabinetId}`, boxOf(cabinetId, true)),
    /** The basin top (TopSolid) as rendered now. */
    countertop: async () => {
      const { productId } = await configurator.countertop();
      if (!productId) throw new Error("no countertop in the scene");
      return required(`countertop ${productId}`, boxOf(productId));
    },
    /**
     * The countertop's X extent on every frame the scene draws (PlayCanvas `frameend`) while `run` goes and for
     * `settleFrames` frames after it. A state read sees only where things end up; this sees a frame in between,
     * e.g. the old length drawn at the new centre. Returns the frames in order and `run`'s result.
     */
    recordCountertopFrames: async <T>(run: () => Promise<T>, settleFrames = 20) => {
      const { productId } = await configurator.countertop();
      if (!productId) throw new Error("no countertop in the scene");
      await frame.evaluate((name) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const w = window as any;
        const app = w.pc.Application.getApplication();
        const frames: { minX: number; maxX: number }[] = [];
        // Same rule as boxOf: the visible meshes of the countertop entity and its descendants.
        const record = () => {
          const root = app.root.findByName(name);
          let minX = Infinity;
          let maxX = -Infinity;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const visit = (entity: any) => {
            if (!entity.enabled) return;
            for (const instance of entity.render?.enabled ? entity.render.meshInstances ?? [] : []) {
              if (!instance.visible) continue;
              minX = Math.min(minX, instance.aabb.getMin().x);
              maxX = Math.max(maxX, instance.aabb.getMax().x);
            }
            for (const child of entity.children) visit(child);
          };
          if (root) visit(root);
          if (Number.isFinite(minX)) frames.push({ minX, maxX });
        };
        app.on("frameend", record);
        w.__e2eCountertopFrames = { frames, stop: () => app.off("frameend", record) };
      }, productId);
      const result = await run();
      const frames = await frame.evaluate(async (settle) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const recorder = (window as any).__e2eCountertopFrames;
        // Wait for `settle` more drawn frames (10 s at most: a headless WebGL frame can be slow).
        const target = recorder.frames.length + settle;
        const deadline = Date.now() + 10_000;
        while (recorder.frames.length < target && Date.now() < deadline) await new Promise((r) => setTimeout(r, 50));
        recorder.stop();
        return recorder.frames as { minX: number; maxX: number }[];
      }, settleFrames);
      return { frames, result };
    },
    /** The generated cabinet covers with the cabinets each one covers. */
    covers: async () =>
      Promise.all(
        (await configurator.coverEntries()).map(async (entry) => ({
          cabinetIds: entry.segment.cabinetIds,
          box: await required(`cover ${entry.productId}`, boxOf(entry.productId)),
        })),
      ),
  };
}

export type SceneReader = ReturnType<typeof createSceneReader>;

const overlap = (aMin: number, aMax: number, bMin: number, bMax: number) => Math.min(aMax, bMax) - Math.max(aMin, bMin);

/** `upper` lies on `lower`: its bottom on the other's top (± tolerance) and they overlap in plan (X and Z). */
export function restsOn(upper: Box, lower: Box, toleranceM = CONTACT_M) {
  return Math.abs(upper.min.y - lower.max.y) <= toleranceM &&
    overlap(upper.min.x, upper.max.x, lower.min.x, lower.max.x) > 0.001 &&
    overlap(upper.min.z, upper.max.z, lower.min.z, lower.max.z) > 0.001;
}

/** `cover` lies on `body` and spans exactly its width (a cover is cut to the cabinets under it). */
export function coversTopOf(cover: Box, body: Box, toleranceM = CONTACT_M) {
  return restsOn(cover, body, toleranceM) &&
    Math.abs(cover.min.x - body.min.x) <= toleranceM &&
    Math.abs(cover.max.x - body.max.x) <= toleranceM;
}

/** Readable box for assertion messages: "x 0.000…0.600 y 0.380…0.393". */
export const describeBox = (box: Box) =>
  `x ${box.min.x.toFixed(3)}…${box.max.x.toFixed(3)} y ${box.min.y.toFixed(3)}…${box.max.y.toFixed(3)} z ${box.min.z.toFixed(3)}…${box.max.z.toFixed(3)}`;
