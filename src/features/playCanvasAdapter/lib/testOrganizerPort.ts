import type { OrganizerApplyResult, OrganizerPortCommand } from "@/entities/configuration";
import type { OrganizersState } from "@/entities/configuration/model/drawerOrganizers";
import type {
  OrganizersChange,
  OrganizersOverlayFrame,
  OrganizersPointer,
  OrganizersView,
  OrganizersViewInsets,
} from "@/features/configuratorApi";

import type { OrganizerPort, OrganizerPreview, OrganizerViewAddress } from "./createOrganizerPort";

/**
 * Stand-in for the organizer port: records every call, answers commands from a table the test builds
 * (from the shared `commands.v1.json`), and delivers the events the test emits.
 */

export type TestOrganizerCall =
  | OrganizerPortCommand
  | { kind: "preview"; preview: OrganizerPreview | null }
  | { kind: "enterView"; address: OrganizerViewAddress }
  | { kind: "exitView" }
  | { kind: "setViewInsets"; insets: OrganizersViewInsets }
  | { kind: "list" }
  | { kind: "getState"; runtimeId: string }
  | { kind: "whenSettled" };

/** The first row whose `match` fields all equal the command's answers it. */
export type TestOrganizerAnswer = { match: Partial<OrganizerPortCommand>; result: OrganizerApplyResult };

type TestOrganizerEvents = {
  change: OrganizersChange;
  view: OrganizersView;
  frame: OrganizersOverlayFrame | null;
  pointer: OrganizersPointer;
};
type TestOrganizerEvent = keyof TestOrganizerEvents;

export type TestOrganizerPort = {
  port: OrganizerPort;
  calls: TestOrganizerCall[];
  /** Commands only, in order. */
  commands(): OrganizerPortCommand[];
  /** The next command answers with this instead of the table. */
  answerNext(result: OrganizerApplyResult): void;
  /** Holds every command until `release()`: for a test of a click while one is running. */
  hold(): { release(): void };
  emit<E extends TestOrganizerEvent>(event: E, payload: TestOrganizerEvents[E]): void;
  /** How many listeners an event has: an unmounted runtime leaves none. */
  listeners(event: TestOrganizerEvent): number;
  setReady(ready: boolean): void;
  /** What `list()` answers; `getState(id)` answers the state with that product id, or null. */
  setList(states: OrganizersState[] | null): void;
};

const NOOP: OrganizerApplyResult = { status: "noop", products: [], corrections: [] };

const matches = (match: Partial<OrganizerPortCommand>, command: OrganizerPortCommand) =>
  Object.entries(match).every(
    ([key, value]) => JSON.stringify((command as Record<string, unknown>)[key]) === JSON.stringify(value),
  );

export const createTestOrganizerPort = ({
  answers = [],
}: { answers?: TestOrganizerAnswer[] } = {}): TestOrganizerPort => {
  const calls: TestOrganizerCall[] = [];
  const listeners: { [E in TestOrganizerEvent]: Set<(payload: TestOrganizerEvents[E]) => void> } = {
    change: new Set(),
    view: new Set(),
    frame: new Set(),
    pointer: new Set(),
  };
  let pending: OrganizerApplyResult | null = null;
  let gate: Promise<void> | null = null;
  let ready = true;
  let listAnswer: OrganizersState[] | null = [];

  const listen =
    <E extends TestOrganizerEvent>(event: E) =>
    async (callback: (payload: TestOrganizerEvents[E]) => void) => {
      listeners[event].add(callback);
      return () => {
        listeners[event].delete(callback);
      };
    };

  const record = <T>(call: TestOrganizerCall, answer: T, fallback: T) => {
    calls.push(call);
    return Promise.resolve(ready ? answer : fallback);
  };

  const port: OrganizerPort = {
    isReady: () => ready,
    async apply(command) {
      calls.push(structuredClone(command));
      if (gate) await gate;
      if (!ready) return { status: "not-ready" };
      const next = pending;
      pending = null;
      return next ?? answers.find(({ match }) => matches(match, command))?.result ?? NOOP;
    },
    preview: (preview) => record({ kind: "preview", preview }, true, false),
    enterView: (address) => record({ kind: "enterView", address }, true, false),
    exitView: () => record({ kind: "exitView" }, true, false),
    setViewInsets: (insets) => record({ kind: "setViewInsets", insets }, true, false),
    list: () => record({ kind: "list" }, listAnswer, null),
    getState: (runtimeId) =>
      record(
        { kind: "getState", runtimeId },
        listAnswer?.find(({ productId }) => productId === runtimeId) ?? null,
        null,
      ),
    // Resolves ready or not: there is no queue here to wait for.
    whenSettled: () => record({ kind: "whenSettled" }, undefined, undefined),
    onChange: listen("change"),
    onView: listen("view"),
    onFrame: listen("frame"),
    onPointer: listen("pointer"),
  };

  return {
    port,
    calls,
    commands: () =>
      calls.filter((call): call is OrganizerPortCommand =>
        ["addColumn", "removeColumn", "setColumnLayout", "setStyle", "clear", "setState"].includes(call.kind),
      ),
    answerNext: (result) => {
      pending = result;
    },
    hold() {
      let release!: () => void;
      gate = new Promise<void>((resolve) => (release = resolve));
      return {
        release: () => {
          gate = null;
          release();
        },
      };
    },
    emit(event, payload) {
      for (const listener of [...listeners[event]]) (listener as (value: typeof payload) => void)(payload);
    },
    listeners: (event) => listeners[event].size,
    setReady: (value) => {
      ready = value;
    },
    setList: (states) => {
      listAnswer = states;
    },
  };
};
