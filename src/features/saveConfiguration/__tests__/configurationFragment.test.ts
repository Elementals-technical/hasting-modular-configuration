import { beforeEach, describe, expect, it } from "vitest";

import { store } from "@/app/store";
import {
  formatTarget,
  resetConfiguration,
  setActiveCollectionId,
  setAttributeValue,
  syncCabinets,
} from "@/entities/configuration";
import { reset } from "@/entities/product/model/store/slice";

import {
  CONFIGURATION_FRAGMENT_VERSION,
  listFragmentAttributeIds,
  readFragmentValue,
} from "../lib/configurationFragment";
import { buildConfigurationMetadata } from "../lib/buildConfigurationMetadata";
import { readConfigurationFragment, readSavedCollectionId } from "../lib/legacyMetadata";
import { selectConfigurationSavePayload } from "../lib/selectSavePayload";

const emptySwatchOrder = {
  selectedMaterials: [],
  manualSelectedMaterials: [],
  isAutofillEnabled: false,
  hasSubmittedCart: false,
};

const setUpConfiguration = () => {
  store.dispatch(reset());
  store.dispatch(resetConfiguration());
  store.dispatch(setActiveCollectionId("urban-standard-height"));
  store.dispatch(syncCabinets(["runtime-a", "runtime-b"]));
};

describe("buildConfigurationFragment", () => {
  beforeEach(setUpConfiguration);

  it("records the collection, the order and the version", () => {
    const { fragment } = selectConfigurationSavePayload(store.getState());

    expect(fragment.version).toBe(CONFIGURATION_FRAGMENT_VERSION);
    expect(fragment.collectionId).toBe("urban-standard-height");
    expect(fragment.cabinets).toEqual([
      { stableKey: "cab-1", index: 0 },
      { stableKey: "cab-2", index: 1 },
    ]);
  });

  it("keeps values of two products apart", () => {
    store.dispatch(
      setAttributeValue({ attributeId: "Handle", target: { scope: "cabinet", cabinetId: "cab-1" }, value: "a" }),
    );
    store.dispatch(
      setAttributeValue({ attributeId: "Handle", target: { scope: "cabinet", cabinetId: "cab-2" }, value: "b" }),
    );

    const { fragment } = selectConfigurationSavePayload(store.getState());

    expect(readFragmentValue(fragment, "Handle", { scope: "cabinet", cabinetId: "cab-1" })).toBe("a");
    expect(readFragmentValue(fragment, "Handle", { scope: "cabinet", cabinetId: "cab-2" })).toBe("b");
  });

  it("keeps drawer-scoped values apart within one product", () => {
    store.dispatch(
      setAttributeValue({
        attributeId: "DividersStyle",
        target: { scope: "drawer", cabinetId: "cab-1", drawerType: "Top" },
        value: "Option A",
      }),
    );
    store.dispatch(
      setAttributeValue({
        attributeId: "DividersStyle",
        target: { scope: "drawer", cabinetId: "cab-1", drawerType: "Bot" },
        value: "Option B",
      }),
    );

    const { fragment } = selectConfigurationSavePayload(store.getState());

    expect(fragment.values[formatTarget({ scope: "drawer", cabinetId: "cab-1", drawerType: "Top" })]).toEqual({
      DividersStyle: "Option A",
    });
    expect(fragment.values[formatTarget({ scope: "drawer", cabinetId: "cab-1", drawerType: "Bot" })]).toEqual({
      DividersStyle: "Option B",
    });
  });

  it("groups several attributes under one target", () => {
    store.dispatch(
      setAttributeValue({ attributeId: "Handle", target: { scope: "cabinet", cabinetId: "cab-1" }, value: "a" }),
    );
    store.dispatch(
      setAttributeValue({ attributeId: "Drawers", target: { scope: "cabinet", cabinetId: "cab-1" }, value: "2" }),
    );

    const { fragment } = selectConfigurationSavePayload(store.getState());

    expect(fragment.values["cabinet:cab-1"]).toEqual({ Handle: "a", Drawers: "2" });
    expect(listFragmentAttributeIds(fragment)).toEqual(["Drawers", "Handle"]);
  });
});

describe("selector memoization", () => {
  beforeEach(setUpConfiguration);

  it("returns the same reference until the configuration changes", () => {
    // Components read this through useAppSelector, which compares by reference. A fresh
    // object on every call would re-render on any store action and, in the summary pages,
    // re-trigger the autosave effect on every render.
    const first = selectConfigurationSavePayload(store.getState());
    const second = selectConfigurationSavePayload(store.getState());

    expect(second).toBe(first);
    expect(second.fragment).toBe(first.fragment);
    expect(second.uiState).toBe(first.uiState);
  });

  it("returns a new reference once a value changes", () => {
    const before = selectConfigurationSavePayload(store.getState());

    store.dispatch(
      setAttributeValue({ attributeId: "Handle", target: { scope: "cabinet", cabinetId: "cab-1" }, value: "a" }),
    );

    expect(selectConfigurationSavePayload(store.getState())).not.toBe(before);
  });

  it("keeps the ui state reference when only the fragment changes", () => {
    const before = selectConfigurationSavePayload(store.getState());

    store.dispatch(
      setAttributeValue({ attributeId: "TestGrooveFinish", target: { scope: "global" }, value: "Matte" }),
    );

    const after = selectConfigurationSavePayload(store.getState());

    expect(after.fragment).not.toBe(before.fragment);
    expect(after.uiState).toBe(before.uiState);
  });
});

describe("metadata roundtrip", () => {
  beforeEach(setUpConfiguration);

  const buildMetadata = () => {
    const payload = selectConfigurationSavePayload(store.getState());

    return buildConfigurationMetadata({
      path: "/custom/summary",
      orderedProductIds: ["runtime-a", "runtime-b"],
      uiState: payload.uiState,
      swatchOrder: emptySwatchOrder,
      fragment: payload.fragment,
    });
  };

  it("carries collectionId at the top level for the collection resolver", () => {
    const metadata = buildMetadata();

    expect(metadata.collectionId).toBe("urban-standard-height");
    expect(readSavedCollectionId(metadata)).toBe("urban-standard-height");
  });

  it("returns the same values through save and read", () => {
    store.dispatch(
      setAttributeValue({
        attributeId: "Handle",
        target: { scope: "cabinet", cabinetId: "cab-2" },
        value: "handle_pto",
      }),
    );

    const metadata = buildMetadata();
    const { fragment, isLegacy, issues } = readConfigurationFragment(metadata);

    expect(isLegacy).toBe(false);
    expect(issues).toEqual([]);
    expect(readFragmentValue(fragment, "Handle", { scope: "cabinet", cabinetId: "cab-2" })).toBe("handle_pto");
    expect(fragment.cabinets.map((entry) => entry.stableKey)).toEqual(["cab-1", "cab-2"]);
  });

  it("round-trips an attribute that has no field in the typed state", () => {
    store.dispatch(
      setAttributeValue({ attributeId: "TestGrooveFinish", target: { scope: "global" }, value: "Matte" }),
    );

    const { fragment } = readConfigurationFragment(buildMetadata());

    expect(readFragmentValue(fragment, "TestGrooveFinish", { scope: "global" })).toBe("Matte");
  });

  it("saves the fields the old format dropped", () => {
    const metadata = buildMetadata();

    // Handle previously survived only inside each product's PlayCanvas config;
    // material and finish were lost entirely and re-derived on restore.
    expect(metadata.uiState).toHaveProperty("Handle");
    expect(metadata.uiState).toHaveProperty("CabinetColorMaterial");
    expect(metadata.uiState).toHaveProperty("CabinetColorFinish");
  });

  it("leaves the legacy uiState shape intact", () => {
    const metadata = buildMetadata();

    // Three restore paths still read these; C08/C09 move them onto the fragment.
    for (const key of ["CabinetColor", "sinkType", "CountertopColor", "TowelBarOption", "FaucetHolesSpacing"]) {
      expect(metadata.uiState, key).toHaveProperty(key);
    }
    expect(metadata.swatchOrder).toEqual(emptySwatchOrder);
    expect(metadata.orderedProductIds).toEqual(["runtime-a", "runtime-b"]);
  });
});
