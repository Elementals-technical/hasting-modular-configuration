import { describe, expect, it, vi } from "vitest";

import { presetsSchema } from "@/entities/collection/model/schemas";

import { applyCompactPresetWithBridge, toCompactPreset } from "../applyCompactPreset";

const compactEntry = {
  format: "ulh-compact-v1",
  collection: "ULH",
  shared: { Color: "White" },
  rows: [{ products: [{ name: "ULH-sink-cabinet", Width: 60 }] }],
};

describe("compact preset review risks", () => {
  // C1: src/pages/prebuilt/model/ModelPage.tsx (~:934-975) — the first-load `?preset=<id>` init effect
  // always calls composition.applyPreset(presetProducts); no exported unit exists to test the branch in isolation.
  it.todo("C1: first-load ?preset= with rows goes through importCompactPreset");

  it("C2: applyCompactPresetWithBridge rethrows importCompactPreset rejection and still disposes the client", async () => {
    const dispose = vi.fn();
    const client = {
      connect: vi.fn().mockResolvedValue(undefined),
      importCompactPreset: vi.fn().mockRejectedValue(new Error("import failed")),
      dispose,
    };
    await expect(applyCompactPresetWithBridge(compactEntry, () => client as never)).rejects.toThrow("import failed");
    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it.todo("C2: ModelPage compact branch falls back to flat presetProducts on error");

  it("C2b: toCompactPreset ignores globalConfig/user overrides (only preset.shared is sent)", () => {
    const withOverrides = { ...compactEntry, globalConfig: { Color: "Black" } } as typeof compactEntry;
    const doc = toCompactPreset(withOverrides);
    expect(doc.shared).toEqual({ Color: "White" });
    expect(doc).not.toHaveProperty("globalConfig");
  });

  it.todo("C2: user overrides are merged into shared");

  it.fails("C4: format must be ulh-compact-v1", () => {
    const result = presetsSchema.safeParse([
      {
        id: 1,
        img: "x.png",
        title: "Preset",
        isProductModel: false,
        presetProducts: [],
        size: "24_29",
        style: [],
        format: "something-else",
        rows: [{ products: [] }],
      },
    ]);
    expect(result.success).toBe(false);
  });
});
