// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { OrganizersOverlayFrame } from "@/features/configuratorApi";

import { createOrganizerOverlayStore } from "../lib/organizerOverlayStore";
import { OrganizerCanvasOverlay, type OrganizerCanvasOverlayProps } from "../ui/OrganizerCanvasOverlay";
import framesFixture from "./fixtures/contract/frames.v1.json";

afterEach(cleanup);

/** The projected frame of a case of the shared `frames.v1.json` (WP-1 §9): projector x = 400 + 1000·xM, y = 300 + 1000·zM. */
const frameOf = (name: string): OrganizersOverlayFrame => {
  const found = framesFixture.cases.find((testCase) => testCase.name === name);
  if (!found) throw new Error(`no frame case ${name}`);
  return structuredClone(found.expected) as unknown as OrganizersOverlayFrame;
};

const TOLERANCE_PX = 0.5;
const MIN_TARGET_PX = 44;

type Overrides = Partial<Omit<OrganizerCanvasOverlayProps, "store">>;

const renderOverlay = (frame: OrganizersOverlayFrame | null, overrides: Overrides = {}) => {
  const store = createOrganizerOverlayStore();
  store.set(frame);
  const handlers = {
    onPlus: vi.fn(),
    onColumn: vi.fn(),
    onOpenDrawer: vi.fn(),
    onCloseDrawer: vi.fn(),
    onSwitchDrawer: vi.fn(),
    onLockedZone: vi.fn(),
  };
  const props: OrganizerCanvasOverlayProps = {
    store,
    selectedSlot: null,
    panel: "closed",
    draftCells: null,
    busy: false,
    lockedZoneText: "Drain area — dividers can't be placed here.",
    switchDrawers: [],
    ...handlers,
    ...overrides,
  };
  const view = render(<OrganizerCanvasOverlay {...props} />);
  return { store, ...handlers, ...view };
};

/** The point an element is placed at (its inline left / top). */
const anchorOf = (element: HTMLElement | null) => ({
  x: parseFloat(element?.style.left ?? "NaN"),
  y: parseFloat(element?.style.top ?? "NaN"),
});

/** Centre of an absolutely placed element, from its inline box. */
const centreOf = (element: HTMLElement) => ({
  x: parseFloat(element.style.left) + parseFloat(element.style.width) / 2,
  y: parseFloat(element.style.top) + parseFloat(element.style.height) / 2,
});

describe("OrganizerCanvasOverlay: frames", () => {
  it("draws nothing without a frame, and nothing for a frame that is not visible", () => {
    const { container, store } = renderOverlay(null);
    expect(container.innerHTML).toBe("");

    act(() => store.set({ ...frameOf("in-view-empty"), visible: false }));
    expect(container.innerHTML).toBe("");
  });

  it("covers the iframe 1:1 and lets the clicks through except on its controls", () => {
    renderOverlay(frameOf("in-view-empty"));
    const root = screen.getByTestId("organizer-overlay");
    expect(root.style.position).toBe("absolute");
    expect(root.style.pointerEvents).toBe("none");
    expect(root.style.zIndex).toBe("25");
  });

  it("follows the store: a new frame replaces the controls", () => {
    const { store } = renderOverlay(frameOf("in-view-empty"));
    expect(screen.getAllByRole("button", { name: /Add divider column/ })).toHaveLength(1);

    act(() => store.set(frameOf("in-view-zone-full")));

    expect(screen.queryByRole("button", { name: /Add divider column/ })).toBeNull();
    expect(screen.getAllByRole("button", { name: /Divider column/ })).toHaveLength(2);
  });
});

describe("OrganizerCanvasOverlay: Add column (⊕)", () => {
  it("sits on the projected centre of its slot, with a hit area of at least 44 × 44", () => {
    renderOverlay(frameOf("in-view-empty"));
    const plus = screen.getByRole("button", { name: "Add divider column" });

    const centre = centreOf(plus);
    expect(Math.abs(centre.x - (400 + 1000 * 0))).toBeLessThanOrEqual(TOLERANCE_PX);
    expect(Math.abs(centre.y - (300 + 1000 * 0))).toBeLessThanOrEqual(TOLERANCE_PX);
    expect(parseFloat(plus.style.width)).toBeGreaterThanOrEqual(MIN_TARGET_PX);
    expect(parseFloat(plus.style.height)).toBeGreaterThanOrEqual(MIN_TARGET_PX);
  });

  it("adds a column at its slot", () => {
    const { onPlus } = renderOverlay(frameOf("in-view-empty"));
    fireEvent.click(screen.getByRole("button", { name: "Add divider column" }));
    expect(onPlus).toHaveBeenCalledWith(0);
  });

  it.each([
    ["left", "Add divider column (left)"],
    ["right", "Add divider column (right)"],
    ["center", "Add divider column"],
  ] as const)("names the %s ⊕ for a screen reader", (side, name) => {
    const frame = frameOf("in-view-empty");
    frame.plus = [{ ...frame.plus[0], side }];
    renderOverlay(frame);
    expect(screen.getByRole("button", { name })).toBeTruthy();
  });

  it("is live while the panel lists presets or is closed", () => {
    renderOverlay(frameOf("in-view-empty"), { panel: "presets" });
    const plus = screen.getByRole("button", { name: "Add divider column" });
    expect(plus.getAttribute("aria-disabled")).toBe("false");
    expect(plus.getAttribute("aria-busy")).toBe("false");
  });

  it("is dimmed and aria-disabled in the editor; the click still reaches the hook, which pulses Save (T10)", () => {
    const { onPlus } = renderOverlay(frameOf("in-view-empty"), { panel: "editor" });
    const plus = screen.getByRole("button", { name: "Add divider column" });
    expect(plus.getAttribute("aria-disabled")).toBe("true");

    fireEvent.click(plus);
    expect(onPlus).toHaveBeenCalledWith(0);
  });

  it("is aria-busy and aria-disabled while a command runs", () => {
    renderOverlay(frameOf("in-view-empty"), { busy: true });
    const plus = screen.getByRole("button", { name: "Add divider column" });
    expect(plus.getAttribute("aria-busy")).toBe("true");
    expect(plus.getAttribute("aria-disabled")).toBe("true");
  });

  it("offers the tooltip text on hover", () => {
    renderOverlay(frameOf("in-view-empty"));
    expect(screen.getByRole("button", { name: "Add divider column" }).getAttribute("data-tooltip")).toBe("Add column");
  });
});

describe("OrganizerCanvasOverlay: columns", () => {
  it("lists a button per column, numbered in screen order, with the selected one pressed", () => {
    renderOverlay(frameOf("in-view-zone-full"), { selectedSlot: 2 });

    const first = screen.getByRole("button", { name: "Divider column 1 of 2" });
    const second = screen.getByRole("button", { name: "Divider column 2 of 2" });
    expect(first.getAttribute("aria-pressed")).toBe("false");
    expect(second.getAttribute("aria-pressed")).toBe("true");
  });

  it("selects a column on a click", () => {
    const { onColumn } = renderOverlay(frameOf("in-view-zone-full"));
    fireEvent.click(screen.getByRole("button", { name: "Divider column 2 of 2" }));
    expect(onColumn).toHaveBeenCalledWith(2);
  });

  it("covers the column's hull, at least 44 px each way", () => {
    renderOverlay(frameOf("in-view-zone-full"));
    const button = screen.getByRole("button", { name: "Divider column 1 of 2" });

    // The hull of slot -2 is x 150..250, y 85..515 in the fixture.
    expect(parseFloat(button.style.left)).toBeCloseTo(150, 0);
    expect(parseFloat(button.style.width)).toBeCloseTo(100, 0);
    expect(parseFloat(button.style.top)).toBeCloseTo(85, 0);
    expect(parseFloat(button.style.height)).toBeCloseTo(430, 0);
  });

  it("widens a narrow column to 44 px around its centre", () => {
    const frame = frameOf("in-view-zone-full");
    frame.columns = [
      {
        slot: 0,
        center: { x: 400, y: 300 },
        hull: [
          { x: 390, y: 285 },
          { x: 410, y: 285 },
          { x: 410, y: 315 },
          { x: 390, y: 315 },
        ],
        cells: [],
      },
    ];
    renderOverlay(frame);
    const button = screen.getByRole("button", { name: "Divider column 1 of 1" });

    expect(parseFloat(button.style.width)).toBe(MIN_TARGET_PX);
    expect(parseFloat(button.style.height)).toBe(MIN_TARGET_PX);
    expect(centreOf(button)).toEqual({ x: 400, y: 300 });
  });

  it("draws the hull as an outline that the stylesheet shows for the selected and the hovered column", () => {
    const { container } = renderOverlay(frameOf("in-view-zone-full"), { selectedSlot: -2 });
    const polygons = [...container.querySelectorAll("polygon[data-column-hull]")];
    expect(polygons).toHaveLength(2);
    expect(polygons[0].getAttribute("points")).toBe("150,85 250,85 250,515 150,515");
    expect(polygons[0].getAttribute("data-selected")).toBe("true");
    expect(polygons[1].getAttribute("data-selected")).toBe("false");
  });

  it("puts a column above the ⊕ it covers, and keeps the buttons in screen order for Tab", () => {
    const frame = frameOf("in-view-zone-full");
    frame.plus = [
      { id: "Top:-2", drawer: "Top", slot: -2, side: "left", center: { x: 200, y: 300 }, radiusPx: 50 },
      { id: "Top:0", drawer: "Top", slot: 0, side: "center", center: { x: 400, y: 300 }, radiusPx: 50 },
    ];
    renderOverlay(frame);

    const plusUnderColumn = screen.getByRole("button", { name: "Add divider column (left)" });
    const column = screen.getByRole("button", { name: "Divider column 1 of 2" });
    // The column's wrapper is the stacking context of its hull and button.
    expect(Number(column.parentElement?.style.zIndex)).toBeGreaterThan(Number(plusUnderColumn.style.zIndex));

    const order = within(screen.getByTestId("organizer-overlay"))
      .getAllByRole("button")
      .map((button) => button.getAttribute("aria-label") ?? button.textContent);
    expect(order).toEqual([
      // x = 200: the ⊕ and the column share it; the column is listed after, so it also has the focus order of a column
      "Add divider column (left)",
      "Divider column 1 of 2",
      "Add divider column",
      "Divider column 2 of 2",
      "Close Drawer",
    ]);
  });
});

describe("OrganizerCanvasOverlay: cells of the draft (the editor)", () => {
  /** The cell polygons the frame gives for a column, as the `points` the overlay writes. */
  const pointsOfCell = (frame: OrganizersOverlayFrame, slot: number, cell: number) =>
    frame.columns
      .find((column) => column.slot === slot)
      ?.cells[cell - 1].map(({ x, y }) => `${x},${y}`)
      .join(" ");

  const litCells = (container: HTMLElement) => [...container.querySelectorAll("polygon[data-draft-cell]")];

  it("tints the cells with an insert on the selected column while the editor is open", () => {
    const frame = frameOf("in-view-zone-full");
    const { container } = renderOverlay(frame, { selectedSlot: 2, panel: "editor", draftCells: [2, 4] });

    const lit = litCells(container);
    expect(lit.map((polygon) => polygon.getAttribute("data-draft-cell"))).toEqual(["2", "4"]);
    expect(lit.map((polygon) => polygon.getAttribute("points"))).toEqual([
      pointsOfCell(frame, 2, 2),
      pointsOfCell(frame, 2, 4),
    ]);
  });

  it("tints only the selected column, never the other one", () => {
    const { container } = renderOverlay(frameOf("in-view-zone-full"), {
      selectedSlot: -2,
      panel: "editor",
      draftCells: [1],
    });

    const lit = litCells(container);
    expect(lit).toHaveLength(1);
    // The cell is inside the first column (x 150..250), not the second (x 550..650).
    expect(lit[0].getAttribute("points")?.startsWith("150,85")).toBe(true);
  });

  it("tints nothing outside the editor, even when it is handed cells", () => {
    const { container } = renderOverlay(frameOf("in-view-zone-full"), {
      selectedSlot: 2,
      panel: "presets",
      draftCells: [2, 4],
    });
    expect(litCells(container)).toHaveLength(0);
  });

  it("tints nothing without a draft, an empty draft, or a selected column", () => {
    const withoutDraft = renderOverlay(frameOf("in-view-zone-full"), { selectedSlot: 2, panel: "editor" });
    expect(litCells(withoutDraft.container)).toHaveLength(0);
    cleanup();

    const emptyDraft = renderOverlay(frameOf("in-view-zone-full"), {
      selectedSlot: 2,
      panel: "editor",
      draftCells: [],
    });
    expect(litCells(emptyDraft.container)).toHaveLength(0);
    cleanup();

    const noColumn = renderOverlay(frameOf("in-view-zone-full"), { panel: "editor", draftCells: [2, 4] });
    expect(litCells(noColumn.container)).toHaveLength(0);
  });

  it("skips a cell the frame does not have", () => {
    const frame = frameOf("in-view-zone-full");
    frame.columns = frame.columns.map((column) => ({ ...column, cells: column.cells.slice(0, 2) }));
    const { container } = renderOverlay(frame, { selectedSlot: 2, panel: "editor", draftCells: [2, 4] });
    expect(litCells(container).map((polygon) => polygon.getAttribute("data-draft-cell"))).toEqual(["2"]);
  });

  it("takes the tint off the selected column's hull in the editor, so the tinted cells stand out", () => {
    const { container } = renderOverlay(frameOf("in-view-zone-full"), {
      selectedSlot: 2,
      panel: "editor",
      draftCells: [2],
    });
    const hulls = [...container.querySelectorAll("polygon[data-column-hull]")];
    expect(hulls.map((hull) => hull.getAttribute("data-editing"))).toEqual(["true", "true"]);
    expect(hulls.map((hull) => hull.getAttribute("data-selected"))).toEqual(["false", "true"]);
  });

  it("does not make the tinted cells a target: no button, the clicks go to the column", () => {
    const { onColumn } = renderOverlay(frameOf("in-view-zone-full"), {
      selectedSlot: 2,
      panel: "editor",
      draftCells: [2, 4],
    });
    expect(screen.getAllByRole("button", { name: /Divider column/ })).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "Divider column 2 of 2" }));
    expect(onColumn).toHaveBeenCalledWith(2);
  });
});

describe("OrganizerCanvasOverlay: locked zone", () => {
  it("marks the zone with the text of the collection, for screen readers and as a tooltip", () => {
    renderOverlay(frameOf("in-view-zone-full"));
    const zone = screen.getByRole("img", { name: "Drain area — dividers can't be placed here." });

    expect(zone.getAttribute("data-tooltip")).toBe("Drain area — dividers can't be placed here.");
    expect(centreOf(zone)).toEqual({ x: 400, y: 300 });
  });

  it("tells the user why on a tap", () => {
    const { onLockedZone } = renderOverlay(frameOf("in-view-zone-full"));
    fireEvent.click(screen.getByRole("img", { name: /Drain area/ }));
    expect(onLockedZone).toHaveBeenCalledTimes(1);
  });

  it("draws nothing for a drawer without a locked zone", () => {
    renderOverlay(frameOf("in-view-empty"));
    expect(screen.queryByRole("img")).toBeNull();
  });
});

describe("OrganizerCanvasOverlay: Close Drawer", () => {
  it("sits at the close anchor and closes the drawer", () => {
    const { onCloseDrawer } = renderOverlay(frameOf("in-view-empty"));
    const close = screen.getByRole("button", { name: "Close Drawer" });
    expect(anchorOf(close.parentElement)).toEqual({ x: 400, y: 555 });

    fireEvent.click(close);
    expect(onCloseDrawer).toHaveBeenCalledTimes(1);
  });

  it("has no Top | Bottom switch unless the cabinet has two drawers to switch between", () => {
    renderOverlay(frameOf("in-view-empty"), { switchDrawers: ["Top"] });
    expect(screen.queryByRole("group", { name: "Drawer" })).toBeNull();
    cleanup();

    renderOverlay(frameOf("in-view-empty"), { switchDrawers: [] });
    expect(screen.queryByRole("group", { name: "Drawer" })).toBeNull();
  });

  it("switches between Top and Bottom, showing the drawer in view as pressed", () => {
    const { onSwitchDrawer } = renderOverlay(frameOf("in-view-empty"), { switchDrawers: ["Top", "Bot"] });
    const group = within(screen.getByRole("group", { name: "Drawer" }));

    expect(group.getByRole("button", { name: "Top" }).getAttribute("aria-pressed")).toBe("true");
    expect(group.getByRole("button", { name: "Bottom" }).getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(group.getByRole("button", { name: "Bottom" }));
    expect(onSwitchDrawer).toHaveBeenCalledWith("Bot");
  });
});

describe("OrganizerCanvasOverlay: Open Drawer (outside the view)", () => {
  it("shows an Open Drawer pill on each drawer that can be edited, at its anchor", () => {
    renderOverlay(frameOf("out-of-view"));

    const pills = screen.getAllByRole("button", { name: /Open [dD]rawer/ });
    expect(pills).toHaveLength(2);
    expect(pills.map(anchorOf)).toEqual([
      { x: 400, y: 420 },
      { x: 400, y: 520 },
    ]);
  });

  it("tells a drawer with columns by a check mark and the count", () => {
    renderOverlay(frameOf("out-of-view"));

    expect(screen.getByRole("button", { name: "Open drawer, 2 columns" }).textContent).toContain("Open Drawer");
    expect(screen.getByRole("button", { name: "Open drawer, 1 column" })).toBeTruthy();
  });

  it("names an empty drawer's pill by its text, and says which drawer it is", () => {
    const frame = frameOf("out-of-view");
    frame.entries = [{ ...frame.entries[0], count: 0 }];
    renderOverlay(frame);

    const pill = screen.getByRole("button", { name: "Open Drawer" });
    expect(pill.title).toBe("Top drawer");
    expect(pill.querySelector("[data-count-badge]")).toBeNull();
  });

  it("opens the drawer of the product", () => {
    const { onOpenDrawer } = renderOverlay(frameOf("out-of-view"));
    fireEvent.click(screen.getByRole("button", { name: "Open drawer, 1 column" }));
    expect(onOpenDrawer).toHaveBeenCalledWith({ productId: "cab-1", drawer: "Bot" });
  });

  it("offers no pill for a drawer that cannot be edited", () => {
    const frame = frameOf("out-of-view");
    frame.entries = frame.entries.map((entry) => ({ ...entry, eligible: false }));
    renderOverlay(frame);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("has no ⊕, columns or Close Drawer outside the view", () => {
    renderOverlay(frameOf("out-of-view"));
    expect(screen.queryByRole("button", { name: /Add divider column|Divider column|Close Drawer/ })).toBeNull();
  });
});
