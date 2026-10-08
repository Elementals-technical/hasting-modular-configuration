// @vitest-environment jsdom

import { createRef } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Accordion } from "../Accordion";
import { ConfiguratorAccordion, ConfiguratorAccordionGroup, ConfiguratorAccordionItem } from "../ConfiguratorAccordion";
import { useSyncedAccordionValue } from "../useSyncedAccordionValue";

const items = (
  <>
    <ConfiguratorAccordionItem value="colors" title="Colors" dataTarget="colors">
      Choose a color
    </ConfiguratorAccordionItem>
    <ConfiguratorAccordionItem value="handles" title="Handles">
      Choose a handle
    </ConfiguratorAccordionItem>
  </>
);

const mockViewport = (matches = false) => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
};

beforeEach(() => mockViewport());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Base UI accordion integration", () => {
  it("links the trigger to its labelled panel and preserves tutorial targets and the SVG", () => {
    render(<ConfiguratorAccordionGroup defaultValue="colors">{items}</ConfiguratorAccordionGroup>);

    const trigger = screen.getByRole("button", { name: "Colors" });
    const panel = screen.getByRole("region", { name: "Colors" });
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(trigger.getAttribute("aria-controls")).toBe(panel.id);
    expect(panel.getAttribute("aria-labelledby")).toBe(trigger.id);
    expect(trigger.hasAttribute("data-panel-open")).toBe(true);
    expect(trigger.closest('[data-tutorial-target="colors"]')).not.toBeNull();
    expect(trigger.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    expect(trigger.querySelector("svg")?.getAttribute("viewBox")).toBe("0 0 15 15");
  });

  it("switches a single open item and reports an empty string when collapsed", async () => {
    const onValueChange = vi.fn();
    render(
      <ConfiguratorAccordionGroup defaultValue="colors" onValueChange={onValueChange}>
        {items}
      </ConfiguratorAccordionGroup>,
    );

    const colors = screen.getByRole("button", { name: "Colors" });
    const handles = screen.getByRole("button", { name: "Handles" });
    fireEvent.click(handles);
    expect(onValueChange).toHaveBeenLastCalledWith("handles");
    expect(colors.getAttribute("aria-expanded")).toBe("false");
    expect(handles.getAttribute("aria-expanded")).toBe("true");

    fireEvent.click(handles);
    expect(onValueChange).toHaveBeenLastCalledWith("");
    expect(handles.getAttribute("aria-expanded")).toBe("false");
    await waitFor(() => expect(screen.queryByText("Choose a handle")).toBeNull());
  });

  it("follows controlled values, including the collapsed value", () => {
    const { rerender } = render(<ConfiguratorAccordionGroup value="colors">{items}</ConfiguratorAccordionGroup>);
    rerender(<ConfiguratorAccordionGroup value="handles">{items}</ConfiguratorAccordionGroup>);
    expect(screen.getByRole("button", { name: "Colors" }).getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByRole("button", { name: "Handles" }).getAttribute("aria-expanded")).toBe("true");

    rerender(<ConfiguratorAccordionGroup value="">{items}</ConfiguratorAccordionGroup>);
    expect(screen.getByRole("button", { name: "Handles" }).getAttribute("aria-expanded")).toBe("false");
  });

  it("collapses multiple items by default on compact screens but keeps a single item open", () => {
    mockViewport(true);
    const { rerender } = render(
      <ConfiguratorAccordionGroup defaultValue="colors" collapseDefaultOnCompact>
        <ConfiguratorAccordionItem value="colors" title="Colors">
          Color
        </ConfiguratorAccordionItem>
        <ConfiguratorAccordionItem value="handles" title="Handles">
          Handle
        </ConfiguratorAccordionItem>
      </ConfiguratorAccordionGroup>,
    );
    expect(screen.getByRole("button", { name: "Colors" }).getAttribute("aria-expanded")).toBe("false");

    rerender(
      <ConfiguratorAccordionGroup key="single" defaultValue="colors" collapseDefaultOnCompact>
        <ConfiguratorAccordionItem value="colors" title="Colors">
          Color
        </ConfiguratorAccordionItem>
      </ConfiguratorAccordionGroup>,
    );
    expect(screen.getByRole("button", { name: "Colors" }).getAttribute("aria-expanded")).toBe("true");
  });

  it("honors a requested section after navigation, even after the user collapses it", () => {
    const SyncedGroup = ({ requestedValue, requestKey }: { requestedValue: string; requestKey: string }) => {
      const selection = useSyncedAccordionValue({
        values: ["colors", "handles"],
        defaultValue: "colors",
        requestedValue,
        requestKey,
      });
      return <ConfiguratorAccordionGroup {...selection}>{items}</ConfiguratorAccordionGroup>;
    };
    const { rerender } = render(<SyncedGroup requestedValue="handles" requestKey="first" />);
    const handles = screen.getByRole("button", { name: "Handles" });
    expect(handles.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(handles);
    expect(handles.getAttribute("aria-expanded")).toBe("false");

    rerender(<SyncedGroup requestedValue="handles" requestKey="second" />);
    expect(handles.getAttribute("aria-expanded")).toBe("true");
  });

  it("supports multiple open panels, disabled items, refs and state-based classes", () => {
    const ref = createRef<HTMLElement>();
    render(
      <Accordion.Root multiple defaultValue={["colors"]}>
        <Accordion.Item value="colors">
          <Accordion.Trigger ref={ref} className={(state) => (state.open ? "selected" : "collapsed")}>
            Colors
          </Accordion.Trigger>
          <Accordion.Content>Color</Accordion.Content>
        </Accordion.Item>
        <Accordion.Item value="handles">
          <Accordion.Trigger>Handles</Accordion.Trigger>
          <Accordion.Content>Handle</Accordion.Content>
        </Accordion.Item>
        <Accordion.Item value="disabled" disabled>
          <Accordion.Trigger>Unavailable</Accordion.Trigger>
          <Accordion.Content>Unavailable content</Accordion.Content>
        </Accordion.Item>
      </Accordion.Root>,
    );
    const colors = screen.getByRole("button", { name: "Colors" });
    expect(ref.current).toBe(colors);
    expect(colors.classList.contains("selected")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Handles" }));
    expect(screen.getAllByRole("region")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Unavailable" }));
    expect(screen.queryByRole("region", { name: "Unavailable" })).toBeNull();
  });

  it("preserves the standalone accordion defaultOpen behavior", () => {
    render(
      <ConfiguratorAccordion title="Cabinet" defaultOpen>
        Cabinet options
      </ConfiguratorAccordion>,
    );
    expect(screen.getByRole("button", { name: "Cabinet" }).getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("region", { name: "Cabinet" }).textContent).toContain("Cabinet options");
  });
});
