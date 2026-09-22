import type {
  ConfigurationCompositionPort,
  SceneCompositionPlacement,
  SceneCompositionProduct,
  SceneCompositionReplaceRequest,
  SceneCompositionResult,
} from "@/entities/configuration";

/**
 * Stand-in for the composition port, so C's composition commands are built and tested without a
 * scene. It keeps the composition it was asked to build and answers every operation as applied,
 * or with the answer set for the next call. It proves the contract and the order of what C hands
 * over, nothing about the real scene.
 */

export type CompositionCall =
  | { op: "replace"; request: SceneCompositionReplaceRequest }
  | { op: "add"; product: SceneCompositionProduct; placement: SceneCompositionPlacement }
  | { op: "remove"; runtimeIds: string[] }
  | { op: "swap"; runtimeIds: [string, string] }
  | { op: "clear" };

export type TestCompositionPort = {
  port: ConfigurationCompositionPort;
  calls: CompositionCall[];
  /** The composition the port holds, in order. */
  order: () => string[];
  setReady(ready: boolean): void;
  /** The next call answers with this instead of applying. */
  answerNext(result: SceneCompositionResult): void;
};

export const createTestCompositionPort = (initial: readonly string[] = []): TestCompositionPort => {
  const calls: CompositionCall[] = [];
  let order = [...initial];
  let ready = true;
  let created = 0;
  let pending: SceneCompositionResult | null = null;

  const answer = (placed: string[], apply: () => void): SceneCompositionResult => {
    if (!ready) return { status: "not-ready" };

    const next = pending;
    pending = null;
    if (next) return next;

    apply();
    return { status: "applied", placed, scene: { status: "ready", order: [...order], cabinets: [] } };
  };

  const newId = (productType: string) => `${productType}-new-${++created}`;

  const port: ConfigurationCompositionPort = {
    isReady: () => ready,

    async replace(request) {
      calls.push({ op: "replace", request });
      const placed = request.products.map(({ productType }) => newId(productType));
      return answer(placed, () => {
        order = [...placed];
      });
    },

    async add(product, placement) {
      calls.push({ op: "add", product, placement });
      const runtimeId = newId(product.productType);
      return answer([runtimeId], () => {
        if (placement.kind === "end") {
          order = [...order, runtimeId];
          return;
        }

        const anchor = order.indexOf(placement.anchorRuntimeId);
        const at = anchor === -1 ? order.length : placement.side === "left" ? anchor : anchor + 1;
        order = [...order.slice(0, at), runtimeId, ...order.slice(at)];
      });
    },

    async remove(runtimeIds) {
      calls.push({ op: "remove", runtimeIds: [...runtimeIds] });
      return answer([], () => {
        order = order.filter((runtimeId) => !runtimeIds.includes(runtimeId));
      });
    },

    async swap(runtimeIdA, runtimeIdB) {
      calls.push({ op: "swap", runtimeIds: [runtimeIdA, runtimeIdB] });
      return answer([], () => {
        order = order.map((runtimeId) =>
          runtimeId === runtimeIdA ? runtimeIdB : runtimeId === runtimeIdB ? runtimeIdA : runtimeId,
        );
      });
    },

    async clear() {
      calls.push({ op: "clear" });
      return answer([], () => {
        order = [];
      });
    },
  };

  return {
    port,
    calls,
    order: () => [...order],
    setReady: (value) => {
      ready = value;
    },
    answerNext: (result) => {
      pending = result;
    },
  };
};
