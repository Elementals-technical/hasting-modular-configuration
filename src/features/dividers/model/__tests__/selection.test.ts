import { describe, expect, it } from "vitest";

import { shouldClearDividersOnOptionChange } from "../selection";

const NONE = "None";

describe("shouldClearDividersOnOptionChange", () => {
  it("does not clear placed dividers when leaving Customize mode through None", () => {
    expect(shouldClearDividersOnOptionChange("None", "Customize", NONE)).toBe(false);
  });

  it("clears placed dividers only when None is re-applied", () => {
    expect(shouldClearDividersOnOptionChange("None", "None", NONE)).toBe(true);
  });

  it("does not clear placed dividers for non-None options", () => {
    expect(shouldClearDividersOnOptionChange("Customize", "None", NONE)).toBe(false);
  });

  it("reads the clearing value from the collection, not from the English spelling", () => {
    expect(shouldClearDividersOnOptionChange("Keine", "Keine", "Keine")).toBe(true);
    expect(shouldClearDividersOnOptionChange("None", "None", "Keine")).toBe(false);
  });
});
