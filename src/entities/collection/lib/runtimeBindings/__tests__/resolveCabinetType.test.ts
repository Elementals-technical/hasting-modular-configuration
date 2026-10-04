import { describe, expect, it } from "vitest";

import { resolveCabinetTypeOfRuntimeId } from "../resolveCabinetType";

import { makoProfile } from "../../../__tests__/makoProfileFixture";
import { ushProfile } from "../../../__tests__/ushProfileFixture";
import { makoRuntimeBindings } from "./makoRuntimeBindingsFixture";
import { ushRuntimeBindings } from "./ushRuntimeBindingsFixture";

describe("resolveCabinetTypeOfRuntimeId", () => {
  it("reads a Mako cabinet from the Mako product the scene placed", () => {
    expect(resolveCabinetTypeOfRuntimeId(makoProfile, makoRuntimeBindings, "Mako-sink-cabinet-k3j4h5g6f")).toBe(
      "Sink-Base",
    );
    expect(resolveCabinetTypeOfRuntimeId(makoProfile, makoRuntimeBindings, "Mako-side-cabinet-abcdefghi")).toBe(
      "Sink-Cabinet",
    );
  });

  it("prefers the Urban cabinet type named like the scene product it shares", () => {
    // Side-Cabinet is placed as Sink-Cabinet too.
    expect(resolveCabinetTypeOfRuntimeId(ushProfile, ushRuntimeBindings, "Sink-Cabinet-k3j4h5g6f")).toBe(
      "Sink-Cabinet",
    );
    expect(resolveCabinetTypeOfRuntimeId(ushProfile, ushRuntimeBindings, "Sink-Base-k3j4h5g6f")).toBe("Sink-Base");
  });

  it("falls back to the cabinet type an id starts with", () => {
    expect(resolveCabinetTypeOfRuntimeId(makoProfile, makoRuntimeBindings, "Sink-Base-ccc333")).toBe("Sink-Base");
    expect(resolveCabinetTypeOfRuntimeId(makoProfile, null, "Sink-Cabinet-ddd444")).toBe("Sink-Cabinet");
    expect(resolveCabinetTypeOfRuntimeId(makoProfile, makoRuntimeBindings, "cab-a")).toBeNull();
  });
});
