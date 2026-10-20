import { describe, expect, it } from "vitest";

import { classRuntimeBindings } from "@/entities/collection/lib/runtimeBindings/__tests__/classRuntimeBindingsFixture";
import { makoRuntimeBindings } from "@/entities/collection/lib/runtimeBindings/__tests__/makoRuntimeBindingsFixture";
import { ushRuntimeBindings } from "@/entities/collection/lib/runtimeBindings/__tests__/ushRuntimeBindingsFixture";
import { parseRuntimeBindings } from "@/entities/collection/lib/runtimeBindings/parseRuntimeBindings";
import type { RuntimeBinding } from "@/entities/collection/model/runtimeBindings";

import sceneCode from "../../../../public/HastingCabinetsParametrization/js/esm.mjs?raw";
import lameRuntimeBindingsDocument from "../../../../public/collections/lame/runtime-bindings.json";
import urbanDuplexRuntimeBindingsDocument from "../../../../public/collections/urban-duplex/runtime-bindings.json";
import ufsRuntimeBindingsDocument from "../../../../public/collections/urban-freestanding/runtime-bindings.json";

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

describe("Urban Freestanding products in the scene code", () => {
  it("registers the scene product of every UF cabinet type and paints the groove of the drawer cabinets", () => {
    for (const sceneType of Object.values(ufsRuntimeBindingsDocument.productTypes)) {
      expect(sceneCode).toContain(`registry.registerProduct("${sceneType}",`);
    }

    for (const sceneType of ["UF-sink-cabinet", "UF-side-cabinet"]) {
      const registration = sceneCode.match(new RegExp(`registerProduct\\("${sceneType}".*?registerProduct\\(`))?.[0];

      expect(registration).toContain("{rule:RuleMaterialsHandleUrbanFreestanding,priority:55}");
    }
  });
});

describe("Urban Duplex products in the scene code", () => {
  // A cabinet type stands in `productTypes` only once the scene registers its product: the scene
  // answers an unknown type with an empty placeholder.
  it("registers the scene product of every UD cabinet type the collection places", () => {
    for (const sceneType of Object.values(urbanDuplexRuntimeBindingsDocument.productTypes)) {
      expect(sceneCode, sceneType).toContain(`registry.registerProduct("${sceneType}",`);
    }
  });

  it("reads the keys the panel colours, the lateral side and the series are sent under", () => {
    const registrationOf = (sceneType: string) =>
      sceneCode.match(new RegExp(`registerProduct\\("${sceneType}",.*?registerProduct\\(`))?.[0] ?? "";

    for (const sceneType of ["UD-sink-cabinet", "UD-side-cabinet"]) {
      const registration = registrationOf(sceneType);

      // CabinetColor, CabinetColorLateral, HandleGrooveColor and HandleSide, each by its own rule.
      expect(registration, sceneType).toContain("rule:RuleMaterialsCabinetUrbanDuplex,");
      expect(registration, sceneType).toContain("rule:RuleMaterialsCabinetLateralUrbanDuplex,");
      expect(registration, sceneType).toContain("rule:RuleMaterialsHandleGrooveUrbanDuplex,");
      expect(registration, sceneType).toContain("rule:RuleHandleSideCabinetUrbanDuplex,");
    }

    expect(registrationOf("UD-open-shelves")).toContain("rule:RuleMaterialsUDOpenShelves,");
    expect(registrationOf("UD-open-shelves-side")).toContain("rule:RuleMaterialsUDOpenShelvesSide,");
    for (const key of ["CabinetColorLateral", "HandleSide"]) expect(isReadByScene(key), key).toBe(true);
  });
});

describe("Lame products in the scene code", () => {
  const parsed = parseRuntimeBindings(lameRuntimeBindingsDocument);
  if (!parsed.ok) throw new Error(`the Lame bindings must parse: ${JSON.stringify(parsed.diagnostics)}`);
  const lameBindings = parsed.bindings;

  const registrationOf = (sceneType: string) =>
    sceneCode.match(new RegExp(`registerProduct\\("${sceneType}",[\\s\\S]*?registerProduct\\(`))?.[0] ?? "";
  const patchValuesOf = (attributeId: string, sceneKey: string) => {
    const binding = lameBindings.bindings.find((candidate) => candidate.attributeId === attributeId);
    return binding?.status === "bound" && binding.values.kind === "map"
      ? Object.values(binding.values.patches).map((patch) => patch[sceneKey])
      : [];
  };

  it("registers the scene product of both cabinet types, with the rules the bindings send to", () => {
    for (const sceneType of Object.values(lameBindings.productTypes)) {
      const registration = registrationOf(sceneType);

      expect(registration, sceneType).not.toBe("");
      for (const rule of [
        "RuleWidthCabinetLame",
        "RuleHeightCabinetLame",
        "RuleDrawersCabinetLame",
        "RuleMaterialsCabinetLame",
        "RuleMaterialsHandleLame",
        "RuleMaterialsLegCapLame",
        "RuleMaterialsUndertopLame",
        "RulePatternCabinetLame",
      ]) {
        expect(registration, `${sceneType} ${rule}`).toContain(`rule:${rule},`);
      }
    }
    expect(registrationOf("Lame-sink-cabinet")).toContain("rule:RuleChangeSinkType,");
  });

  it("finds every bound key in the scene bundle except the ones listed as not read", () => {
    const keys = [...new Set(lameBindings.bindings.flatMap(sceneKeysOf))];

    expect(keys).toEqual(
      expect.arrayContaining(["Drawers", "CabinetPattern", "LegCapColor", "ShowLegs", "UndertopColor", "ShowUndertop"]),
    );
    expect(keys.filter((key) => !isReadByScene(key))).toEqual(Object.keys(NOT_READ_BY_SCENE));
  });

  it("sends the drawer styles and the patterns the scene's rules take", () => {
    expect(sceneCode).toContain('["2D","1D"]');
    expect(new Set(patchValuesOf("Drawers", "Drawers"))).toEqual(new Set(["2D", "1D"]));

    expect(sceneCode).toContain('["Galles","Gessatto","Oxford","Piquet","Plisse"]');
    expect(patchValuesOf("CabinetPattern", "CabinetPattern")).toEqual([
      "Galles",
      "Gessatto",
      "Oxford",
      "Piquet",
      "Plisse",
    ]);
  });

  it("swaps the basin of the sink cabinet for a sink product the scene registers", () => {
    // "Vessel" is the scene's empty cutout, not a product.
    for (const sink of new Set(patchValuesOf("sinkType", "sinkType"))) {
      if (sink === "Vessel") continue;
      expect(sceneCode, String(sink)).toContain(`registerProduct("${String(sink)}"`);
    }
  });
});
