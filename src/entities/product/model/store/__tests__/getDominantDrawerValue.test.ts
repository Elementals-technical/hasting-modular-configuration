import { beforeEach, describe, expect, it } from "vitest";

import { store } from "@/app/store";
import { makoProfile } from "@/entities/collection/__tests__/makoProfileFixture";
import { ushProfile } from "@/entities/collection/__tests__/ushProfileFixture";

import { getDominantDrawerValue } from "../derivedSelectors";
import { reset, setActiveProfile, setPlacedCabinetStyle } from "../slice";

/**
 * The table below is the behaviour the removed `getDominantDrawerGroup` had while the groups
 * were the literals "1" / "1+inner" / "2" in code. They now come from the collection's
 * `drawerStyleGroups`, and the selector returns the placed value rather than a group name, so a
 * card's picture can be looked up by the value the collection declares.
 */

const place = (styles: Record<string, string>) => {
  Object.entries(styles).forEach(([id, value]) => store.dispatch(setPlacedCabinetStyle({ id, value })));
};

describe("getDominantDrawerValue", () => {
  beforeEach(() => {
    store.dispatch(reset());
    store.dispatch(setActiveProfile(ushProfile));
  });

  it("has no value while nothing is placed", () => {
    expect(getDominantDrawerValue(store.getState())).toBeNull();
  });

  it.each([
    [{ a: "1" }, "1"],
    [{ a: "1+inner" }, "1+inner"],
    // Both belong to the same group, so either names the composition.
    [{ a: "1", b: "1+inner" }, "1"],
    [{ a: "2" }, "2"],
    // One two-drawer cabinet decided the composition while the groups were code.
    [{ a: "1", b: "2" }, "2"],
  ])("resolves %j to %j", (styles, expected) => {
    place(styles);

    expect(getDominantDrawerValue(store.getState())).toBe(expected);
  });

  it("does not recognise the scene spelling of a drawer value", () => {
    place({ a: "1D" });

    expect(getDominantDrawerValue(store.getState())).toBeNull();
  });

  it("uses the groups of the active collection", () => {
    store.dispatch(setActiveProfile(makoProfile));
    place({ a: "1", b: "2" });

    expect(getDominantDrawerValue(store.getState())).toBe("2");
  });
});
