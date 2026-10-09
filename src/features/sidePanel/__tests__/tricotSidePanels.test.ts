import { describe, expect, it } from "vitest";

import { tricotProfile } from "@/entities/collection/__tests__/tricotFixtures";

import { mapCabinetTypeToGroup } from "../model/selectors";
import {
  mapSidePanelDrawersToHandleType,
  sidePanelAvailabilityRule,
  sidePanelCountertopLengthRule,
} from "../lib/sidePanelRules";

/**
 * Tricot side panels go through the shared side panel rules, as Urban Freestanding's do, with one
 * groove type: the panel without a groove (NoG). Each active side adds 1 cm to the countertop.
 */

const availableFor = (cabinet: string, drawers: string, height = 40) => [
  ...sidePanelAvailabilityRule(
    {
      height,
      handleType: mapSidePanelDrawersToHandleType(drawers, tricotProfile),
      cabinetType: mapCabinetTypeToGroup(cabinet, tricotProfile),
    },
    tricotProfile,
  ).allowed,
];

describe("Tricot side panels", () => {
  it.each([
    ["Tricot-sink-cabinet-a1b2c3", "1"],
    ["Tricot-sink-cabinet-a1b2c3", "2"],
    ["Tricot-side-cabinet-a1b2c3", "1+inner"],
    ["Sink-Base", "1DWID"],
    ["Side-Cabinet", "2D"],
  ])("offers %s with drawers %s the panel without a groove only", (cabinet, drawers) => {
    expect(availableFor(cabinet, drawers)).toEqual(["NoG"]);
  });

  it("offers none at a height Tricot does not make", () => {
    expect(availableFor("Tricot-sink-cabinet-a1b2c3", "2", 52)).toEqual([]);
  });

  it("lengthens the countertop by 1 cm a side when both sides take a panel", () => {
    expect(sidePanelCountertopLengthRule({ sidePanels: "NoG", vanityLength: 120 }, tricotProfile)).toEqual({
      length: 122,
    });
    expect(sidePanelCountertopLengthRule({ sidePanels: "None", vanityLength: 120 }, tricotProfile)).toEqual({
      length: 120,
    });
  });
});
