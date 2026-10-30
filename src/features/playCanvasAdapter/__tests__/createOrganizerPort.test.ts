import { afterEach, describe, expect, it, vi } from "vitest";

import type { OrganizerPortCommand } from "@/entities/configuration";
import { readDrawerOrganizers } from "@/entities/configuration/model/drawerOrganizers";
import type { DrawerOrganizersV1, OrganizersState } from "@/entities/configuration/model/drawerOrganizers";
import type { ConfiguratorBridge } from "@/features/configuratorApi";
import commandsFixture from "@/features/drawerOrganizers/__tests__/fixtures/contract/commands.v1.json";
import contractFixture from "@/features/drawerOrganizers/__tests__/fixtures/contract/contract.v1.json";
import framesFixture from "@/features/drawerOrganizers/__tests__/fixtures/contract/frames.v1.json";

import { createOrganizerPort } from "../lib/createOrganizerPort";

/**
 * The organizer port over `ConfiguratorAPI.organizers`: commands by runtime id, receipts read into what
 * the scene holds, `clear` product by product; the runtime part never throws.
 */

type CommandCase = (typeof commandsFixture.cases)[number];

const DERIVED = contractFixture.cases.find(({ name }) => name === "positions-fixed")!.expected.derived;

const stateOf = (productId: string, stored: unknown, revision = 2): OrganizersState =>
  ({
    productId,
    revision,
    params: { collection: "class", role: "SC", width: 60, drawersMode: "2D" },
    state: stored,
    drawers: DERIVED,
    lastCorrections: [],
  }) as OrganizersState;

/** The receipt 3D answers for a command case of the shared fixture. */
const receiptOf = (testCase: CommandCase, productId = "rt-1") => {
  const error = "error" in testCase.expected ? testCase.expected.error : undefined;
  return {
    status: testCase.expected.status,
    state: stateOf(productId, error ? null : testCase.expected.state),
    corrections: testCase.expected.corrections,
    ...(error ? { error: { code: error.code, message: `${error.code} message` } } : {}),
  };
};

const caseNamed = (name: string) => commandsFixture.cases.find((testCase) => testCase.name === name)!;

type FakeBridge = Required<
  Pick<ConfiguratorBridge, "callOrganizers" | "subscribeOrganizers" | "subscribeOrganizersOverlay">
>;

const fakeBridge = (answer: (method: string, input: unknown) => unknown = () => null) => {
  const calls: Array<[string, unknown]> = [];
  const bridge: FakeBridge = {
    callOrganizers: vi.fn(async (method: string, input?: unknown) => {
      calls.push([method, input]);
      return answer(method, input);
    }),
    subscribeOrganizers: vi.fn(async () => null),
    subscribeOrganizersOverlay: vi.fn(async () => null),
  };
  return { bridge, calls };
};

afterEach(() => vi.restoreAllMocks());

describe("createOrganizerPort: commands", () => {
  it("sends each command to its organizers method, addressed by runtime id", async () => {
    const { bridge, calls } = fakeBridge(() => receiptOf(caseNamed("add-first")));
    const port = createOrganizerPort({ bridge, isReady: () => true });
    const positions = [2, 4];
    const stored = caseNamed("set-state-normalizes").command.state as DrawerOrganizersV1;

    await port.apply({ kind: "addColumn", runtimeId: "rt-1", drawer: "Top", slot: -2 });
    await port.apply({ kind: "addColumn", runtimeId: "rt-1", drawer: "Bot", slot: 1, style: "Metal" });
    await port.apply({ kind: "removeColumn", runtimeId: "rt-1", drawer: "Top", slot: 0 });
    await port.apply({ kind: "setColumnLayout", runtimeId: "rt-1", drawer: "Top", slot: 0, positions });
    await port.apply({ kind: "setStyle", runtimeId: "rt-1", drawer: "Bot", style: "Metal" });
    await port.apply({ kind: "setState", runtimeId: "rt-1", state: stored });

    expect(calls).toEqual([
      ["addColumn", { productId: "rt-1", drawer: "Top", slot: -2 }],
      ["addColumn", { productId: "rt-1", drawer: "Bot", slot: 1, style: "Metal" }],
      ["removeColumn", { productId: "rt-1", drawer: "Top", slot: 0 }],
      ["setColumnLayout", { productId: "rt-1", drawer: "Top", slot: 0, positions: [2, 4] }],
      ["setStyle", { productId: "rt-1", drawer: "Bot", style: "Metal" }],
      ["setState", { productId: "rt-1", state: stored }],
    ]);
    // The scene gets its own copy of the positions.
    expect((calls[3][1] as { positions: number[] }).positions).not.toBe(positions);
  });

  it.each(
    commandsFixture.cases
      .filter(({ command }) => command.type !== "clear" && command.type !== "setState")
      .map((testCase) => [testCase.name, testCase] as const),
  )("reads the receipt of %s", async (_, testCase) => {
    const { bridge } = fakeBridge(() => receiptOf(testCase));
    const port = createOrganizerPort({ bridge, isReady: () => true });

    const result = await port.apply({ kind: "addColumn", runtimeId: "rt-1", drawer: "Top", slot: 0 });

    if ("error" in testCase.expected && testCase.expected.error) {
      expect(result).toEqual({
        status: "rejected",
        code: testCase.expected.error.code,
        message: `${testCase.expected.error.code} message`,
      });
      return;
    }
    expect(result).toEqual({
      status: testCase.expected.status,
      products: [{ runtimeId: "rt-1", entry: readDrawerOrganizers(testCase.expected.state), drawers: DERIVED }],
      corrections: testCase.expected.corrections,
    });
  });

  it("answers not-ready without a call while the scene is not ready, and when the build has no organizers", async () => {
    const { bridge, calls } = fakeBridge(() => null);

    expect(
      await createOrganizerPort({ bridge, isReady: () => false }).apply({ kind: "clear", runtimeIds: ["rt-1"] }),
    ).toEqual({ status: "not-ready" });
    expect(calls).toEqual([]);

    expect(
      await createOrganizerPort({ bridge, isReady: () => true }).apply({
        kind: "removeColumn",
        runtimeId: "rt-1",
        drawer: "Top",
        slot: 0,
      }),
    ).toEqual({ status: "not-ready" });
  });

  it("answers failed when the call throws, and rejected when the answer is not a receipt", async () => {
    const throwing = fakeBridge(() => {
      throw Object.assign(new Error("busy"), { code: "LEGACY_WRITERS_BUSY" });
    });
    expect(
      await createOrganizerPort({ bridge: throwing.bridge, isReady: () => true }).apply({
        kind: "setStyle",
        runtimeId: "rt-1",
        drawer: "Top",
        style: "Metal",
      }),
    ).toEqual({ status: "failed", message: "LEGACY_WRITERS_BUSY: busy" });

    const broken = fakeBridge(() => ({ status: "applied" }));
    expect(
      await createOrganizerPort({ bridge: broken.bridge, isReady: () => true }).apply({
        kind: "addColumn",
        runtimeId: "rt-1",
        drawer: "Top",
        slot: 0,
      }),
    ).toMatchObject({ status: "rejected", code: "API_INVALID_RESPONSE" });
  });

  it("reads an applied receipt without a state (the product went away during the render) as applied, with nothing to record", async () => {
    const { bridge } = fakeBridge(() => ({ status: "applied", state: null, corrections: [] }));

    expect(
      await createOrganizerPort({ bridge, isReady: () => true }).apply({
        kind: "addColumn",
        runtimeId: "rt-1",
        drawer: "Top",
        slot: 0,
      }),
    ).toEqual({ status: "applied", products: [], corrections: [] });
  });
});

describe("createOrganizerPort: clear", () => {
  const clearDrawer = caseNamed("clear-drawer");
  const clearEmpty = caseNamed("clear-all-empty");
  const rejected = caseNamed("api-unknown-product");

  it("clears product by product, in order, and reports every product it reached", async () => {
    const { bridge, calls } = fakeBridge((_, input) =>
      receiptOf(
        (input as { productId: string }).productId === "rt-2" ? clearEmpty : clearDrawer,
        (input as { productId: string }).productId,
      ),
    );

    const result = await createOrganizerPort({ bridge, isReady: () => true }).apply({
      kind: "clear",
      runtimeIds: ["rt-1", "rt-2"],
    });

    expect(calls).toEqual([
      ["clear", { productId: "rt-1" }],
      ["clear", { productId: "rt-2" }],
    ]);
    expect(result).toEqual({
      status: "applied",
      products: [
        { runtimeId: "rt-1", entry: readDrawerOrganizers(clearDrawer.expected.state), drawers: DERIVED },
        { runtimeId: "rt-2", entry: { status: "absent" }, drawers: DERIVED },
      ],
      corrections: [],
    });
  });

  it("is a noop when no product had anything to clear, and for no products at all", async () => {
    const { bridge, calls } = fakeBridge(() => receiptOf(clearEmpty));
    const port = createOrganizerPort({ bridge, isReady: () => true });

    expect(await port.apply({ kind: "clear", runtimeIds: ["rt-1"] })).toMatchObject({ status: "noop" });
    expect(await port.apply({ kind: "clear", runtimeIds: [] })).toEqual({
      status: "noop",
      products: [],
      corrections: [],
    });
    expect(calls).toHaveLength(1);
  });

  it("reports a failure on the first product as it is, and one after a product changed as partial", async () => {
    const first = fakeBridge(() => receiptOf(rejected));
    expect(
      await createOrganizerPort({ bridge: first.bridge, isReady: () => true }).apply({
        kind: "clear",
        runtimeIds: ["rt-1", "rt-2"],
      }),
    ).toEqual({
      status: "rejected",
      code: "ORGANIZERS_UNKNOWN_PRODUCT",
      message: "ORGANIZERS_UNKNOWN_PRODUCT message",
    });
    expect(first.calls).toHaveLength(1);

    vi.spyOn(console, "warn").mockImplementation(() => {});
    const second = fakeBridge((_, input) =>
      (input as { productId: string }).productId === "rt-1" ? receiptOf(clearDrawer) : receiptOf(rejected, "rt-2"),
    );
    const result = await createOrganizerPort({ bridge: second.bridge, isReady: () => true }).apply({
      kind: "clear",
      runtimeIds: ["rt-1", "rt-2", "rt-3"],
    });

    expect(result).toMatchObject({ status: "partial", products: [{ runtimeId: "rt-1" }] });
    expect(second.calls).toHaveLength(2);
  });
});

describe("createOrganizerPort: setState", () => {
  const normalizes = caseNamed("set-state-normalizes");
  const stored = normalizes.command.state as DrawerOrganizersV1;
  const putBackNone: OrganizerPortCommand = { kind: "setState", runtimeId: "rt-1", state: null };

  it("puts back a stored key and reads what the scene holds after normalizing it", async () => {
    const { bridge, calls } = fakeBridge(() => receiptOf(normalizes));

    const result = await createOrganizerPort({ bridge, isReady: () => true }).apply({
      kind: "setState",
      runtimeId: "rt-1",
      state: stored,
    });

    expect(calls).toEqual([["setState", { productId: "rt-1", state: stored }]]);
    // The shared case: 3D drops a column of the put-back key that is in a locked zone, so it answers `partial`.
    expect(result).toEqual({
      status: "partial",
      products: [{ runtimeId: "rt-1", entry: readDrawerOrganizers(normalizes.expected.state), drawers: DERIVED }],
      corrections: normalizes.expected.corrections,
    });
    expect(result).toMatchObject({ products: [{ entry: { status: "ok" } }] });
  });

  it("sends a null state as it is (no organizers) and reads the product as absent", async () => {
    const { bridge, calls } = fakeBridge(() => ({ status: "applied", state: stateOf("rt-1", null), corrections: [] }));

    const result = await createOrganizerPort({ bridge, isReady: () => true }).apply(putBackNone);

    // 3D requires the `state` key, so null is sent, not left out (toEqual tells null from a missing key).
    expect(calls).toEqual([["setState", { productId: "rt-1", state: null }]]);
    expect(result).toEqual({
      status: "applied",
      products: [{ runtimeId: "rt-1", entry: { status: "absent" }, drawers: DERIVED }],
      corrections: [],
    });
  });

  it("reports a refusal with the scene's code and message", async () => {
    const { bridge } = fakeBridge(() => ({
      status: "rejected",
      state: null,
      corrections: [],
      error: { code: "ORGANIZERS_UNKNOWN_PRODUCT", message: 'No product "rt-1" in the active composition' },
    }));

    expect(await createOrganizerPort({ bridge, isReady: () => true }).apply(putBackNone)).toEqual({
      status: "rejected",
      code: "ORGANIZERS_UNKNOWN_PRODUCT",
      message: 'No product "rt-1" in the active composition',
    });
  });

  it("answers not-ready without a call while the scene is not ready, and when the build has no setState", async () => {
    const notReady = fakeBridge(() => receiptOf(normalizes));
    expect(await createOrganizerPort({ bridge: notReady.bridge, isReady: () => false }).apply(putBackNone)).toEqual({
      status: "not-ready",
    });
    expect(notReady.calls).toEqual([]);

    // The bridge answers null for a method the build does not have.
    const withoutMethod = fakeBridge(() => null);
    expect(await createOrganizerPort({ bridge: withoutMethod.bridge, isReady: () => true }).apply(putBackNone)).toEqual(
      { status: "not-ready" },
    );
  });
});

describe("createOrganizerPort: runtime", () => {
  it("previews a column and clears the preview, never as a command", async () => {
    const { bridge, calls } = fakeBridge((method) => (method === "previewColumnLayout" ? true : null));
    const port = createOrganizerPort({ bridge, isReady: () => true });

    expect(await port.preview({ runtimeId: "rt-1", drawer: "Top", slot: 0, positions: [1, 3] })).toBe(true);
    expect(await port.preview(null)).toBe(true);
    expect(calls).toEqual([
      ["previewColumnLayout", { productId: "rt-1", drawer: "Top", slot: 0, positions: [1, 3] }],
      ["previewColumnLayout", null],
    ]);
  });

  it("enters and leaves the view, and says when the scene refused it or has no organizers", async () => {
    const answers: Record<string, unknown> = {
      enterView: { status: "rejected", error: { code: "ORGANIZERS_DRAWER_UNAVAILABLE" } },
      exitView: { status: "noop" },
    };
    const { bridge, calls } = fakeBridge((method) => answers[method] ?? null);
    const port = createOrganizerPort({ bridge, isReady: () => true });

    expect(await port.enterView({ runtimeId: "rt-1", drawer: "Bot" })).toBe(false);
    expect(await port.exitView()).toBe(true);
    expect(calls).toEqual([
      ["enterView", { productId: "rt-1", drawer: "Bot" }],
      ["exitView", undefined],
    ]);

    expect(await createOrganizerPort({ bridge: fakeBridge().bridge, isReady: () => true }).exitView()).toBe(false);
  });

  it("sends the view insets (the method returns nothing) and lists the organizer products", async () => {
    const { bridge, calls } = fakeBridge((method) =>
      method === "setViewInsets" ? undefined : [stateOf("rt-1", null), { productId: "broken" }],
    );
    const port = createOrganizerPort({ bridge, isReady: () => true });

    expect(await port.setViewInsets({ left: 160, right: 0, top: 0, bottom: 0 })).toBe(true);
    expect(await port.list()).toEqual([stateOf("rt-1", null)]);
    expect(calls[0]).toEqual(["setViewInsets", { left: 160, right: 0, top: 0, bottom: 0 }]);
    expect(await createOrganizerPort({ bridge: fakeBridge().bridge, isReady: () => true }).list()).toBeNull();
  });

  it("reads one product's state, and null for a product without organizers", async () => {
    const { bridge, calls } = fakeBridge((_, input) => (input === "rt-1" ? stateOf("rt-1", null) : null));
    const port = createOrganizerPort({ bridge, isReady: () => true });

    expect(await port.getState("rt-1")).toEqual(stateOf("rt-1", null));
    expect(await port.getState("rt-usH")).toBeNull();
    expect(calls).toEqual([
      ["getState", "rt-1"],
      ["getState", "rt-usH"],
    ]);
  });

  it("never throws from the runtime part", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { bridge } = fakeBridge(() => {
      throw new Error("iframe gone");
    });
    const port = createOrganizerPort({ bridge, isReady: () => true });

    expect(await port.enterView({ runtimeId: "rt-1", drawer: "Top" })).toBe(false);
    expect(await port.list()).toBeNull();
    expect(warn).toHaveBeenCalled();
  });

  it("waits for the scene to settle, and resolves at once without a warning for a build without whenSettled", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    // `organizers.whenSettled()` resolves with nothing.
    const settling = fakeBridge(() => undefined);

    await expect(
      createOrganizerPort({ bridge: settling.bridge, isReady: () => true }).whenSettled(),
    ).resolves.toBeUndefined();
    expect(settling.calls).toEqual([["whenSettled", undefined]]);

    const withoutMethod = fakeBridge(() => null);
    await expect(
      createOrganizerPort({ bridge: withoutMethod.bridge, isReady: () => true }).whenSettled(),
    ).resolves.toBeUndefined();
    expect(warn).not.toHaveBeenCalled();
  });

  it("resolves whenSettled with one warning when the call throws", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { bridge } = fakeBridge(() => {
      throw new Error("iframe gone");
    });

    await expect(createOrganizerPort({ bridge, isReady: () => true }).whenSettled()).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

describe("createOrganizerPort: events", () => {
  const subscribed = () => {
    const deliver: Record<string, (payload: unknown) => void> = {};
    const unsubscribe = vi.fn();
    const bridge: FakeBridge = {
      callOrganizers: vi.fn(async () => null),
      subscribeOrganizers: vi.fn(async (event, callback) => {
        deliver[`organizers:${event}`] = callback;
        return unsubscribe;
      }),
      subscribeOrganizersOverlay: vi.fn(async (event, callback) => {
        deliver[`overlay:${event}`] = callback;
        return unsubscribe;
      }),
    };
    return { port: createOrganizerPort({ bridge, isReady: () => true }), deliver, unsubscribe };
  };

  it("delivers parsed changes and views, and skips a payload that does not read as one", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { port, deliver, unsubscribe } = subscribed();
    const changes: unknown[] = [];
    const views: unknown[] = [];

    expect(await port.onChange((change) => changes.push(change))).toBe(unsubscribe);
    await port.onView((view) => views.push(view));

    const change = {
      productId: "rt-1",
      revision: 3,
      state: stateOf("rt-1", null, 3),
      corrections: [],
      reason: "current",
    };
    deliver["organizers:change"](change);
    deliver["organizers:change"]({ ...change, reason: "unknown" });
    deliver["organizers:view"]({ view: { productId: "rt-1", drawer: "Top" }, reason: "enter" });
    deliver["organizers:view"]({ view: "Top", reason: "enter" });

    expect(changes).toEqual([change]);
    expect(views).toEqual([{ view: { productId: "rt-1", drawer: "Top" }, reason: "enter" }]);
  });

  it("delivers each frame of the shared fixture, a broken frame as null, and only background taps", async () => {
    const { port, deliver } = subscribed();
    const frames: unknown[] = [];
    const taps: unknown[] = [];
    await port.onFrame((frame) => frames.push(frame));
    await port.onPointer((pointer) => taps.push(pointer));

    for (const { expected } of framesFixture.cases) deliver["overlay:change"](expected);
    deliver["overlay:change"]({ revision: 9 });
    deliver["overlay:pointer"]({ kind: "background", point: { x: 1, y: 2 }, source: "mouse" });
    deliver["overlay:pointer"]({ kind: "plus", drawer: "Top", slot: 0 });

    expect(frames).toEqual([...framesFixture.cases.map(({ expected }) => expected), null]);
    expect(taps).toEqual([{ kind: "background", point: { x: 1, y: 2 }, source: "mouse" }]);
  });

  it("answers null for a build without the events", async () => {
    const port = createOrganizerPort({ bridge: {}, isReady: () => true });

    expect(await port.onChange(vi.fn())).toBeNull();
    expect(await port.onPointer(vi.fn())).toBeNull();
  });
});
