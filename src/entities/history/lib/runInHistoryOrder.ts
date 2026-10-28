/**
 * History operations — a user's action (a step), an undo, a redo — run one at a time, in the order they
 * were started. Each starts from the state the one before it left: an action is applied and written to
 * the history before the next one reads its starting state, and an undo takes back the action started
 * before it only once that action has been written.
 *
 * A queue of its own: the scene calls inside an action go through `runInBatchQueue`, which an action
 * waiting in that same queue would block.
 */
let last: Promise<unknown> = Promise.resolve();

export const runInHistoryOrder = <T>(operation: () => Promise<T>): Promise<T> => {
  const run = last.then(operation, operation);
  last = run.then(
    () => undefined,
    () => undefined,
  );

  return run;
};
