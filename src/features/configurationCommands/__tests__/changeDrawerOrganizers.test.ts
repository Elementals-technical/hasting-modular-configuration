import { beforeEach, describe, expect, it } from "vitest";

import { store } from "@/app/store";
import { getOrganizersByCabinet, recordOrganizers, resetConfiguration, syncCabinets } from "@/entities/configuration";
import {
  answerOf,
  endStateOf,
  portResultOf,
  startStateOf,
} from "@/features/drawerOrganizers/__tests__/organizerPortAnswers";
import { createTestOrganizerPort } from "@/features/playCanvasAdapter";

import { changeDrawerOrganizers, type OrganizerChange } from "../lib/changeDrawerOrganizers";

/**
 * The organizer command: stable key → runtime id → port → receipt → read-model. The scene owns the key;
 * the command records only what it answered and never a value or a history step of its own.
 */

const organizers = () => getOrganizersByCabinet(store.getState());

const run = (change: OrganizerChange, port: ReturnType<typeof createTestOrganizerPort>["port"]) =>
  changeDrawerOrganizers(change, { dispatch: (action) => store.dispatch(action), getState: store.getState, port });

describe("changeDrawerOrganizers", () => {
  beforeEach(() => {
    store.dispatch(resetConfiguration());
    store.dispatch(syncCabinets(["rt-1", "rt-2"]));
  });

  it("sends the command by runtime id and records what the scene holds after it", async () => {
    const fake = createTestOrganizerPort({ answers: [answerOf("add-first")] });

    const result = await run({ kind: "addColumn", cabinetId: "cab-1", drawer: "Top", slot: 0 }, fake.port);

    expect(fake.commands()).toEqual([{ kind: "addColumn", runtimeId: "rt-1", drawer: "Top", slot: 0 }]);
    expect(result).toEqual({ status: "applied", corrections: [] });
    expect(organizers()).toEqual({ "cab-1": endStateOf("add-first") });
  });

  it("records the corrected state of a partial answer and hands the corrections on", async () => {
    store.dispatch(recordOrganizers({ stableKey: "cab-1", entry: startStateOf("layout-fixed") }));
    const fake = createTestOrganizerPort({ answers: [answerOf("layout-fixed")] });

    const result = await run(
      { kind: "setColumnLayout", cabinetId: "cab-1", drawer: "Top", slot: 0, positions: [5, 1, 1, 3] },
      fake.port,
    );

    expect(result).toEqual({
      status: "partial",
      corrections: [expect.objectContaining({ code: "POSITIONS_FIXED", severity: "fixed" })],
    });
    expect(organizers()["cab-1"]).toEqual(endStateOf("layout-fixed"));
  });

  it("removes the entry when the last column goes, and keeps the entry of a noop", async () => {
    store.dispatch(recordOrganizers({ stableKey: "cab-1", entry: startStateOf("remove-last") }));
    store.dispatch(recordOrganizers({ stableKey: "cab-2", entry: startStateOf("preset-same") }));
    const before = organizers()["cab-2"];
    const fake = createTestOrganizerPort({ answers: [answerOf("remove-last"), answerOf("preset-same", "rt-2")] });

    expect(await run({ kind: "removeColumn", cabinetId: "cab-1", drawer: "Top", slot: 0 }, fake.port)).toMatchObject({
      status: "applied",
    });
    expect(
      await run({ kind: "setColumnLayout", cabinetId: "cab-2", drawer: "Top", slot: 0, positions: [4, 2] }, fake.port),
    ).toEqual({ status: "noop", corrections: [] });

    expect(organizers()).toEqual({ "cab-2": before });
    expect(organizers()["cab-2"]).toBe(before);
  });

  it.each(["add-not-candidate", "add-in-zone", "layout-no-column", "unsupported-version", "api-unknown-product"])(
    "records nothing when the scene refuses the command (%s)",
    async (name) => {
      store.dispatch(recordOrganizers({ stableKey: "cab-1", entry: startStateOf(name) }));
      const before = organizers();
      const fake = createTestOrganizerPort();
      fake.answerNext(portResultOf(name));

      const result = await run({ kind: "addColumn", cabinetId: "cab-1", drawer: "Top", slot: 0 }, fake.port);

      expect(result).toMatchObject({ status: "rejected", code: expect.stringMatching(/^ORGANIZERS_/) });
      expect(organizers()).toBe(before);
    },
  );

  it("records nothing when the scene is not ready or the call failed", async () => {
    const fake = createTestOrganizerPort();
    fake.setReady(false);
    expect(await run({ kind: "setStyle", cabinetId: "cab-1", drawer: "Top", style: "Metal" }, fake.port)).toMatchObject(
      {
        status: "error",
        code: "runtime-not-ready",
      },
    );

    fake.setReady(true);
    fake.answerNext({ status: "failed", message: "LEGACY_WRITERS_BUSY: busy" });
    expect(await run({ kind: "setStyle", cabinetId: "cab-1", drawer: "Top", style: "Metal" }, fake.port)).toEqual({
      status: "error",
      code: "runtime-failed",
      message: "LEGACY_WRITERS_BUSY: busy",
    });
    expect(organizers()).toEqual({});
  });

  it("does not call the scene for a cabinet it cannot address", async () => {
    const fake = createTestOrganizerPort();

    expect(await run({ kind: "addColumn", cabinetId: "cab-9", drawer: "Top", slot: 0 }, fake.port)).toMatchObject({
      status: "error",
      code: "unknown-target",
    });
    expect(await run({ kind: "clear", cabinetIds: ["cab-1", "cab-9"] }, fake.port)).toMatchObject({
      code: "unknown-target",
    });
    expect(fake.calls).toEqual([]);
  });
});

describe("changeDrawerOrganizers: clear", () => {
  beforeEach(() => {
    store.dispatch(resetConfiguration());
    store.dispatch(syncCabinets(["rt-1", "rt-2", "rt-3"]));
  });

  it("without cabinets clears every cabinet the read-model holds organizers for, and records each", async () => {
    store.dispatch(recordOrganizers({ stableKey: "cab-1", entry: startStateOf("clear-drawer") }));
    store.dispatch(recordOrganizers({ stableKey: "cab-3", entry: startStateOf("remove-last") }));
    const fake = createTestOrganizerPort();
    fake.answerNext({
      status: "applied",
      products: [
        { runtimeId: "rt-1", entry: { status: "absent" } },
        { runtimeId: "rt-3", entry: { status: "absent" } },
      ],
      corrections: [],
    });

    expect(await run({ kind: "clear" }, fake.port)).toEqual({ status: "applied", corrections: [] });
    expect(fake.commands()).toEqual([{ kind: "clear", runtimeIds: ["rt-1", "rt-3"] }]);
    expect(organizers()).toEqual({});
  });

  it("records what a partial clear reached", async () => {
    store.dispatch(recordOrganizers({ stableKey: "cab-1", entry: startStateOf("clear-drawer") }));
    store.dispatch(recordOrganizers({ stableKey: "cab-2", entry: startStateOf("clear-drawer") }));
    const fake = createTestOrganizerPort();
    fake.answerNext({
      status: "partial",
      products: [{ runtimeId: "rt-1", entry: endStateOf("clear-drawer") }],
      corrections: [],
    });

    expect(await run({ kind: "clear", cabinetIds: ["cab-1", "cab-2"] }, fake.port)).toMatchObject({
      status: "partial",
    });
    expect(organizers()).toEqual({ "cab-1": endStateOf("clear-drawer"), "cab-2": startStateOf("clear-drawer") });
  });

  it("is a noop without asking the scene when no cabinet holds organizers", async () => {
    const fake = createTestOrganizerPort();

    expect(await run({ kind: "clear" }, fake.port)).toEqual({ status: "noop", corrections: [] });
    expect(fake.calls).toEqual([]);
  });
});
