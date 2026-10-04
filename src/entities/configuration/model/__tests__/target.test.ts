import { describe, expect, it } from "vitest";

import { formatTarget, parseTarget } from "../types";
import type { ValueTarget } from "../types";

describe("parseTarget", () => {
  it.each<ValueTarget>([
    { scope: "global" },
    { scope: "countertop" },
    { scope: "basin" },
    { scope: "cabinet", cabinetId: "cab-1" },
    { scope: "drawer", cabinetId: "cab-2", drawerType: "TopFull" },
  ])("reads back %o from its saved key", (target) => {
    expect(parseTarget(formatTarget(target))).toEqual(target);
  });

  it.each(["cabinet:", "drawer:cab-1:Side", "shelf:cab-1", "cabinet:cab-1:Top", "drawer:cab-1:Top:x"])(
    "does not guess a target for %s",
    (key) => {
      expect(parseTarget(key)).toBeNull();
    },
  );
});
