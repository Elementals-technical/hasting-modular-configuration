// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";

import { readEditSizeButtonRect } from "../lib/readEditSizeButtonRect";

const host = window as unknown as { containerRef?: { current: HTMLIFrameElement | null } };

const rectOf = (left: number, top: number, width: number, height: number): DOMRect => ({
  left,
  top,
  width,
  height,
  right: left + width,
  bottom: top + height,
  x: left,
  y: top,
  toJSON: () => ({}),
});

/** The scene iframe, offset in the page so a rect with the offset added would show. */
const mountScene = () => {
  const iframe = document.createElement("iframe");
  document.body.appendChild(iframe);
  iframe.getBoundingClientRect = () => rectOf(100, 50, 1000, 800);
  host.containerRef = { current: iframe };
  const sceneDocument = iframe.contentDocument;
  if (!sceneDocument) throw new Error("jsdom gave the iframe no document");
  return sceneDocument;
};

const addButton = (sceneDocument: Document, rect: DOMRect, display = "flex") => {
  const button = sceneDocument.createElement("button");
  button.className = "countertop-edit-size-button";
  button.style.display = display;
  button.getBoundingClientRect = () => rect;
  sceneDocument.body.appendChild(button);
  return button;
};

afterEach(() => {
  document.body.innerHTML = "";
  delete host.containerRef;
});

describe("Edit size button rect", () => {
  it("is null without the scene iframe", () => {
    expect(readEditSizeButtonRect()).toBeNull();
    host.containerRef = { current: null };
    expect(readEditSizeButtonRect()).toBeNull();
  });

  it("is null while the scene draws no button", () => {
    mountScene();
    expect(readEditSizeButtonRect()).toBeNull();
  });

  it("is null for a hidden button or one its hidden layer leaves 0 × 0", () => {
    const sceneDocument = mountScene();
    addButton(sceneDocument, rectOf(365, 210, 40, 40), "none");
    addButton(sceneDocument, rectOf(0, 0, 0, 0));
    expect(readEditSizeButtonRect()).toBeNull();
  });

  it("takes the visible button's rect in iframe px, without the iframe's offset", () => {
    const sceneDocument = mountScene();
    addButton(sceneDocument, rectOf(10, 10, 40, 40), "none");
    addButton(sceneDocument, rectOf(365, 210, 40, 40));
    expect(readEditSizeButtonRect()).toEqual({ left: 365, top: 210, right: 405, bottom: 250 });
  });
});
