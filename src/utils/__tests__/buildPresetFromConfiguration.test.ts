import { describe, expect, it } from "vitest";

import tricotProfileDocument from "../../../public/collections/tricot/product-profile.json";
import tricotBindingsDocument from "../../../public/collections/tricot/runtime-bindings.json";
import ufProfileDocument from "../../../public/collections/urban-freestanding/product-profile.json";
import ufBindingsDocument from "../../../public/collections/urban-freestanding/runtime-bindings.json";
import { parseProductProfile, parseRuntimeBindings } from "@/entities/collection";
import { makoProfile } from "@/entities/collection/__tests__/makoProfileFixture";
import { ushProfile } from "@/entities/collection/__tests__/ushProfileFixture";
import { makoRuntimeBindings } from "@/entities/collection/lib/runtimeBindings/__tests__/makoRuntimeBindingsFixture";
import { ushRuntimeBindings } from "@/entities/collection/lib/runtimeBindings/__tests__/ushRuntimeBindingsFixture";

import { buildPresetFromConfiguration } from "../buildPresetFromConfiguration";

const parsed = (profileDocument: unknown, bindingsDocument: unknown) => {
  const profile = parseProductProfile(profileDocument);
  const bindings = parseRuntimeBindings(bindingsDocument);
  if (!profile.ok || !bindings.ok) throw new Error("the packaged collection data must parse");
  return { profile: profile.profile, bindings: bindings.bindings };
};

/**
 * Scene configs as the scene returns them (`getConfig`): it names a product after its scene type and
 * a colour after its scene material. A preset holds them as the configuration does.
 */
describe("buildPresetFromConfiguration", () => {
  it("names a Mako product by its cabinet type and its colours as the configuration does", () => {
    const [preset] = buildPresetFromConfiguration(
      {
        "Mako-sink-cabinet-cer8ck0hy": {
          Width: 60,
          Height: 52,
          Depth: 52,
          Drawers: "2D",
          CabinetColor: "Agata 407 Lacquered MT",
          CountertopColor: "Solid Surface Matte White",
          ProductType: "Mako-sink-cabinet",
        },
      },
      makoProfile,
      makoRuntimeBindings,
    );

    expect(preset).toMatchObject({
      name: "Sink-Base",
      CabinetColor: "Agata 407 MT",
      CountertopColor: "Matte White",
      Width: 60,
      Drawers: "2D",
    });
  });

  it("reads the handle groove colour of Tricot and Urban Freestanding as the configuration does", () => {
    const tricot = parsed(tricotProfileDocument, tricotBindingsDocument);
    const uf = parsed(ufProfileDocument, ufBindingsDocument);

    const [tricotPreset] = buildPresetFromConfiguration(
      {
        "Tricot-side-cabinet-ln6r43p1a": {
          Drawers: "1D",
          HandleGrooveColor: "Ambra 413 Lacquered MT",
          ProductType: "Tricot-side-cabinet",
        },
      },
      tricot.profile,
      tricot.bindings,
    );
    const [ufPreset] = buildPresetFromConfiguration(
      {
        "UF-side-cabinet-luo19p92f": {
          Drawers: "2D",
          HandleGrooveColor: "Acqua 419 Lacquered MT",
          ProductType: "UF-side-cabinet",
        },
      },
      uf.profile,
      uf.bindings,
    );

    expect(tricotPreset).toMatchObject({ name: "Side-Cabinet", HandleGrooveColor: "Ambra 413 MT" });
    expect(ufPreset).toMatchObject({ name: "Sink-Cabinet", HandleGrooveColor: "Acqua 419 MT" });
  });

  it("keeps the values of a collection whose scene names them as the configuration does", () => {
    const [preset] = buildPresetFromConfiguration(
      {
        "Sink-Base-i5e52imdq": {
          Drawers: "1D",
          CabinetColor: "Cemento Cenere 1A1",
          HandleGrooveColor: "Castagno chiaro 1C1",
          ProductType: "Sink-Base",
        },
      },
      ushProfile,
      ushRuntimeBindings,
    );

    expect(preset).toMatchObject({
      name: "Sink-Base",
      CabinetColor: "Cemento Cenere 1A1",
      HandleGrooveColor: "Castagno chiaro 1C1",
    });
  });
});
