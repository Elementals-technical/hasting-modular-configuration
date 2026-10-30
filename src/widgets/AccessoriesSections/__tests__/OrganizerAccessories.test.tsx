// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { parseProductProfile } from "@/entities/collection/lib/parseProductProfile";
import { buildReadyCollection } from "@/entities/collection/__tests__/fixtures/buildReadyCollection";
import { setActiveProfile, setDividersOption } from "@/entities/product/model/store/slice";
import {
  classProfile,
  createOrganizerTestStore,
  record,
  ui,
  type OrganizerTestStore,
} from "@/features/drawerOrganizers/__tests__/organizerHookSetup";
import { columnsEntry, withPage } from "@/features/drawerOrganizers/__tests__/organizerUiSetup";
import { ORGANIZER_PROFILES } from "@/features/drawerOrganizers/model/presets";
import { recordDerived, setView } from "@/features/drawerOrganizers/model/store/slice";

import tricotManifest from "../../../../public/collections/tricot/manifest.json";
import tricotProfileDocument from "../../../../public/collections/tricot/product-profile.json";
import tricotUi from "../../../../public/collections/tricot/ui.json";
import lameManifest from "../../../../public/collections/lame/manifest.json";
import lameUi from "../../../../public/collections/lame/ui.json";
import { LAME } from "@/shared/lib/pricing/__tests__/fixtures/collectionPricingScenarios";
import { useOrganizerAccessoriesSections } from "../ui/OrganizerAccessories";

// The step reads its sections from ui.json and the picks go to the command runner, as on the legacy page.
const changeMock = vi.fn(async () => ({ status: "applied" as const, plan: [] }));

vi.mock("@/features/configurationCommands", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/configurationCommands")>();
  return { ...actual, useChangeAttribute: () => ({ change: changeMock, getState: () => ({}) }) };
});
vi.mock("@/utils/functions/playcanvas/getOrderedProductIds", () => ({
  getOrderedProductIds: (fallback: string[] = []) => fallback,
}));
vi.mock("@/utils/functions/playcanvas/getConfig", () => ({ getConfig: vi.fn(async () => ({ Width: 60 })) }));
vi.mock("@/shared/ui/Accordion/ConfiguratorAccordion");
vi.mock("@/shared/ui/Accordion/useCompactAccordionViewport", () => ({ useCompactAccordionViewport: () => false }));

/**
 * The Accessories sections of a collection with organizers: the None | Customize chips, the hint under
 * them that follows the state, the column counter, the material chips, and the section reaching the layer.
 */

let store: OrganizerTestStore;

beforeEach(() => {
  store = createOrganizerTestStore();
  changeMock.mockClear();
});

afterEach(cleanup);

const TOP = { cabinetKey: "cab-1", drawer: "Top" as const };

/** What 3D derived for a drawer that can take columns. */
const editable = (overrides: Partial<{ capacity: number; unavailable: "FULL" | "LOCKED_FULL" | null }> = {}) => ({
  exists: true,
  offered: true,
  role: "single" as const,
  profile: { id: "ROW-MTL-43", pitchM: 0.1, positionCount: 5, maxActive: 5, codec: "cells-v1" },
  maxSlot: 2,
  capacity: 3,
  count: 0,
  lock: null,
  candidates: [],
  unavailable: null,
  ...overrides,
});

const deriveTop = (overrides?: Parameters<typeof editable>[0]) =>
  store.dispatch(recordDerived({ cabinetKey: "cab-1", drawers: { Top: editable(overrides) } }));

/** The step as a page lays it out: a region per section, and a button to open or close each one. */
const Harness = ({ stepId = "accessories" }: { stepId?: string }) => {
  const { accordions, onSectionChange, sidePanelSyncModal } = useOrganizerAccessoriesSections(stepId);
  return (
    <>
      {accordions.map(({ sectionId, label, content }) => (
        <section key={sectionId} aria-label={label}>
          <button onClick={() => onSectionChange(sectionId)}>open {sectionId}</button>
          <button onClick={() => onSectionChange("")}>close all</button>
          {content}
        </section>
      ))}
      {sidePanelSyncModal}
    </>
  );
};

const renderStep = () => render(<Harness />, { wrapper: withPage(store) });
const dividers = () => within(screen.getByRole("region", { name: "Drawer Dividers" }));

describe("the Drawer Dividers section", () => {
  it("is the section ui.json declares, with the None and Customize options of the profile", () => {
    renderStep();
    expect(screen.getAllByRole("region").map((region) => region.getAttribute("aria-label"))).toEqual([
      "Drawer Dividers",
    ]);
    expect(dividers().getByRole("button", { name: "None" })).toBeTruthy();
    expect(dividers().getByRole("button", { name: "Customize" })).toBeTruthy();
  });

  it("sends a pick through the command runner", async () => {
    renderStep();

    await act(async () => {
      fireEvent.click(dividers().getByRole("button", { name: "Customize" }));
    });

    expect(changeMock).toHaveBeenCalledWith({ attributeId: "DividersOption", value: "Customize", scope: "global" });
  });
});

describe("the hint under the options", () => {
  const hint = () => dividers().queryByTestId("organizer-hint")?.textContent ?? null;

  it("says nothing for None", () => {
    renderStep();
    expect(hint()).toBeNull();
  });

  it("says no drawer can take dividers when Customize has nothing to open", () => {
    store.dispatch(setDividersOption("Customize"));
    renderStep();
    expect(hint()).toBe("Dividers aren't available for this cabinet size.");
  });

  it("asks to open a drawer when some drawer can take columns and none is open", () => {
    store.dispatch(setDividersOption("Customize"));
    deriveTop();
    renderStep();
    expect(hint()).toBe("Click ‘Open Drawer’ on a drawer to add divider columns.");
  });

  it("explains how to place columns once a drawer is open", () => {
    store.dispatch(setDividersOption("Customize"));
    deriveTop();
    store.dispatch(setView(TOP));
    renderStep();
    expect(hint()).toBe("Click the ⊕ button to place a divider column. Select added columns to customize it.");
  });

  it("says the drawer is full", () => {
    store.dispatch(setDividersOption("Customize"));
    deriveTop({ unavailable: "FULL" });
    store.dispatch(setView(TOP));
    renderStep();
    expect(hint()).toBe("This drawer is full.");
  });
});

describe("the column counter", () => {
  const counter = () => dividers().getByTestId("organizer-counter");

  it("is a polite live region that is empty while no drawer is open", () => {
    renderStep();
    expect(counter().getAttribute("aria-live")).toBe("polite");
    expect(counter().textContent).toBe("");
  });

  it("counts the columns of the drawer in view", () => {
    record(
      store,
      "cab-1",
      columnsEntry({
        Top: [
          { slot: -1, positions: [] },
          { slot: 1, positions: [2] },
        ],
      }),
    );
    store.dispatch(setView(TOP));
    renderStep();
    expect(counter().textContent).toBe("2 columns · Top drawer");
  });

  it("says column for one, and names the bottom drawer", () => {
    record(store, "cab-1", columnsEntry({ Bot: [{ slot: 0, positions: [] }] }));
    store.dispatch(setView({ cabinetKey: "cab-1", drawer: "Bot" }));
    renderStep();
    expect(counter().textContent).toBe("1 column · Bottom drawer");
  });

  it("counts an open drawer that has no columns yet", () => {
    store.dispatch(setView(TOP));
    renderStep();
    expect(counter().textContent).toBe("0 columns · Top drawer");
  });

  it("follows the drawer as columns are added", () => {
    store.dispatch(setView(TOP));
    renderStep();

    act(() => {
      record(store, "cab-1", columnsEntry({ Top: [{ slot: 0, positions: [] }] }));
    });

    expect(counter().textContent).toBe("1 column · Top drawer");
  });
});

describe("the material chips", () => {
  const table = ORGANIZER_PROFILES["ROW-MTL-43"] as { unavailableStyles: Record<string, string> };
  const oakPending = table.unavailableStyles;
  afterEach(() => {
    table.unavailableStyles = oakPending;
  });

  it("are not shown while Oak is not available (v1): one material is no choice", () => {
    store.dispatch(setDividersOption("Customize"));
    deriveTop();
    store.dispatch(setView(TOP));
    renderStep();
    expect(dividers().queryByRole("group", { name: "Divider material" })).toBeNull();
  });

  // The rules are read once per profile object, so a changed table needs a profile object that is new.
  const freshProfile = () => store.dispatch(setActiveProfile({ ...classProfile }));

  it("are shown for Customize when there are two materials to choose from, the chosen one pressed", () => {
    table.unavailableStyles = {};
    freshProfile();
    store.dispatch(setDividersOption("Customize"));
    store.dispatch(setView(TOP));
    renderStep();

    const chips = within(dividers().getByRole("group", { name: "Divider material" }));
    expect(chips.getAllByRole("button").map((chip) => [chip.textContent, chip.getAttribute("aria-pressed")])).toEqual([
      ["Metal", "false"],
      ["Oak", "false"],
    ]);

    fireEvent.click(chips.getByRole("button", { name: "Oak" }));
    expect(chips.getByRole("button", { name: "Oak" }).getAttribute("aria-pressed")).toBe("true");
    expect(ui(store).pendingStyle).toEqual({ "cab-1:Top": "Oak" });
  });

  it("are not shown for None", () => {
    table.unavailableStyles = {};
    freshProfile();
    store.dispatch(setView(TOP));
    renderStep();
    expect(dividers().queryByRole("group", { name: "Divider material" })).toBeNull();
  });

  it("disable a material that is not available, with the reason as its tooltip", () => {
    // A third material that the profile table does not offer next to the two that it does.
    table.unavailableStyles = { Glass: "organizer.oakPending" };
    const withGlass = {
      ...classProfile,
      attributes: classProfile.attributes.map((attribute) =>
        attribute.attributeId === "DividersStyle"
          ? { ...attribute, options: [...(attribute.options ?? []), { value: "Glass", label: "Glass", order: 30 }] }
          : attribute,
      ),
    };
    store.dispatch(setActiveProfile(withGlass));
    store.dispatch(setDividersOption("Customize"));
    store.dispatch(setView(TOP));
    renderStep();

    const glass = dividers().getByRole("button", { name: "Glass" }) as HTMLButtonElement;
    expect(glass.disabled).toBe(true);
    expect(glass.title).toBe("Oak organizers are not available yet.");
    expect((dividers().getByRole("button", { name: "Metal" }) as HTMLButtonElement).disabled).toBe(false);
  });
});

describe("the section reaching the layer", () => {
  it("is active from the start when ui.json opens it by default", () => {
    renderStep();
    expect(ui(store).sectionActive).toBe(true);
  });

  it("is not active when another section is opened, and active again when it is opened", () => {
    renderStep();
    fireEvent.click(screen.getByRole("button", { name: "close all" }));
    expect(ui(store).sectionActive).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "open dividers" }));
    expect(ui(store).sectionActive).toBe(true);
  });

  it("is not active once the page is left", () => {
    const view = renderStep();
    expect(ui(store).sectionActive).toBe(true);

    view.unmount();

    expect(ui(store).sectionActive).toBe(false);
  });
});

describe("the Side Panels section of a collection that has it (Tricot, Q-O6)", () => {
  it("renders the same options as the legacy page, with the hook running either way", () => {
    const parsed = parseProductProfile(tricotProfileDocument);
    if (!parsed.ok) throw new Error("tricot profile failed validation");
    const collection = buildReadyCollection("tricot", tricotManifest, tricotUi);
    store.dispatch(setActiveProfile(parsed.profile));

    render(<Harness stepId="side-panels" />, { wrapper: withPage(store, collection) });

    const sidePanels = within(screen.getByRole("region", { name: "Side Panels" }));
    expect(sidePanels.getAllByRole("button").map((button) => button.getAttribute("aria-label"))).toContain("None");
    expect(ui(store).sectionActive).toBe(false);
  });
});

describe("Lamè Accessories", () => {
  it("declares Side Panels before dividers in the shared prebuilt/custom step", () => {
    const collection = buildReadyCollection("lame", lameManifest, lameUi);
    store.dispatch(setActiveProfile(LAME.profile));
    render(<Harness />, { wrapper: withPage(store, collection) });
    expect(screen.getAllByRole("region").map((region) => region.getAttribute("aria-label"))).toEqual([
      "Side Panels",
      "Drawer Dividers",
    ]);
    const sidePanels = within(screen.getByRole("region", { name: "Side Panels" }));
    expect(sidePanels.getByRole("button", { name: "None" })).toBeTruthy();
    expect(LAME.profile.attributes.find((attribute) => attribute.attributeId === "SidePanels")?.options).toEqual([
      { value: "None", label: "None", order: 10, aliases: ["No"] },
      { value: "NoG", label: "Yes", order: 20, aliases: ["Yes"] },
    ]);
  });
});
