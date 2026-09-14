import { beforeEach, describe, expect, it } from "vitest";

import { store } from "@/app/store";

import { getDominantDrawerGroup } from "../selectors";
import { reset, setPlacedCabinetStyle } from "../slice";

/**
 * Current behaviour of the drawer mixing groups, recorded before the groups move into the
 * collection profile. CabinetBuilderPage restricts a style outside the dominant group.
 */

const place = (styles: Record<string, string>) => {
  Object.entries(styles).forEach(([id, value]) => store.dispatch(setPlacedCabinetStyle({ id, value })));
};

describe("getDominantDrawerGroup", () => {
  beforeEach(() => {
    store.dispatch(reset());
  });

  it("has no group while nothing is placed", () => {
    expect(getDominantDrawerGroup(store.getState())).toBeNull();
  });

  it.each([
    [{ a: "1" }, "single"],
    [{ a: "1+inner" }, "single"],
    [{ a: "1", b: "1+inner" }, "single"],
    [{ a: "2" }, "double"],
    // One two-drawer cabinet makes the composition double.
    [{ a: "1", b: "2" }, "double"],
  ])("resolves %j to %j", (styles, group) => {
    place(styles);

    expect(getDominantDrawerGroup(store.getState())).toBe(group);
  });

  it("does not recognise the scene spelling of a drawer value", () => {
    place({ a: "1D" });

    expect(getDominantDrawerGroup(store.getState())).toBeNull();
  });
});
