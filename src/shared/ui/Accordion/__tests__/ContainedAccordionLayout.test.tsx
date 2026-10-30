// @vitest-environment jsdom

import { useRef } from "react";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useContainedAccordionLayout } from "../useContainedAccordionLayout";
import s from "../Accordion.module.scss";

const observers: TestResizeObserver[] = [];
class TestResizeObserver implements ResizeObserver {
  private callback: ResizeObserverCallback;
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    observers.push(this);
  }
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  notify() {
    this.callback([], this);
  }
}

let availableHeight = 400;
let headerHeight = 40;
let precedingHeight = 0;

function Group({ count = 3 }: { count?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useContainedAccordionLayout(ref);
  return (
    <div ref={ref} className={s.Root} data-testid="accordion">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className={s.Item} style={{ marginTop: index ? 1 : 0 }}>
          <h3 className={s.Header}>Section {index + 1}</h3>
        </div>
      ))}
    </div>
  );
}

function Step({ count }: { count?: number }) {
  return (
    <div data-scroll-container="step-content" data-testid="step">
      <Group count={count} />
    </div>
  );
}

const resize = async () => {
  await act(async () => {
    observers[0].notify();
    await new Promise(requestAnimationFrame);
  });
};

beforeEach(() => {
  observers.length = 0;
  availableHeight = 400;
  headerHeight = 40;
  precedingHeight = 0;
  vi.stubGlobal("ResizeObserver", TestResizeObserver);
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockImplementation(function (this: HTMLElement) {
    return this.dataset.scrollContainer ? availableHeight : 0;
  });
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    const top = this.classList.contains(s.Root) ? precedingHeight - (this.parentElement?.scrollTop ?? 0) : 0;
    const height = this.classList.contains(s.Header) ? headerHeight : 0;
    return { top, bottom: top + height, height, width: 300, left: 0, right: 300, x: 0, y: top, toJSON: () => ({}) };
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("configurator accordion scroll ownership", () => {
  it("reserves space for every header and content preceding the accordion", () => {
    precedingHeight = 20;
    const { getByTestId } = render(<Step />);
    const root = getByTestId("accordion");
    expect(root.dataset.accordionLayout).toBe("contained");
    expect(root.style.getPropertyValue("--accordion-content-max-height")).toBe("257px");
    expect(observers[0].observe).toHaveBeenCalledTimes(4);
  });

  it("allows outer scrolling on short screens and resets it when returning to contained mode", async () => {
    precedingHeight = 20;
    const { getByTestId } = render(<Step />);
    const root = getByTestId("accordion");
    const step = getByTestId("step");
    availableHeight = 180;
    await resize();
    expect(root.dataset.accordionLayout).toBe("scroll");
    step.scrollTop = 100;
    await resize();
    expect(root.style.getPropertyValue("--accordion-max-height")).toBe("160px");
    expect(step.scrollTop).toBe(100);
    availableHeight = 400;
    await resize();
    expect(root.dataset.accordionLayout).toBe("contained");
    expect(root.style.getPropertyValue("--accordion-content-max-height")).toBe("257px");
    expect(step.scrollTop).toBe(0);
  });

  it("recalculates when sections appear or disappear and stops observing removed headers", async () => {
    availableHeight = 300;
    const { getByTestId, rerender } = render(<Step count={2} />);
    const root = getByTestId("accordion");
    expect(root.dataset.accordionLayout).toBe("contained");
    rerender(<Step count={6} />);
    await waitFor(() => expect(root.dataset.accordionLayout).toBe("scroll"));
    rerender(<Step count={2} />);
    await waitFor(() => expect(root.dataset.accordionLayout).toBe("contained"));
    expect(observers[0].unobserve).toHaveBeenCalledTimes(4);
  });

  it("accounts for headers changing height and disconnects on unmount", async () => {
    availableHeight = 250;
    const { getByTestId, unmount } = render(<Step />);
    const root = getByTestId("accordion");
    expect(root.dataset.accordionLayout).toBe("contained");
    headerHeight = 60;
    await resize();
    expect(root.dataset.accordionLayout).toBe("scroll");
    unmount();
    expect(observers[0].disconnect).toHaveBeenCalledOnce();
  });

  it("leaves accordions outside the configurator step in their natural layout", () => {
    const { getByTestId } = render(<Group />);
    expect(getByTestId("accordion").dataset.accordionLayout).toBeUndefined();
    expect(observers).toHaveLength(0);
  });
});
