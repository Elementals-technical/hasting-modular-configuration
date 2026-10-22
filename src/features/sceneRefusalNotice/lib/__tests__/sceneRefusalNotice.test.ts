// @vitest-environment jsdom
import { act, cleanup, render, renderHook, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { interpolateMessage, ReasonTextContextProvider, type ReasonTextResolver } from "@/shared/lib/reasonText";

import { SceneRefusalNotice } from "../../ui/SceneRefusalNotice";
import { dismissSceneRefusal, reportAddRefusal, reportSceneRefusal, useSceneRefusal } from "../sceneRefusalNotice";

afterEach(() => {
  cleanup();
  dismissSceneRefusal();
});

describe("scene refusal notice", () => {
  it("shows the scene's refusal until it is dismissed", () => {
    const { result } = renderHook(() => useSceneRefusal());

    act(() => reportSceneRefusal({ status: "error", sceneCode: "UF_HEIGHT_RUN_VIOLATION" }));
    expect(result.current).toEqual({ code: "UF_HEIGHT_RUN_VIOLATION" });

    act(() => dismissSceneRefusal());
    expect(result.current).toBeNull();
  });

  it("ignores an applied command, an error without a scene code and a code with no text", () => {
    const { result } = renderHook(() => useSceneRefusal());

    act(() => {
      reportSceneRefusal({ status: "applied" });
      reportSceneRefusal({ status: "error" });
      reportSceneRefusal({ status: "error", sceneCode: "NO_AVAILABLE_PLACEMENT" });
    });
    expect(result.current).toBeNull();
  });

  it("shows a refused add with its params, and a newer refusal replaces the one shown", () => {
    const { result } = renderHook(() => useSceneRefusal());
    const rowFull = { code: "countertop.rowLengthReached", params: { maxCm: 270, maxIn: "106.3" } };

    act(() => reportSceneRefusal({ status: "error", sceneCode: "UF_HEIGHT_RUN_VIOLATION" }));
    act(() => reportAddRefusal(rowFull));
    expect(result.current).toEqual(rowFull);
  });

  it("renders the collection's text for the refused add, filled with its params", () => {
    const messages: Record<string, string> = {
      "countertop.rowLengthReached": 'Maximum length reached for this level ({maxCm} cm / {maxIn}").',
    };
    const resolve: ReasonTextResolver = ({ code, params, text }) =>
      code && messages[code] ? interpolateMessage(messages[code], params) : (text ?? code);

    render(createElement(ReasonTextContextProvider, { value: resolve }, createElement(SceneRefusalNotice)));
    act(() => reportAddRefusal({ code: "countertop.rowLengthReached", params: { maxCm: 270, maxIn: "106.3" } }));

    expect(screen.getByRole("alert").textContent).toBe('Maximum length reached for this level (270 cm / 106.3").');
  });
});
