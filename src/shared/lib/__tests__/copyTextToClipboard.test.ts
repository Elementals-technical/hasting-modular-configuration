// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { copyTextToClipboard } from "../copyTextToClipboard";

const setSecureContext = (value: boolean) => {
  Object.defineProperty(window, "isSecureContext", {
    configurable: true,
    value,
  });
};

const setClipboard = (writeText?: (text: string) => Promise<void>) => {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: writeText ? { writeText } : undefined,
  });
};

const setExecCommand = (implementation: (command: string) => boolean) => {
  Object.defineProperty(document, "execCommand", {
    configurable: true,
    value: vi.fn(implementation),
  });

  return document.execCommand as ReturnType<typeof vi.fn>;
};

afterEach(() => {
  vi.restoreAllMocks();
  setClipboard(undefined);
  setSecureContext(false);
});

describe("copyTextToClipboard", () => {
  it("uses Clipboard API in a secure context", async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined);
    const execCommand = setExecCommand(() => true);
    setSecureContext(true);
    setClipboard(writeText);

    await expect(copyTextToClipboard("SKU-123")).resolves.toBe(true);

    expect(writeText).toHaveBeenCalledWith("SKU-123");
    expect(execCommand).not.toHaveBeenCalled();
  });

  it("falls back to textarea copy when Clipboard API rejects", async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>().mockRejectedValue(new Error("denied"));
    const execCommand = setExecCommand((command) => command === "copy");
    setSecureContext(true);
    setClipboard(writeText);

    await expect(copyTextToClipboard("Tooltip description")).resolves.toBe(true);

    expect(writeText).toHaveBeenCalledWith("Tooltip description");
    expect(execCommand).toHaveBeenCalledWith("copy");
  });

  it("falls back to textarea copy when Clipboard API is unavailable", async () => {
    const execCommand = setExecCommand((command) => command === "copy");
    setSecureContext(false);
    setClipboard(undefined);

    await expect(copyTextToClipboard("SKU-456")).resolves.toBe(true);

    expect(execCommand).toHaveBeenCalledWith("copy");
  });
});
