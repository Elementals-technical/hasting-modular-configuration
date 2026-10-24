import { expect, test } from "@playwright/test";
import {
  eventually,
  near,
  openPreset,
  type Cabinet,
  type Configurator,
  type CountertopEnd,
} from "../support/configurator";
import { describeBox, restsOn, type Box, type SceneReader } from "../support/scene";

/**
 * Resize ▸ Length: releasing a handle commits `countertop.resizeFrom(side, length)`; the opposite end stays put
 * (HR-CT-05, client rules R15.4 / R16.5). Bug 23.10: for ~150–250 ms the old-length mesh was drawn at the new centre,
 * so the end that must stay jumped by half the change and back (the top "blinked"). Fixed in the PlayCanvas repo:
 * `countertop-composition-adapter.mjs`, resizeFromM re-cuts the mesh at once (`_syncLength` `immediate`).
 * Fixture: configuration 15268 — the SB raised 22 cm, an SC beside it, a 5⅛″ top resting on the SB, moved
 * (length 1.717 m, offset 4 cm).
 */
const FIXTURE = "sb-raised-sc-thick-top-moved";
const FIXTURE_LENGTH_M = 1.71704;
const THICKNESS_5_1_8_M = 5.125 * 0.0254;
/** A drawn end may differ from the state by the mesh's float precision, never by centimetres. */
const END_TOLERANCE_M = 0.001;

const sinkBase = (cabinets: Cabinet[]) => {
  const found = cabinets.find((c) => c.definitionId.includes("-sink-"));
  if (!found) throw new Error(`no sink base in ${FIXTURE}`);
  return found;
};
const otherEnd = (side: CountertopEnd): CountertopEnd => (side === "right" ? "left" : "right");
const endX = (box: { minX: number; maxX: number }, end: CountertopEnd) => (end === "left" ? box.minX : box.maxX);
const extent = (box: Box) => ({ minX: box.min.x, maxX: box.max.x });

test.describe("ULH Resize ▸ Length: a released handle draws no in-between countertop", () => {
  let configurator: Configurator;
  let scene: SceneReader;
  let sbBody: Box;

  test.beforeEach(async ({ page }) => {
    ({ configurator, scene } = await openPreset(page, "ulh", FIXTURE));
    await eventually(async () => (await configurator.countertop()).size.length, "the fixture's top length")
      .toBeCloseTo(FIXTURE_LENGTH_M, 4);
    const top = await configurator.countertop();
    expect(top.placementState, "a moved top").toBe("moved");
    expect(near(top.thickness, THICKNESS_5_1_8_M, 0.003), `a 5⅛″ top (Length is offered for it), got ${top.thickness}`)
      .toBe(true);
    sbBody = await scene.cabinetBody(sinkBase(await configurator.cabinets()).id);
    const drawn = await scene.countertop();
    expect(restsOn(drawn, sbBody), `top ${describeBox(drawn)} rests on the SB ${describeBox(sbBody)}`).toBe(true);
  });

  for (const { name, side, lengthM } of [
    { name: "right end out", side: "right" as const, lengthM: FIXTURE_LENGTH_M + 0.24 },
    { name: "left end out", side: "left" as const, lengthM: FIXTURE_LENGTH_M + 0.24 },
    { name: "right end in", side: "right" as const, lengthM: 1.4 },
  ]) {
    test(`${name}: every frame keeps the other end, the top stays on the SB`, async () => {
      const anchored = otherEnd(side);
      const stateBefore = await configurator.countertop();
      const before = extent(await scene.countertop());

      const { frames, result: state } = await scene.recordCountertopFrames(() =>
        configurator.resizeCountertopFrom(side, lengthM),
      );

      // State: the new length, a valid pose, still resting at its height, the sink still in the SB.
      expect(state.size.length).toBeCloseTo(lengthM, 4);
      expect(state.validation.reasons).toEqual([]);
      expect(state.validation.status).toBe("valid");
      expect(near(state.offset.y, stateBefore.offset.y, 1e-6), "no lift").toBe(true);
      expect(state.sink.owner, "the sink stays with the SB").toBe("cabinet");

      // Geometry: the drawn top ends at the new length with the anchored end in place, on the SB, covering it.
      const drawn = await scene.countertop();
      const after = extent(drawn);
      expect(near(endX(after, anchored), endX(before, anchored), END_TOLERANCE_M), `${anchored} end stays`).toBe(true);
      expect(near(after.maxX - after.minX, lengthM, END_TOLERANCE_M), `drawn length ${describeBox(drawn)}`).toBe(true);
      expect(restsOn(drawn, sbBody), `top ${describeBox(drawn)} on the SB ${describeBox(sbBody)}`).toBe(true);
      expect(drawn.min.x <= sbBody.min.x + END_TOLERANCE_M && drawn.max.x >= sbBody.max.x - END_TOLERANCE_M,
        "the SB stays covered").toBe(true);

      // The bug: no drawn frame between the old and the new top.
      expect(frames.length, "frames were drawn").toBeGreaterThan(2);
      frames.forEach((frame, index) => {
        expect(near(endX(frame, anchored), endX(before, anchored), END_TOLERANCE_M),
          `frame ${index}: the ${anchored} end at ${endX(frame, anchored).toFixed(3)}, was ${endX(before, anchored).toFixed(3)}`)
          .toBe(true);
        const atOld = near(endX(frame, side), endX(before, side), END_TOLERANCE_M);
        const atNew = near(endX(frame, side), endX(after, side), END_TOLERANCE_M);
        expect(atOld || atNew, `frame ${index}: the ${side} end at ${endX(frame, side).toFixed(3)}, ` +
          `neither ${endX(before, side).toFixed(3)} nor ${endX(after, side).toFixed(3)}`).toBe(true);
      });
    });
  }
});
