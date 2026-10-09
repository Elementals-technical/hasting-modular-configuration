import { beforeEach, describe, expect, it } from "vitest";

import { store } from "@/app/store";
import {
  tricotConfigurator,
  tricotProfile,
  tricotRuntimeBindings,
} from "@/entities/collection/__tests__/tricotFixtures";
import { ushProfile } from "@/entities/collection/__tests__/ushProfileFixture";
import { ushRuntimeBindings } from "@/entities/collection/lib/runtimeBindings/__tests__/ushRuntimeBindingsFixture";
import type { ConfiguratorGroupCatalog } from "@/entities/collection/model/types";
import { resetConfiguration, setActiveCollectionId, setActiveRuntimeBindings } from "@/entities/configuration";
import { reset, setActiveProfile } from "@/entities/product/model/store/slice";

import { evaluateChange } from "../lib/evaluateChange";

/**
 * A command may carry a value read back from the scene, where it is the material asset. The change is
 * made in the configuration's value, which the bindings know; a value the collection offers is kept.
 */

const plannedValue = (evaluation: ReturnType<typeof evaluateChange>, attributeId: string) =>
  evaluation.kind === "planned" ? evaluation.plan.find((change) => change.attributeId === attributeId)?.value : null;

describe("changes requested in the scene's spelling", () => {
  beforeEach(() => {
    store.dispatch(reset());
    store.dispatch(resetConfiguration());
  });

  it("changes Tricot's groove to the catalog colour its material asset stands for", () => {
    store.dispatch(setActiveProfile(tricotProfile));
    store.dispatch(setActiveCollectionId("tricot"));
    store.dispatch(setActiveRuntimeBindings(tricotRuntimeBindings));

    const evaluation = evaluateChange(
      { attributeId: "HandleGrooveColor", scope: "global", value: "Nero 433 Lacquered MT" },
      store.getState(),
      tricotConfigurator,
    );

    expect(plannedValue(evaluation, "HandleGrooveColor")).toBe("Nero 433 MT");
  });

  it("keeps a colour the configurator offers even when another one is sent under its name", () => {
    store.dispatch(setActiveProfile(ushProfile));
    store.dispatch(setActiveCollectionId("urban-standard-height"));
    store.dispatch(setActiveRuntimeBindings(ushRuntimeBindings));
    const variant = (id: number, name: string) => ({
      id,
      name,
      image: null,
      enabled: true,
      description: "",
      metadata: { sku: "SSTKR", Material: "Tekorlux" },
    });
    const group = {
      id: 1,
      proxyName: "Countertop Color",
      proxyType: "material",
      enabled: true,
      metadata: {},
      options: [
        {
          id: 2,
          name: "Tekorlux",
          resource: null,
          paramString: null,
          playcanvasString: null,
          // The scene shows the Syntesi Bianco Gloss TAN in the Tekorlux Bianco Gloss TAL material.
          variants: [variant(3, "Bianco Gloss TAL"), variant(4, "Bianco Gloss TAN")],
        },
      ],
    };
    const configurator: ConfiguratorGroupCatalog = { groups: [group], groupsByName: { "Countertop Color": group } };

    const evaluation = evaluateChange(
      { attributeId: "CountertopColor", scope: "countertop", value: "Bianco Gloss TAL" },
      store.getState(),
      configurator,
    );

    expect(plannedValue(evaluation, "CountertopColor")).toBe("Bianco Gloss TAL");
  });
});
