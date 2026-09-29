import { describe, expect, it } from "vitest";

import configurator9 from "@/entities/collection/__tests__/fixtures/remote/configurator-9.json";
import { classRuntimeBindings } from "@/entities/collection/lib/runtimeBindings/__tests__/classRuntimeBindingsFixture";
import { makoRuntimeBindings } from "@/entities/collection/lib/runtimeBindings/__tests__/makoRuntimeBindingsFixture";
import { isStateOnlyResolution, resolveRuntimeBinding, selectRuntimeBinding } from "@/entities/collection";
import type { RuntimeBindingSet } from "@/entities/collection/model/runtimeBindings";
import type { ConfiguratorAvailableOption } from "@/entities/configurator/api/types";
import { buildConfiguratorOptions } from "@/features/collectionCustomization/lib/buildConfiguratorOptions";

import classProfileDocument from "../../../../public/collections/class/product-profile.json";
import makoProfileDocument from "../../../../public/collections/mako/product-profile.json";
import sceneConfig from "../../../../public/HastingCabinetsParametrization/config.json?raw";

/**
 * Which Mako and Class colours the scene has a material for.
 *
 * The scene looks a material up by its exact name (MaterialService.loadMaterial) and skips the
 * rest of a cabinet's materials once one is missing. Static evidence only: the names come from
 * the scene export and the configurator 9 fixture; how a material looks is the browser's call.
 */

/** Families of configurator 9 the scene has no materials for yet. */
const NOT_IN_SCENE = ["Porcelain", "Laminate", "HPL", "Solid Surface"];

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
      buildConfiguratorOptions(sectionOf(section))
        .filter(({ traits }) => !traits?.materials?.some((material) => NOT_IN_SCENE.includes(material)))
        .flatMap(({ value }) => {
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
