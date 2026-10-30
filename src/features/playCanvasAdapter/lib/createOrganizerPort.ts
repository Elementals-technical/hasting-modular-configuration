import type {
  ConfigurationOrganizerPort,
  OrganizerApplyResult,
  OrganizerPortCommand,
  OrganizerProductState,
} from "@/entities/configuration";
import type { Correction, DrawerName, OrganizersState } from "@/entities/configuration/model/drawerOrganizers";
import {
  classifyOrganizersError,
  createConfiguratorBridge,
  parseOrganizersChange,
  parseOrganizersFrame,
  parseOrganizersPointer,
  parseOrganizersReceipt,
  parseOrganizersState,
  parseOrganizersView,
  readModelEntryOf,
} from "@/features/configuratorApi";
import type {
  ConfiguratorBridge,
  ConfiguratorUnsubscribe,
  OrganizersChange,
  OrganizersMethod,
  OrganizersOverlayFrame,
  OrganizersPointer,
  OrganizersView,
  OrganizersViewInsets,
} from "@/features/configuratorApi";
import { isSceneReady } from "@/utils/functions/playcanvas/sceneBridge";

/**
 * The Ph2 drawer organizers over `ConfiguratorAPI.organizers` / `organizersOverlay` (I).
 *
 * The scene owns the `DrawerOrganizers` key and every rule (slots, zones, positions). This port sends a
 * command by runtime id and reports what the scene answered, so the command records only what the scene
 * holds. The runtime part (view, preview, events, frames) never throws: a build without organizers, or a
 * failing call, answers false / null and is logged.
 */

/** A render-only layout of one column; the stored key and the history do not change. */
export type OrganizerPreview = { runtimeId: string; drawer: DrawerName; slot: number; positions: readonly number[] };
export type OrganizerViewAddress = { runtimeId: string; drawer: DrawerName };

export type OrganizerRuntimePort = {
  /** Shows (or, with null, clears) a column preview. False when the scene did not take it. */
  preview(preview: OrganizerPreview | null): Promise<boolean>;
  /** Shows the drawer from the top. False when the scene refused it or has no organizers. */
  enterView(address: OrganizerViewAddress): Promise<boolean>;
  exitView(): Promise<boolean>;
  /** CSS px of the iframe the panel covers, so 3D frames the drawer in the free part. */
  setViewInsets(insets: OrganizersViewInsets): Promise<boolean>;
  /** The state of every organizer product; null when the build has no organizers. */
  list(): Promise<OrganizersState[] | null>;
  /** The state of one product; null when it is not an organizer product or the build has no organizers. */
  getState(runtimeId: string): Promise<OrganizersState | null>;
  /** Each subscription delivers the current state first; null when the build has no such event. */
  onChange(callback: (change: OrganizersChange) => void): Promise<ConfiguratorUnsubscribe | null>;
  onView(callback: (view: OrganizersView) => void): Promise<ConfiguratorUnsubscribe | null>;
  /** Null frame: nothing to draw (also for a frame that does not read as one). */
  onFrame(callback: (frame: OrganizersOverlayFrame | null) => void): Promise<ConfiguratorUnsubscribe | null>;
  /** A tap on the canvas background while a drawer is in view. */
  onPointer(callback: (pointer: OrganizersPointer) => void): Promise<ConfiguratorUnsubscribe | null>;
  /**
   * Resolves once every organizers command sent so far has its receipt and the composition rules are idle.
   * Resolves at once (and never rejects) when the build has no organizers or the call fails.
   */
  whenSettled(): Promise<void>;
};

export type OrganizerPort = ConfigurationOrganizerPort & OrganizerRuntimePort;

export type OrganizerPortDeps = {
  /** Tests pass a fake; the app uses the configurator bridge. */
  bridge?: Pick<ConfiguratorBridge, "callOrganizers" | "subscribeOrganizers" | "subscribeOrganizersOverlay">;
  /** Whether the scene can take commands now; the app asks the scene bridge. */
  isReady?: () => boolean;
};

const warn = (what: string, detail: unknown) => console.warn(`[drawerOrganizers] ${what}`, detail);

/**
 * The input `ConfiguratorAPI.organizers` takes for a single-product command (3D checks the keys in its
 * `INPUTS` table, organizers.plugin.mjs).
 * Examples: `{ kind: "setStyle", runtimeId: "rt-1", drawer: "Bot", style: "Metal" }` → `{ productId: "rt-1",
 * drawer: "Bot", style: "Metal" }`; `{ kind: "setState", runtimeId: "rt-1", state: null }` → `{ productId: "rt-1",
 * state: null }` (null stores "no organizers", so the key must be sent, not left out).
 */
const toInput = (command: Exclude<OrganizerPortCommand, { kind: "clear" }>): Record<string, unknown> => {
  // `setState` puts back the whole stored key of the product: it names no drawer.
  if (command.kind === "setState") return { productId: command.runtimeId, state: command.state };

  const address = { productId: command.runtimeId, drawer: command.drawer };
  switch (command.kind) {
    case "addColumn":
      return { ...address, slot: command.slot, ...(command.style === undefined ? {} : { style: command.style }) };
    case "removeColumn":
      return { ...address, slot: command.slot };
    case "setColumnLayout":
      return { ...address, slot: command.slot, positions: [...command.positions] };
    case "setStyle":
      return { ...address, style: command.style };
  }
};

export const createOrganizerPort = ({
  bridge = createConfiguratorBridge(),
  isReady = isSceneReady,
}: OrganizerPortDeps = {}): OrganizerPort => {
  /** One command on one product: the receipt as the scene's answer about that product. */
  const applyToProduct = async (
    method: OrganizersMethod,
    input: Record<string, unknown>,
    runtimeId: string,
  ): Promise<OrganizerApplyResult> => {
    let raw: unknown;
    try {
      raw = bridge.callOrganizers ? await bridge.callOrganizers(method, input) : null;
    } catch (error) {
      const { code, message } = classifyOrganizersError(error);
      return { status: "failed", message: `${code}: ${message}` };
    }
    // The build has no organizers (or the iframe is gone): nothing was sent.
    if (raw === null) return { status: "not-ready" };

    const receipt = parseOrganizersReceipt(raw);
    if (receipt.status === "rejected") {
      const error = receipt.error ?? { code: "API_INVALID_RESPONSE", message: "The scene refused the command." };
      return { status: "rejected", code: error.code, message: error.message };
    }
    // Applied, but the product went away during the render: nothing of it is left to record.
    if (!receipt.state) return { status: receipt.status, products: [], corrections: receipt.corrections };

    const product: OrganizerProductState = {
      runtimeId,
      entry: readModelEntryOf(receipt.state, receipt.corrections),
      drawers: receipt.state.drawers,
    };
    return { status: receipt.status, products: [product], corrections: receipt.corrections };
  };

  /**
   * `clear` runs product by product (OPUS-C §4.3: `clear{productId}`). A failure before anything changed is
   * reported as it is; after a product changed it is `partial`, with what the scene holds so far.
   */
  const clearProducts = async (runtimeIds: readonly string[]): Promise<OrganizerApplyResult> => {
    const products: OrganizerProductState[] = [];
    const corrections: Correction[] = [];
    let changed = false;
    let corrected = false;

    for (const runtimeId of runtimeIds) {
      const result = await applyToProduct("clear", { productId: runtimeId }, runtimeId);

      if (result.status === "rejected" || result.status === "not-ready" || result.status === "failed") {
        if (!changed) return result;
        warn("clear stopped after a product changed", { runtimeId, result });
        return { status: "partial", products, corrections };
      }

      products.push(...result.products);
      corrections.push(...result.corrections);
      if (result.status !== "noop") changed = true;
      if (result.status === "partial") corrected = true;
    }

    if (!changed) return { status: "noop", products, corrections };
    return { status: corrected ? "partial" : "applied", products, corrections };
  };

  /**
   * A runtime call that answers `read(raw)`, or `fallback` when the build has no such method (the bridge
   * answers null) or it threw. A method that returns nothing (`setViewInsets`) reads `undefined`.
   */
  const callRuntime = async <T>(method: OrganizersMethod, input: unknown, read: (raw: unknown) => T, fallback: T) => {
    try {
      const raw = bridge.callOrganizers ? await bridge.callOrganizers(method, input) : null;
      return raw === null ? fallback : read(raw);
    } catch (error) {
      warn(`organizers.${method} failed`, classifyOrganizersError(error));
      return fallback;
    }
  };

  const isViewApplied = (raw: unknown) =>
    typeof raw === "object" && raw !== null && (raw as { status?: unknown }).status !== "rejected";

  const subscribe = async (
    subscribeTo: (callback: (payload: unknown) => void) => Promise<ConfiguratorUnsubscribe | null> | undefined,
    operation: string,
    deliver: (payload: unknown) => void,
  ): Promise<ConfiguratorUnsubscribe | null> => {
    try {
      return (await subscribeTo(deliver)) ?? null;
    } catch (error) {
      warn(`${operation} failed`, classifyOrganizersError(error));
      return null;
    }
  };

  return {
    isReady,

    async apply(command) {
      if (!isReady()) return { status: "not-ready" };
      if (command.kind === "clear") return clearProducts(command.runtimeIds);
      return applyToProduct(command.kind, toInput(command), command.runtimeId);
    },

    preview: (preview) =>
      callRuntime(
        "previewColumnLayout",
        preview === null
          ? null
          : {
              productId: preview.runtimeId,
              drawer: preview.drawer,
              slot: preview.slot,
              positions: [...preview.positions],
            },
        (raw) => raw === true,
        false,
      ),

    enterView: ({ runtimeId, drawer }) =>
      callRuntime("enterView", { productId: runtimeId, drawer }, isViewApplied, false),

    exitView: () => callRuntime("exitView", undefined, isViewApplied, false),

    setViewInsets: (insets) =>
      callRuntime(
        "setViewInsets",
        { left: insets.left, right: insets.right, top: insets.top, bottom: insets.bottom },
        () => true,
        false,
      ),

    list: () =>
      callRuntime(
        "list",
        undefined,
        (raw) => (Array.isArray(raw) ? raw.flatMap((item) => parseOrganizersState(item) ?? []) : []),
        null,
      ),

    getState: (runtimeId) => callRuntime("getState", runtimeId, parseOrganizersState, null),

    // A build without `whenSettled` (the bridge answers null) has nothing to wait for; a failed call is logged.
    whenSettled: () => callRuntime("whenSettled", undefined, () => undefined, undefined),

    onChange: (callback) =>
      subscribe(
        (deliver) => bridge.subscribeOrganizers?.("change", deliver),
        "organizers.on('change')",
        (payload) => {
          const change = parseOrganizersChange(payload);
          if (change) callback(change);
          else warn("ignored a change that does not read as one", payload);
        },
      ),

    onView: (callback) =>
      subscribe(
        (deliver) => bridge.subscribeOrganizers?.("view", deliver),
        "organizers.on('view')",
        (payload) => {
          const view = parseOrganizersView(payload);
          if (view) callback(view);
          else warn("ignored a view event that does not read as one", payload);
        },
      ),

    onFrame: (callback) =>
      subscribe(
        (deliver) => bridge.subscribeOrganizersOverlay?.("change", deliver),
        "organizersOverlay.on('change')",
        (payload) => callback(parseOrganizersFrame(payload)),
      ),

    onPointer: (callback) =>
      subscribe(
        (deliver) => bridge.subscribeOrganizersOverlay?.("pointer", deliver),
        "organizersOverlay.on('pointer')",
        (payload) => {
          const pointer = parseOrganizersPointer(payload);
          if (pointer) callback(pointer);
        },
      ),
  };
};
