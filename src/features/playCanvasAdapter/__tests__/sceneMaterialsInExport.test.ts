import { describe, expect, it } from "vitest";

import configurator9 from "@/entities/collection/__tests__/fixtures/remote/configurator-9.json";
import configurator11 from "@/entities/collection/__tests__/fixtures/remote/configurator-11.json";
import configurator12 from "@/entities/collection/__tests__/fixtures/remote/configurator-12.json";
import configurator13 from "@/entities/collection/__tests__/fixtures/remote/configurator-13.json";
import { classRuntimeBindings } from "@/entities/collection/lib/runtimeBindings/__tests__/classRuntimeBindingsFixture";
import { makoRuntimeBindings } from "@/entities/collection/lib/runtimeBindings/__tests__/makoRuntimeBindingsFixture";
import {
  isStateOnlyResolution,
  parseProductProfile,
  parseRuntimeBindings,
  resolveRuntimeBinding,
  selectRuntimeBinding,
} from "@/entities/collection";
import type { RuntimeBindingSet } from "@/entities/collection/model/runtimeBindings";
import type { ConfiguratorAvailableOption } from "@/entities/configurator/api/types";
import { buildConfiguratorOptions } from "@/features/collectionCustomization/lib/buildConfiguratorOptions";
import { resolveConfiguratorOptions } from "@/features/collectionCustomization/lib/resolveSectionState";

import classProfileDocument from "../../../../public/collections/class/product-profile.json";
import makoProfileDocument from "../../../../public/collections/mako/product-profile.json";
import tricotProfileDocument from "../../../../public/collections/tricot/product-profile.json";
import tricotRuntimeBindingsDocument from "../../../../public/collections/tricot/runtime-bindings.json";
import urbanLowHeightRuntimeBindingsDocument from "../../../../public/collections/urban-low-height/runtime-bindings.json";
import urbanDuplexProfileDocument from "../../../../public/collections/urban-duplex/product-profile.json";
import urbanDuplexRuntimeBindingsDocument from "../../../../public/collections/urban-duplex/runtime-bindings.json";
import urbanFreestandingProfileDocument from "../../../../public/collections/urban-freestanding/product-profile.json";
import urbanFreestandingRuntimeBindingsDocument from "../../../../public/collections/urban-freestanding/runtime-bindings.json";
import sceneConfig from "../../../../public/HastingCabinetsParametrization/config.json?raw";

/**
 * Which Mako and Class colours the scene has a material for.
 *
 * The scene looks a material up by its exact name (MaterialService.loadMaterial) and skips the
 * rest of a cabinet's materials once one is missing. Static evidence only: the names come from
 * the scene export and the configurator 9 fixture; how a material looks is the browser's call.
 */

/** Leg colours that name no material: "" hides the legs, "None" paints them in the cabinet colour. */
const NOT_MATERIALS = ["", "None"];

const SCENE_MATERIALS = new Set(
  Object.values((JSON.parse(sceneConfig) as { assets: Record<string, { name: string; type: string }> }).assets)
    .filter(({ type }) => type === "material")
    .map(({ name }) => name),
);

const CONFIGURATOR_SOURCE = "configurator:";

type ProfileDocument = { attributes: { attributeId: string; optionsSource?: string }[] };

/** The colours a collection sends to the scene, with the configurator section that offers them. */
const sceneColours = (profile: ProfileDocument, bindings: RuntimeBindingSet) =>
  profile.attributes.flatMap(({ attributeId, optionsSource }) =>
    optionsSource?.startsWith(CONFIGURATOR_SOURCE) && selectRuntimeBinding(bindings, attributeId)?.status === "bound"
      ? [{ attributeId, section: optionsSource.slice(CONFIGURATOR_SOURCE.length) }]
      : [],
  );

const sectionOf = (proxyName: string) =>
  configurator9.availableOptions.find((group) => group.proxyName === proxyName) as ConfiguratorAvailableOption;

// Every family of configurator 9 is sent under the scene's names (the overrides), none left out.
describe.each([
  { collection: "mako", profile: makoProfileDocument as ProfileDocument, bindings: makoRuntimeBindings },
  { collection: "class", profile: classProfileDocument as ProfileDocument, bindings: classRuntimeBindings },
])("$collection colours in the scene export", ({ profile, bindings }) => {
  const colours = sceneColours(profile, bindings);

  it("sends every offered colour under a scene material name", () => {
    // The colour keys carry the attribute's own name in the scene.
    const sentName = (attributeId: string, value: string) => {
      const resolution = resolveRuntimeBinding(bindings, attributeId, value);
      return resolution.ok && !isStateOnlyResolution(resolution) ? resolution.patch[attributeId] : undefined;
    };

    const missing = colours.flatMap(({ attributeId, section }) =>
      buildConfiguratorOptions(sectionOf(section)).flatMap(({ value }) => {
        const name = String(sentName(attributeId, value));
        return SCENE_MATERIALS.has(name) ? [] : [`${attributeId}: ${value} -> ${name}`];
      }),
    );

    expect(colours.length).toBeGreaterThan(0);
    expect(missing).toEqual([]);
  });

  it("translates colours only into scene material names", () => {
    const names = colours.flatMap(({ attributeId }) => {
      const binding = selectRuntimeBinding(bindings, attributeId);
      if (binding?.status !== "bound") return [];

      return binding.values.kind === "identity"
        ? Object.values(binding.values.overrides ?? {})
        : Object.values(binding.values.patches)
            .map((patch) => patch[attributeId])
            .filter((name) => !NOT_MATERIALS.includes(String(name)));
    });

    expect(names.length).toBeGreaterThan(0);
    expect(names.filter((name) => !SCENE_MATERIALS.has(String(name)))).toEqual([]);
  });
});

/**
 * Every colour a collection's own configurator offers, as its bindings send it: Urban Duplex's panel
 * colours under their scene keys (CabinetColor, CabinetColorLateral, the groove and the side shelf's
 * CabinetColor), Tricot's lacquers and Urban Freestanding's grooves, with the countertop, vessel and
 * towel bar colours of each. Unlike Mako and Class no family is left out, so a configurator name the
 * scene spells differently (Sahara Noir Silky Matte TR8, Tricot's capitals, the lacquers Urban
 * Freestanding shares with Tricot) needs an override. Values a binding declares pending
 * (`unboundValues`, Tricot's woods) are not sent and are left to its own tests.
 */
describe.each([
  {
    collection: "urban-duplex",
    profileDocument: urbanDuplexProfileDocument,
    bindingsDocument: urbanDuplexRuntimeBindingsDocument,
    configuratorGroups: configurator13.availableOptions,
    attributeIds: ["BasePanelColor", "LateralPanelColor", "CountertopColor", "VesselColor", "TowelBarColor"],
    countertopOverrides: {
      "Sahara Noir Silky Matte TR8": "Sahara Noir Silky Matte",
      "Matte White": "Solid Surface Matte White",
    },
  },
  {
    collection: "tricot",
    profileDocument: tricotProfileDocument,
    bindingsDocument: tricotRuntimeBindingsDocument,
    configuratorGroups: configurator12.availableOptions,
    attributeIds: ["CabinetColor", "HandleGrooveColor", "CountertopColor", "VesselColor"],
    countertopOverrides: {
      "BIANCO KOS 250": "Bianco Kos 250",
      "ARDESIA NERA 328": "Ardesia Nera 328",
      "Matte White": "Solid Surface Matte White",
      "Matte White 8cm": "Solid Surface Matte White 8cm",
    },
  },
  {
    collection: "urban-freestanding",
    profileDocument: urbanFreestandingProfileDocument,
    bindingsDocument: urbanFreestandingRuntimeBindingsDocument,
    configuratorGroups: configurator11.availableOptions,
    attributeIds: ["CabinetColor", "HandleGrooveColor", "CountertopColor", "VesselColor", "TowelBarColor"],
    countertopOverrides: {
      "Sahara Noir Silky Matte TR8": "Sahara Noir Silky Matte",
      "Matte White": "Solid Surface Matte White",
    },
  },
])(
  "$collection colours of its configurator in the scene export",
  ({ profileDocument, bindingsDocument, configuratorGroups, attributeIds, countertopOverrides }) => {
    const parsedProfile = parseProductProfile(profileDocument);
    const parsedBindings = parseRuntimeBindings(bindingsDocument);
    if (!parsedProfile.ok || !parsedBindings.ok) throw new Error("The profile or the bindings failed validation");
    const profile = parsedProfile.profile;
    const bindings = parsedBindings.bindings;
    const groups = configuratorGroups as ConfiguratorAvailableOption[];
    const configurator = { groups, groupsByName: Object.fromEntries(groups.map((group) => [group.proxyName, group])) };
    const colours = sceneColours(profileDocument as ProfileDocument, bindings);

    const isPending = (attributeId: string, value: string) => {
      const binding = selectRuntimeBinding(bindings, attributeId);
      return binding?.status === "bound" && binding.values.kind === "map"
        ? Object.hasOwn(binding.values.unboundValues ?? {}, value)
        : false;
    };

    it("sends every offered colour under a scene material name", () => {
      const missing = colours.flatMap(({ attributeId }) =>
        resolveConfiguratorOptions(profile, attributeId, configurator).flatMap(({ value }) => {
          if (isPending(attributeId, value)) return [];
          const resolution = resolveRuntimeBinding(bindings, attributeId, value);
          if (!resolution.ok || isStateOnlyResolution(resolution)) return [`${attributeId}: ${value} is not sent`];

          return [resolution.patch, ...(resolution.also ?? []).map(({ patch }) => patch)]
            .flatMap((patch) => Object.entries(patch))
            .filter(([, name]) => !SCENE_MATERIALS.has(String(name)) && !NOT_MATERIALS.includes(String(name)))
            .map(([sceneKey, name]) => `${attributeId}: ${value} -> ${sceneKey} ${String(name)}`);
        }),
      );

      expect(colours.map(({ attributeId }) => attributeId)).toEqual(attributeIds);
      expect(missing).toEqual([]);
    });

    it("translates colours only into scene material names", () => {
      const binding = selectRuntimeBinding(bindings, "CountertopColor");
      const names = binding?.status === "bound" && binding.values.kind === "identity" ? binding.values.overrides : {};

      expect(names).toMatchObject(countertopOverrides);
      expect(Object.values(names ?? {}).filter((name) => !SCENE_MATERIALS.has(String(name)))).toEqual([]);
    });
  },
);

/**
 * Urban Low Height reads configurator 4, which the fixtures keep only in part, so the colours the
 * scene spells differently are named here: the porcelain Sahara Noir Silky Matte has no TR8 in the
 * export. Every other colour of configurator 4 matched an export material by its own name (v63).
 */
describe("urban-low-height colours the scene spells differently", () => {
  const parsedBindings = parseRuntimeBindings(urbanLowHeightRuntimeBindingsDocument);
  if (!parsedBindings.ok) throw new Error("Urban Low Height bindings failed validation");
  const bindings = parsedBindings.bindings;

  it("sends them under the scene's material names", () => {
    const resolution = resolveRuntimeBinding(bindings, "CountertopColor", "Sahara Noir Silky Matte TR8");
    if (!resolution.ok || isStateOnlyResolution(resolution)) throw new Error("The countertop colour is not sent");

    expect(resolution.patch).toEqual({ CountertopColor: "Sahara Noir Silky Matte" });
    expect(SCENE_MATERIALS.has("Sahara Noir Silky Matte TR8")).toBe(false);
    for (const binding of bindings.bindings) {
      if (binding.status !== "bound" || binding.values.kind !== "identity") continue;
      const missing = Object.values(binding.values.overrides ?? {}).filter(
        (name) => !SCENE_MATERIALS.has(String(name)),
      );
      expect(missing, binding.attributeId).toEqual([]);
    }
  });
});
