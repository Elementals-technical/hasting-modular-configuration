import { beforeEach, describe, expect, it } from "vitest";

import { store } from "@/app/store";
import { ushProfile } from "@/entities/collection/__tests__/ushProfileFixture";
import type { ProductProfile } from "@/entities/collection";
import { resetConfiguration, setActiveCollectionId, syncCabinets } from "@/entities/configuration";
import type { ProductDatatable } from "@/entities/product/api";
import { buildCabinetCatalogFromMatrix } from "@/entities/product/lib/matrixCabinet";
import {
  reset,
  setActiveCabinetType,
  setActiveProfile,
  setCabinetCatalog,
  setHandleGrooveColor,
  setSelectedProductConfig,
} from "@/entities/product/model/store/slice";
import { createTestRuntimePort } from "@/features/playCanvasAdapter";
import type { TestRuntimePort } from "@/features/playCanvasAdapter";

import { changeAttribute } from "../lib/changeAttribute";
import type { ChangeAttributeDeps } from "../lib/changeAttribute";
import { confirmAttributeChange } from "../lib/confirmAttributeChange";
import type { AttributeChange, ChangePreview, ChangeResult } from "../model/types";

/**
 * C05: preview, confirm, cancel. Nothing changes before Confirm, Cancel never reaches
 * the scene, a changed state re-checks the plan, and an error from I is not a success.
 */

const matrix = {
  rows: [
    {
      cabinet_type: "Sink-Base",
      widths_cm: "60|80",
      depths_cm: "46",
      heights_cm: "50|53|56",
      drawer_configs: "1D|2D",
      handles_allowed: "handle_pto|handle_urban_topcut|handle_urban_botcut",
      supports_height: "50|53|56",
      handle_pto_forced_height_cm: "1D:50|2D:50",
      handle_urban_topcut_forced_height_cm: "1D:53|2D:56",
      handle_urban_botcut_forced_height_cm: "2D:56",
      handle_urban_botcut_requires_drawers: "2D",
    },
  ],
} as unknown as ProductDatatable;

const HANDLE_TO_PTO: AttributeChange = {
  attributeId: "Handle",
  value: "handle_pto",
  scope: "cabinet",
  cabinetId: "cab-1",
};

const setUpScene = () => {
  store.dispatch(reset());
  store.dispatch(resetConfiguration());
  store.dispatch(setActiveProfile(ushProfile));
  store.dispatch(setActiveCollectionId("urban-standard-height"));
  store.dispatch(setCabinetCatalog(buildCabinetCatalogFromMatrix(matrix, ushProfile)));
  store.dispatch(setActiveCabinetType("Sink-Base"));
  store.dispatch(setSelectedProductConfig({ Drawers: "1D", Handle: "handle_urban_topcut" }));
  store.dispatch(syncCabinets(["runtime-a", "runtime-b"]));
};

/** Deps that record what the command service writes, apart from the test's own setup. */
const createDeps = (runtime: TestRuntimePort) => {
  const dispatched: string[] = [];
  const deps: ChangeAttributeDeps = {
    getState: () => store.getState(),
    dispatch: (action) => {
      dispatched.push(action.type);
      return store.dispatch(action);
    },
    runtime: runtime.port,
    flow: "custom",
  };
  return { deps, dispatched };
};

const currentHandle = () => store.getState().rootStateUI.product.selectedProductConfig?.Handle;

const previewOf = (result: ChangeResult): ChangePreview => {
  if (result.status !== "confirmation-required") throw new Error(`expected a preview, got ${result.status}`);
  return result.preview;
};

describe("preview", () => {
  beforeEach(setUpScene);

  it("holds a handle change for confirmation while cabinets are placed, and cancelling needs no call", async () => {
    const runtime = createTestRuntimePort();
    const { deps, dispatched } = createDeps(runtime);

    const result = await changeAttribute(HANDLE_TO_PTO, deps);

    expect(result).toMatchObject({
      status: "confirmation-required",
      replaced: false,
      preview: {
        change: HANDLE_TO_PTO,
        reasons: [
          {
            attributeId: "Handle",
            reasonCode: "handle.appliesToAllCabinets",
            reason: "The handle style will be updated for all drawer cabinets.",
          },
          { attributeId: "Height", reasonCode: "handle.requiredHeight" },
        ],
      },
    });
    expect(previewOf(result).plan.map(({ attributeId }) => attributeId)).toEqual(["Handle", "Height"]);

    // Cancel is dropping the preview: nothing was written and the scene heard nothing.
    expect(dispatched).toEqual([]);
    expect(runtime.calls).toHaveLength(0);
    expect(currentHandle()).toBe("handle_urban_topcut");
  });

  it("applies at once when the attribute declares no confirmation", async () => {
    const runtime = createTestRuntimePort();
    const { deps } = createDeps(runtime);

    const result = await changeAttribute(
      { attributeId: "Drawers", value: "2", scope: "cabinet", cabinetId: "cab-1" },
      deps,
    );

    expect(result.status).toBe("applied");
    expect(runtime.calls).toHaveLength(1);
  });

  it("asks only because the profile says so", async () => {
    const withoutConfirmation: ProductProfile = {
      ...ushProfile,
      attributes: ushProfile.attributes.map((attribute) =>
        attribute.attributeId === "Handle" ? { ...attribute, confirmation: undefined } : attribute,
      ),
    };
    store.dispatch(setActiveProfile(withoutConfirmation));
    const runtime = createTestRuntimePort();

    const result = await changeAttribute(HANDLE_TO_PTO, createDeps(runtime).deps);

    expect(result.status).toBe("applied");
    expect(runtime.calls).toHaveLength(1);
  });

  it("never previews a change the rules block", async () => {
    const runtime = createTestRuntimePort();

    const result = await changeAttribute(
      { attributeId: "Handle", value: "handle_urban_botcut", scope: "cabinet", cabinetId: "cab-1" },
      createDeps(runtime).deps,
    );

    expect(result).toMatchObject({ status: "blocked", attributeId: "Handle" });
    expect(runtime.calls).toHaveLength(0);
  });
});

describe("confirm", () => {
  beforeEach(setUpScene);

  it("applies exactly the previewed set when nothing changed", async () => {
    const runtime = createTestRuntimePort();
    const { deps } = createDeps(runtime);
    const preview = previewOf(await changeAttribute(HANDLE_TO_PTO, deps));

    const result = await confirmAttributeChange(preview, deps);

    expect(result).toEqual({ status: "applied", plan: preview.plan });
    expect(runtime.calls).toEqual([preview.plan]);
    expect(currentHandle()).toBe("handle_pto");
  });

  it("shows a set that changed since the preview again instead of applying the stale one", async () => {
    const runtime = createTestRuntimePort();
    const { deps } = createDeps(runtime);
    const preview = previewOf(await changeAttribute(HANDLE_TO_PTO, deps));

    // While the dialog is open, a groove colour is set: leaving the groove handle now clears it.
    store.dispatch(setHandleGrooveColor("Pulpis Chiaro TKH"));

    const result = await confirmAttributeChange(preview, deps);

    expect(result).toMatchObject({ status: "confirmation-required", replaced: true });
    expect(previewOf(result).plan.map(({ attributeId }) => attributeId)).toEqual([
      "Handle",
      "Height",
      "HandleGrooveColor",
    ]);
    expect(runtime.calls).toHaveLength(0);
    expect(currentHandle()).toBe("handle_urban_topcut");
  });

  it("blocks a change that became disallowed before confirmation", async () => {
    store.dispatch(setSelectedProductConfig({ Drawers: "2D", Handle: "handle_urban_topcut" }));
    const runtime = createTestRuntimePort();
    const { deps } = createDeps(runtime);
    const preview = previewOf(
      await changeAttribute(
        { attributeId: "Handle", value: "handle_urban_botcut", scope: "cabinet", cabinetId: "cab-1" },
        deps,
      ),
    );

    // The central groove needs two drawers; the drawers go back to one before Confirm.
    store.dispatch(setSelectedProductConfig({ Drawers: "1D", Handle: "handle_urban_topcut" }));

    const result = await confirmAttributeChange(preview, deps);

    expect(result).toMatchObject({ status: "blocked", attributeId: "Handle" });
    expect(runtime.calls).toHaveLength(0);
  });

  it("does not turn an error from I into a success", async () => {
    const runtime = createTestRuntimePort();
    const { deps, dispatched } = createDeps(runtime);
    const preview = previewOf(await changeAttribute(HANDLE_TO_PTO, deps));

    runtime.setReady(false);
    const result = await confirmAttributeChange(preview, deps);

    expect(result).toMatchObject({ status: "error", code: "runtime-not-ready" });
    expect(dispatched).toEqual([]);
    expect(currentHandle()).toBe("handle_urban_topcut");
  });

  it("records only what I applied when the confirmed set partly fails", async () => {
    const runtime = createTestRuntimePort();
    const { deps, dispatched } = createDeps(runtime);
    const preview = previewOf(await changeAttribute(HANDLE_TO_PTO, deps));

    runtime.failNext((change) => change.attributeId === "Height", "scene refused the height");
    const result = await confirmAttributeChange(preview, deps);

    expect(result).toMatchObject({
      status: "partial",
      needsSync: true,
      failed: [{ change: { attributeId: "Height" } }],
    });
    expect(dispatched).not.toContain("product/setSelectedDimensions");
    expect(currentHandle()).toBe("handle_pto");
  });
});
