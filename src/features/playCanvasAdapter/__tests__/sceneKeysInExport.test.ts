import { describe, expect, it } from "vitest";

import { classRuntimeBindings } from "@/entities/collection/lib/runtimeBindings/__tests__/classRuntimeBindingsFixture";
import { makoRuntimeBindings } from "@/entities/collection/lib/runtimeBindings/__tests__/makoRuntimeBindingsFixture";
import { ushRuntimeBindings } from "@/entities/collection/lib/runtimeBindings/__tests__/ushRuntimeBindingsFixture";
import type { RuntimeBinding } from "@/entities/collection/model/runtimeBindings";

import sceneCode from "../../../../public/HastingCabinetsParametrization/js/esm.mjs?raw";

/**
 * Which scene keys of the USH table the scene code actually reads (I06).
 *
 * Static evidence only: a key the scene bundle never mentions cannot have an effect. Whether
 * a key that is read behaves as the binding assumes is the browser run in
 * docs/i06-scene-acceptance.md.
 */

/** Keys the code sends although no scene script reads them, with the reason they stay. */
const NOT_READ_BY_SCENE: Record<string, string> = {
  CountertopStyle: "sent by the code, but no scene script reads it; the browser run decides whether it can go",
};

const sceneKeysOf = (binding: RuntimeBinding): string[] => {
  if (binding.status !== "bound") return [];

  const valueKeys =
    binding.values.kind === "identity"
      ? [binding.values.sceneKey]
      : Object.values(binding.values.patches).flatMap((patch) => Object.keys(patch));

  return [...new Set([...valueKeys, ...Object.keys(binding.resetBefore ?? {})])];
};

const boundSceneKeys = [...new Set(ushRuntimeBindings.bindings.flatMap(sceneKeysOf))];

const isReadByScene = (key: string): boolean => new RegExp(`\\b${key}\\b`).test(sceneCode);

describe("USH scene keys in the scene code", () => {
  it("collects the keys of identity values, mapped patches and the steps sent before them", () => {
    expect(boundSceneKeys).toEqual(
      expect.arrayContaining(["Handle", "Drawers", "HandleGrooveColor", "TowelBar", "TowelBarSide", "sinkType"]),
    );
  });

  it("finds every bound key in the scene bundle except the ones listed as not read", () => {
    const notRead = boundSceneKeys.filter((key) => !isReadByScene(key));

    expect(notRead).toEqual(Object.keys(NOT_READ_BY_SCENE));
  });
});

describe("Mako sink and countertop rules in the scene code", () => {
  it("ships the mapped sink key, vessel colour, sink swap rule and 0.75-inch top offset", () => {
    expect(makoRuntimeBindings.bindings.flatMap(sceneKeysOf)).toEqual(
      expect.arrayContaining(["sinkType", "VesselColor", "Thickness"]),
    );
    expect(sceneCode).toContain(
      "rules:[{rule:RuleInitCabinetMako,priority:10},{rule:RuleChangeSinkType,priority:15}",
    );
    expect(sceneCode).toContain(".75:{y:.00635}");
    expect(sceneCode).toContain(
      "CountertopColor:firstCabinet.CountertopColor,Thickness:firstCabinet.Thickness??productMeta.defaultConfig?.Thickness??.5",
    );
  });
});

describe("Class sink and countertop rules in the scene code", () => {
  it("ships the Class thickness binding, calibrated offsets and combined sink mount rule", () => {
    expect(classRuntimeBindings.bindings.flatMap(sceneKeysOf)).toContain("Thickness");

    const classSinkRegistration = sceneCode.match(
      /registerProduct\("Class-sink-cabinet".*?registerProduct\("Class-side-cabinet"/,
    )?.[0];

    expect(classSinkRegistration).toContain("heightLocalY:{40:{y:-0.16},52:{y:-0.04}}");
    expect(classSinkRegistration).toContain("{rule:RuleSinkMountPosition,priority:70}");
    expect(classSinkRegistration).toContain("Thickness:.5");
    expect(sceneCode).toContain("3.125:{y:.066675}");
    expect(sceneCode).toContain("4.75:{y:.10795}");
  });
});
