import type { ConfigurationDividerPort, DividerClearResult } from "@/entities/configuration";
import { clearPlacedDividersInScene } from "@/utils/functions/playcanvas/dividers";
import { isSceneReady } from "@/utils/functions/playcanvas/sceneBridge";

/**
 * The placed dividers of the composition over the scene's divider API (C06, I).
 *
 * Dividers are drawer zone objects the divider wrappers own, not a value the runtime port can
 * translate — `DividersOption` and `DividersStyle` are unbound bindings. Clearing them is
 * therefore an operation of its own, in the same shape as the side panel port: the scene is
 * touched here, and the command records what it took.
 *
 * A run that removed some but not all dividers is "partial", never "failed": the scene changed
 * and C must know it.
 */

export type DividerPortDeps = {
  /** Tests pass a fake; the app uses the divider wrappers. */
  scene?: {
    isReady(): boolean;
    clear(runtimeIds: string[]): Promise<{ cleared: number; total: number }>;
  };
};

const defaultScene: NonNullable<DividerPortDeps["scene"]> = {
  isReady: isSceneReady,
  clear: clearPlacedDividersInScene,
};

export const createDividerPort = ({ scene = defaultScene }: DividerPortDeps = {}): ConfigurationDividerPort => ({
  async clear(runtimeIds): Promise<DividerClearResult> {
    if (runtimeIds.length === 0) return { status: "applied", cleared: 0 };
    if (!scene.isReady()) return { status: "not-ready" };

    try {
      const { cleared, total } = await scene.clear([...runtimeIds]);

      if (cleared === total) return { status: "applied", cleared };

      return {
        status: "partial",
        cleared,
        message: `The scene cleared ${cleared} of ${total} dividers.`,
      };
    } catch (error) {
      return { status: "failed", message: error instanceof Error ? error.message : String(error) };
    }
  },
});
