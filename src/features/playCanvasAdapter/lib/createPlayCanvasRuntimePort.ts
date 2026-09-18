import { resolveRuntimeBinding } from "@/entities/collection";
import type { RuntimeBindingSet, RuntimeTarget, ScenePatch } from "@/entities/collection";
import type {
  ConfigurationRuntimePort,
  FailedRuntimeChange,
  RuntimeApplyResult,
  RuntimeChange,
  RuntimeContext,
  UnsupportedRuntimeChange,
} from "@/entities/configuration";
import { applySceneConfig, isSceneReady, setSceneProductConfig } from "@/utils/functions/playcanvas/sceneBridge";
import type { SceneCallResult, SceneSelector } from "@/utils/functions/playcanvas/sceneBridge";

import { resolveSceneSelector } from "./resolveSceneSelector";

/**
 * The runtimePort over the existing PlayCanvas wrappers.
 *
 * 1. Everything that can be known without the scene is checked first, so a set with an
 *    unknown translation or an unaddressable cabinet sends nothing at all.
 * 2. The set runs in the phases the collection declares (`order`: drawers before the
 *    handle, the handle before the height), keeping C's order within a phase.
 * 3. A value may take steps (`resetBefore`, then the value); a change counts as applied
 *    only when every step is. An identical step is sent once per set.
 * 4. The first failure stops the set. Once any step reached the scene the result is
 *    "partial", never "failed": the scene has changed and C must know it.
 */

/** The scene side of the adapter. Tests pass a fake; the app uses sceneBridge. */
export type SceneBridge = {
  isReady(): boolean;
  apply(selector: SceneSelector, patch: ScenePatch): Promise<SceneCallResult>;
  /**
   * Width is a scene layout operation: the legacy scene requires its per-product
   * `setConfig(id, patch)` API, not a one-product batch. Optional so existing test
   * bridges retain the generic batch fallback.
   */
  applyProduct?(runtimeId: string, patch: ScenePatch): Promise<SceneCallResult>;
};

export type PlayCanvasRuntimePortDeps = {
  /** Bindings of the active collection. Null until A loads them (A07). */
  getBindings: () => RuntimeBindingSet | null;
  scene?: SceneBridge;
};

type SceneStep = {
  selector: SceneSelector;
  patch: ScenePatch;
  /** Identity of the step, so the same command is not sent twice in one set. */
  key: string;
};

type SceneCommand<T extends RuntimeChange> = {
  change: T;
  targetKind: RuntimeTarget["kind"];
  /** Empty when there is nothing to send, e.g. no cabinets placed. */
  steps: SceneStep[];
  order: number;
  /** Position in C's set, which breaks ties within a phase. */
  index: number;
};

type StepFailure = Pick<FailedRuntimeChange, "code" | "message">;

const defaultScene: SceneBridge = {
  isReady: isSceneReady,
  apply: applySceneConfig,
  async applyProduct(runtimeId, patch) {
    const result = await setSceneProductConfig(runtimeId, patch);
    if (result.status === "applied") return { status: "applied", updatedIds: [runtimeId] };
    return result;
  },
};

const sortedEntries = (record: object) => Object.entries(record).sort(([a], [b]) => a.localeCompare(b));

const stepKey = (selector: SceneSelector, patch: ScenePatch): string =>
  JSON.stringify([sortedEntries(selector), sortedEntries(patch)]);

const toSteps = (selector: SceneSelector | null, patch: ScenePatch, resetBefore?: ScenePatch): SceneStep[] => {
  if (!selector) return [];

  const valueStep = { selector, patch, key: stepKey(selector, patch) };

  // Resetting to the value itself would only repeat the command.
  if (!resetBefore || stepKey(selector, resetBefore) === valueStep.key) return [valueStep];

  return [{ selector, patch: resetBefore, key: stepKey(selector, resetBefore) }, valueStep];
};

const byPhase = <T extends RuntimeChange>(a: SceneCommand<T>, b: SceneCommand<T>): number =>
  a.order === b.order ? a.index - b.index : a.order < b.order ? -1 : 1;

/**
 * A broadcast must reach every placed cabinet. The bridge already checks explicit
 * product ids; a product-type target has no known full list, and add-ons return none.
 */
const missingCabinets = (
  targetKind: RuntimeTarget["kind"],
  updatedIds: string[] | null,
  context: RuntimeContext,
): string[] =>
  targetKind === "all" && updatedIds
    ? context.cabinetRuntimeIds.filter((runtimeId) => !updatedIds.includes(runtimeId))
    : [];

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

    // 1. Translate and address every change before the first scene call.
    const unsupported: UnsupportedRuntimeChange<T>[] = [];
    const unaddressable: FailedRuntimeChange<T>[] = [];
    const commands: SceneCommand<T>[] = [];

    changes.forEach((change, index) => {
      const resolution = resolveRuntimeBinding(bindings, change.attributeId, change.value, context.flow);

      if (!resolution.ok) {
        unsupported.push({ change, reason: resolution.reason, detail: resolution.detail });
        return;
      }

      const addressed = resolveSceneSelector(resolution.target, change, context);

      if (!addressed.ok) {
        unaddressable.push({ change, code: "unknown-target", message: addressed.message });
        return;
      }

      commands.push({
        change,
        targetKind: resolution.target.kind,
        steps: toSteps(addressed.selector, resolution.patch, resolution.resetBefore),
        order: resolution.order ?? Number.POSITIVE_INFINITY,
        index,
      });
    });

    if (unsupported.length > 0) return { status: "unsupported", unsupported };

    if (unaddressable.length > 0) return { status: "failed", failed: unaddressable };

    // 2. Run the set phase by phase; the first failure stops it.
    commands.sort(byPhase);

    const applied: T[] = [];
    const sent = new Set<string>();
    let sceneChanged = false;

    for (const [position, command] of commands.entries()) {
      let failure: StepFailure | null = null;

      for (const step of command.steps) {
        if (sent.has(step.key)) continue;

        // Width must preserve the scene's established direct-product resize path.
        // Other bindings deliberately remain batched so their result can be checked
        // against every addressed cabinet.
        const productId =
          command.change.attributeId === "Width" && step.selector.productIds?.length === 1
            ? step.selector.productIds[0]
            : null;
        const result = productId && scene.applyProduct
          ? await scene.applyProduct(productId, step.patch)
          : await scene.apply(step.selector, step.patch);

        if (result.status === "not-ready") {
          // Nothing reached the scene yet: the whole set is simply not ready.
          if (!sceneChanged) return { status: "not-ready" };

          failure = { code: "not-ready", message: "The scene stopped being ready." };
          break;
        }

        if (result.status === "failed") {
          failure = { code: result.code, message: result.message };
          break;
        }

        sceneChanged ||= result.updatedIds === null || result.updatedIds.length > 0;

        const missing = missingCabinets(command.targetKind, result.updatedIds, context);

        if (missing.length > 0) {
          failure = { code: "product-not-found", message: `The scene did not update ${missing.join(", ")}.` };
          break;
        }

        sent.add(step.key);
      }

      if (!failure) {
        applied.push(command.change);
        continue;
      }

      const failed = [{ change: command.change, ...failure }, ...notAttempted(commands.slice(position + 1))];

      return sceneChanged ? { status: "partial", applied, failed } : { status: "failed", failed };
    }

    return { status: "applied", applied };
  },
});
