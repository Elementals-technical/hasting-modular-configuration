import { describe, expect, it, vi } from "vitest";

import commandsFixture from "@/features/drawerOrganizers/__tests__/fixtures/contract/commands.v1.json";
import contractFixture from "@/features/drawerOrganizers/__tests__/fixtures/contract/contract.v1.json";
import framesFixture from "@/features/drawerOrganizers/__tests__/fixtures/contract/frames.v1.json";

import {
  ORGANIZERS_ERROR_CODES,
  classifyOrganizersError,
  parseOrganizersChange,
  parseOrganizersFrame,
  parseOrganizersPointer,
  parseOrganizersReceipt,
  parseOrganizersState,
  parseOrganizersView,
  readModelEntryOf,
  type OrganizersState,
} from "../organizers";

/**
 * The UI side of `ConfiguratorAPI.organizers` v1 (OPUS-C §4.2–4.4): names and codes against the shared
 * fixtures, and parsers that never trust what the iframe sends.
 */

type ContractCase = (typeof contractFixture.cases)[number];

/** The `OrganizersState` 3D builds for a product whose stored key normalises as in the contract case. */
const stateOf = (testCase: ContractCase, productId = "rt-1"): OrganizersState =>
  ({
    productId,
    revision: 1,
    params: testCase.params,
    state: testCase.expected.state,
    drawers: testCase.expected.derived,
    lastCorrections: testCase.expected.diagnostics,
  }) as unknown as OrganizersState;

const contractCase = (name: string) => {
  const found = contractFixture.cases.find((testCase) => testCase.name === name);
  if (!found) throw new Error(`no contract case ${name}`);
  return found;
};

// Vitest runs this in Node; keep Node-only types out of the app's DOM tsconfig (as bridge.test.ts does).
const vm = await vi.importActual<{ runInNewContext(code: string): unknown }>("node:vm");

describe("organizers contract names", () => {
  it("knows exactly the eight error codes of organizer-contract.mjs, and every code the command fixture uses", () => {
    expect([...ORGANIZERS_ERROR_CODES].sort()).toEqual([
      "ORGANIZERS_DRAWER_UNAVAILABLE",
      "ORGANIZERS_INVALID_INPUT",
      "ORGANIZERS_NOT_ORGANIZER_PRODUCT",
      "ORGANIZERS_NOT_READY",
      "ORGANIZERS_NO_SUCH_COLUMN",
      "ORGANIZERS_SLOT_UNAVAILABLE",
      "ORGANIZERS_UNKNOWN_PRODUCT",
      "ORGANIZERS_UNSUPPORTED_VERSION",
    ]);
    const fixtureCodes = commandsFixture.cases.flatMap(({ expected }) =>
      "error" in expected && expected.error ? [expected.error.code] : [],
    );
    expect(fixtureCodes.length).toBeGreaterThan(0);
    expect(fixtureCodes.filter((code) => !(ORGANIZERS_ERROR_CODES as readonly string[]).includes(code))).toEqual([]);
  });
});

describe("parseOrganizersState", () => {
  it.each(contractFixture.cases.map((testCase) => [testCase.name, testCase] as const))(
    "reads the state of %s as 3D builds it",
    (_, testCase) => {
      expect(parseOrganizersState(stateOf(testCase))).toEqual(stateOf(testCase));
    },
  );

  it("returns a copy that shares nothing with the scene's object, also from another realm", () => {
    const source = stateOf(contractCase("sb60-example2"));
    const foreign = vm.runInNewContext(`(${JSON.stringify(source)})`) as OrganizersState;

    const parsed = parseOrganizersState(foreign);

    expect(parsed).toEqual(source);
    expect(Object.getPrototypeOf(parsed)).toBe(Object.prototype);
    expect(Object.getPrototypeOf(parsed!.drawers.Top.candidates)).toBe(Array.prototype);
    expect(parsed!.drawers).not.toBe(foreign.drawers);
  });

  it.each([
    ["null", null],
    ["a string", "rt-1"],
    ["no product id", { ...stateOf(contractCase("empty-sb60")), productId: 5 }],
    ["a revision that is not a number", { ...stateOf(contractCase("empty-sb60")), revision: Number.NaN }],
    [
      "no Bot drawer",
      { ...stateOf(contractCase("empty-sb60")), drawers: { Top: contractCase("empty-sb60").expected.derived.Top } },
    ],
    [
      "a drawer without candidates",
      {
        ...stateOf(contractCase("empty-sb60")),
        drawers: { ...contractCase("empty-sb60").expected.derived, Bot: { exists: true } },
      },
    ],
    ["a malformed stored state", { ...stateOf(contractCase("empty-sb60")), state: { version: 1, Top: 5 } }],
  ])("returns null for %s", (_, raw) => {
    expect(parseOrganizersState(raw)).toBeNull();
  });
});

describe("parseOrganizersReceipt", () => {
  const params = { collection: "class", role: "SC", width: 60, drawersMode: "2D" };
  const derived = contractCase("positions-fixed").expected.derived;

  it.each(commandsFixture.cases.map((testCase) => [testCase.name, testCase] as const))(
    "reads the receipt of %s",
    (_, testCase) => {
      const { status, state, corrections } = testCase.expected;
      const error = "error" in testCase.expected ? testCase.expected.error : undefined;
      const receipt = {
        status,
        // A rejected command leaves the stored key as it was; 3D still answers with the product's state.
        state: {
          productId: "rt-1",
          revision: 2,
          params,
          state: status === "rejected" ? null : state,
          drawers: derived,
          lastCorrections: corrections,
        },
        corrections,
        ...(error ? { error: { code: error.code, message: `${error.code} message` } } : {}),
      };

      expect(parseOrganizersReceipt(receipt)).toEqual(receipt);
    },
  );

  it("takes a rejected receipt without a state", () => {
    const receipt = {
      status: "rejected",
      state: null,
      corrections: [],
      error: { code: "ORGANIZERS_NOT_READY", message: "x" },
    };
    expect(parseOrganizersReceipt(receipt)).toEqual(receipt);
  });

  it.each(["applied", "noop", "partial"])("takes the receipt status %s", (status) => {
    const receipt = { status, state: null, corrections: [] };
    expect(parseOrganizersReceipt(receipt)).toEqual(receipt);
  });

  it("takes an applied receipt without a state: the product went away during the render", () => {
    const receipt = { status: "applied", state: null, corrections: [] };
    expect(parseOrganizersReceipt(receipt)).toEqual(receipt);
  });

  it.each([
    ["null", null],
    ["an unknown status", { status: "done", state: null, corrections: [] }],
    [
      "an applied receipt with a state that does not read as one",
      { status: "applied", state: { productId: 1 }, corrections: [] },
    ],
    ["corrections that are not a list", { status: "noop", state: null, corrections: 5 }],
    ["a rejected receipt without an error", { status: "rejected", state: null, corrections: [] }],
  ])("reads %s as a rejected receipt, never as applied", (_, raw) => {
    expect(parseOrganizersReceipt(raw)).toMatchObject({
      status: "rejected",
      state: null,
      corrections: [],
      error: { code: "API_INVALID_RESPONSE" },
    });
  });
});

describe("parseOrganizersFrame", () => {
  it.each(framesFixture.cases.map((frameCase) => [frameCase.name, frameCase.expected] as const))(
    "reads the frame %s",
    (_, frame) => {
      expect(parseOrganizersFrame(frame)).toEqual(frame);
    },
  );

  it("reads null (nothing to show) and a broken frame as null", () => {
    expect(parseOrganizersFrame(null)).toBeNull();
    expect(parseOrganizersFrame({ revision: 1, visible: "yes" })).toBeNull();
    expect(parseOrganizersFrame({ ...framesFixture.cases[0].expected, plus: [{ slot: 0 }] })).toBeNull();
  });
});

describe("events", () => {
  const state = stateOf(contractCase("sc120-example1"));

  it("reads a change, including the first delivery (`current`), and refuses a broken one", () => {
    const change = { productId: "rt-1", revision: 3, state, corrections: [], reason: "current" };
    expect(parseOrganizersChange(change)).toEqual(change);
    expect(
      parseOrganizersChange({
        ...change,
        reason: "width",
        corrections: [{ code: "OUT_OF_RANGE", severity: "dropped", drawer: "Bot", slot: -5 }],
      }),
    ).toMatchObject({ reason: "width", corrections: [{ code: "OUT_OF_RANGE" }] });
    expect(parseOrganizersChange({ ...change, state: null })).toBeNull();
    expect(parseOrganizersChange({ ...change, reason: 5 })).toBeNull();
  });

  it.each(["current", "command", "width", "height", "drawers", "created", "restore", "removed", "config"])(
    "knows the change reason %s, and refuses one the contract does not list",
    (reason) => {
      const change = { productId: "rt-1", revision: 3, state, corrections: [], reason };
      expect(parseOrganizersChange(change)).toMatchObject({ reason });
      expect(parseOrganizersChange({ ...change, reason: `${reason}-later` })).toBeNull();
    },
  );

  it.each(["dropped", "fixed", "info", "error"])("knows the correction severity %s", (severity) => {
    const change = { productId: "rt-1", revision: 3, state, corrections: [{ code: "X", severity }], reason: "command" };
    expect(parseOrganizersChange(change)).toMatchObject({ corrections: [{ severity }] });
    expect(
      parseOrganizersChange({ ...change, corrections: [{ code: "X", severity: `${severity}-later` }] }),
    ).toBeNull();
  });

  it("reads a view and a background pointer", () => {
    expect(parseOrganizersView({ view: { productId: "rt-1", drawer: "Top" }, reason: "enter" })).toEqual({
      view: { productId: "rt-1", drawer: "Top" },
      reason: "enter",
    });
    expect(parseOrganizersView({ view: null, reason: "current" })).toEqual({ view: null, reason: "current" });
    expect(parseOrganizersView({ view: { productId: "rt-1", drawer: "Middle" }, reason: "enter" })).toBeNull();

    const pointer = { kind: "background", point: { x: 10, y: 20 }, source: "touch" };
    expect(parseOrganizersPointer(pointer)).toEqual(pointer);
    expect(parseOrganizersPointer({ ...pointer, kind: "plus" })).toBeNull();
  });
});

describe("readModelEntryOf", () => {
  it("reads the stored state of the product", () => {
    expect(readModelEntryOf(stateOf(contractCase("sc120-example1")))).toEqual({
      status: "ok",
      value: contractCase("sc120-example1").expected.state,
    });
    expect(readModelEntryOf(stateOf(contractCase("empty-sb60")))).toEqual({ status: "absent" });
  });

  it("never reads the data of a newer build as empty", () => {
    const unsupported = stateOf(contractCase("unsupported-version"));
    expect(unsupported.state).toBeNull();

    expect(readModelEntryOf(unsupported)).toEqual({ status: "unsupported-version", version: null });
    expect(
      readModelEntryOf({ ...unsupported, lastCorrections: [] }, [
        { code: "UNSUPPORTED_VERSION", severity: "error", detail: { version: 2 } },
      ]),
    ).toEqual({ status: "unsupported-version", version: 2 });
  });
});

describe("classifyOrganizersError", () => {
  it("keeps the code and message of a runtime or bridge error", () => {
    expect(classifyOrganizersError({ code: "ORGANIZERS_SLOT_UNAVAILABLE", message: "not a candidate" })).toEqual({
      code: "ORGANIZERS_SLOT_UNAVAILABLE",
      message: "not a candidate",
    });
    expect(classifyOrganizersError(Object.assign(new Error("busy"), { code: "LEGACY_WRITERS_BUSY" }))).toEqual({
      code: "LEGACY_WRITERS_BUSY",
      message: "busy",
    });
  });

  it("names anything else UNKNOWN", () => {
    expect(classifyOrganizersError("boom")).toEqual({ code: "UNKNOWN", message: "boom" });
    expect(classifyOrganizersError(undefined)).toEqual({ code: "UNKNOWN", message: "Organizers command failed" });
  });
});
