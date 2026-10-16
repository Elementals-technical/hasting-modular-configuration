// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { FieldRuntimeState } from "@/entities/collection";

import { CountertopColorLevelPicker } from "../ui/CountertopColorLevelPicker";

vi.mock("@/features/collectionCustomization", () => ({
  ColorField: ({
    field,
    onChange,
    onOrderSwatches,
  }: {
    field: FieldRuntimeState;
    onChange: (value: string) => void;
    onOrderSwatches: () => void;
  }) => (
    <div>
      <label>
        Lower filter
        <input />
      </label>
      <button
        type="button"
        aria-pressed={field.value === "Pulpis Chiaro TKH"}
        onClick={() => onChange("Pulpis Chiaro TKH")}
      >
        Lower swatch
      </button>
      <button type="button" onClick={onOrderSwatches}>
        Order lower swatches
      </button>
    </div>
  ),
}));
afterEach(cleanup);

const field: FieldRuntimeState = {
  attributeId: "CoverCountertopColor",
  value: "Rox Black TKQ",
  visible: true,
  enabled: true,
  options: [],
};

describe("Upper / Lower color selection", () => {
  it("exposes semantic tabs and routes each panel to its own handler", () => {
    const upper = vi.fn(),
      lower = vi.fn(async () => undefined),
      orderSwatches = vi.fn();
    render(
      <CountertopColorLevelPicker
        lowerField={field}
        processing={false}
        error={null}
        onLowerChange={lower}
        onOrderSwatches={orderSwatches}
      >
        <button type="button" onClick={upper}>
          Upper swatch
        </button>
      </CountertopColorLevelPicker>,
    );

    const tabList = screen.getByRole("tablist", { name: "Countertop level" });
    const upperTab = screen.getByRole("tab", { name: "Upper" });
    const lowerTab = screen.getByRole("tab", { name: "Lower" });
    expect(tabList).toBeTruthy();
    expect(upperTab.getAttribute("aria-selected")).toBe("true");
    expect(lowerTab.getAttribute("aria-selected")).toBe("false");

    fireEvent.click(lowerTab);
    fireEvent.click(screen.getByRole("button", { name: "Lower swatch" }));
    fireEvent.click(screen.getByRole("button", { name: "Order lower swatches" }));
    expect(lower).toHaveBeenCalledWith("Pulpis Chiaro TKH");
    expect(orderSwatches).toHaveBeenCalledOnce();
    expect(upper).not.toHaveBeenCalled();

    fireEvent.click(upperTab);
    fireEvent.click(screen.getByRole("button", { name: "Upper swatch" }));
    expect(upper).toHaveBeenCalledOnce();
    expect(lower).toHaveBeenCalledOnce();
    expect(upperTab.querySelector('svg[aria-hidden="true"]')).toBeTruthy();
    expect(lowerTab.querySelector('svg[aria-hidden="true"]')).toBeTruthy();
  });

  it("activates focused tabs with arrow keys and wraps focus", async () => {
    render(
      <CountertopColorLevelPicker
        lowerField={field}
        processing={false}
        error={null}
        onLowerChange={vi.fn(async () => undefined)}
        onOrderSwatches={vi.fn()}
      >
        Upper content
      </CountertopColorLevelPicker>,
    );

    const upperTab = screen.getByRole("tab", { name: "Upper" });
    const lowerTab = screen.getByRole("tab", { name: "Lower" });
    upperTab.focus();
    fireEvent.keyDown(upperTab, { key: "ArrowRight" });
    await waitFor(() => {
      expect(document.activeElement).toBe(lowerTab);
      expect(lowerTab.getAttribute("aria-selected")).toBe("true");
    });

    fireEvent.keyDown(lowerTab, { key: "ArrowRight" });
    await waitFor(() => {
      expect(document.activeElement).toBe(upperTab);
      expect(upperTab.getAttribute("aria-selected")).toBe("true");
    });
  });

  it("keeps the independent filter state of both panels mounted", () => {
    render(
      <CountertopColorLevelPicker
        lowerField={field}
        processing={false}
        error={null}
        onLowerChange={vi.fn(async () => undefined)}
        onOrderSwatches={vi.fn()}
      >
        <label>
          Upper filter
          <input />
        </label>
      </CountertopColorLevelPicker>,
    );

    const upperFilter = screen.getByLabelText("Upper filter") as HTMLInputElement;
    fireEvent.change(upperFilter, { target: { value: "stone" } });
    fireEvent.click(screen.getByRole("tab", { name: "Lower" }));
    const lowerFilter = screen.getByLabelText("Lower filter") as HTMLInputElement;
    fireEvent.change(lowerFilter, { target: { value: "glass" } });

    fireEvent.click(screen.getByRole("tab", { name: "Upper" }));
    expect((screen.getByLabelText("Upper filter") as HTMLInputElement).value).toBe("stone");
    fireEvent.click(screen.getByRole("tab", { name: "Lower" }));
    expect((screen.getByLabelText("Lower filter") as HTMLInputElement).value).toBe("glass");
  });

  it("shows only Upper without a cover and resets to Upper when covers disappear", () => {
    const props = {
      processing: false,
      error: null,
      onLowerChange: vi.fn(async () => undefined),
      onOrderSwatches: vi.fn(),
    };
    const { rerender } = render(
      <CountertopColorLevelPicker {...props} lowerField={field}>
        Upper content
      </CountertopColorLevelPicker>,
    );
    fireEvent.click(screen.getByRole("tab", { name: "Lower" }));
    rerender(
      <CountertopColorLevelPicker {...props} lowerField={{ ...field, visible: false }}>
        Upper content
      </CountertopColorLevelPicker>,
    );
    expect(screen.queryByRole("tab")).toBeNull();
    expect(screen.getByText("Upper content")).toBeTruthy();

    rerender(
      <CountertopColorLevelPicker {...props} lowerField={field}>
        Upper content
      </CountertopColorLevelPicker>,
    );
    expect(screen.getByRole("tab", { name: "Upper" }).getAttribute("aria-selected")).toBe("true");
  });

  it("preserves processing and Lower error behavior", () => {
    const props = {
      lowerField: field,
      error: "Could not update Lower",
      onLowerChange: vi.fn(async () => undefined),
      onOrderSwatches: vi.fn(),
    };
    const { rerender } = render(
      <CountertopColorLevelPicker {...props} processing={false}>
        Upper content
      </CountertopColorLevelPicker>,
    );
    expect(screen.queryByRole("alert")).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: "Lower" }));
    expect(screen.getByRole("alert").textContent).toBe("Could not update Lower");

    rerender(
      <CountertopColorLevelPicker {...props} processing>
        Upper content
      </CountertopColorLevelPicker>,
    );
    expect(screen.getByRole("tab", { name: "Upper" }).getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByRole("tab", { name: "Lower" }).getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByLabelText("Lower filter").closest("fieldset")?.hasAttribute("disabled")).toBe(true);
  });
});
