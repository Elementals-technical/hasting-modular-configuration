import { resolveRuntimeBinding } from "@/entities/collection";
import type { RuntimeBindingSet, ScenePatch } from "@/entities/collection";
import type {
  ConfigurationRuntimePort,
  FailedRuntimeChange,
  RuntimeApplyResult,
  RuntimeChange,
  RuntimeContext,
  UnsupportedRuntimeChange,
} from "@/entities/configuration";
import { applySceneConfig, isSceneReady } from "@/utils/functions/playcanvas/sceneBridge";
import type { SceneCallResult, SceneSelector } from "@/utils/functions/playcanvas/sceneBridge";

import { resolveSceneSelector } from "./resolveSceneSelector";

/**
 * The runtimePort over the existing PlayCanvas wrappers.
 *
 * Everything that can be known without touching the scene is checked first, so a set
 * with an unknown translation or an unaddressable cabinet sends nothing at all. Then the
 * commands run one by one through the shared batch queue and the first failure stops
 * the set. Ordering rules between attributes and reading back actual values are later
 * tasks (I03/I04); here the set runs in the order C planned it.
 */

/** The scene side of the adapter. Tests pass a fake; the app uses sceneBridge. */
export type SceneBridge = {
  isReady(): boolean;
  apply(selector: SceneSelector, patch: ScenePatch): Promise<SceneCallResult>;
};

export type PlayCanvasRuntimePortDeps = {
  /** Bindings of the active collection. Null until A loads them (A07). */
  getBindings: () => RuntimeBindingSet | null;
  scene?: SceneBridge;
};

type SceneCommand<T extends RuntimeChange> = {
  change: T;
  /** Null when there is nothing to send, e.g. no cabinets placed. */
  selector: SceneSelector | null;
  patch: ScenePatch;
};

const defaultScene: SceneBridge = { isReady: isSceneReady, apply: applySceneConfig };

const notAttempted = <T extends RuntimeChange>(commands: SceneCommand<T>[]): FailedRuntimeChange<T>[] =>
  commands.map(({ change }) => ({
    change,
    code: "not-attempted",
    message: "Not sent: an earlier command of the set failed.",
  }));

export const createPlayCanvasRuntimePort = ({
  getBindings,
  scene = defaultScene,
}: PlayCanvasRuntimePortDeps): ConfigurationRuntimePort => ({
  isReady: () => scene.isReady(),

  async apply<T extends RuntimeChange>(changes: readonly T[], context: RuntimeContext): Promise<RuntimeApplyResult<T>> {
    if (changes.length === 0) return { status: "applied", applied: [] };

    if (!scene.isReady()) return { status: "not-ready" };

    const bindings = getBindings();

    if (!bindings || bindings.collectionId !== context.collectionId) {
      return {
        status: "unsupported",
        unsupported: changes.map((change) => ({
          change,
          reason: "no-binding",
          detail: `No runtime bindings are loaded for ${context.collectionId}.`,
        })),
      };
    }

    // 1. Translate every change before the first scene call.
    const unsupported: UnsupportedRuntimeChange<T>[] = [];
    const unaddressable: FailedRuntimeChange<T>[] = [];
    const commands: SceneCommand<T>[] = [];

    for (const change of changes) {
      const resolution = resolveRuntimeBinding(bindings, change.attributeId, change.value, context.flow);

      if (!resolution.ok) {
        unsupported.push({ change, reason: resolution.reason, detail: resolution.detail });
        continue;
      }

      const addressed = resolveSceneSelector(resolution.target, change, context);

      if (!addressed.ok) {
        unaddressable.push({ change, code: "unknown-target", message: addressed.message });
        continue;
      }

      commands.push({ change, selector: addressed.selector, patch: resolution.patch });
    }

    if (unsupported.length > 0) return { status: "unsupported", unsupported };

    if (unaddressable.length > 0) return { status: "failed", failed: unaddressable };

    // 2. Send them in order; the first failure stops the set.
    const applied: T[] = [];

    for (const [index, command] of commands.entries()) {
      if (!command.selector) {
        applied.push(command.change);
        continue;
      }

      const result = await scene.apply(command.selector, command.patch);

      if (result.status === "applied") {
        applied.push(command.change);
        continue;
      }

      // Nothing sent yet and the scene went away: the whole set is simply not ready.
      if (result.status === "not-ready" && applied.length === 0) return { status: "not-ready" };

      const failure: FailedRuntimeChange<T> =
        result.status === "not-ready"
          ? { change: command.change, code: "not-ready", message: "The scene stopped being ready." }
          : { change: command.change, code: result.code, message: result.message };

      const failed = [failure, ...notAttempted(commands.slice(index + 1))];

      return applied.length > 0 ? { status: "partial", applied, failed } : { status: "failed", failed };
    }

    return { status: "applied", applied };
  },
});
