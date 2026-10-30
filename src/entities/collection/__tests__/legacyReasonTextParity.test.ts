import { describe, expect, it } from "vitest";

import {
  formatCompositionLengthReachedReason,
  formatSidePanelsExceedMaxReason,
  resolveIntegratedBasinUnavailableReason,
} from "@/features/configurator-rule-core/countertop";
import type { CountertopMatrixRule } from "@/features/configurator-rule-core/countertop/types";
import { buildUnavailableDividerWarning, validatePlacement } from "@/features/dividers/model/validate";
import { deriveDividerOptions } from "@/features/dividers/model/deriveOptions";
import type { DividerSlot } from "@/features/dividers/model/types";
import { cmToInches } from "@/shared/lib/sku";

import { ushProfile } from "./ushProfileFixture";
import { selectMessage } from "../lib/productProfileSelectors";

/**
 * DEV-08: reasons that used to be English strings in code now come from USH `messages`.
 * Without a profile the code falls back to the old string, so the USH text must equal it:
 * the user sees exactly what they saw before the move.
 */

const rule = (overrides: Partial<CountertopMatrixRule>): CountertopMatrixRule =>
  ({
    material: "HPL",
    basinStyle: "Quadra 50",
    maxIntegratedCm: null,
    minSbCm: null,
    integratedAllowedSizesOnly: [],
    ...overrides,
  }) as CountertopMatrixRule;

const slot = (overrides: Partial<DividerSlot>): DividerSlot =>
  ({ id: "candidate:cab-1:Top:0:A", availableTypes: ["A", "B"], canPlace: true, ...overrides }) as DividerSlot;

describe("USH reason texts equal the legacy strings", () => {
  it.each([
    ["total width over the basin maximum", [rule({ maxIntegratedCm: 160 })], 60, 180],
    ["sink base under its minimum", [rule({ minSbCm: 80 })], 60, 60],
    ["sink base outside the exact sizes", [rule({ integratedAllowedSizesOnly: [80, 100] })], 60, 60],
    ["the selection as a whole", [rule({})], 60, 60],
  ])("integrated basin: %s", (_, basinRules, sinkBaseWidth, totalWidth) => {
    const fromProfile = resolveIntegratedBasinUnavailableReason({
      basinRules,
      sinkBaseWidth,
      totalWidth,
      profile: ushProfile,
    });
    const legacy = resolveIntegratedBasinUnavailableReason({ basinRules, sinkBaseWidth, totalWidth, profile: null });

    expect(fromProfile.disabledReason).toBe(legacy.disabledReason);
    expect(fromProfile.reasonCode).toBe(legacy.reasonCode);
  });

  it("composition and side panel length", () => {
    expect(formatCompositionLengthReachedReason(220, ushProfile)).toBe(formatCompositionLengthReachedReason(220, null));
    expect(formatCompositionLengthReachedReason(null, ushProfile)).toBe(formatCompositionLengthReachedReason(null, null));
    expect(formatSidePanelsExceedMaxReason(224, 220, ushProfile)).toBe(formatSidePanelsExceedMaxReason(224, 220, null));
  });

  it("dividers", () => {
    expect(buildUnavailableDividerWarning("C", ["A", "B"], ushProfile)).toBe(
      "Option C does not fit here. Choose one of: Option A, Option B.",
    );
    expect(buildUnavailableDividerWarning("C", [], ushProfile)).toBe(buildUnavailableDividerWarning("C", [], null));

    for (const [selected, target] of [
      ["A", null],
      [null, slot({})],
      ["A", slot({ canPlace: false })],
      ["B", slot({ placementType: "A" })],
    ] as const) {
      const fromProfile = validatePlacement(selected, target, "trace", ushProfile);
      const legacy = validatePlacement(selected, target, "trace", null);
      expect(fromProfile).toEqual(legacy);
    }

    const options = [{ name: "A" }, { name: "not-a-divider" }];
    expect(deriveDividerOptions(options, ["B"], ushProfile)).toEqual(deriveDividerOptions(options, ["B"], null));
  });

  it("cabinet type, height and open cabinet reasons", () => {
    expect(selectMessage(ushProfile, "handle.heightLocked", { heightCm: 56, heightIn: cmToInches(56) })).toBe(
      `Not available for current configuration height (56 cm / ${cmToInches(56)}" locked)`,
    );
    expect(selectMessage(ushProfile, "cabinet.notAvailableForType")).toBe("Not available for selected cabinet type");
    expect(selectMessage(ushProfile, "cabinet.noCommonHeight")).toBe(
      "No common supported height across selected products",
    );
    expect(selectMessage(ushProfile, "cabinet.heightLocked")).toBe("Height locked by existing products");
    expect(selectMessage(ushProfile, "handle.notAvailableForOpenCabinet")).toBe("Not available for open cabinets");
  });

  it("names a divider style by the collection's own label", () => {
    const classLike = {
      ...ushProfile,
      attributes: ushProfile.attributes.map((attribute) =>
        attribute.attributeId === "DividersStyle"
          ? {
              ...attribute,
              options: [
                { value: "Metal", label: "Metal", order: 10 },
                { value: "Oak", label: "Oak", order: 20 },
              ],
            }
          : attribute,
      ),
    };

    expect(buildUnavailableDividerWarning("Oak", ["Metal"], classLike)).toBe(
      "Oak does not fit here. Choose one of: Metal.",
    );
  });
});
