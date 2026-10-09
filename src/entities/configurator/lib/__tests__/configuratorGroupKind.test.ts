import { describe, expect, it } from "vitest";

import configurator4 from "@/entities/collection/__tests__/fixtures/remote/configurator-4.json";
import configurator9 from "@/entities/collection/__tests__/fixtures/remote/configurator-9.json";
import configurator11 from "@/entities/collection/__tests__/fixtures/remote/configurator-11.json";
import configurator12 from "@/entities/collection/__tests__/fixtures/remote/configurator-12.json";
import configurator13 from "@/entities/collection/__tests__/fixtures/remote/configurator-13.json";
import configurator14 from "@/entities/collection/__tests__/fixtures/remote/configurator-14.json";

import { getConfiguratorGroupKind, getConfiguratorProductElement } from "../configuratorGroupKind";

/** Each group of a recorded configurator with its kind and the product element the swatch order shows. */
const describeGroups = ({ availableOptions }: { availableOptions: readonly { proxyName: string }[] }) =>
  availableOptions.map(({ proxyName }) => [
    proxyName,
    getConfiguratorGroupKind(proxyName),
    getConfiguratorProductElement(proxyName),
  ]);

describe("configurator group kinds", () => {
  it("reads configurator 4 by its own names", () => {
    expect(describeGroups(configurator4)).toEqual([
      ["Cabinet Color", "cabinet", "Cabinet Color"],
      ["Handle Groove Color", "groove", "Handle Groove Color"],
      ["Towel Bar Color", "towelBar", "Towel Bar Color"],
      ["Countertop Color", "countertop", "Countertop Color"],
      ["Vessels", "vessel", "Vessels"],
    ]);
  });

  it("reads the Select names of the collections' own configurators as configurator 4's", () => {
    expect(describeGroups(configurator11)).toEqual([
      ["Select Cabinet Color", "cabinet", "Cabinet Color"],
      ["Select Handle Groove Color", "groove", "Handle Groove Color"],
      ["Select Countertop Color", "countertop", "Countertop Color"],
      ["Select Vessel Color", "vessel", "Vessels"],
      ["Select Towel Bar Color", "towelBar", "Towel Bar Color"],
    ]);
    expect(describeGroups(configurator12)).toEqual([
      ["Select Cabinet Color", "cabinet", "Cabinet Color"],
      ["Select Handle Groove Color", "groove", "Handle Groove Color"],
      ["Select Countertop Color", "countertop", "Countertop Color"],
      ["Select Vessel Color", "vessel", "Vessels"],
    ]);
    // Duplex's two panels share one group.
    expect(describeGroups(configurator13)).toEqual([
      ["Select Cabinet Colors", "cabinet", "Cabinet Color"],
      ["Select Countertop Color", "countertop", "Countertop Color"],
      ["Select Vessel Color", "vessel", "Vessels"],
      ["Select Towel Bar Color", "towelBar", "Towel Bar Color"],
    ]);
  });

  it("names a group of no known kind after itself, without Select", () => {
    expect(describeGroups(configurator14)).toEqual([
      ["Select Cabinet Color", "cabinet", "Cabinet Color"],
      ["Select Handle Color", null, "Handle Color"],
      ["Select Countertop Color", "countertop", "Countertop Color"],
      ["Select Vessel Color", "vessel", "Vessels"],
      ["Select Leg Cap Color", null, "Leg Cap Color"],
    ]);
    expect(describeGroups(configurator9)).toEqual([
      ["Select Cabinet Color", "cabinet", "Cabinet Color"],
      ["Select Handle Color", null, "Handle Color"],
      ["Select Leg Color", null, "Leg Color"],
      ["Select Countertop Color", "countertop", "Countertop Color"],
    ]);
  });
});
