// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { setScenePlusFilter, type ScenePlus } from "../sceneBridge";

vi.mock("../apiLogger", () => ({ installConfiguratorApiLogger: vi.fn() }));
vi.mock("../updateDimensionData", () => ({ updateDimensionDataForProduct: vi.fn() }));

type Host = { containerRef?: unknown; playCanvasReady?: boolean };

const host = window as unknown as Host;

type Button = { side: string; parentEntity: { name: string } | null; plus?: ScenePlus; shown?: boolean };

/** The scene's PlusButtonManager as far as the filter goes: a "+" without `plus` is always shown. */
class ScenePlusManager {
  _plusFilter: ((plus: ScenePlus) => boolean) | null = null;
  readonly _buttons: Button[];

  constructor(buttons: Button[]) {
    this._buttons = buttons;
  }

  setPlusFilter(filter: unknown) {
    this._plusFilter = typeof filter === "function" ? (filter as (plus: ScenePlus) => boolean) : null;
    this._buttons.forEach((button) => {
      button.shown = this._isPlusVisible(button);
    });
  }

  _isPlusVisible(button: Button): boolean {
    if (!button.plus) return true;
    return !this._plusFilter || this._plusFilter(button.plus);
  }
}

const ROWS = { preserveCabinetPositions: true };
const ONE_ROW = { preserveCabinetPositions: false };
const COLUMNS = { preserveCabinetPositions: true, freeLayoutPolicy: { columns: true } };

const installScene = (buttons: Button[], compositionManager: Record<string, unknown> = ROWS) => {
  const plusManager = new ScenePlusManager(buttons);
  host.containerRef = {
    current: {
      contentWindow: {
        ConfiguratorAPI: {
          setPlusFilter: (filter: unknown) => plusManager.setPlusFilter(filter),
          config: { compositionManager, sceneManager: { plusManager } },
        },
      },
    },
  };
  return plusManager;
};

const rowEnd = (side: string, cabinetId: string): Button => ({ side, parentEntity: { name: cabinetId } });
const shown = (buttons: Button[]) => buttons.map((button) => button.shown);
/** The Sink Base rule: only the countertop's row, where "sb" stands. */
const countertopRowOnly = (plus: ScenePlus) => plus.cabinetId === "sb";

describe("setScenePlusFilter", () => {
  afterEach(() => {
    delete host.containerRef;
    delete host.playCanvasReady;
  });

  it("puts the row-end + of a composition in rows through the filter, named as the scene names its own", () => {
    const buttons = [rowEnd("left", "sb"), rowEnd("right", "sb"), rowEnd("left", "lower"), rowEnd("right", "shelf")];
    installScene(buttons);
    const filter = vi.fn(countertopRowOnly);

    expect(setScenePlusFilter(filter)).toBe(true);

    expect(shown(buttons)).toEqual([true, true, false, false]);
    expect(filter).toHaveBeenCalledWith({ id: "left:lower", kind: "left", cabinetId: "lower" });
    expect(filter).toHaveBeenCalledWith({ id: "right:shelf", kind: "right", cabinetId: "shelf" });
  });

  it("shows every + again without a filter", () => {
    const buttons = [rowEnd("left", "sb"), rowEnd("left", "lower")];
    installScene(buttons);

    setScenePlusFilter(countertopRowOnly);
    setScenePlusFilter(null);

    expect(shown(buttons)).toEqual([true, true]);
  });

  it("leaves one row and columns to the scene", () => {
    const oneRow = [rowEnd("left", "sb"), rowEnd("left", "lower")];
    installScene(oneRow, ONE_ROW);
    setScenePlusFilter(countertopRowOnly);
    expect(shown(oneRow)).toEqual([true, true]);

    const columnPlus: ScenePlus = { id: "bottom:lower", kind: "bottom", cabinetId: "lower", rowId: "row-1" };
    const columns = [rowEnd("left", "lower"), { ...rowEnd("bottom", "lower"), plus: columnPlus }];
    installScene(columns, COLUMNS);
    setScenePlusFilter(countertopRowOnly);
    expect(shown(columns)).toEqual([true, false]);
  });

  it("keeps the scene's answer for a + that carries its place and for the + of an empty scene", () => {
    const columnPlus: ScenePlus = { id: "top:sb", kind: "top", cabinetId: "sb", rowId: "row-1" };
    const buttons = [
      { ...rowEnd("top", "sb"), plus: columnPlus },
      { side: "right", parentEntity: null },
    ];
    installScene(buttons);
    const filter = vi.fn(() => false);

    setScenePlusFilter(filter);

    expect(shown(buttons)).toEqual([false, true]);
    expect(filter).toHaveBeenCalledTimes(1);
    expect(filter).toHaveBeenCalledWith(columnPlus);
  });

  it("answers for the + of a scene loaded again", () => {
    installScene([rowEnd("left", "lower")]);
    setScenePlusFilter(countertopRowOnly);

    const reloaded = [rowEnd("left", "sb"), rowEnd("left", "lower")];
    installScene(reloaded);
    setScenePlusFilter(countertopRowOnly);

    expect(shown(reloaded)).toEqual([true, false]);
  });

  it("still sets the filter when the scene's + manager cannot be changed", () => {
    const buttons = [rowEnd("left", "lower")];
    const plusManager = installScene(buttons);
    Object.defineProperty(plusManager, "_isPlusVisible", {
      value: ScenePlusManager.prototype._isPlusVisible,
      writable: false,
    });

    expect(setScenePlusFilter(countertopRowOnly)).toBe(true);

    expect(plusManager._plusFilter).toBe(countertopRowOnly);
    expect(shown(buttons)).toEqual([true]);
  });

  it("is false when the scene build has no filter", () => {
    host.containerRef = { current: { contentWindow: { ConfiguratorAPI: {} } } };

    expect(setScenePlusFilter(countertopRowOnly)).toBe(false);
  });
});
