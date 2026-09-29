// @vitest-environment jsdom
import { createRef } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ConfiguratorClient } from "@/features/configuratorApi";
import type { RuntimeBindingSet } from "@/entities/collection";
import { CabinetPlacementDebug, type CabinetPlacementControls } from "../ui/CabinetPlacementDebug";
import { isCabinetPlacementDebugEnabled, resolveCabinetDebugSelection } from "../lib/resolveCabinetDebugSelection";

const selection = {
  definitionId: "Example-side-cabinet",
  selection: { Width: 80, Height: 28, Depth: 46, Handle: "handle_urban_topcut", SupportGroupId: "group-custom" },
};
const preview = { sessionId: "draft-1", lifecycle: "preview", kind: "add", canApply: true, canCancel: true };
const fixture = (
  methods = [
    "cabinetPlacement.beginAdd",
    "cabinetPlacement.beginMove",
    "cabinetPlacement.apply",
    "cabinetPlacement.cancel",
  ],
) => {
  const listeners = new Map<string, (event: unknown) => void>();
  const client = {
    connect: vi.fn(async () => undefined),
    getCapabilities: vi.fn(async () => ({ readiness: "ready", supportedMethods: methods })),
    getCompositionState: vi.fn(async () => ({ activeSessionId: null })),
    getPlacementState: vi.fn(async () => preview),
    getCabinetsState: vi.fn(async () => ({
      cabinets: [{ id: "runtime-selected" }],
      selectedCabinetId: "runtime-selected",
    })),
    getPlacementOptions: vi.fn(async () => [
      {
        id: "right-option",
        kind: "right",
        availability: "available",
        frameId: "wall",
        positionM: { x: 0, y: 0, z: 0 },
      },
    ]),
    beginAdd: vi.fn(async () => preview),
    beginMove: vi.fn(async () => ({ ...preview, kind: "move" })),
    apply: vi.fn(async () => ({ requestId: "apply-1", kind: "add", addedProductIds: ["new-cabinet"] })),
    cancel: vi.fn(async () => ({ ...preview, lifecycle: "cancelled" })),
    exportPreset: vi.fn(async () => ({
      presetSchemaVersion: 2,
      collection: { id: "example" },
      presetProducts: [],
      presetLayout: { featureSettings: { cover: true } },
    })),
    importPreset: vi.fn(async () => ({
      requestId: "import-1",
      kind: "import",
      keyToProductId: { cabinet0: "new-runtime-id" },
    })),
    on: vi.fn(async (namespace: string, event: string, listener: (event: unknown) => void) => {
      listeners.set(`${namespace}.${event}`, listener);
      return () => listeners.delete(`${namespace}.${event}`);
    }),
    dispose: vi.fn(() => listeners.clear()),
  };
  const createClient = () => client as unknown as ConfiguratorClient;
  const emit = (event: string, data: unknown) => act(() => listeners.get(event)?.({ data }));
  return { client, createClient, emit };
};

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.useRealTimers();
});

describe("Cabinet drag and drop test controls", () => {
  it("repositions the explicit context-menu cabinet even when runtime selection differs, then applies through the existing controls", async () => {
    const { client, createClient } = fixture();
    client.getCabinetsState.mockResolvedValue({
      cabinets: [{ id: "runtime-selected" }, { id: "context-menu-target" }],
      selectedCabinetId: "runtime-selected",
    });
    const controls = createRef<CabinetPlacementControls>();
    const available = vi.fn();
    const committed = vi.fn();
    const { unmount } = render(
      <CabinetPlacementDebug
        ref={controls}
        ready
        selection={selection}
        selectedProductId="old-redux-id"
        createClient={createClient}
        onRepositionAvailabilityChange={available}
        onCompositionCommitted={committed}
      />,
    );
    await waitFor(() => expect(available).toHaveBeenLastCalledWith({ supported: true, available: true }));
    act(() => {
      controls.current?.reposition("context-menu-target");
      controls.current?.reposition("runtime-selected");
    });
    await screen.findByRole("button", { name: "Apply" });
    expect(client.beginMove).toHaveBeenCalledExactlyOnceWith("context-menu-target");
    expect(client.getCabinetsState).toHaveBeenCalledOnce();
    expect(available).toHaveBeenLastCalledWith({ supported: true, available: false });
    act(() => controls.current?.reposition("runtime-selected"));
    expect(client.beginMove).toHaveBeenCalledOnce();
    await waitFor(() =>
      expect((screen.getByRole("button", { name: "Apply" }) as HTMLButtonElement).disabled).toBe(false),
    );
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    await waitFor(() => expect(client.apply).toHaveBeenCalledExactlyOnceWith("draft-1"));
    await waitFor(() => expect(committed).toHaveBeenCalledOnce());
    await waitFor(() => expect(available).toHaveBeenLastCalledWith({ supported: true, available: true }));
    unmount();
    expect(available).toHaveBeenLastCalledWith({ supported: false, available: false });
    expect(controls.current).toBeNull();
  });

  it("rejects a missing explicit cabinet ID without moving the selected cabinet", async () => {
    const { client, createClient } = fixture();
    const controls = createRef<CabinetPlacementControls>();
    const available = vi.fn();
    render(
      <CabinetPlacementDebug
        ref={controls}
        ready
        selection={selection}
        selectedProductId="runtime-selected"
        createClient={createClient}
        onRepositionAvailabilityChange={available}
      />,
    );
    await waitFor(() => expect(available).toHaveBeenLastCalledWith({ supported: true, available: true }));
    act(() => controls.current?.reposition("missing-cabinet"));
    expect((await screen.findByRole("alert")).textContent).toContain("Cabinet not found");
    expect(client.beginMove).not.toHaveBeenCalled();
    expect(client.apply).not.toHaveBeenCalled();
  });

  it("cancels context-menu reposition without committing and re-enables availability", async () => {
    const { client, createClient } = fixture();
    const controls = createRef<CabinetPlacementControls>();
    const available = vi.fn();
    const committed = vi.fn();
    render(
      <CabinetPlacementDebug
        ref={controls}
        ready
        selection={selection}
        selectedProductId={null}
        createClient={createClient}
        onRepositionAvailabilityChange={available}
        onCompositionCommitted={committed}
      />,
    );
    act(() => controls.current?.reposition("runtime-selected"));
    expect(client.beginMove).not.toHaveBeenCalled();
    await waitFor(() => expect(available).toHaveBeenLastCalledWith({ supported: true, available: true }));
    act(() => controls.current?.reposition("runtime-selected"));
    const cancel = (await screen.findByRole("button", { name: "Cancel" })) as HTMLButtonElement;
    await waitFor(() => expect(cancel.disabled).toBe(false));
    fireEvent.click(cancel);
    await waitFor(() => expect(client.cancel).toHaveBeenCalledExactlyOnceWith("draft-1"));
    await waitFor(() => expect(available).toHaveBeenLastCalledWith({ supported: true, available: true }));
    expect(committed).not.toHaveBeenCalled();
    expect(client.apply).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
  });

  it("uses the runtime seed pose instead of an option invalidated by the first collection claim", async () => {
    const { client, createClient } = fixture();
    client.getCabinetsState.mockResolvedValueOnce({ cabinets: [], selectedCabinetId: "" });
    client.getPlacementOptions.mockResolvedValueOnce([
      {
        id: "seed-option",
        kind: "seed",
        availability: "available",
        frameId: "wall",
        positionM: { x: 0.2, y: 0, z: 0 },
      },
    ]);
    render(<CabinetPlacementDebug ready selection={selection} selectedProductId={null} createClient={createClient} />);
    const add = screen.getByRole("button", { name: "Drag & Drop" }) as HTMLButtonElement;
    await waitFor(() => expect(add.disabled).toBe(false));
    fireEvent.click(add);
    await screen.findByRole("button", { name: "Apply" });
    expect(client.getPlacementOptions).toHaveBeenCalledOnce();
    expect(client.beginAdd).toHaveBeenCalledExactlyOnceWith(selection.definitionId, selection.selection, {
      kind: "free",
      frameId: "wall",
      positionM: { x: 0.2, y: 0, z: 0 },
    });
  });

  it("recovers from unsupported bootstrap to ready without duplicate subscriptions or mutations", async () => {
    vi.useFakeTimers();
    const { client, createClient } = fixture();
    client.getCapabilities.mockResolvedValueOnce({
      readiness: "unsupported",
      supportedMethods: ["cabinetPlacement.beginAdd"],
    });
    let unmount!: () => void;
    await act(async () => {
      ({ unmount } = render(
        <CabinetPlacementDebug ready selection={selection} selectedProductId={null} createClient={createClient} />,
      ));
    });
    const add = screen.getByRole("button", { name: "Drag & Drop" }) as HTMLButtonElement;
    expect(add.disabled).toBe(true);
    expect(screen.getByRole("status").textContent).toBe("Cabinet runtime: unsupported");
    expect(client.connect).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(add.disabled).toBe(false);
    expect(client.connect).toHaveBeenCalledOnce();
    expect(client.on).toHaveBeenCalledTimes(3);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });
    expect(client.getCapabilities).toHaveBeenCalledTimes(2);
    expect(client.beginAdd).not.toHaveBeenCalled();
    expect(client.importPreset).not.toHaveBeenCalled();
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("refreshes capabilities on composition changes, disabling stale controls while initializing", async () => {
    const { client, createClient, emit } = fixture();
    render(<CabinetPlacementDebug ready selection={selection} selectedProductId={null} createClient={createClient} />);
    const add = screen.getByRole("button", { name: "Drag & Drop" }) as HTMLButtonElement;
    await waitFor(() => expect(add.disabled).toBe(false));
    client.getCapabilities.mockResolvedValueOnce({
      readiness: "initializing",
      supportedMethods: ["cabinetPlacement.beginAdd"],
    });
    emit("composition.change", { status: "ready", activeSessionId: null });
    expect(add.disabled).toBe(true);
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Waiting for cabinet runtime…"));
    expect(screen.queryByRole("button", { name: "Move selected cabinet" })).toBeNull();
    await waitFor(() => expect(add.disabled).toBe(false));
    expect(client.on).toHaveBeenCalledTimes(3);
    expect(client.beginAdd).not.toHaveBeenCalled();
  });

  it("refreshes capabilities after commands and preserves draft controls when a method becomes unsupported", async () => {
    const { client, createClient } = fixture();
    render(<CabinetPlacementDebug ready selection={selection} selectedProductId={null} createClient={createClient} />);
    const add = screen.getByRole("button", { name: "Drag & Drop" }) as HTMLButtonElement;
    await waitFor(() => expect(add.disabled).toBe(false));
    client.getCapabilities.mockResolvedValueOnce({
      readiness: "ready",
      supportedMethods: ["cabinetPlacement.beginAdd", "cabinetPlacement.cancel"],
    });
    fireEvent.click(add);
    const apply = (await screen.findByRole("button", { name: "Apply" })) as HTMLButtonElement;
    await waitFor(() =>
      expect((screen.getByRole("button", { name: "Cancel" }) as HTMLButtonElement).disabled).toBe(false),
    );
    expect(apply.disabled).toBe(true);
    expect(client.getCapabilities).toHaveBeenCalledTimes(2);
    fireEvent.click(apply);
    expect(client.apply).not.toHaveBeenCalled();
    expect(client.on).toHaveBeenCalledTimes(3);
  });

  it("bounds readiness polling and cancels its pending timer on unmount", async () => {
    vi.useFakeTimers();
    const { client, createClient } = fixture();
    client.getCapabilities.mockResolvedValue({ readiness: "initializing", supportedMethods: [] });
    let unmount!: () => void;
    await act(async () => {
      ({ unmount } = render(
        <CabinetPlacementDebug ready selection={selection} selectedProductId={null} createClient={createClient} />,
      ));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(16_000);
    });
    expect(screen.getByRole("status").textContent).toContain("Reload the runtime to retry");
    const calls = client.getCapabilities.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });
    expect(client.getCapabilities).toHaveBeenCalledTimes(calls);
    expect(client.on).not.toHaveBeenCalled();
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("passes the current type/config, blocks repeated starts and waits for explicit Apply", async () => {
    const { client, createClient, emit } = fixture();
    const committed = vi.fn();
    render(
      <CabinetPlacementDebug
        ready
        selection={selection}
        selectedProductId={null}
        createClient={createClient}
        onCompositionCommitted={committed}
      />,
    );
    const add = screen.getByRole("button", { name: "Drag & Drop" }) as HTMLButtonElement;
    await waitFor(() => expect(add.disabled).toBe(false));
    fireEvent.click(add);
    fireEvent.click(add);
    await screen.findByRole("button", { name: "Apply" });
    expect(client.getPlacementOptions).toHaveBeenCalledExactlyOnceWith({
      ...selection,
      operation: "add",
      anchorCabinetId: "runtime-selected",
    });
    expect(client.beginAdd).toHaveBeenCalledExactlyOnceWith(selection.definitionId, selection.selection, {
      kind: "option",
      optionId: "right-option",
    });
    expect(add.disabled).toBe(true);
    expect(client.apply).not.toHaveBeenCalled();
    expect(committed).not.toHaveBeenCalled();
    emit("cabinetPlacement.change", { ...preview, canApply: false });
    expect((screen.getByRole("button", { name: "Apply" }) as HTMLButtonElement).disabled).toBe(true);
    emit("cabinetPlacement.change", preview);
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    await waitFor(() => expect(client.apply).toHaveBeenCalledExactlyOnceWith("draft-1"));
    await waitFor(() => expect(add.disabled).toBe(false));
    expect(screen.getByRole("status").textContent).toBe("Placement applied");
    expect(committed).toHaveBeenCalledExactlyOnceWith(await client.getCabinetsState());
    emit("cabinetPlacement.action", { status: "committed", sessionId: "draft-1", receipt: { requestId: "apply-1" } });
    expect(committed).toHaveBeenCalledOnce();
  });

  it("keeps the draft open on Apply failure and permits cancelling it", async () => {
    const { client, createClient } = fixture();
    const committed = vi.fn();
    client.apply.mockRejectedValueOnce(Object.assign(new Error("Candidate is invalid"), { code: "APPLY_UNAVAILABLE" }));
    render(
      <CabinetPlacementDebug
        ready
        selection={selection}
        selectedProductId={null}
        createClient={createClient}
        onCompositionCommitted={committed}
      />,
    );
    await waitFor(() =>
      expect((screen.getByRole("button", { name: "Drag & Drop" }) as HTMLButtonElement).disabled).toBe(false),
    );
    fireEvent.click(screen.getByRole("button", { name: "Drag & Drop" }));
    fireEvent.click(await screen.findByRole("button", { name: "Apply" }));
    expect((await screen.findByRole("alert")).textContent).toContain("APPLY_UNAVAILABLE");
    expect((screen.getByRole("button", { name: "Drag & Drop" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(client.cancel).toHaveBeenCalledExactlyOnceWith("draft-1"));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull());
    expect(committed).not.toHaveBeenCalled();
  });

  it("reads the runtime selected cabinet when Move is clicked", async () => {
    const { client, createClient } = fixture();
    render(
      <CabinetPlacementDebug
        ready
        selection={selection}
        selectedProductId="old-redux-id"
        createClient={createClient}
      />,
    );
    const move = (await screen.findByRole("button", { name: "Move selected cabinet" })) as HTMLButtonElement;
    await waitFor(() => expect(move.disabled).toBe(false));
    fireEvent.click(move);
    await waitFor(() => expect(client.beginMove).toHaveBeenCalledExactlyOnceWith("runtime-selected"));
    expect(client.apply).not.toHaveBeenCalled();
  });

  it("does not clear a draft when Cancel returns a nonterminal lifecycle", async () => {
    const { client, createClient } = fixture();
    client.cancel.mockResolvedValueOnce({ ...preview, lifecycle: "preview" });
    render(<CabinetPlacementDebug ready selection={selection} selectedProductId={null} createClient={createClient} />);
    const add = screen.getByRole("button", { name: "Drag & Drop" }) as HTMLButtonElement;
    await waitFor(() => expect(add.disabled).toBe(false));
    fireEvent.click(add);
    fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(client.cancel).toHaveBeenCalledOnce());
    await waitFor(() =>
      expect((screen.getByRole("button", { name: "Cancel" }) as HTMLButtonElement).disabled).toBe(false),
    );
    expect(add.disabled).toBe(true);
    expect(screen.getByRole("button", { name: "Apply" })).toBeTruthy();
  });

  it("refuses Add when fresh placement options have no available chosen side or seed", async () => {
    const { client, createClient } = fixture();
    client.getPlacementOptions.mockResolvedValueOnce([
      { id: "left-only", kind: "left", availability: "available", frameId: "wall", positionM: { x: 0, y: 0, z: 0 } },
    ]);
    render(<CabinetPlacementDebug ready selection={selection} selectedProductId={null} createClient={createClient} />);
    const add = screen.getByRole("button", { name: "Drag & Drop" }) as HTMLButtonElement;
    await waitFor(() => expect(add.disabled).toBe(false));
    fireEvent.click(add);
    expect((await screen.findByRole("alert")).textContent).toContain("No available placement");
    expect(client.beginAdd).not.toHaveBeenCalled();
  });

  it("saves the full JSON and restores only after explicit confirmation while idle", async () => {
    const { client, createClient } = fixture([
      "cabinetPlacement.beginAdd",
      "composition.exportPreset",
      "composition.importPreset",
    ]);
    const committed = vi.fn();
    render(
      <CabinetPlacementDebug
        ready
        selection={selection}
        selectedProductId={null}
        createClient={createClient}
        onCompositionCommitted={committed}
      />,
    );
    fireEvent.click(await screen.findByText("Save / Restore JSON"));
    fireEvent.click(screen.getByRole("button", { name: "Save JSON" }));
    await waitFor(() => expect(localStorage.getItem("cabinet-placement-debug-preset")).toContain("featureSettings"));
    const preset = await client.exportPreset();
    expect(JSON.parse((screen.getByLabelText("Preset JSON") as HTMLTextAreaElement).value)).toEqual(preset);
    const restore = screen.getByRole("button", { name: "Restore JSON" }) as HTMLButtonElement;
    expect(restore.disabled).toBe(true);
    fireEvent.click(restore);
    expect(client.importPreset).not.toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText("Replace the current composition with this JSON"));
    fireEvent.click(restore);
    await waitFor(() => expect(client.importPreset).toHaveBeenCalledExactlyOnceWith(preset));
    await waitFor(() => expect(committed).toHaveBeenCalledOnce());
    expect(restore.disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Drag & Drop" }));
    await screen.findByRole("button", { name: "Cancel" });
    expect((screen.getByRole("button", { name: "Save JSON" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("honours unsupported capabilities and other active runtime sessions", async () => {
    const { createClient, emit } = fixture(["cabinetPlacement.beginAdd"]);
    const { unmount } = render(
      <CabinetPlacementDebug ready selection={selection} selectedProductId={null} createClient={createClient} />,
    );
    const add = screen.getByRole("button", { name: "Drag & Drop" }) as HTMLButtonElement;
    await waitFor(() => expect(add.disabled).toBe(false));
    expect(screen.queryByRole("button", { name: "Move selected cabinet" })).toBeNull();
    expect(screen.queryByText("Countertop test controls")).toBeNull();
    emit("composition.change", { activeSessionId: "external-draft" });
    expect(add.disabled).toBe(true);
    emit("composition.change", { activeSessionId: null });
    await waitFor(() => expect(add.disabled).toBe(false));
    unmount();
  });

  it("responds to runtime Cancel and disposes subscriptions on unmount", async () => {
    const { client, createClient, emit } = fixture();
    const { unmount } = render(
      <CabinetPlacementDebug ready selection={selection} selectedProductId={null} createClient={createClient} />,
    );
    const add = screen.getByRole("button", { name: "Drag & Drop" }) as HTMLButtonElement;
    await waitFor(() => expect(add.disabled).toBe(false));
    fireEvent.click(add);
    await screen.findByRole("button", { name: "Cancel" });
    emit("cabinetPlacement.action", { status: "cancelled", sessionId: "draft-1" });
    expect(add.disabled).toBe(false);
    unmount();
    expect(client.dispose).toHaveBeenCalledOnce();
  });

  it("clears draft controls when the placement stream publishes data: null", async () => {
    const { createClient, emit } = fixture();
    render(<CabinetPlacementDebug ready selection={selection} selectedProductId={null} createClient={createClient} />);
    const add = screen.getByRole("button", { name: "Drag & Drop" }) as HTMLButtonElement;
    await waitFor(() => expect(add.disabled).toBe(false));
    fireEvent.click(add);
    await screen.findByRole("button", { name: "Cancel" });
    emit("cabinetPlacement.change", null);
    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
    expect(add.disabled).toBe(false);
  });

  it("blocks cabinet commands while the countertop is being edited", async () => {
    const { client, createClient } = fixture();
    const controls = createRef<CabinetPlacementControls>();
    render(
      <CabinetPlacementDebug
        ref={controls}
        ready
        externalBusy
        selection={selection}
        selectedProductId="runtime-selected"
        createClient={createClient}
      />,
    );
    await screen.findByRole("button", { name: "Move selected cabinet" });
    expect((screen.getByRole("button", { name: "Drag & Drop" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Move selected cabinet" }) as HTMLButtonElement).disabled).toBe(true);
    act(() => controls.current?.reposition("runtime-selected"));
    expect(client.beginMove).not.toHaveBeenCalled();
  });
});

describe("Cabinet debug selection and mode", () => {
  it("preserves scene config and resolves its registered product type without an arbitrary id suffix", () => {
    const config = { ...selection.selection, ProductType: "Example-side-cabinet" };
    expect(
      resolveCabinetDebugSelection({
        config,
        selectedProductId: "Example-side-cabinet-abcdefghi",
        activeCabinetType: null,
        bindings: null,
      }),
    ).toEqual({ definitionId: "Example-side-cabinet", selection: config });
    expect(selection.selection.SupportGroupId).toBe("group-custom");
    expect(
      resolveCabinetDebugSelection({
        config: null,
        selectedProductId: "Example-side-cabinet-abcdefghi",
        activeCabinetType: null,
        bindings: null,
      }),
    ).toBeNull();
  });

  it("resolves scene IDs and active cabinet types through the collection's runtime bindings", () => {
    const bindings: RuntimeBindingSet = {
      schemaVersion: 1,
      collectionId: "example",
      bindings: [],
      productTypes: { "Side-Cabinet": "Example-side-cabinet", "Open-Shelf": "Example-open-shelf" },
    };
    expect(
      resolveCabinetDebugSelection({
        config: selection.selection,
        selectedProductId: "Example-side-cabinet-abcdefghi",
        activeCabinetType: null,
        bindings,
      }),
    ).toEqual(selection);
    expect(
      resolveCabinetDebugSelection({
        config: selection.selection,
        selectedProductId: null,
        activeCabinetType: "Open-Shelf",
        bindings,
      }),
    ).toEqual({ definitionId: "Example-open-shelf", selection: selection.selection });
    expect(
      resolveCabinetDebugSelection({
        config: { ...selection.selection, productType: "Example-open-shelf" },
        selectedProductId: null,
        activeCabinetType: null,
        bindings,
      })?.definitionId,
    ).toBe("Example-open-shelf");
  });

  it("works without local debug flags and excludes engineering runtimes", () => {
    expect(isCabinetPlacementDebugEnabled("?collectionId=urban-low-height")).toBe(true);
    expect(isCabinetPlacementDebugEnabled("?debug=true&local=true")).toBe(true);
    expect(isCabinetPlacementDebugEnabled("")).toBe(true);
    expect(isCabinetPlacementDebugEnabled("?debug=true")).toBe(true);
    expect(isCabinetPlacementDebugEnabled("?debug=true&local=true&cabinetEngineering=true")).toBe(false);
    expect(isCabinetPlacementDebugEnabled("?debug=true&local=true&cabinetFromLine=true")).toBe(false);
  });
});
