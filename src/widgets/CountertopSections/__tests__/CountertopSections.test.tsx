// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, renderHook, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { store } from "@/app/store";
import { ReadyCollectionContext } from "@/entities/collection";
import type { ProductProfile } from "@/entities/collection";
import { configurator4WithLiveVessels } from "@/entities/collection/__tests__/fixtures/configurator4LiveVessels";
import configurator4 from "@/entities/collection/__tests__/fixtures/remote/configurator-4.json";
import { ushProfile } from "@/entities/collection/__tests__/ushProfileFixture";
import { configuratorSchema } from "@/entities/collection/model/schemas";
import { resetConfiguration, syncCabinets } from "@/entities/configuration";
import { clearHistory, setHistoryRestoring } from "@/entities/history/model/store/slice";
import {
  addProductId,
  reset,
  setActiveBasinStyle,
  setActiveCountertopColor,
  setActiveCountertopThickness,
  setActiveProfile,
  setCountertopStyle,
  setSelectedDimensions,
} from "@/entities/product/model/store/slice";
import { ReasonTextProvider, useCustomizationStepSections } from "@/features/collectionCustomization";
import type { AttributeChange, ChangeResult, PlannedChange } from "@/features/configurationCommands";
import { readyCollectionFixture } from "@/features/configurationCommands/__tests__/readyCollectionFixture";
import datatable438 from "@/entities/collection/__tests__/fixtures/remote/datatable-438.json";
import type { CountertopDatatable } from "@/entities/countertop/api/types";
import { parseCountertopMatrix } from "@/features/configurator-rule-core/countertop";
import { CountertopPage } from "@/pages/countertop/CountertopPage";

import { useCountertopColorState } from "../lib/useCountertopColorState";
import { useCountertopContext } from "../lib/useCountertopContext";
import { useVesselColorState } from "../lib/useVesselColorState";

// The countertop step reads its sections from ui.json and its options from the profile; the pick goes to the command.

/** The set the command answers a basin pick with; every other pick changes nothing else. */
let basinPlan: PlannedChange[] = [];
const changeMock = vi.fn(
  async ({ attributeId }: AttributeChange): Promise<ChangeResult> => ({
    status: "applied",
    plan: attributeId === "sinkType" ? basinPlan : [],
  }),
);

vi.mock("@/features/configurationCommands", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/configurationCommands")>();
  return { ...actual, useChangeAttribute: () => ({ change: changeMock, getState: () => store.getState() }) };
});

vi.mock("@/shared/ui/Accordion/ConfiguratorAccordion");
vi.mock("@/shared/ui/Accordion/useCompactAccordionViewport", () => ({ useCompactAccordionViewport: () => false }));
// The basins are offered once the scene reads a Sink Base among the placed products.
vi.mock("@/utils/functions/playcanvas/getConfig", () => ({
  getConfig: async (runtimeId: string) => (runtimeId.startsWith("Sink-Base") ? { ProductType: "Sink-Base" } : null),
}));

afterEach(cleanup);

/** The shipped countertop matrix, so a style the rules allow reads as available. */
const withCountertopRules = {
  ...readyCollectionFixture,
  catalog: {
    ...readyCollectionFixture.catalog,
    countertops: parseCountertopMatrix(datatable438 as unknown as CountertopDatatable),
  },
};

const renderStep = (path = "/prebuilt/countertop", stepId = "countertop", collection = readyCollectionFixture) =>
  render(
    <ReadyCollectionContext.Provider value={collection}>
      <Provider store={store}>
        <MemoryRouter initialEntries={[path]}>
          <CountertopPage stepId={stepId} />
        </MemoryRouter>
      </Provider>
    </ReadyCollectionContext.Provider>,
  );

const sectionTitles = () => screen.getAllByRole("region").map((region) => region.getAttribute("aria-label"));

describe("the countertop step from ui.json", () => {
  beforeEach(() => {
    store.dispatch(reset());
    store.dispatch(setActiveProfile(ushProfile));
    changeMock.mockClear();
  });

  it("renders the prebuilt sections in the order ui.json declares, without the vessel colour", () => {
    renderStep();

    expect(sectionTitles()).toEqual(["Countertop Color", "Thickness", "Countertop Style", "Basin style"]);
  });

  it("renders the custom flow from the same widget", () => {
    renderStep("/custom/countertop", "countertop-custom");

    expect(sectionTitles()).toEqual(["Countertop Color", "Thickness", "Countertop Style", "Basin style"]);
  });

  it("lists the thicknesses and styles of the profile", () => {
    renderStep();

    const thickness = within(screen.getByRole("region", { name: "Thickness" }));
    expect(thickness.getAllByRole("button").map((button) => button.textContent)).toEqual(
      ushProfile.attributes.find(({ attributeId }) => attributeId === "Thickness")?.options?.map(({ label }) => label),
    );
    const style = within(screen.getByRole("region", { name: "Countertop Style" }));
    expect(style.getByText("Integrated")).toBeTruthy();
    expect(style.getByText("Vessel")).toBeTruthy();
  });

  it("names the basin section as ui.json names it for the chosen style", () => {
    renderStep("/prebuilt/countertop", "countertop", withCountertopRules);
    expect(sectionTitles()).toContain("Basin style");

    act(() => {
      store.dispatch(setCountertopStyle("vessel"));
    });

    expect(sectionTitles()).toContain("Vessel Sink Style");
    expect(sectionTitles()).not.toContain("Basin style");
  });

  it("asks for a thickness before it offers basins", () => {
    renderStep();

    expect(screen.getByText("Select a thickness first to enable basin styles.")).toBeTruthy();
  });

  it("sends a picked thickness through the command", async () => {
    renderStep();

    await act(async () => {
      fireEvent.click(within(screen.getByRole("region", { name: "Thickness" })).getByRole("button", { name: '0.5"' }));
    });

    expect(changeMock).toHaveBeenCalledWith({
      attributeId: "Thickness",
      value: "0.5",
      scope: "countertop",
      userInitiated: true,
    });
  });
});

describe("the countertop step's resets", () => {
  beforeEach(() => {
    store.dispatch(reset());
    store.dispatch(setActiveProfile(ushProfile));
    store.dispatch(clearHistory());
    store.dispatch(setHistoryRestoring(false));
    // A placed cabinet, so a history step written here would be one that undo could restore.
    store.dispatch(addProductId("rt-a"));
    store.dispatch(setActiveCountertopThickness("9"));
    changeMock.mockClear();
  });

  const thicknessChanges = () =>
    changeMock.mock.calls.filter(
      (call: unknown[]) => (call[0] as { attributeId?: string }).attributeId === "Thickness",
    );

  it("puts back a thickness the rules allow without writing an undo step", async () => {
    renderStep();
    await act(async () => {});

    expect(thicknessChanges().length).toBeGreaterThan(0);
    expect(store.getState().rootStateUI.history.past).toEqual([]);
  });

  it("waits for an undo to end before it resets anything", async () => {
    store.dispatch(setHistoryRestoring(true));
    renderStep();
    await act(async () => {});

    expect(thicknessChanges()).toEqual([]);

    await act(async () => {
      store.dispatch(setHistoryRestoring(false));
    });

    expect(thicknessChanges().length).toBeGreaterThan(0);
  });
});

// USH's configurator 4, recorded with its HPL colours, so the active colour reaches the matrix by its material.
const ushGroups = configuratorSchema.parse(configurator4).availableOptions;
const withUshColors = {
  ...withCountertopRules,
  catalog: {
    ...withCountertopRules.catalog,
    configurator: {
      groups: ushGroups,
      groupsByName: Object.fromEntries(ushGroups.map((group) => [group.proxyName, group])),
    },
  },
};

// Table 438 makes a vessel top from an 80 cm Sink Base and an integrated HPL one from 60 or 70 cm.
describe("the countertop step's styles follow CountertopStyle.allowed", () => {
  beforeEach(() => {
    store.dispatch(reset());
    store.dispatch(setActiveProfile(ushProfile));
    store.dispatch(setActiveCountertopColor("Ardesia TKF"));
    store.dispatch(setCountertopStyle("integrated"));
    changeMock.mockClear();
  });

  const renderStyles = () => {
    render(
      <ReadyCollectionContext.Provider value={withUshColors}>
        <Provider store={store}>
          <ReasonTextProvider>
            <MemoryRouter initialEntries={["/prebuilt/countertop"]}>
              <CountertopPage stepId="countertop" />
            </MemoryRouter>
          </ReasonTextProvider>
        </Provider>
      </ReadyCollectionContext.Provider>,
    );
    return within(screen.getByRole("region", { name: "Countertop Style" }));
  };
  const isEnabled = (button: HTMLElement) => button.getAttribute("aria-disabled") !== "true";
  const shownStyles = () =>
    renderStyles()
      .getAllByRole("button")
      .map((button) => [button.getAttribute("aria-label"), isEnabled(button)]);
  const hoverOption = (style: ReturnType<typeof renderStyles>, label: string) => {
    fireEvent.mouseEnter(style.getByRole("button", { name: label }).closest("div") as HTMLElement);
  };

  it("offers both styles on an 80 cm Sink Base", () => {
    store.dispatch(setSelectedDimensions({ width: 80, depth: 50.5 }));

    expect(shownStyles()).toEqual([
      ["Integrated", true],
      ["Vessel", true],
    ]);
  });

  it("refuses the vessel style on a Sink Base below the vessel minimum, saying the minimum", () => {
    store.dispatch(setSelectedDimensions({ width: 70, depth: 50.5 }));
    const style = renderStyles();

    expect(isEnabled(style.getByRole("button", { name: "Integrated" }))).toBe(true);
    expect(isEnabled(style.getByRole("button", { name: "Vessel" }))).toBe(false);
    hoverOption(style, "Vessel");
    expect(
      screen.getByText('Not available for selected sink base cabinet width. Minimum width required 80cm (31.5")'),
    ).toBeTruthy();
  });

  // The USH fallbacks restrict Tekormud and Solid Surface tops, which the recorded configurator does not list: the
  // profile here restricts HPL instead, so that the HPL colour reaches the check. HPL is made from a 60 cm Sink Base.
  it("refuses the integrated style at 46 cm for a restricted material, in the profile's words for the depth", () => {
    const fallbacks = ushProfile.ruleData.countertopFallbacks;
    if (!fallbacks) throw new Error("The USH profile declares no countertop fallbacks");
    const restrictingHpl: ProductProfile = {
      ...ushProfile,
      ruleData: {
        ...ushProfile.ruleData,
        countertopFallbacks: { ...fallbacks, restrictedIntegratedMaterialTokens: ["hpl"] },
      },
    };
    // The profile's defaults replace the colour, so it is chosen again.
    store.dispatch(setActiveProfile(restrictingHpl));
    store.dispatch(setActiveCountertopColor("Ardesia TKF"));
    store.dispatch(setSelectedDimensions({ width: 50, depth: 46 }));
    const style = renderStyles();

    expect(isEnabled(style.getByRole("button", { name: "Integrated" }))).toBe(false);
    hoverOption(style, "Integrated");
    expect(screen.getByText('Integrated basin style not available for 46cm (18.1") depth configurations')).toBeTruthy();
  });

  it.each([
    ["an 80 cm Sink Base", 80, 50.5],
    ["a 70 cm Sink Base", 70, 50.5],
    ["a 50 cm Sink Base at 46 cm", 50, 46],
  ])("shows the styles as CountertopStyle.allowed resolves them on %s", (_case, width, depth) => {
    store.dispatch(setSelectedDimensions({ width, depth }));
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ReadyCollectionContext.Provider value={withUshColors}>
        <Provider store={store}>{children}</Provider>
      </ReadyCollectionContext.Provider>
    );
    const resolved = renderHook(() => useCustomizationStepSections("countertop"), { wrapper })
      .result.current.flatMap(({ fields }) => fields)
      .find(({ definition }) => definition.attributeId === "CountertopStyle")?.field;

    expect(resolved?.options.map(({ label, enabled }) => [label, enabled])).toEqual(shownStyles());
  });
});

describe("the countertop step's vessel picks", () => {
  // Configurator 4 with the vessel colours the live one offers.
  const vesselGroups = configuratorSchema.parse(configurator4WithLiveVessels).availableOptions;
  const withVesselColors = {
    ...withCountertopRules,
    catalog: {
      ...withCountertopRules.catalog,
      configurator: {
        groups: vesselGroups,
        groupsByName: Object.fromEntries(vesselGroups.map((group) => [group.proxyName, group])),
      },
    },
  };
  const SINK_BASE = "Sink-Base-placed";

  beforeEach(() => {
    store.dispatch(reset());
    store.dispatch(resetConfiguration());
    store.dispatch(setActiveProfile(ushProfile));
    store.dispatch(addProductId(SINK_BASE));
    store.dispatch(syncCabinets([SINK_BASE]));
    store.dispatch(setSelectedDimensions({ width: 80, depth: 50.5 }));
    store.dispatch(setActiveCountertopColor("Ardesia TKF"));
    store.dispatch(setActiveCountertopThickness("0.5"));
    store.dispatch(setCountertopStyle("vessel"));
    store.dispatch(setActiveBasinStyle("Vessel_UrbanMorris"));
    basinPlan = [];
    changeMock.mockClear();
  });

  const renderVesselStep = async () => {
    renderStep("/prebuilt/countertop", "countertop", withVesselColors);
    await act(async () => {});
  };
  const vesselColors = () => within(screen.getByRole("region", { name: "Vessel Color" }));

  /** Narrows the colour grid to Solid Surface, a material the Urban Morris takes. */
  const filterVesselColors = async () => {
    await act(async () => {
      fireEvent.click(vesselColors().getByRole("button", { name: "Material" }));
    });
    await act(async () => {
      fireEvent.click(
        within(screen.getByRole("listbox", { name: "Material" })).getByRole("button", { name: "Solid Surface" }),
      );
    });
  };

  const pickBasin = async (label: string) => {
    await act(async () => {
      fireEvent.click(
        within(screen.getByRole("region", { name: "Vessel Sink Style" })).getByRole("button", { name: label }),
      );
    });
  };

  it("sends a picked colour for the whole composition, naming no Sink Base", async () => {
    await renderVesselStep();

    await act(async () => {
      fireEvent.click(vesselColors().getByRole("button", { name: "Bianco Gloss TAL" }));
    });

    expect(changeMock).toHaveBeenCalledWith({
      attributeId: "VesselColor",
      value: "Bianco Gloss TAL",
      scope: "basin",
      userInitiated: true,
    });
  });

  it("clears the colour filter when the basin picked set a colour, which it could hide", async () => {
    basinPlan = [
      { attributeId: "sinkType", target: { scope: "basin" }, value: "Vessel_UrbanModo", origin: "requested" },
      { attributeId: "VesselColor", target: { scope: "basin" }, value: "Matte White T1C", origin: "dependency" },
    ];
    await renderVesselStep();
    await filterVesselColors();
    expect(vesselColors().getByRole("button", { name: "Clear All" })).toBeTruthy();

    await pickBasin("Vessel Urban Modo");

    expect(vesselColors().queryByRole("button", { name: "Clear All" })).toBeNull();
  });

  it("keeps the colour filter when the basin picked left the colour as it was", async () => {
    basinPlan = [
      { attributeId: "sinkType", target: { scope: "basin" }, value: "Vessel_UrbanModo", origin: "requested" },
    ];
    await renderVesselStep();
    await filterVesselColors();

    await pickBasin("Vessel Urban Modo");

    expect(changeMock).toHaveBeenCalledWith({
      attributeId: "sinkType",
      value: "Vessel_UrbanModo",
      scope: "basin",
      userInitiated: true,
    });
    expect(vesselColors().getByRole("button", { name: "Clear All" })).toBeTruthy();
  });
});

// The USH vessel compatibility lists the Porcelain TQ2 as unavailable under Urban Modo: the countertop colour and the
// vessel exclude each other, each grid saying why.
describe("the countertop step keeps Urban Modo off a Porcelain TQ2 countertop", () => {
  // Configurator 4 with two of the Porcelain countertop colours the live one offers (2026-11-04); the recorded
  // sample keeps HPL only.
  const porcelain = (id: number, name: string, codeColor: string, color: string) => ({
    id,
    name,
    image: null,
    enabled: true,
    sort: 0,
    description: "",
    metadata: {
      sku: "POR",
      codeColor,
      Color: color,
      Material: "Porcelain",
      Look: "Cement-Look",
      label: name,
      value: name,
    },
  });
  const groups = configuratorSchema.parse({
    ...configurator4WithLiveVessels,
    availableOptions: configurator4WithLiveVessels.availableOptions.map((group) =>
      group.proxyName === "Countertop Color"
        ? {
            ...group,
            options: [
              ...group.options,
              {
                id: 293,
                name: "Porcelain",
                resource: null,
                paramString: "",
                playcanvasString: "",
                variants: [
                  porcelain(3269, "Avenue Amber TRC", "TRC", "Brown"),
                  porcelain(3283, "Fokos Rena TQ2", "TQ2", "Beige"),
                ],
              },
            ],
          }
        : group,
    ),
  }).availableOptions;
  const withPorcelainColors = {
    ...withCountertopRules,
    catalog: {
      ...withCountertopRules.catalog,
      configurator: { groups, groupsByName: Object.fromEntries(groups.map((group) => [group.proxyName, group])) },
    },
  };
  const SINK_BASE = "Sink-Base-placed";

  beforeEach(() => {
    store.dispatch(reset());
    store.dispatch(resetConfiguration());
    store.dispatch(setActiveProfile(ushProfile));
    store.dispatch(addProductId(SINK_BASE));
    store.dispatch(syncCabinets([SINK_BASE]));
    store.dispatch(setSelectedDimensions({ width: 80, depth: 50.5 }));
    store.dispatch(setActiveCountertopThickness("0.5"));
    store.dispatch(setCountertopStyle("vessel"));
    basinPlan = [];
    changeMock.mockClear();
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <ReadyCollectionContext.Provider value={withPorcelainColors}>
      <Provider store={store}>
        <ReasonTextProvider>{children}</ReasonTextProvider>
      </Provider>
    </ReadyCollectionContext.Provider>
  );
  const renderPorcelainStep = async () => {
    render(
      <MemoryRouter initialEntries={["/prebuilt/countertop"]}>
        <CountertopPage stepId="countertop" />
      </MemoryRouter>,
      { wrapper },
    );
    await act(async () => {});
  };
  const regionOf = (name: string) => within(screen.getByRole("region", { name }));
  const isEnabled = (region: ReturnType<typeof regionOf>, label: string) =>
    region.getByRole("button", { name: label }).getAttribute("aria-disabled") !== "true";
  const hoverOption = (region: ReturnType<typeof regionOf>, label: string) => {
    fireEvent.mouseEnter(region.getByRole("button", { name: label }).closest("div") as HTMLElement);
  };

  it("refuses TQ2 under Urban Modo in the vessel's words, and keeps another Porcelain colour", async () => {
    store.dispatch(setActiveCountertopColor("Avenue Amber TRC"));
    store.dispatch(setActiveBasinStyle("Vessel_UrbanModo"));
    await renderPorcelainStep();
    const colors = regionOf("Countertop Color");

    expect(isEnabled(colors, "Fokos Rena TQ2")).toBe(false);
    expect(isEnabled(colors, "Avenue Amber TRC")).toBe(true);
    hoverOption(colors, "Fokos Rena TQ2");
    expect(screen.getByText("Not available for selected vessel sink style.")).toBeTruthy();
  });

  it("keeps a refused colour from the command, whichever grid picked it", () => {
    store.dispatch(setActiveCountertopColor("Avenue Amber TRC"));
    store.dispatch(setActiveBasinStyle("Vessel_UrbanModo"));
    const { result } = renderHook(() => useCountertopColorState(useCountertopContext()), { wrapper });

    expect(result.current.isColorCompatible("Fokos Rena TQ2")).toBe(false);
    expect(result.current.isColorCompatible("Avenue Amber TRC")).toBe(true);
  });

  it("offers TQ2 under another vessel", async () => {
    store.dispatch(setActiveCountertopColor("Avenue Amber TRC"));
    store.dispatch(setActiveBasinStyle("Vessel_UrbanMorris"));
    await renderPorcelainStep();

    expect(isEnabled(regionOf("Countertop Color"), "Fokos Rena TQ2")).toBe(true);
  });

  it("refuses Urban Modo on a TQ2 countertop in the countertop's words, and keeps another vessel and None", async () => {
    store.dispatch(setActiveCountertopColor("Fokos Rena TQ2"));
    store.dispatch(setActiveBasinStyle("Vessel_UrbanMorris"));
    await renderPorcelainStep();
    const basins = regionOf("Vessel Sink Style");

    expect(isEnabled(basins, "Vessel Urban Modo")).toBe(false);
    expect(isEnabled(basins, "Vessel Urban Morris")).toBe(true);
    expect(isEnabled(basins, "None")).toBe(true);
    hoverOption(basins, "Vessel Urban Modo");
    expect(screen.getByText("Not available for selected countertop color.")).toBeTruthy();
  });

  it("offers Urban Modo on another Porcelain countertop", async () => {
    store.dispatch(setActiveCountertopColor("Avenue Amber TRC"));
    store.dispatch(setActiveBasinStyle("Vessel_UrbanMorris"));
    await renderPorcelainStep();

    expect(isEnabled(regionOf("Vessel Sink Style"), "Vessel Urban Modo")).toBe(true);
  });
});

// Without a code the grid shows the generic "not available": a refused colour names its reason by code.
describe("the countertop step's refused colours carry their reason codes", () => {
  const groups = configuratorSchema.parse(configurator4WithLiveVessels).availableOptions;
  const withVesselColors = {
    ...withCountertopRules,
    catalog: {
      ...withCountertopRules.catalog,
      configurator: { groups, groupsByName: Object.fromEntries(groups.map((group) => [group.proxyName, group])) },
    },
  };
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ReadyCollectionContext.Provider value={withVesselColors}>
      <Provider store={store}>{children}</Provider>
    </ReadyCollectionContext.Provider>
  );
  const colorStates = () =>
    renderHook(
      () => {
        const context = useCountertopContext();
        const countertop = useCountertopColorState(context);
        const vessel = useVesselColorState({
          context,
          vesselColorOptions: countertop.vesselColorOptions,
          defaultMaterialFilters: countertop.defaultMaterialFilters,
        });
        return { countertop, vessel };
      },
      { wrapper },
    ).result.current;

  beforeEach(() => {
    store.dispatch(reset());
    store.dispatch(resetConfiguration());
    store.dispatch(setActiveProfile(ushProfile));
    store.dispatch(setActiveCountertopColor("Ardesia TKF"));
    store.dispatch(setActiveCountertopThickness("0.5"));
  });

  it("refuses a countertop colour the matrix has no row for at the depth with the depth's code", () => {
    store.dispatch(setSelectedDimensions({ width: 80, depth: 46 }));
    store.dispatch(setCountertopStyle("integrated"));

    expect(colorStates().countertop.fullModeOptions.find(({ title }) => title === "Bianco Gloss TAN")).toMatchObject({
      isAvailable: false,
      disabledReason: "Not available for current cabinet depth",
      disabledReasonCode: "countertop.materialNotAvailableForDepth",
    });
  });

  it("refuses a vessel colour the vessel style does not take with the vessel colour's code", () => {
    store.dispatch(setSelectedDimensions({ width: 80, depth: 50.5 }));
    store.dispatch(setCountertopStyle("vessel"));
    store.dispatch(setActiveBasinStyle("Vessel_UrbanModo"));

    expect(colorStates().vessel.visibleOptions.find(({ title }) => title === "Agata BD MT")).toMatchObject({
      isAvailable: false,
      disabledReason: "Not available for selected vessel sink style.",
      disabledReasonCode: "vessel.colorUnavailable",
    });
  });
});
