// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MobileLandscapeStub } from "../MobileLandscapeStub";
import { MOBILE_LANDSCAPE_MEDIA_QUERY } from "../useIsMobileLandscape";

// jsdom has no matchMedia; this stands in for the list the browser returns.
class FakeMediaQueryList extends EventTarget implements MediaQueryList {
  matches: boolean;
  media = MOBILE_LANDSCAPE_MEDIA_QUERY;
  onchange: MediaQueryList["onchange"] = null;

  constructor(matches: boolean) {
    super();
    this.matches = matches;
  }

  addListener() {}
  removeListener() {}

  setMatches(matches: boolean) {
    this.matches = matches;
    this.dispatchEvent(new Event("change"));
  }
}

const installMatchMedia = (matches: boolean) => {
  const mediaQueryList = new FakeMediaQueryList(matches);
  const matchMedia = vi.fn(() => mediaQueryList);

  vi.stubGlobal("matchMedia", matchMedia);

  return { mediaQueryList, matchMedia };
};

describe("MobileLandscapeStub", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders nothing outside mobile landscape", () => {
    const { matchMedia } = installMatchMedia(false);

    render(<MobileLandscapeStub />);

    expect(matchMedia).toHaveBeenCalledWith(MOBILE_LANDSCAPE_MEDIA_QUERY);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows the rotate prompt when the page opens in mobile landscape", () => {
    installMatchMedia(true);

    render(<MobileLandscapeStub />);

    expect(screen.getByRole("alert").textContent).toContain("Please rotate your device");
  });

  it("follows the device as it is rotated", () => {
    const { mediaQueryList } = installMatchMedia(false);

    render(<MobileLandscapeStub />);

    act(() => mediaQueryList.setMatches(true));
    expect(screen.queryByRole("alert")).not.toBeNull();

    act(() => mediaQueryList.setMatches(false));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("stops listening after unmount", () => {
    const { mediaQueryList } = installMatchMedia(false);
    const addEventListener = vi.spyOn(mediaQueryList, "addEventListener");
    const removeEventListener = vi.spyOn(mediaQueryList, "removeEventListener");

    const { unmount } = render(<MobileLandscapeStub />);
    unmount();

    expect(removeEventListener).toHaveBeenCalledWith("change", addEventListener.mock.calls[0][1]);
  });
});
