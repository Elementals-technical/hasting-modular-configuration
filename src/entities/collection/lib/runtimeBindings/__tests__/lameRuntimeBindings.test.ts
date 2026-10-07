import { describe, expect, it } from "vitest";

import lameProfileDocument from "../../../../../../public/collections/lame/product-profile.json";
import lameRuntimeBindingsDocument from "../../../../../../public/collections/lame/runtime-bindings.json";
import lameUiDocument from "../../../../../../public/collections/lame/ui.json";
import { CORE_ATTRIBUTE_IDS } from "@/entities/configuration/model/ownership";

import { parseProductProfile } from "../../parseProductProfile";
import { parseRuntimeBindings } from "../parseRuntimeBindings";
import { isStateOnlyResolution, resolveRuntimeBinding } from "../resolveRuntimeBinding";
import { validateRuntimeBindings } from "../validateRuntimeBindings";

/**
 * The scene registers no Lame product yet: both cabinet types wait in unplacedProductTypes, the
 * cabinet's own values are recorded for the rules and the price, and the countertop and the sizes
 * are bound as the Mako scene takes them.
 */

const parsedProfile = parseProductProfile(lameProfileDocument);
const parsedBindings = parseRuntimeBindings(lameRuntimeBindingsDocument);

const lameProfile = () => {
  if (!parsedProfile.ok) throw new Error(`profile failed validation: ${JSON.stringify(parsedProfile.diagnostics)}`);
  return parsedProfile.profile;
};

const lameRuntimeBindings = () => {
  if (!parsedBindings.ok) throw new Error(`bindings failed validation: ${JSON.stringify(parsedBindings.diagnostics)}`);
  return parsedBindings.bindings;
};

const UI_FIELD_IDS = Object.values(lameUiDocument.sections).flatMap(({ fields }) =>
  fields.map(({ attributeId }) => attributeId),
);

// What the loader requires: the C01 registry, the fields of ui.json and the dimensions.
const REQUIRED_ATTRIBUTE_IDS = [...new Set([...CORE_ATTRIBUTE_IDS, ...UI_FIELD_IDS, "Height", "Width", "Depth"])];

/** The values a model shares with every cabinet of it; one without a translation rejects the model. */
const SHARED_PRESET_VALUES = [
  "CabinetColor",
  "HandleGrooveColor",
  "CountertopColor",
  "sinkType",
  "CountertopStyle",
  "VesselColor",
  "Thickness",
];

/** A value of each attribute a mapped binding translates; any other attribute takes any value. */
const MAPPED_VALUE: Record<string, string> = { CountertopStyle: "integrated" };

const resolve = (attributeId: string, value: string | number) =>
  resolveRuntimeBinding(lameRuntimeBindings(), attributeId, value);

const patchOf = (attributeId: string, value: string | number) => {
  const resolution = resolve(attributeId, value);
  return resolution.ok && !isStateOnlyResolution(resolution) ? resolution.patch : null;
};

describe("lame runtime bindings", () => {
  it("cover the profile and every required attribute without a finding", () => {
    expect(validateRuntimeBindings(lameProfile(), lameRuntimeBindings(), REQUIRED_ATTRIBUTE_IDS)).toEqual([]);
  });

  it("place no cabinet type until the scene has a Lame product", () => {
    expect(lameRuntimeBindings().productTypes).toEqual({});
    expect(Object.keys(lameRuntimeBindings().unplacedProductTypes ?? {})).toEqual(["Sink-Base", "Sink-Cabinet"]);
  });

  it("let every shared value of a model and every field but the cabinet type through", () => {
    for (const attributeId of [...SHARED_PRESET_VALUES, ...UI_FIELD_IDS.filter((id) => id !== "CabinetType")]) {
      expect(resolve(attributeId, MAPPED_VALUE[attributeId] ?? "x").ok, attributeId).toBe(true);
    }
  });

  it("record the cabinet's own values without a scene call", () => {
    for (const [attributeId, value] of [
      ["Drawers", "2"],
      ["Handle", "G58"],
      ["HandleColor", "Antracite 400 MT"],
      ["CabinetColor", "Antracite 400 MT"],
      ["CabinetPattern", "Oxford"],
      ["LegColor", "Gold"],
      ["sinkType", "LB440"],
    ]) {
      expect(isStateOnlyResolution(resolve(attributeId, value)), attributeId).toBe(true);
    }
  });

  it("send the sizes and the countertop as the Mako scene takes them", () => {
    expect(patchOf("Height", 26)).toEqual({ Height: 26 });
    expect(patchOf("Height", 52)).toEqual({ Height: 52 });
    expect(patchOf("Width", 80)).toEqual({ Width: 80 });
    expect(patchOf("Depth", 52)).toEqual({ Depth: 52 });
    expect(patchOf("CountertopStyle", "vessel")).toEqual({ CountertopStyle: "Vessel" });
    expect(patchOf("CountertopColor", "Antracite 400 MT")).toEqual({ CountertopColor: "Antracite 400 Glass MT" });
  });
});
