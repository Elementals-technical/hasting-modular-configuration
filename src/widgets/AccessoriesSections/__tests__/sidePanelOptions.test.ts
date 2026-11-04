import { describe, expect, it } from "vitest";

import type { FieldRuntimeState } from "@/entities/collection";
import { ushProfile } from "@/entities/collection/__tests__/ushProfileFixture";
import type { CountertopLengthGuard } from "@/features/configurator-rule-core/countertop";
import type { SidePanelAvailabilityResult } from "@/features/configurator-rule-core/options/types";

import { buildSidePanelOptions } from "../lib/sidePanelOptions";

// A refused groove carries the reason code its text is the fallback of, so the grid shows the profile's words for it
// instead of the generic "not available".

const field = {
  options: [{ value: "None" }, { value: "NoG" }, { value: "UpperG" }],
} as unknown as FieldRuntimeState;

/** A countertop of 219 cm under a 220 cm maximum: one panel on each side (1 cm each) makes it 221 cm. */
const lengthGuard = {
  max: 220,
  currentCabinetOnly: 219,
  canAccommodateTotal: (totalCm: number) => totalCm <= 220,
} as unknown as CountertopLengthGuard;

const unlimited = {
  max: null,
  currentCabinetOnly: 160,
  canAccommodateTotal: () => true,
} as unknown as CountertopLengthGuard;

const options = (availability: SidePanelAvailabilityResult, guard: CountertopLengthGuard) =>
  buildSidePanelOptions({
    field,
    isBlockedByLength: false,
    availability,
    lengthGuard: guard,
    targetSide: "both",
    leftStatus: "inactive",
    rightStatus: "inactive",
    profile: ushProfile,
  });

const grooves = (availability: SidePanelAvailabilityResult, guard: CountertopLengthGuard) =>
  options(availability, guard).filter(({ id }) => id !== "None");

describe("buildSidePanelOptions", () => {
  it("refuses every groove on a Syntesi countertop with the Syntesi message key and keeps its text", () => {
    const syntesi: SidePanelAvailabilityResult = {
      allowed: new Set(),
      reason: "Syntesi is not available with side panels.",
      reasonCode: "syntesi-countertop",
      messageCode: "syntesi.sidePanelsUnavailable",
    };

    expect(grooves(syntesi, unlimited)).toMatchObject([
      {
        id: "NoG",
        isAvailable: false,
        disabledReason: "Syntesi is not available with side panels.",
        disabledReasonCode: "syntesi.sidePanelsUnavailable",
      },
      {
        id: "UpperG",
        isAvailable: false,
        disabledReason: "Syntesi is not available with side panels.",
        disabledReasonCode: "syntesi.sidePanelsUnavailable",
      },
    ]);
  });

  it("refuses a groove that would take the countertop past its maximum with the length code and values", () => {
    const [noGroove] = grooves({ allowed: new Set(["NoG"]) }, lengthGuard);

    expect(noGroove).toMatchObject({
      id: "NoG",
      isAvailable: false,
      disabledReasonCode: "countertop.sidePanelsExceedMaxLength",
      disabledReasonParams: { withPanelsCm: 221, withPanelsIn: "87", maxCm: 220, maxIn: "86.6" },
      disabledReason:
        'Enabling side panels would exceed max countertop length (with panels: 221 cm / 87", max 220 cm / 86.6").',
    });
  });

  it("offers an allowed groove that fits without a reason", () => {
    const [noGroove] = grooves({ allowed: new Set(["NoG"]) }, unlimited);

    expect(noGroove).toMatchObject({ id: "NoG" });
    expect(noGroove.isAvailable).toBeUndefined();
    expect(noGroove.disabledReason).toBeUndefined();
    expect(noGroove.disabledReasonCode).toBeUndefined();
    expect(noGroove.disabledReasonParams).toBeUndefined();
  });
});
