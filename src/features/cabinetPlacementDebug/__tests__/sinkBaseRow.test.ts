import { describe, expect, it } from "vitest";

import type { CabinetDraftState, CabinetsState } from "@/features/configuratorApi";

import { wallAfterDraft, type WallCabinet } from "../lib/sideShelfEdges";
import { sinkBasesInOneRow } from "../lib/sinkBaseRow";

/**
 * Client, Cabinet Builder SB Placement: the sink bases of a composition stand in one row, so a
 * Drag & Drop draft that would put one on another level is not applied.
 */

const SINK = "ULH-sink-cabinet";
const SIDE = "ULH-side-cabinet";
const isSinkBase = (definitionId: string) => definitionId === SINK;

/** The upper level the countertop rests on, and the lower one of a Multi-Level composition. */
const UPPER = 0.56;
const LOWER = 0.28;

const cabinet = (id: string, centreXM: number, widthCm: number, definitionId = SIDE, levelYM = UPPER): WallCabinet => ({
  id,
  definitionId,
  centreXM,
  widthCm,
  levelYM,
});

describe("sink bases in one row", () => {
  it("takes a composition with no sink base, and one with a single one", () => {
    expect(sinkBasesInOneRow([], isSinkBase)).toBe(true);
    expect(sinkBasesInOneRow([cabinet("a", 0.3, 60), cabinet("b", 0.9005, 60)], isSinkBase)).toBe(true);
    expect(sinkBasesInOneRow([cabinet("sink", 0.3, 60, SINK), cabinet("b", 0.9005, 60)], isSinkBase)).toBe(true);
  });

  it("takes two sink bases standing in one row, touching or apart in it", () => {
    const row = [cabinet("sink-a", 0.3, 60, SINK), cabinet("mid", 0.9005, 60), cabinet("sink-b", 1.501, 60, SINK)];

    expect(sinkBasesInOneRow(row, isSinkBase)).toBe(true);
  });

  it("refuses a sink base on another level, however the rows line up along the wall", () => {
    const above = cabinet("sink-a", 0.3, 60, SINK);

    expect(sinkBasesInOneRow([above, cabinet("sink-b", 0.3, 60, SINK, LOWER)], isSinkBase)).toBe(false);
    expect(sinkBasesInOneRow([above, cabinet("sink-b", 1.5, 60, SINK, LOWER)], isSinkBase)).toBe(false);
  });

  it("reads a level the scene reports a hair off as the same one", () => {
    const pair = [cabinet("sink-a", 0.3, 60, SINK), cabinet("sink-b", 0.9005, 60, SINK, UPPER + 0.004)];

    expect(sinkBasesInOneRow(pair, isSinkBase)).toBe(true);
  });

  it("refuses two sink bases of one level standing in runs that do not touch", () => {
    const apart = [cabinet("sink-a", 0.3, 60, SINK), cabinet("sink-b", 3, 60, SINK)];

    expect(sinkBasesInOneRow(apart, isSinkBase)).toBe(false);
  });

  it("judges the composition a draft would leave, not the one before it", () => {
    const state: CabinetsState = {
      cabinets: [
        { id: "sink-a", definitionId: SINK, selection: { Width: 60 }, positionM: { x: 0.3, y: UPPER, z: 0 } },
        { id: "sink-b", definitionId: SINK, selection: { Width: 60 }, positionM: { x: 0.9005, y: UPPER, z: 0 } },
      ],
      connections: [],
      selectedCabinetId: null,
    };
    const move = {
      sessionId: "draft-1",
      kind: "move",
      lifecycle: "preview",
      baseCompositionRevision: 1,
      candidateRevision: 2,
      canApply: true,
      canCancel: true,
      candidate: {
        definitionId: SINK,
        selection: { Width: 60 },
        productId: "sink-b",
        effectivePlacement: { positionM: { x: 0.9005, y: LOWER, z: 0 } },
      },
    } satisfies CabinetDraftState;

    const dropped = wallAfterDraft(state, move);
    expect(dropped && sinkBasesInOneRow(dropped, isSinkBase)).toBe(false);

    const kept = wallAfterDraft(state, {
      ...move,
      candidate: { ...move.candidate, effectivePlacement: { positionM: { x: 0.9005, y: UPPER, z: 0 } } },
    });
    expect(kept && sinkBasesInOneRow(kept, isSinkBase)).toBe(true);
  });
});
