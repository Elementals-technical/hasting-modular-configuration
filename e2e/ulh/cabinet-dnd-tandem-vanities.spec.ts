import { expect, test, type Frame } from "@playwright/test";
import { eventually, near, openPreset, type Cabinet, type Configurator } from "../support/configurator";
import { describeBox, restsOn, type Box, type SceneReader } from "../support/scene";

/**
 * D&D: separating two sink bases (Ryan 23.10, "remote tandem vanities"; Andriy 23.10).
 * - thin top (0.5″): the SB set apart stays an SB and gets a clone of the top (finish, style) — a tandem top;
 * - thick top (5⅛″): the one top is extended over the SB set apart at its level.
 * Fixtures: [SB 90][SB 90] under one top, from sb-sc-same-height (configuration 15264) with two SBs.
 */

type TandemTop = { id: string; config: Record<string, unknown> };

/** Tandem tops of the active composition (CountertopRole 'tandemTop'), read inside the iframe. */
const tandemTops = (frame: Frame) =>
  frame.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const app = w.pc?.Application?.getApplication?.();
    const products = app?.compositionManager?.getActiveComposition?.()?.getAllProducts?.() ?? {};
    return Object.entries(products)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter(([, p]: [string, any]) => p?.CountertopRole === "tandemTop")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map(([id, p]: [string, any]) => ({ id, config: { ...p } }));
  }) as Promise<TandemTop[]>;

const sinkBases = async (configurator: Configurator) => {
  const list = (await configurator.cabinets()).filter((c) => c.definitionId.includes("-sink-"));
  expect(list.length, "two sink bases").toBe(2);
  return [...list].sort((a, b) => a.positionM.x - b.positionM.x);
};
const movedRight = (c: Cabinet, dx: number) => ({ ...c.positionM, x: c.positionM.x + dx });
const frameOf = (page: import("@playwright/test").Page) =>
  page.frames().find((f) => f.url().includes("/HastingCabinetsParametrization/"))!;

test.describe("ULH D&D: two sink bases set apart — thin top", () => {
  let configurator: Configurator;
  let scene: SceneReader;
  let left: Cabinet;
  let right: Cabinet;
  let frame: Frame;

  test.beforeEach(async ({ page }) => {
    ({ configurator, scene } = await openPreset(page, "ulh", "sb-sb-thin"));
    frame = frameOf(page);
    [left, right] = await sinkBases(configurator);
    const top = await scene.countertop();
    expect(restsOn(top, await scene.cabinetBody(left.id)), `top ${describeBox(top)} on the left SB`).toBe(true);
    expect(restsOn(top, await scene.cabinetBody(right.id)), `top ${describeBox(top)} on the right SB`).toBe(true);
    expect(await tandemTops(frame)).toEqual([]);
  });

  test("dragging the right SB out (doc picture 3): valid at every step, never TRAP_KEEPOUT", async () => {
    for (const dx of [0.03, 0.2, 0.45, 0.9]) {
      const move = await configurator.moveDraft(right.id, movedRight(right, dx));
      const codes = move.draft.validation.reasons.map((r) => r.code);
      expect(codes, `dx ${dx}`).not.toContain("TRAP_KEEPOUT");
      expect(move.draft.validation.status, `dx ${dx}: ${codes.join(",")}`).toBe("valid");
      expect(move.draft.canApply).toBe(true);
      await move.cancel();
    }
  });

  test("Apply with a narrow gap: still an SB, a clone of the top on it (same finish), no cover", async () => {
    const before = await configurator.countertop();
    const move = await configurator.moveDraft(right.id, movedRight(right, 0.03));
    await move.apply();

    await eventually(async () => (await tandemTops(frame)).length, "one tandem top").toBe(1);
    const [tandem] = await tandemTops(frame);
    const after = await configurator.cabinets();
    const moved = after.find((c) => c.id === right.id)!;
    expect(moved.definitionId, "the right cabinet stays a sink base").toContain("-sink-");
    expect(tandem.config.CountertopColor).toBe("Bianco Male TFA");
    expect(String(tandem.config.Thickness)).toBe("0.5");
    expect(tandem.config.TandemSinkBaseId).toBe(right.id);
    await eventually(async () => (await configurator.covers()).length, "no Cabinet_Cover on the SB set apart").toBe(0);
    // The basin top shrank to the left SB; the tandem top lies on the right SB and spans it.
    await eventually(async () => (await configurator.countertop()).size.length, "the top on the left SB only")
      .toBeLessThan(before.size.length - 0.3);
    const rightBody = await scene.cabinetBody(right.id);
    await eventually(async () => {
      const box: Box = await scene.box(tandem.id);
      return restsOn(box, rightBody) && near(box.min.x, rightBody.min.x, 0.012) && near(box.max.x, rightBody.max.x, 0.012);
    }, `tandem top on the right SB ${describeBox(rightBody)}`).toBe(true);
    expect(restsOn(await scene.countertop(), await scene.cabinetBody(left.id)), "the basin top on the left SB").toBe(true);
  });

  test("the SB moved back against the other: the tandem top is removed, one top again", async () => {
    await (await configurator.moveDraft(right.id, movedRight(right, 0.1))).apply();
    await eventually(async () => (await tandemTops(frame)).length).toBe(1);
    await (await configurator.moveDraft(right.id, right.positionM)).apply();
    await eventually(async () => (await tandemTops(frame)).length, "no tandem top").toBe(0);
    const top = await scene.countertop();
    await eventually(async () => restsOn(await scene.countertop(), await scene.cabinetBody(right.id)), `top ${describeBox(top)} on both`)
      .toBe(true);
  });
});

test.describe("ULH D&D: two sink bases set apart — thick top", () => {
  test("Apply at the same level: the one top extends over the gap, nothing cloned, no cover", async ({ page }) => {
    const { configurator, scene } = await openPreset(page, "ulh", "sb-sb-thick");
    const frame = frameOf(page);
    const [left, right] = await sinkBases(configurator);
    const move = await configurator.moveDraft(right.id, movedRight(right, 0.1));
    expect(move.draft.validation.status, move.draft.validation.reasons.map((r) => r.code).join(",")).toBe("valid");
    await move.apply();
    const leftBody = await scene.cabinetBody(left.id);
    const rightBody = await scene.cabinetBody(right.id);
    await eventually(async () => {
      const top = await scene.countertop();
      return top.min.x <= leftBody.min.x + 0.012 && top.max.x >= rightBody.max.x - 0.012;
    }, "the top spans both SBs and the gap").toBe(true);
    expect(await tandemTops(frame)).toEqual([]);
    await eventually(async () => (await configurator.covers()).length, "no cover").toBe(0);
  });
});
