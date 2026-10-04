import type {
  ConfigurationSceneRestorer,
  SceneRestoreIssue,
  SceneRestoreRequest,
  SceneRestoreResult,
} from "@/entities/configuration";

/**
 * Stand-in for the scene restorer, so C's restore can be tested without a scene. By default
 * every product comes back as `new-<sourceId>`; what the real scene does is verified in I06.
 */

type Answer = SceneRestoreResult | ((request: SceneRestoreRequest) => SceneRestoreResult);

export type TestSceneRestorer = {
  restorer: ConfigurationSceneRestorer;
  /** Every request passed to `restore`, in call order. */
  requests: SceneRestoreRequest[];
  /** The answer of every following restore. */
  answerWith(answer: Answer): void;
  /** Issues preflight reports from now on. */
  setIssues(issues: SceneRestoreIssue[]): void;
};

const restoreAll = (request: SceneRestoreRequest): SceneRestoreResult => {
  const matches = request.products.map(({ sourceId }) => ({ sourceId, runtimeId: `new-${sourceId}` }));

  return {
    status: "restored",
    matches,
    scene: { status: "ready", order: matches.map(({ runtimeId }) => runtimeId), cabinets: [] },
  };
};

export const createTestSceneRestorer = (): TestSceneRestorer => {
  const requests: SceneRestoreRequest[] = [];

  let answer: Answer = restoreAll;
  let issues: SceneRestoreIssue[] = [];

  const restorer: ConfigurationSceneRestorer = {
    preflight: () => [...issues],
    async restore(request) {
      requests.push(request);

      if (issues.length > 0) return { status: "rejected", issues: [...issues] };

      return typeof answer === "function" ? answer(request) : answer;
    },
  };

  return {
    restorer,
    requests,
    answerWith(next) {
      answer = next;
    },
    setIssues(next) {
      issues = [...next];
    },
  };
};
