// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { dismissSceneRefusal, reportSceneRefusal, useSceneRefusal } from "../sceneRefusalNotice";

afterEach(() => dismissSceneRefusal());

describe("scene refusal notice", () => {
  it("shows the scene's refusal until it is dismissed", () => {
    const { result } = renderHook(() => useSceneRefusal());

    act(() => reportSceneRefusal({ status: "error", sceneCode: "UF_HEIGHT_RUN_VIOLATION" }));
    expect(result.current).toBe("UF_HEIGHT_RUN_VIOLATION");

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
});
