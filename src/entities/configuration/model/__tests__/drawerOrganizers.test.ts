import { describe, expect, it, vi } from "vitest";

import commands from "@/features/drawerOrganizers/__tests__/fixtures/contract/commands.v1.json";
import contract from "@/features/drawerOrganizers/__tests__/fixtures/contract/contract.v1.json";
import pricing from "@/features/drawerOrganizers/__tests__/fixtures/contract/pricing.v1.json";

import { DRAWER_ORGANIZERS_KEY, DRAWER_ORGANIZERS_VERSION, readDrawerOrganizers } from "../drawerOrganizers";

// Vitest runs this in Node; keep Node-only types out of the app's DOM tsconfig.
const { runInNewContext } = await vi.importActual<{ runInNewContext(code: string): unknown }>("node:vm");

type FixtureState = { version: number } | null;

/** What the reader must answer for a state the 3D canon writes (or leaves untouched). */
function expectReadOf(state: FixtureState, where: string) {
  const read = readDrawerOrganizers(state);
  if (state === null) {
    expect(read, where).toEqual({ status: "absent" });
  } else if (state.version === DRAWER_ORGANIZERS_VERSION) {
    expect(read, where).toEqual({ status: "ok", value: state });
  } else {
    expect(read, where).toEqual({ status: "unsupported-version", version: state.version });
  }
}

describe("readDrawerOrganizers", () => {
  it("names the scene key and its data version", () => {
    expect(DRAWER_ORGANIZERS_KEY).toBe("DrawerOrganizers");
    expect(DRAWER_ORGANIZERS_VERSION).toBe(1);
  });

  it.each(contract.cases.map((item) => [item.name, item.expected.state as FixtureState] as const))(
    "reads the canonical state of contract case %s",
    (name, state) => expectReadOf(state, name),
  );

  it.each(commands.cases.map((item) => [item.name, item.expected.state as FixtureState] as const))(
    "reads the state after command case %s",
    (name, state) => expectReadOf(state, name),
  );

  it("reads every priced cabinet value of the pricing fixture", () => {
    for (const item of pricing.cases) {
      for (const cabinet of item.input.cabinets) expectReadOf(cabinet.value as FixtureState, `${item.name}/${cabinet.stableKey}`);
    }
  });

  it("reports a newer data version instead of reading it", () => {
    const unsupported = contract.cases.find((item) => item.name === "unsupported-version");

    expect(readDrawerOrganizers(unsupported?.raw)).toEqual({ status: "unsupported-version", version: 2 });
  });

  it("reads { version: 1 } without sets as absent", () => {
    expect(readDrawerOrganizers({ version: 1 })).toEqual({ status: "absent" });
    expect(readDrawerOrganizers(undefined)).toEqual({ status: "absent" });
  });

  it.each([
    ["null", null, "absent"],
    ["a number", 5, "malformed"],
    ["a string", "x", "malformed"],
    ["an array", [], "malformed"],
    ["no version", { Top: { style: "Metal", columns: [{ slot: 0, positions: [] }] } }, "malformed"],
    ["a string version", { version: "1" }, "malformed"],
    ["a set that is a number", { version: 1, Top: 5 }, "malformed"],
    ["an unknown style", { version: 1, Top: { style: "Walnut", columns: [{ slot: 0, positions: [] }] } }, "malformed"],
    ["no columns", { version: 1, Top: { style: "Metal", columns: [] } }, "malformed"],
    ["a string slot", { version: 1, Top: { style: "Metal", columns: [{ slot: "1", positions: [] }] } }, "malformed"],
    ["a fractional slot", { version: 1, Top: { style: "Metal", columns: [{ slot: 0.5, positions: [] }] } }, "malformed"],
    ["string positions", { version: 1, Bot: { style: "Metal", columns: [{ slot: 0, positions: ["2"] }] } }, "malformed"],
  ])("never throws on %s", (_label, raw, status) => {
    expect(() => readDrawerOrganizers(raw)).not.toThrow();
    expect(readDrawerOrganizers(raw).status).toBe(status);
  });

  it("answers malformed for an object whose getter throws", () => {
    const hostile = { version: 1, get Top(): unknown { throw new Error("boom"); } };

    expect(readDrawerOrganizers(hostile)).toEqual({ status: "malformed", issue: "DrawerOrganizers could not be read" });
  });

  it("ignores extra keys and returns a fresh copy", () => {
    const raw = { version: 1, note: "x", Top: { style: "Metal", extra: true, columns: [{ slot: -1, positions: [2], selected: true }] } };

    const read = readDrawerOrganizers(raw);

    expect(read).toEqual({ status: "ok", value: { version: 1, Top: { style: "Metal", columns: [{ slot: -1, positions: [2] }] } } });
    if (read.status !== "ok") return;
    read.value.Top?.columns[0].positions.push(4);
    expect(raw.Top.columns[0].positions).toEqual([2]);
  });

  it("reads an object from another realm (the PlayCanvas iframe) into this realm's plain data", () => {
    const foreign = runInNewContext(
      '({ version: 1, Bot: { style: "Metal", columns: [{ slot: 0, positions: [1, 4] }, { slot: 1, positions: [] }] } })',
    );

    const read = readDrawerOrganizers(foreign);

    expect(read).toEqual({
      status: "ok",
      value: { version: 1, Bot: { style: "Metal", columns: [{ slot: 0, positions: [1, 4] }, { slot: 1, positions: [] }] } },
    });
    if (read.status !== "ok") return;
    expect(Object.getPrototypeOf(read.value)).toBe(Object.prototype);
    expect(Object.getPrototypeOf(read.value.Bot)).toBe(Object.prototype);
    expect(Object.getPrototypeOf(read.value.Bot?.columns)).toBe(Array.prototype);
    expect(Object.getPrototypeOf(read.value.Bot?.columns[0])).toBe(Object.prototype);
    expect(Object.getPrototypeOf(read.value.Bot?.columns[0].positions)).toBe(Array.prototype);
  });
});
