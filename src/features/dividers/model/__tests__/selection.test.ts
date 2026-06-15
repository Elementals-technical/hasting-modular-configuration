import { describe, expect, it } from "vitest";

import { shouldClearDividersOnOptionChange } from "../selection";

describe("shouldClearDividersOnOptionChange", () => {
  it("does not clear placed dividers when leaving Customize mode through None", () => {
    expect(shouldClearDividersOnOptionChange("None", "Customize")).toBe(false);
  });

  it("clears placed dividers only when None is re-applied", () => {
    expect(shouldClearDividersOnOptionChange("None", "None")).toBe(true);
  });

  it("does not clear placed dividers for non-None options", () => {
    expect(shouldClearDividersOnOptionChange("Customize", "None")).toBe(false);
  });
});
