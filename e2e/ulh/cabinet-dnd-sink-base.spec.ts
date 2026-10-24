import { expect, test } from "@playwright/test";
import { eventually, near, openPreset, type Cabinet, type Configurator } from "../support/configurator";
import { coversTopOf, describeBox, restsOn, type SceneReader } from "../support/scene";

/**
 * D&D: shifting the sink base (SB) carries the countertop resting on it (PlayCanvas 9d83a6a, Ryan / Andriy 22.10).
 * Fixture: [SB][SC], both 38 cm, under one thin (0.5″, Standard) top — exported from configuration 15264.
 */
const FIXTURE = "sb-sc-same-height";

const byKind = (cabinets: Cabinet[], kind: "sink" | "side") => {
  const found = cabinets.find((c) => c.definitionId.includes(`-${kind}-`));
  if (!found) throw new Error(`no ${kind} cabinet in ${FIXTURE}`);
  return found;
};
const shifted = (c: Cabinet, dy: number) => ({ ...c.positionM, y: c.positionM.y + dy });

test.describe("ULH D&D: shifting the SB carries its countertop", () => {
  let configurator: Configurator;
  let scene: SceneReader;
  let sb: Cabinet;
  let sc: Cabinet;

  test.beforeEach(async ({ page }) => {
    ({ configurator, scene } = await openPreset(page, "ulh", FIXTURE));
    const cabinets = await configurator.cabinets();
    sb = byKind(cabinets, "sink");
    sc = byKind(cabinets, "side");
    expect((await configurator.countertop()).placementState, "a Standard top").toBe("attached");
    // The fixture as drawn: one top lying on both cabinets.
    const top = await scene.countertop();
    expect(restsOn(top, await scene.cabinetBody(sb.id)), `top ${describeBox(top)} on the SB`).toBe(true);
    expect(restsOn(top, await scene.cabinetBody(sc.id)), `top ${describeBox(top)} on the SC`).toBe(true);
  });

  test("SB moved up: valid, Apply on, the top shown on the SB, the composition revision stays; Cancel leaves it", async () => {
    const revision = await configurator.revision();
    // Measured before the drag: while a draft is open the SB itself is hidden and its preview is drawn instead.
    const sbBody = await scene.cabinetBody(sb.id);
    const move = await configurator.moveDraft(sb.id, shifted(sb, 0.1));
    expect(move.draft.validation.reasons.map((r) => r.code)).toEqual([]);
    expect(move.draft.validation.status).toBe("valid");
    expect(move.draft.canApply, "the top shown over the preview is no composition change").toBe(true);
    expect(await configurator.revision()).toBe(revision);
    // The top goes up with the SB's preview: 10 cm above where it lay.
    const top = await scene.countertop();
    expect(near(top.min.y, sbBody.max.y + 0.1, 0.002), `top ${describeBox(top)} 10 cm above the SB's old top`).toBe(true);

    await move.cancel();
    expect(await configurator.revision(), "Cancel puts the top back as it was").toBe(revision);
    expect(restsOn(await scene.countertop(), sbBody), "the top back on the SB").toBe(true);
  });

  test("SB moved below the SC top: SC_HIGHER_THAN_SB blocks Apply, not the trap keep-out", async () => {
    const move = await configurator.moveDraft(sb.id, shifted(sb, -0.05));
    const codes = move.draft.validation.reasons.map((r) => r.code);
    expect(codes).toContain("SC_HIGHER_THAN_SB");
    expect(codes, "the top went down with the SB").not.toContain("TRAP_KEEPOUT");
    expect(move.draft.canApply).toBe(false);
    await move.cancel();
  });

  test("Apply: the top on the SB only, a cover on the SC, the SC stays", async () => {
    const lengthBefore = (await configurator.countertop()).size.length;
    const move = await configurator.moveDraft(sb.id, shifted(sb, 0.1));
    await move.apply();

    await eventually(async () => (await configurator.covers()).map((cover) => cover.cabinetIds), "a cover on the SC")
      .toEqual([[sc.id]]);
    await eventually(async () => (await configurator.countertop()).size.length, "the top shortened to the SB")
      .toBeLessThan(lengthBefore - 0.1);

    const after = await configurator.cabinets();
    const movedSb = after.find((c) => c.id === sb.id)!;
    const sameSc = after.find((c) => c.id === sc.id)!;
    expect(near(movedSb.positionM.y, sb.positionM.y + 0.1), "SB committed 10 cm higher").toBe(true);
    expect(near(sameSc.positionM.x, sc.positionM.x) && near(sameSc.positionM.y, sc.positionM.y), "the SC stays").toBe(true);

    // What is drawn: the top lies on the raised SB, the cover lies on the SC and spans it.
    const sbBody = await scene.cabinetBody(sb.id);
    const scBody = await scene.cabinetBody(sc.id);
    await eventually(async () => restsOn(await scene.countertop(), sbBody), `top on the SB ${describeBox(sbBody)}`).toBe(true);
    const [cover] = await scene.covers();
    expect(coversTopOf(cover.box, scBody), `cover ${describeBox(cover.box)} on the SC ${describeBox(scBody)}`).toBe(true);
  });
});
