import { describe, expect, it } from "vitest";

import type { CabinetDraftState, CabinetsState } from "@/features/configuratorApi";

import { sideShelvesAtRowEnds, wallAfterDraft, type WallCabinet } from "../lib/sideShelfEdges";

const SHELF = "UD-open-shelves-side";
const isSideShelf = (definitionId: string) => definitionId === SHELF;
const cabinet = (id: string, centreXM: number, widthCm: number, definitionId = "UD-side-cabinet"): WallCabinet => ({
  id,
  definitionId,
  centreXM,
  widthCm,
});

describe("side shelves at row ends", () => {
  it("lets a side shelf stand at either end of its row", () => {
    expect(sideShelvesAtRowEnds([cabinet("shelf", 0.075, 15, SHELF), cabinet("a", 0.4505, 60)], isSideShelf)).toBe(
      true,
    );
    expect(sideShelvesAtRowEnds([cabinet("a", 0.3, 60), cabinet("shelf", 0.6755, 15, SHELF)], isSideShelf)).toBe(true);
  });

  it("refuses a side shelf between two cabinets", () => {
    expect(
      sideShelvesAtRowEnds(
        [cabinet("a", 0.3, 60), cabinet("shelf", 0.6755, 15, SHELF), cabinet("b", 1.051, 60)],
        isSideShelf,
      ),
    ).toBe(false);
  });

  it("refuses a side shelf in a column", () => {
    expect(sideShelvesAtRowEnds([cabinet("a", 0.3, 60), cabinet("shelf", 0.3, 15, SHELF)], isSideShelf)).toBe(false);
  });

  it("reads a cabinet far along the wall as another row", () => {
    expect(
      sideShelvesAtRowEnds(
        [cabinet("a", 0.3, 60), cabinet("shelf", 0.6755, 15, SHELF), cabinet("b", 2, 60)],
        isSideShelf,
      ),
    ).toBe(true);
  });

  it("reads the composition a draft would leave: the moved cabinet at its draft place", () => {
    const state: CabinetsState = {
      cabinets: [
        { id: "a", definitionId: "UD-sink-cabinet", selection: { Width: 60 }, positionM: { x: 0.3, y: 0, z: 0 } },
        { id: "shelf", definitionId: SHELF, selection: { Width: 15 }, positionM: { x: 0.6755, y: 0, z: 0 } },
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
        definitionId: SHELF,
        selection: { Width: 15 },
        productId: "shelf",
        effectivePlacement: { positionM: { x: 0.3, y: 0, z: 0 } },
      },
    } satisfies CabinetDraftState;

    const wall = wallAfterDraft(state, move);

    expect(wall).toEqual([cabinet("a", 0.3, 60, "UD-sink-cabinet"), cabinet("shelf", 0.3, 15, SHELF)]);
    expect(wall && sideShelvesAtRowEnds(wall, isSideShelf)).toBe(false);
    expect(wallAfterDraft(state, { ...move, candidate: { ...move.candidate, selection: {} } })).toBeNull();
  });
});
