import type {
  CabinetDimensions,
  ConfigurationSceneReader,
  SceneCabinetState,
  SceneStateResult,
} from "@/entities/configuration";
import { readSceneProducts } from "@/utils/functions/playcanvas/sceneBridge";
import type { SceneProductsRead } from "@/utils/functions/playcanvas/sceneBridge";

/**
 * Reads the actual result of the scene for C (I04): the composition order and the size of
 * each product, taken from that product's own config. The scene fires no events for sizes
 * or order, so C calls this after the actions that change them.
 */

/** The scene side of the reader. Tests pass a fake; the app uses sceneBridge. */
export type SceneReadBridge = {
  read(productIds: readonly string[]): Promise<SceneProductsRead>;
};

export type SceneReaderDeps = {
  scene?: SceneReadBridge;
};

const defaultScene: SceneReadBridge = { read: readSceneProducts };

/** The scene reports sizes as numbers; older configs may carry numeric strings. */
const toDimension = (value: unknown): number | null => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const readDimensions = (config: Record<string, unknown>): CabinetDimensions => ({
  width: toDimension(config.Width),
  height: toDimension(config.Height),
  depth: toDimension(config.Depth),
});

export const createSceneReader = ({ scene = defaultScene }: SceneReaderDeps = {}): ConfigurationSceneReader => ({
  async read(runtimeIds): Promise<SceneStateResult> {
    const result = await scene.read(runtimeIds);
    if (result.status !== "ready") return { status: "not-ready" };

    const cabinets: SceneCabinetState[] = runtimeIds.flatMap((runtimeId) => {
      const config = result.configs[runtimeId];
      return config ? [{ runtimeId, dimensions: readDimensions(config) }] : [];
    });

    return { status: "ready", order: [...result.order], cabinets };
  },
});
