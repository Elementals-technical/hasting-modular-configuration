// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { schematicLines } from "../model/cellsCodec";
import { buildPresetCards, ORGANIZER_PROFILES } from "../model/presets";
import { PositionsEditor, type PositionsEditorProps } from "../ui/PositionsEditor";
import { PresetList, type PresetListProps } from "../ui/PresetList";

afterEach(cleanup);

const cards = buildPresetCards(ORGANIZER_PROFILES["ROW-MTL-43"]);

const renderList = (overrides: Partial<PresetListProps> = {}) => {
  const handlers = { onSelect: vi.fn(), onCustomize: vi.fn(), onRemove: vi.fn() };
  render(
    <PresetList
      cards={cards}
      activeId={null}
      customizeLabel="Customize"
      layout="vertical"
      {...handlers}
      {...overrides}
    />,
  );
  return handlers;
};

const radios = () => within(screen.getByRole("radiogroup")).getAllByRole("radio");
const radioNames = () => radios().map((radio) => radio.textContent);

describe("PresetList", () => {
  it("is a radiogroup of [Customize] [Empty] [Preset 1..4]", () => {
    renderList();
    expect(radioNames()).toEqual(["Customize", "Empty", "Preset 1", "Preset 2", "Preset 3", "Preset 4"]);
  });

  it("checks the card the column matches", () => {
    renderList({ activeId: "preset-4" });
    expect(radios().map((radio) => radio.getAttribute("aria-checked"))).toEqual([
      "false",
      "false",
      "false",
      "false",
      "false",
      "true",
    ]);
  });

  it("checks Customize and says Custom when the column matches no preset", () => {
    renderList({ activeId: "custom" });
    const [customize, ...others] = radios();
    expect(customize.getAttribute("aria-checked")).toBe("true");
    expect(customize.textContent).toBe("CustomizeCustom");
    expect(others.every((radio) => radio.getAttribute("aria-checked") === "false")).toBe(true);
  });

  it("checks nothing without an active id", () => {
    renderList({ activeId: null });
    expect(radios().every((radio) => radio.getAttribute("aria-checked") === "false")).toBe(true);
  });

  it("applies a preset by its id and opens the editor from Customize", () => {
    const { onSelect, onCustomize } = renderList();

    fireEvent.click(screen.getByRole("radio", { name: "Preset 3" }));
    expect(onSelect).toHaveBeenCalledWith("preset-3");

    fireEvent.click(screen.getByRole("radio", { name: "Customize" }));
    expect(onCustomize).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("Remove column calls onRemove", () => {
    const { onRemove } = renderList();
    fireEvent.click(screen.getByRole("button", { name: "Remove column" }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it("the arrows only move the focus; they apply nothing", () => {
    const { onSelect, onCustomize } = renderList({ activeId: "preset-1" });
    const [customize, empty, preset1] = radios();

    preset1.focus();
    fireEvent.keyDown(preset1, { key: "ArrowUp" });
    expect(document.activeElement).toBe(empty);
    fireEvent.keyDown(empty, { key: "ArrowUp" });
    expect(document.activeElement).toBe(customize);
    fireEvent.keyDown(customize, { key: "ArrowDown" });
    expect(document.activeElement).toBe(empty);

    expect(onSelect).not.toHaveBeenCalled();
    expect(onCustomize).not.toHaveBeenCalled();
  });

  it("the focus wraps around the group", () => {
    renderList();
    const all = radios();
    all[0].focus();
    fireEvent.keyDown(all[0], { key: "ArrowUp" });
    expect(document.activeElement).toBe(all[all.length - 1]);
    fireEvent.keyDown(all[all.length - 1], { key: "ArrowDown" });
    expect(document.activeElement).toBe(all[0]);
  });

  it("a horizontal list moves with ←/→ and ignores ↑/↓", () => {
    renderList({ layout: "horizontal" });
    const [customize, empty] = radios();
    customize.focus();

    fireEvent.keyDown(customize, { key: "ArrowDown" });
    expect(document.activeElement).toBe(customize);
    fireEvent.keyDown(customize, { key: "ArrowRight" });
    expect(document.activeElement).toBe(empty);
    fireEvent.keyDown(empty, { key: "ArrowLeft" });
    expect(document.activeElement).toBe(customize);
  });

  it("keeps one card in the tab order: the checked one, else the first", () => {
    renderList({ activeId: "preset-2" });
    expect(radios().map((radio) => radio.tabIndex)).toEqual([-1, -1, -1, 0, -1, -1]);
    cleanup();

    renderList({ activeId: null });
    expect(radios().map((radio) => radio.tabIndex)).toEqual([0, -1, -1, -1, -1, -1]);
  });

  it("labels the Customize card from ui.json", () => {
    renderList({ customizeLabel: "Edit layout" });
    expect(radioNames()[0]).toBe("Edit layout");
  });
});

const renderEditor = (overrides: Partial<PositionsEditorProps> = {}) => {
  const handlers = { onToggle: vi.fn(), onBack: vi.fn(), onSave: vi.fn() };
  const view = render(
    <PositionsEditor
      positionCount={5}
      value={[]}
      maxActive={2}
      layout="vertical"
      pulse={0}
      saving={false}
      {...handlers}
      {...overrides}
    />,
  );
  return { ...handlers, ...view };
};

const cellButtons = () =>
  within(screen.getByRole("group", { name: "Divider positions, back to front" })).getAllByRole("button");

const trayDrawing = () => screen.getByRole("group", { name: "Divider positions, back to front" }).querySelector("svg");

const HINT = "Each insert splits the tray with two walls. Up to 2 per column.";
const VIEW_BOX_LENGTH = 430;

/** Where the solid walls of the drawing are, in viewBox units along the tray (0 = the back edge). */
const wallPositions = (container: HTMLElement) =>
  [...container.querySelectorAll<SVGLineElement>("line[data-schematic-line]")].map((line) =>
    Number(line.getAttribute("y1")),
  );

describe("PositionsEditor", () => {
  it("is a tray of five cells, pressed for the draft, with Back above cell 1 and Front under cell 5", () => {
    renderEditor({ value: [2, 4] });
    expect(
      cellButtons().map((button) => [button.getAttribute("aria-label"), button.getAttribute("aria-pressed")]),
    ).toEqual([
      ["Cell 1 of 5", "false"],
      ["Cell 2 of 5", "true"],
      ["Cell 3 of 5", "false"],
      ["Cell 4 of 5", "true"],
      ["Cell 5 of 5", "false"],
    ]);
    expect(screen.getByText("Back")).toBeTruthy();
    expect(screen.getByText("Front")).toBeTruthy();
  });

  it("has no digits on the cells: a cell is a place in the tray, not a number to press", () => {
    renderEditor({ value: [2] });
    expect(cellButtons().map((button) => button.textContent)).toEqual(["", "", "", "", ""]);
  });

  it("disables the cells that are not pressed once maxActive are, and keeps the pressed ones live", () => {
    const { onToggle } = renderEditor({ value: [2, 4] });
    const disabled = cellButtons().map((button) => (button as HTMLButtonElement).disabled);
    expect(disabled).toEqual([true, false, true, false, true]);

    fireEvent.click(cellButtons()[1]);
    expect(onToggle).toHaveBeenCalledWith(2);
  });

  it("leaves every cell live below maxActive", () => {
    renderEditor({ value: [3] });
    expect(cellButtons().every((button) => !(button as HTMLButtonElement).disabled)).toBe(true);
  });

  it("passes the clicked cell, Back and Save on", () => {
    const { onToggle, onBack, onSave } = renderEditor();
    fireEvent.click(cellButtons()[2]);
    fireEvent.click(screen.getByRole("button", { name: "Back to presets" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onToggle).toHaveBeenCalledWith(3);
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("counts the inserts of the draft against the limit", () => {
    const { rerender, ...handlers } = renderEditor({ value: [] });
    expect(screen.getByText("Inserts 0 of 2")).toBeTruthy();

    const props: PositionsEditorProps = {
      positionCount: 5,
      value: [3],
      maxActive: 2,
      layout: "vertical",
      pulse: 0,
      saving: false,
      onToggle: handlers.onToggle,
      onBack: handlers.onBack,
      onSave: handlers.onSave,
    };
    rerender(<PositionsEditor {...props} />);
    expect(screen.getByText("Inserts 1 of 2")).toBeTruthy();

    rerender(<PositionsEditor {...props} maxActive={1} />);
    expect(screen.getByText("Inserts 1 of 1")).toBeTruthy();
  });

  it("says what an insert does in one sentence, and the tray is described by it", () => {
    renderEditor({ value: [1] });
    const hint = screen.getByText(HINT);
    const group = screen.getByRole("group", { name: "Divider positions, back to front" });
    expect(group.getAttribute("aria-describedby")).toBe(hint.id);
    expect(screen.getByText("Inserts 1 of 2").getAttribute("title")).toBeNull();
  });

  it("draws a wall on each edge of a pressed cell, and one for a cell at the end of the tray", () => {
    const viewOf = (value: number[]) => {
      const { container } = render(
        <PositionsEditor
          positionCount={5}
          value={value}
          maxActive={2}
          layout="vertical"
          pulse={0}
          saving={false}
          onToggle={vi.fn()}
          onBack={vi.fn()}
          onSave={vi.fn()}
        />,
      );
      return container;
    };
    const cellEdge = (index: number) => (index / 5) * VIEW_BOX_LENGTH;
    const nearEdge = (wall: number, index: number) => Math.abs(wall - cellEdge(index)) < 2;

    // Cell 2 is between the borders 1 and 2 of five cells; cell 4 between 3 and 4.
    const [first, second, third, fourth] = wallPositions(viewOf([2, 4]));
    expect([nearEdge(first, 1), nearEdge(second, 2), nearEdge(third, 3), nearEdge(fourth, 4)]).toEqual([
      true,
      true,
      true,
      true,
    ]);
    cleanup();

    // Cell 1: only its front edge (the back edge is the end of the tray). Cell 5: only its back edge.
    const backCell = wallPositions(viewOf([1]));
    expect(backCell).toHaveLength(1);
    expect(nearEdge(backCell[0], 1)).toBe(true);
    cleanup();

    const frontCell = wallPositions(viewOf([5]));
    expect(frontCell).toHaveLength(1);
    expect(nearEdge(frontCell[0], 4)).toBe(true);
    cleanup();

    expect(wallPositions(viewOf([]))).toEqual([]);
  });

  it("draws the same walls as the codec of the cards", () => {
    const { container } = renderEditor({ value: [2, 4] });
    expect(wallPositions(container)).toEqual(schematicLines([2, 4]).map((fraction) => fraction * VIEW_BOX_LENGTH));
  });

  it("marks the borders between the five cells by four dashed lines", () => {
    const { container } = renderEditor();
    expect(container.querySelectorAll("line[data-cell-border]")).toHaveLength(4);
  });

  it("gives each cell a fifth of the tray, back to front", () => {
    renderEditor();
    expect(cellButtons().map(({ style }) => [style.top, style.height])).toEqual([
      ["0%", "20%"],
      ["20%", "20%"],
      ["40%", "20%"],
      ["60%", "20%"],
      ["80%", "20%"],
    ]);
  });

  it("marks Save busy while it saves", () => {
    renderEditor({ saving: true });
    expect(screen.getByRole("button", { name: "Save" }).getAttribute("aria-busy")).toBe("true");
  });

  it("draws attention to Save again on every pulse, without moving the focus", () => {
    const { rerender, ...handlers } = renderEditor({ pulse: 0 });
    const save = screen.getByRole("button", { name: "Save" });
    expect(save.querySelector("[data-save-pulse]")).toBeNull();
    save.focus();

    const props: PositionsEditorProps = {
      positionCount: 5,
      value: [],
      maxActive: 2,
      layout: "vertical",
      pulse: 1,
      saving: false,
      onToggle: handlers.onToggle,
      onBack: handlers.onBack,
      onSave: handlers.onSave,
    };
    rerender(<PositionsEditor {...props} />);
    const first = save.querySelector("[data-save-pulse]");
    expect(first).not.toBeNull();

    rerender(<PositionsEditor {...props} pulse={2} />);
    const second = save.querySelector("[data-save-pulse]");
    expect(second).not.toBeNull();
    expect(second).not.toBe(first);
    expect(document.activeElement).toBe(save);
  });

  describe("in the horizontal strip", () => {
    it("keeps the order [←][the tray][Save] and says Back ▸ Front", () => {
      renderEditor({ layout: "horizontal" });
      const names = screen
        .getAllByRole("button")
        .map((button) => button.getAttribute("aria-label") ?? button.textContent);
      expect(names).toEqual([
        "Back to presets",
        "Cell 1 of 5",
        "Cell 2 of 5",
        "Cell 3 of 5",
        "Cell 4 of 5",
        "Cell 5 of 5",
        "Save",
      ]);
      expect(screen.getByText("Back ▸ Front")).toBeTruthy();
      expect(screen.queryByText("Back")).toBeNull();
    });

    it("shows the counter, and carries the hint as the title of the counter and the description of the tray", () => {
      renderEditor({ layout: "horizontal", value: [3] });
      expect(screen.getByText("Inserts 1 of 2").getAttribute("title")).toBe(HINT);

      const group = screen.getByRole("group", { name: "Divider positions, back to front" });
      const describedBy = group.getAttribute("aria-describedby");
      expect(describedBy).toBeTruthy();
      expect(document.getElementById(describedBy ?? "")?.textContent).toBe(HINT);
    });

    it("turns the tray a quarter and gives each cell a fifth of its width, back on the left", () => {
      renderEditor({ layout: "horizontal" });
      expect(trayDrawing()?.getAttribute("viewBox")).toBe("0 0 430 100");
      expect(cellButtons().map(({ style }) => [style.left, style.width])).toEqual([
        ["0%", "20%"],
        ["20%", "20%"],
        ["40%", "20%"],
        ["60%", "20%"],
        ["80%", "20%"],
      ]);
    });

    it("still disables the cells over the limit", () => {
      renderEditor({ layout: "horizontal", value: [2, 4] });
      expect(cellButtons().map((button) => (button as HTMLButtonElement).disabled)).toEqual([
        true,
        false,
        true,
        false,
        true,
      ]);
    });
  });

  it("draws the vertical tray upright: 100 wide, 430 long", () => {
    renderEditor();
    expect(trayDrawing()?.getAttribute("viewBox")).toBe("0 0 100 430");
  });
});
