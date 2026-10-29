import { describe, expect, it } from "vitest";

import classRuntimeBindingsDocument from "../../../../public/collections/class/runtime-bindings.json";
import lameRuntimeBindingsDocument from "../../../../public/collections/lame/runtime-bindings.json";
import lameUiDocument from "../../../../public/collections/lame/ui.json";
import { parseRuntimeBindings } from "@/entities/collection/lib/runtimeBindings/parseRuntimeBindings";

import { PENDING_BASIN_BADGE, PENDING_BASIN_REASON, markPendingBasins, pendingBasinValues } from "../lib/basinOptions";

import type { ProductOptionData } from "@/entities/product/ui/ProductOptionsGrid/ProductOptionsGrid";

const bindingsOf = (document: unknown) => {
  const parsed = parseRuntimeBindings(document);
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
  return parsed.bindings;
};

const basin = (name: string): ProductOptionData => ({ id: name, title: name, name, isShortDesc: false, isAvailable: true });

describe("basins without a scene model yet", () => {
  it("are the sinkType values the collection holds back from the scene: VA030 in Lame, none in Class", () => {
    expect([...pendingBasinValues(bindingsOf(lameRuntimeBindingsDocument))]).toEqual(["VA030"]);
    expect([...pendingBasinValues(bindingsOf(classRuntimeBindingsDocument))]).toEqual([]);
    expect([...pendingBasinValues(null)]).toEqual([]);
  });

  it("stay in the list, disabled with a 'Coming soon' badge, while the other basins are untouched", () => {
    const pending = pendingBasinValues(bindingsOf(lameRuntimeBindingsDocument));
    const [lb440, va030] = markPendingBasins([basin("LB440"), basin("VA030")], pending);

    expect(lb440).toEqual(basin("LB440"));
    expect(va030).toMatchObject({
      name: "VA030",
      isAvailable: false,
      disabledBadgeLabel: PENDING_BASIN_BADGE,
      disabledReason: PENDING_BASIN_REASON,
    });
  });

  it("show the in-development placeholder picture in Lame", () => {
    expect(lameUiDocument.optionImages.sinkType.VA030).toBe("images/basin/VA030.png");
  });
});
