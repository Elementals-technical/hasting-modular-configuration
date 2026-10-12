import { useLayoutEffect, type RefObject } from "react";
import s from "./Accordion.module.scss";

// Enough room for panel padding and one usable control. Smaller panels use the step's scroll.
const MIN_CONTENT_HEIGHT = 80;

/** Fit configurator headers and one panel into the step's available height. */
export const useContainedAccordionLayout = (rootRef: RefObject<HTMLDivElement>) => {
  useLayoutEffect(() => {
    const root = rootRef.current;
    const container = root?.closest<HTMLElement>('[data-scroll-container="step-content"]');
    if (!root || !container || typeof ResizeObserver === "undefined") return;
    const accordionRoot = root;
    const scrollContainer = container;

    let frame = 0;
    const observedHeaders = new Set<HTMLElement>();
    const scheduleMeasure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    const resizeObserver = new ResizeObserver(scheduleMeasure);

    function measure() {
      const items = Array.from(accordionRoot.children).filter((item) => item.classList.contains(s.Item));
      const headers = new Set<HTMLElement>();
      let reservedHeight = 0;

      for (const item of items) {
        const header = item.querySelector<HTMLElement>(`:scope > .${s.Header}`);
        if (!header) continue;
        headers.add(header);
        const height = header.getBoundingClientRect().height;
        (item as HTMLElement).style.setProperty("--accordion-header-height", `${height}px`);
        const style = getComputedStyle(item);
        reservedHeight += height + (parseFloat(style.marginTop) || 0) + (parseFloat(style.marginBottom) || 0);
        if (!observedHeaders.has(header)) resizeObserver.observe(header);
      }

      for (const header of observedHeaders) {
        if (!headers.has(header)) resizeObserver.unobserve(header);
      }
      observedHeaders.clear();
      headers.forEach((header) => observedHeaders.add(header));

      // Include content preceding the accordion; scrollTop keeps this offset stable in fallback mode.
      const offset =
        accordionRoot.getBoundingClientRect().top -
        scrollContainer.getBoundingClientRect().top +
        scrollContainer.scrollTop;
      const availableHeight = Math.max(0, scrollContainer.clientHeight - offset);
      const contentHeight = Math.max(0, availableHeight - reservedHeight - 1);
      accordionRoot.style.setProperty("--accordion-max-height", `${availableHeight}px`);
      accordionRoot.style.setProperty("--accordion-content-max-height", `${contentHeight}px`);
      const layout = contentHeight >= MIN_CONTENT_HEIGHT ? "contained" : "scroll";
      accordionRoot.dataset.accordionLayout = layout;
      if (layout === "contained") scrollContainer.scrollTop = 0;
    }

    resizeObserver.observe(container);
    // Wrappers can contain other controls above the group. Their height changes move the root.
    let wrapper = root.parentElement;
    while (wrapper && wrapper !== container) {
      resizeObserver.observe(wrapper);
      wrapper = wrapper.parentElement;
    }
    const mutationObserver = new MutationObserver(scheduleMeasure);
    mutationObserver.observe(container, { childList: true, subtree: true });
    measure();

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, [rootRef]);
};
