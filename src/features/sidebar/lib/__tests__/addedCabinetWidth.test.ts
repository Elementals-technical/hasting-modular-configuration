import { describe, expect, it } from "vitest";

import { resolveAddedCabinetWidth } from "../addedCabinetWidth";

describe("the width a cabinet is added at", () => {
  it("keeps the chosen width where it is offered", () => {
    expect(resolveAddedCabinetWidth(70, [60, 70, 80])).toBe(70);
  });

  it("takes the widest offered width where the chosen one is not offered", () => {
    expect(resolveAddedCabinetWidth(60, [70, 80, 90])).toBe(90);
  });

  it("takes the widest offered width where the chosen one has no room", () => {
    // The offered widths are those the row has room for.
    expect(resolveAddedCabinetWidth(120, [60, 70])).toBe(70);
  });

  it("takes the widest offered width while none is chosen", () => {
    expect(resolveAddedCabinetWidth(null, [60, 105])).toBe(105);
  });

  it("adds at no width while none is offered", () => {
    expect(resolveAddedCabinetWidth(60, [])).toBe(null);
  });
});
