import {
  readDrawerOrganizers,
  type CandidateSlot,
  type Correction,
  type DrawerDerived,
  type DrawerName,
  type DrawerOrganizersRead,
  type DrawerOrganizersV1,
  type OrganizersReceipt,
  type OrganizersState,
} from "@/entities/configuration/model/drawerOrganizers";

/**
 * `ConfiguratorAPI.organizers` and `organizersOverlay` v1 (Ph2 drawer organizers, OPUS-C §4.2–4.4, names C/A).
 * The only place in the UI that names the runtime's error codes and reads its answers; the port
 * (features/playCanvasAdapter/lib/createOrganizerPort.ts) and the bridge use it.
 *
 * The state types come from entities/configuration/model/drawerOrganizers.ts (WP-1) and are re-exported here
 * as they are. Every value arrives from the PlayCanvas iframe (another realm), so the parsers check shapes with
 * `typeof` / `Array.isArray` only and return a plain copy made in this realm.
 *
 * A new code or reason is an API change of `ORGANIZERS_PUBLIC_CONTRACT_V1` (3D
 * `domain/drawer-organizers/organizer-contract.mjs`): it is added there, in the shared fixtures and here together.
 */

export { readDrawerOrganizers };
export type {
  CandidateSlot,
  Correction,
  DrawerDerived,
  DrawerName,
  DrawerOrganizersRead,
  DrawerOrganizersV1,
  OrganizersReceipt,
  OrganizersState,
};

/** CSS px of the iframe viewport, like `PlacementOverlayPoint`. */
export type OrganizersPoint = { x: number; y: number };

/**
 * Why 3D reports a product's state: `current` is the first delivery to a subscriber with `{ emitCurrent: true }`.
 * The type is made from this list, so the list `parseOrganizersChange` checks against cannot drift from it.
 */
const CHANGE_REASONS = [
  "current",
  "command",
  "width",
  "height",
  "drawers",
  "created",
  "restore",
  "removed",
  "config",
] as const;
export type OrganizersChangeReason = (typeof CHANGE_REASONS)[number];

/** `organizers.on('change')`: the product's state after a command, a size or drawer change, a restore. */
export type OrganizersChange = {
  productId: string;
  revision: number;
  state: OrganizersState;
  corrections: Correction[];
  reason: OrganizersChangeReason;
};

/** `organizers.on('view')`: the drawer shown from the top, null when none is. */
export type OrganizersView = { view: { productId: string; drawer: DrawerName } | null; reason: string };

/** One overlay frame (`organizersOverlay.on('change')`); the UI draws every control from it. */
export type OrganizersOverlayFrame = {
  revision: number;
  viewport: { width: number; height: number } | null;
  visible: boolean;
  view: { productId: string; drawer: DrawerName } | null;
  plus: Array<CandidateSlot & { center: OrganizersPoint; radiusPx: number }>;
  columns: Array<{ slot: number; hull: OrganizersPoint[]; center: OrganizersPoint; cells: OrganizersPoint[][] }>;
  lock: { fromSlot: number; toSlot: number; hull: OrganizersPoint[]; center: OrganizersPoint } | null;
  entries: Array<{
    productId: string;
    drawer: DrawerName;
    anchor: OrganizersPoint;
    count: number;
    eligible: boolean;
    open: boolean;
  }>;
  closeAnchor: OrganizersPoint | null;
};

/** `organizersOverlay.on('pointer')`: a tap on the canvas background while a drawer is in view (v1: the only kind). */
export type OrganizersPointer = { kind: "background"; point: OrganizersPoint; source: "mouse" | "touch" };

export type OrganizersColumnInput = { productId: string; drawer: DrawerName; slot: number };
export type OrganizersViewInsets = { left: number; right: number; top: number; bottom: number };

/** `ConfiguratorAPI.organizers` (concept §3.4). Products are addressed by the runtime id the scene knows. */
export type OrganizersApi = {
  contract: unknown;
  getState(productId: string): OrganizersState | null;
  list(): OrganizersState[];
  addColumn(input: OrganizersColumnInput & { style?: string }): Promise<OrganizersReceipt>;
  removeColumn(input: OrganizersColumnInput): Promise<OrganizersReceipt>;
  setColumnLayout(input: OrganizersColumnInput & { positions: number[] }): Promise<OrganizersReceipt>;
  /** Render only: neither the stored key nor the history changes. */
  previewColumnLayout(input: (OrganizersColumnInput & { positions: number[] }) | null): boolean;
  setStyle(input: { productId: string; drawer: DrawerName; style: string }): Promise<OrganizersReceipt>;
  clear(input: { productId: string; drawer?: DrawerName }): Promise<OrganizersReceipt>;
  setState(input: { productId: string; state: DrawerOrganizersV1 | null }): Promise<OrganizersReceipt>;
  dryRun(input: { productId: string; patch: Record<string, unknown> }): {
    state: DrawerOrganizersV1 | null;
    corrections: Correction[];
  };
  enterView(input: { productId: string; drawer: DrawerName }): Promise<{ status: string }>;
  exitView(): Promise<{ status: string }>;
  setViewInsets(insets: OrganizersViewInsets): void;
  whenSettled(): Promise<void>;
  on(event: "change" | "view", callback: (payload: unknown) => void, options?: { emitCurrent?: boolean }): () => void;
};

/** Methods the bridge may call on `organizers` (`ConfiguratorBridge.callOrganizers`). */
export type OrganizersMethod = Exclude<keyof OrganizersApi, "contract" | "on">;

/** `ConfiguratorAPI.organizersOverlay`. `pointer` takes no options (3D refuses them). */
export type OrganizersOverlayApi = {
  getState(): unknown;
  on(
    event: "change" | "pointer",
    callback: (payload: unknown) => void,
    options?: { emitCurrent?: boolean },
  ): () => void;
};

export const ORGANIZERS_ERROR_CODES = [
  "ORGANIZERS_NOT_READY",
  "ORGANIZERS_INVALID_INPUT",
  "ORGANIZERS_UNKNOWN_PRODUCT",
  "ORGANIZERS_NOT_ORGANIZER_PRODUCT",
  "ORGANIZERS_DRAWER_UNAVAILABLE",
  "ORGANIZERS_SLOT_UNAVAILABLE",
  "ORGANIZERS_NO_SUCH_COLUMN",
  "ORGANIZERS_UNSUPPORTED_VERSION",
] as const;

export type OrganizersErrorCode = (typeof ORGANIZERS_ERROR_CODES)[number];

export const isOrganizersErrorCode = (code: string): code is OrganizersErrorCode =>
  (ORGANIZERS_ERROR_CODES as readonly string[]).includes(code);

// The unions of a receipt's status and a correction's severity belong to
// entities/configuration/model/drawerOrganizers.ts. Each table below must name every member of its union (a
// `Record` with a key missing does not compile), so a member added there cannot be refused here as "unknown".
const RECEIPT_STATUSES: Record<OrganizersReceipt["status"], true> = {
  applied: true,
  noop: true,
  partial: true,
  rejected: true,
};
const SEVERITIES: Record<Correction["severity"], true> = { dropped: true, fixed: true, info: true, error: true };

const isReceiptStatus = (value: unknown): value is OrganizersReceipt["status"] =>
  typeof value === "string" && Object.hasOwn(RECEIPT_STATUSES, value);
const isSeverity = (value: unknown): value is Correction["severity"] =>
  typeof value === "string" && Object.hasOwn(SEVERITIES, value);

// ---- shape checks (realm-safe: typeof / Array.isArray only) ----

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const isDrawerName = (value: unknown): value is DrawerName => value === "Top" || value === "Bot";
const isNullOr = <T>(value: unknown, check: (value: unknown) => value is T): boolean => value === null || check(value);
const isListOf = (value: unknown, check: (item: unknown) => boolean): boolean =>
  Array.isArray(value) && value.every(check);

const isPoint = (value: unknown): value is OrganizersPoint => isRecord(value) && isNumber(value.x) && isNumber(value.y);
const isPolygon = (value: unknown) => isListOf(value, isPoint);
const isAddress = (value: unknown): value is { productId: string; drawer: DrawerName } =>
  isRecord(value) && typeof value.productId === "string" && isDrawerName(value.drawer);

const isCorrection = (value: unknown): value is Correction =>
  isRecord(value) &&
  typeof value.code === "string" &&
  isSeverity(value.severity) &&
  (value.drawer === undefined || isDrawerName(value.drawer)) &&
  (value.slot === undefined || Number.isInteger(value.slot));

const isCandidate = (value: unknown): value is CandidateSlot =>
  isRecord(value) &&
  typeof value.id === "string" &&
  isDrawerName(value.drawer) &&
  Number.isInteger(value.slot) &&
  typeof value.side === "string";

const isDrawerDerived = (value: unknown): value is DrawerDerived =>
  isRecord(value) &&
  typeof value.exists === "boolean" &&
  typeof value.offered === "boolean" &&
  isNullOr(value.role, (role): role is string => typeof role === "string") &&
  isNullOr(value.profile, isRecord) &&
  isNumber(value.maxSlot) &&
  isNumber(value.capacity) &&
  isNumber(value.count) &&
  isNullOr(value.lock, isRecord) &&
  isListOf(value.candidates, isCandidate) &&
  isNullOr(value.unavailable, (reason): reason is string => typeof reason === "string");

/** A plain copy in this realm. What the scene sends is JSON data by contract, so a JSON round trip keeps all of it. */
const copyPlain = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/**
 * The stored part of an `OrganizersState`: 3D sends the normalised key, so it reads as `ok` or `absent`.
 * `undefined` when it reads as anything else (the answer is broken).
 */
const readStoredState = (raw: unknown): DrawerOrganizersV1 | null | undefined => {
  const read = readDrawerOrganizers(raw);
  if (read.status === "ok") return read.value;
  if (read.status === "absent") return null;
  return undefined;
};

/**
 * `OrganizersState` of one product as 3D builds it (`getState`, `list`, receipts, `change`), or null when the
 * answer does not have that shape. Example: `parseOrganizersState({ productId: "rt-1", revision: 1, params, state:
 * null, drawers: { Top, Bot }, lastCorrections: [] })` → the same object, copied.
 */
export const parseOrganizersState = (raw: unknown): OrganizersState | null => {
  if (!isRecord(raw)) return null;
  if (typeof raw.productId !== "string" || !isNumber(raw.revision) || !isRecord(raw.params)) return null;

  const drawers = raw.drawers;
  if (!isRecord(drawers) || !isDrawerDerived(drawers.Top) || !isDrawerDerived(drawers.Bot)) return null;
  if (!isListOf(raw.lastCorrections, isCorrection)) return null;

  const stored = readStoredState(raw.state);
  if (stored === undefined) return null;

  return copyPlain({
    productId: raw.productId,
    revision: raw.revision,
    params: raw.params as OrganizersState["params"],
    state: stored,
    drawers: { Top: drawers.Top, Bot: drawers.Bot },
    lastCorrections: raw.lastCorrections as Correction[],
  });
};

const invalidReceipt = (): OrganizersReceipt => ({
  status: "rejected",
  state: null,
  corrections: [],
  error: { code: "API_INVALID_RESPONSE", message: "The scene did not answer with an organizers receipt." },
});

/**
 * A command's receipt. Anything that is not a receipt reads as `rejected` with `API_INVALID_RESPONSE`, so a broken
 * answer is never taken for a change: `rejected` needs an error, and a state that is sent must read as one.
 * `applied` / `partial` / `noop` may come with `state: null`: the product went away while 3D waited for its
 * render, so the command was applied but there is nothing left to record.
 */
export const parseOrganizersReceipt = (raw: unknown): OrganizersReceipt => {
  if (!isRecord(raw)) return invalidReceipt();

  const status = raw.status;
  if (!isReceiptStatus(status)) return invalidReceipt();
  if (!isListOf(raw.corrections, isCorrection)) return invalidReceipt();
  const corrections = copyPlain(raw.corrections as Correction[]);
  const state = parseOrganizersState(raw.state);

  if (status !== "rejected") {
    // A state the UI cannot read is not one it can record.
    if (raw.state !== null && !state) return invalidReceipt();
    return { status, state, corrections };
  }

  const error = raw.error;
  if (!isRecord(error) || typeof error.code !== "string") return invalidReceipt();
  const message = typeof error.message === "string" ? error.message : error.code;
  return { status, state, corrections, error: { code: error.code, message } };
};

/** `organizers.on('change')` payload, or null when it is broken or names a reason the contract does not know. */
export const parseOrganizersChange = (raw: unknown): OrganizersChange | null => {
  if (!isRecord(raw)) return null;
  if (typeof raw.productId !== "string" || !isNumber(raw.revision)) return null;
  if (!CHANGE_REASONS.includes(raw.reason as OrganizersChangeReason)) return null;
  if (!isListOf(raw.corrections, isCorrection)) return null;

  const state = parseOrganizersState(raw.state);
  if (!state) return null;

  return {
    productId: raw.productId,
    revision: raw.revision,
    state,
    corrections: copyPlain(raw.corrections as Correction[]),
    reason: raw.reason as OrganizersChangeReason,
  };
};

/** `organizers.on('view')` payload, or null when it is broken. */
export const parseOrganizersView = (raw: unknown): OrganizersView | null => {
  if (!isRecord(raw) || typeof raw.reason !== "string") return null;
  if (raw.view !== null && !isAddress(raw.view)) return null;

  const view = raw.view === null ? null : { productId: raw.view.productId, drawer: raw.view.drawer };
  return { view, reason: raw.reason };
};

const isPlus = (value: unknown) =>
  isCandidate(value) &&
  isPoint((value as Record<string, unknown>).center) &&
  isNumber((value as Record<string, unknown>).radiusPx);

const isColumnShape = (value: unknown) =>
  isRecord(value) &&
  Number.isInteger(value.slot) &&
  isPolygon(value.hull) &&
  isPoint(value.center) &&
  isListOf(value.cells, isPolygon);

const isLockShape = (value: unknown) =>
  isRecord(value) &&
  isNumber(value.fromSlot) &&
  isNumber(value.toSlot) &&
  isPolygon(value.hull) &&
  isPoint(value.center);

const isEntry = (value: unknown) =>
  isAddress(value) &&
  isPoint((value as Record<string, unknown>).anchor) &&
  isNumber((value as Record<string, unknown>).count) &&
  typeof (value as Record<string, unknown>).eligible === "boolean" &&
  typeof (value as Record<string, unknown>).open === "boolean";

const isViewport = (value: unknown) => isRecord(value) && isNumber(value.width) && isNumber(value.height);

/**
 * One overlay frame, copied, or null: 3D sends null when there is nothing to show, and a broken frame shows
 * nothing either (the layer must never draw a control at a wrong place).
 */
export const parseOrganizersFrame = (raw: unknown): OrganizersOverlayFrame | null => {
  if (!isRecord(raw)) return null;

  const valid =
    isNumber(raw.revision) &&
    (raw.viewport === null || isViewport(raw.viewport)) &&
    typeof raw.visible === "boolean" &&
    (raw.view === null || isAddress(raw.view)) &&
    isListOf(raw.plus, isPlus) &&
    isListOf(raw.columns, isColumnShape) &&
    (raw.lock === null || isLockShape(raw.lock)) &&
    isListOf(raw.entries, isEntry) &&
    (raw.closeAnchor === null || isPoint(raw.closeAnchor));
  if (!valid) return null;

  return copyPlain({
    revision: raw.revision,
    viewport: raw.viewport,
    visible: raw.visible,
    view: raw.view,
    plus: raw.plus,
    columns: raw.columns,
    lock: raw.lock,
    entries: raw.entries,
    closeAnchor: raw.closeAnchor,
  } as OrganizersOverlayFrame);
};

/** `organizersOverlay.on('pointer')` payload, or null for anything but a background tap. */
export const parseOrganizersPointer = (raw: unknown): OrganizersPointer | null => {
  if (!isRecord(raw) || raw.kind !== "background" || !isPoint(raw.point)) return null;
  if (raw.source !== "mouse" && raw.source !== "touch") return null;
  return { kind: "background", point: { x: raw.point.x, y: raw.point.y }, source: raw.source };
};

/**
 * The read-model entry for one product (`configuration.organizersByCabinet`) from its state.
 *
 * 3D leaves the data of a newer build untouched and normalises it to `state: null` with an UNSUPPORTED_VERSION
 * diagnostic; read as `absent` it would be priced and saved as empty. So that diagnostic, in the event's
 * corrections or in the state's `lastCorrections`, wins over the null state.
 * Example: `{ state: null, lastCorrections: [{ code: "UNSUPPORTED_VERSION", severity: "error" }] }`
 * → `{ status: "unsupported-version", version: null }`.
 */
export const readModelEntryOf = (
  state: OrganizersState,
  corrections: readonly Correction[] = [],
): DrawerOrganizersRead => {
  const unsupported = [...corrections, ...state.lastCorrections].find(({ code }) => code === "UNSUPPORTED_VERSION");
  if (unsupported) return { status: "unsupported-version", version: unsupported.detail?.version ?? null };
  return readDrawerOrganizers(state.state);
};

/** Any failure of an `organizers` call (a thrown runtime error or a bridge error) as one shape, for logs and notices. */
export const classifyOrganizersError = (error: unknown): { code: string; message: string } => {
  const detail = (typeof error === "object" && error !== null ? error : {}) as { code?: unknown; message?: unknown };
  const code = typeof detail.code === "string" ? detail.code : "UNKNOWN";

  let message = "Organizers command failed";
  if (typeof detail.message === "string" && detail.message) message = detail.message;
  else if (typeof error === "string" && error) message = error;

  return { code, message };
};
