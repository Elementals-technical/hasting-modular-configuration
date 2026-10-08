export type ConfiguratorReadiness = "initializing" | "ready" | "error" | "unsupported";

export type ConfiguratorScope = {
  apiInstanceId: string;
  compositionId: string;
};

export type ConfiguratorApiContext = {
  dependencies?: {
    compositionRevision?: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

export type ConfiguratorApiErrorDetail = {
  code: string;
  message?: string;
  reasons?: unknown[];
  retryable?: boolean;
  requestId?: string;
  [key: string]: unknown;
};

export type ConfiguratorApiResult<T> =
  | { ok: true; data: T; context?: ConfiguratorApiContext }
  | { ok: false; error: ConfiguratorApiErrorDetail; context?: ConfiguratorApiContext };

export type ConfiguratorCapabilities = {
  readiness: ConfiguratorReadiness;
  apiInstanceId: string;
  activeCompositionId: string;
  collectionId?: string;
  supportedMethods: string[];
};

export type CabinetPositionM = { x: number; y: number; z: number };
export type CabinetSelection = Record<string, unknown>;

export type Cabinet = {
  id: string;
  definitionId: string;
  selection: CabinetSelection;
  positionM: CabinetPositionM;
  [key: string]: unknown;
};

export type CabinetConnection = Record<string, unknown>;

export type CabinetsState = {
  cabinets: Cabinet[];
  connections: CabinetConnection[];
  selectedCabinetId: string | null;
};

export type CabinetCatalogEntry = {
  definitionId: string;
  label: string;
  availability: unknown;
  [key: string]: unknown;
};

export type CabinetConfigurationField = {
  id?: string;
  key?: string;
  [key: string]: unknown;
};

export type CabinetConfigurationOptions = CabinetConfigurationField[];

export type CabinetPlacementOption = {
  id: string;
  kind: string;
  anchorCabinetId?: string;
  positionM: CabinetPositionM;
  [key: string]: unknown;
};

export type CabinetPlacement = {
  kind: string;
  frameId?: string;
  positionM?: CabinetPositionM;
  optionId?: string;
  [key: string]: unknown;
};

/** One reason a draft cannot be applied (validation.reasons[]). `message` comes from the collection's rule pack. */
export type CabinetDraftReason = {
  code: string;
  messageKey?: string;
  message?: string | null;
  params?: Record<string, unknown>;
  affectedProductIds: string[];
  decisionIds?: string[];
  severity?: "invalid" | "unsupported" | "pending";
  ruleId?: string;
};

export type CabinetDraftValidation = {
  status: "valid" | "invalid" | "unsupported" | "pending";
  reasons: CabinetDraftReason[];
  requiredDecisionIds?: string[];
  candidateRevision?: number;
  [key: string]: unknown;
};

export type CabinetDraftState = {
  sessionId: string;
  kind: "add" | "move";
  lifecycle: "loading-draft" | "preview" | "applying" | "committed" | "cancelled" | "error";
  baseCompositionRevision: number;
  candidateRevision: number;
  candidate?: {
    effectivePlacement?: { positionM?: CabinetPositionM; [key: string]: unknown };
    [key: string]: unknown;
  };
  validation?: CabinetDraftValidation;
  canApply: boolean;
  canCancel: boolean;
  [key: string]: unknown;
};

export type ConfiguratorReceipt = {
  requestId: string;
  sessionId?: string;
  kind: string;
  compositionRevision: number;
  addedProductIds: string[];
  updatedProductIds: string[];
  removedProductIds: string[];
  selectedCabinetId: string | null;
  [key: string]: unknown;
};

export type ConfiguratorPresetProduct = {
  name: string;
  [key: string]: unknown;
};

/** Portable preset v2 is intentionally open: the UI stores the runtime document unchanged. */
export type ConfiguratorPreset = {
  presetSchemaVersion: number;
  collection: Record<string, unknown>;
  presetProducts: unknown[];
  presetLayout: Record<string, unknown>;
  [key: string]: unknown;
};

export type ConfiguratorCompactPresetRow = {
  elevation?: number;
  offsetX?: number;
  products: ConfiguratorPresetProduct[];
};

/** Compact preset (format "ulh-compact-v1"); all lengths in cm. See scratch CONTRACT / compact-preset.mjs. */
export type ConfiguratorCompactPreset = {
  format: "ulh-compact-v1";
  collection: string;
  shared?: Record<string, unknown>;
  rows: ConfiguratorCompactPresetRow[];
  top?: { productType: string; positionM?: CabinetPositionM; [key: string]: unknown };
  featureSettings?: Record<string, unknown>;
  [key: string]: unknown;
};

export type ConfiguratorImportReceipt = ConfiguratorReceipt & {
  keyToProductId: Record<string, string>;
};

export type CompositionState = {
  status: "ready" | "applying" | "recovery-required" | string;
  activeSessionId: string | null;
  [key: string]: unknown;
};

export type ConfiguratorCommandResult = {
  status: string;
  result?: unknown;
  error?: ConfiguratorApiErrorDetail;
};

export type ConfiguratorEventEnvelope<T> = ConfiguratorScope & {
  eventSequence: number;
  compositionRevision: number;
  data: T;
};

/**
 * Screen frame of an open cabinet draft, published by PlayCanvas (`ConfiguratorAPI.placementOverlay`)
 * every time it changes. Coordinates are CSS px of the configurator iframe's viewport, so they map
 * 1:1 onto an absolutely positioned layer that covers the iframe.
 */
export type PlacementOverlayPoint = { x: number; y: number };
export type PlacementOverlayPointName =
  | "center"
  | "frontCenter"
  | "topLeft"
  | "topRight"
  | "bottomLeft"
  | "bottomRight"
  | "topCenter"
  | "bottomCenter";
export type PlacementOverlayFrame = {
  sessionId: string;
  kind: "add" | "move" | null;
  lifecycle: CabinetDraftState["lifecycle"];
  /** clear: green; colliding: red, Apply blocked; unknown: geometry not measurable (not blocking). */
  status: "clear" | "colliding" | "unknown";
  collidesWith: string[];
  canApply: boolean;
  canCancel: boolean;
  /** A pointer drag of the draft is in progress. */
  dragging: boolean;
  /** False when the draft is (partly) behind the camera: no anchors. */
  visible: boolean;
  viewport: { width: number; height: number } | null;
  hull: PlacementOverlayPoint[];
  bounds: { left: number; top: number; right: number; bottom: number; width: number; height: number } | null;
  points: Record<PlacementOverlayPointName, PlacementOverlayPoint> | null;
};
export type PlacementOverlayApi = {
  getState(): PlacementOverlayFrame | null;
  on(
    event: "change",
    callback: (frame: PlacementOverlayFrame | null) => void,
    options?: { emitCurrent?: boolean },
  ): ConfiguratorUnsubscribe;
  /** PlayCanvas draws temporary icons until the UI switches them off. */
  setPlaceholdersEnabled(enabled: boolean): void;
};

/**
 * Screen frame of the countertop in Drag & Drop mode (`ConfiguratorAPI.countertopOverlay`), in the
 * configurator iframe's viewport px like `PlacementOverlayFrame`. `lengthAxisPx` is the screen
 * vector of one metre along the countertop's length axis (left end -> right end).
 */
export type CountertopOverlayPointName =
  | PlacementOverlayPointName
  | "leftEnd"
  | "rightEnd"
  | "lengthLabel"
  | "depthLabel";
export type CountertopOverlayReason = { code: string; message: string };
export type CountertopResizeSide = "left" | "right";
/** Ghost length preview drawn in the overlay frames only (`countertopOverlay.previewLength`). */
export type CountertopLengthPreview = { side: CountertopResizeSide; lengthM: number };
/** `countertopOverlay.lengthAtPointer`: the length a one-sided resize would get at a frame point. */
export type CountertopLengthAtPointer = {
  lengthM: number;
  rawLengthM: number;
  snappedTo: { kind: string; xM: number } | null;
  limits: { minLengthM: number; maxLengthM: number };
};
export type CountertopOverlayFrame = {
  active: boolean;
  /** clear: green; colliding: red, Apply blocked; unknown: geometry not measurable. */
  status: "clear" | "colliding" | "unknown";
  reasons: CountertopOverlayReason[];
  collidesWith: string[];
  attached: boolean;
  lengthM: number | null;
  depthM: number | null;
  limits: { minLengthM: number; maxLengthM: number } | null;
  canApply: boolean;
  dragging: boolean;
  visible: boolean;
  viewport: { width: number; height: number } | null;
  hull: PlacementOverlayPoint[];
  bounds: { left: number; top: number; right: number; bottom: number; width: number; height: number } | null;
  points: Partial<Record<CountertopOverlayPointName, PlacementOverlayPoint>> | null;
  lengthAxisPx: PlacementOverlayPoint | null;
  /** Set while a ghost preview is shown; `lengthM` is then the preview length. */
  preview?: CountertopLengthPreview | null;
};
/** `ConfiguratorAPI.room`: the UI names the open collection; the scene places the room for it. */
export type RoomApi = {
  setCollection?: (collectionId: string | null) => unknown;
  clearCollection?: () => unknown;
  getState?: () => unknown;
};

export type CountertopOverlayApi = {
  setActive(active: boolean): void;
  getState(): CountertopOverlayFrame | null;
  on(
    event: "change",
    callback: (frame: CountertopOverlayFrame | null) => void,
    options?: { emitCurrent?: boolean },
  ): ConfiguratorUnsubscribe;
  setPlaceholdersEnabled(enabled: boolean): void;
  /** Newer builds only (feature-detect). */
  previewLength?(preview: CountertopLengthPreview | null): void;
  /** Newer builds only (feature-detect). `point` is in frame (iframe viewport px) coordinates. */
  lengthAtPointer?(
    side: CountertopResizeSide,
    point: PlacementOverlayPoint,
    options?: { snap?: boolean },
  ): CountertopLengthAtPointer | null;
};
/** Effective countertop length limits in metres; null restores the runtime defaults. */
export type CountertopLengthLimitsM = { minM: number; maxM: number };

/*
 * `ConfiguratorAPI.countertop` (phase 1, PlayCanvas `docs/countertop/ui-integration-phase1.md`).
 * Metres, world XY; `offset` is measured from the standard (composition) pose. Fields stay optional:
 * older builds omit them, and the UI must feature-detect.
 */
/** `getState().resizeBoundsM[side]`: limits of a one-end resize that keeps the other end at `anchorXM`. */
export type CountertopResizeBoundsSide = {
  anchorXM: number;
  minLengthM: number;
  maxLengthM: number;
  basinMinLengthM?: number | null;
  supportMinLengthM?: number | null;
};
export type CountertopValidationStatus = "valid" | "invalid" | "unknown";
/** Verdict of the current pose; `reasons` / `warnings` are slugs (`CountertopReasonSlug`). */
export type CountertopValidation = { status: CountertopValidationStatus; reasons: string[]; warnings: string[] };
export type CountertopSinkLandingStatus = "none" | "home" | "fits" | "gap" | "unfit";
/** Where the sink a lifted top carries would land. */
export type CountertopSinkLanding = {
  status: CountertopSinkLandingStatus;
  cabinetId: string | null;
  fromCabinetId: string | null;
  reason: "TYPE" | "HEIGHT" | null;
  snapDxM: number;
};
/** A 'fits' landing waiting for the UI to commit (`cabinets.moveSink`) or decline. */
export type CountertopSinkPending = { cabinetId: string; fromCabinetId: string };
/** `owner`: 'cabinet' while the top rests (the sink sits on its sink base); 'countertop' while it carries it. */
export type CountertopSinkState = {
  owner: "cabinet" | "countertop" | null;
  shiftM: number;
  landing: CountertopSinkLanding | null;
  pending: CountertopSinkPending | null;
};
export type CountertopPlacementState = "waiting" | "attached" | "moved";
export type CountertopState = {
  readiness: string;
  productId: string | null;
  compositionId?: string | null;
  placementState?: CountertopPlacementState;
  attached?: boolean;
  moved?: boolean;
  /** `ready && !attached`: the edit-size button only, never the end handles. */
  canResize?: boolean;
  offset?: { x: number; y: number };
  customLength?: number | null;
  autoLength?: number | null;
  size?: { length?: number | null; depth?: number | null };
  thickness?: number | null;
  dragEnabled?: boolean;
  dragging?: boolean;
  moving?: boolean;
  /** Effective limits (`getLengthLimitsM()`): the requested ones raised to fit the basin cut-outs. */
  lengthLimitsM?: {
    minLengthM: number;
    maxLengthM: number;
    requestedMinM?: number | null;
    requestedMaxM?: number | null;
    basinMinLengthM?: number | null;
  } | null;
  resizeBoundsM?: { left: CountertopResizeBoundsSide | null; right: CountertopResizeBoundsSide | null } | null;
  validation?: CountertopValidation;
  sink?: CountertopSinkState;
  /** Offset-only mode (4″ tops): no lift by the API or the pointer. */
  verticalLocked?: boolean;
  /** Locked, but a restored pose is lifted (kept, not rejected): offer "lower" / "reset". */
  verticalLockViolated?: boolean;
};
export type CountertopChangeReason =
  | "current"
  | "selection"
  | "reset"
  | "layout"
  | "restored"
  | "offset"
  | "length"
  | "length-settled"
  | "length-limits"
  | "validation"
  | "vertical-lock"
  | "sink-landing";
export type CountertopEvent = { reason?: CountertopChangeReason | (string & {}); type?: string; state: CountertopState };
export type CountertopAction =
  | { type: "edit-size"; state: CountertopState }
  | { type: "sink-landing"; landing: CountertopSinkLanding };
/** 'guard' (default): an invalid pose is reverted and the call throws COUNTERTOP_POSE_INVALID. */
export type CountertopCommandOptions = { validation?: "guard" | "skip" };
export type CountertopApi = {
  getState(): CountertopState | Promise<CountertopState>;
  setDragEnabled(enabled: boolean): unknown;
  setOffset(offset: { x: number; y: number }, options?: CountertopCommandOptions): unknown;
  /** Back to Standard (drops the custom length); not validated. */
  resetOffset(): unknown;
  /** Symmetric, moved tops only (client §17: on a standard top the length changes through the handles). */
  setSize(size: { length: number | null }): unknown;
  /** One-end resize, the other end fixed, clamped to `resizeBoundsM[side]`; works on a standard top too. */
  resizeFrom?(side: CountertopResizeSide, lengthM: number, options?: CountertopCommandOptions): unknown;
  /** Newer builds only (feature-detect). */
  setVerticalLocked?(locked: boolean): unknown;
  whenSettled(): CountertopState | Promise<CountertopState>;
  on(event: "change", callback: (event: CountertopEvent) => void, options?: { emitCurrent?: boolean }): () => void;
  on(event: "action", callback: (action: CountertopAction) => void, options?: { emitCurrent?: boolean }): () => void;
};
/** `error.code` of a rejected countertop command. */
export type CountertopErrorCode =
  | "COUNTERTOP_POSE_INVALID"
  | "COUNTERTOP_VERTICAL_LOCKED"
  | "COUNTERTOP_ATTACHED"
  | "COUNTERTOP_INVALID_INPUT"
  | "COUNTERTOP_NOT_READY"
  | "COUNTERTOP_DESTROYED"
  | "LEGACY_WRITERS_BUSY";
/** Slugs of `validation.reasons` / `.warnings` and of `COUNTERTOP_POSE_INVALID.reasons`. */
export type CountertopReasonSlug =
  | "TRAP_KEEPOUT"
  | "BASIN_EDGE_TOO_CLOSE"
  | "SINK_BASE_NOT_COVERED"
  | "SINK_LANDING_GAP"
  | "SINK_LANDING_UNFIT"
  | "COUNTERTOP_COLLISION"
  | "COUNTERTOP_VERTICAL_LOCKED";
/** `cabinets.moveSink`: commit a pending 'fits' landing (SB <-> SC swap under NEW ids, the top lowered). */
export type CabinetMoveSinkInput = { fromCabinetId: string; toCabinetId: string };
export type CabinetMoveSinkReceipt = ConfiguratorReceipt & {
  /** `{ [oldId]: newId }` for both swapped cabinets. */
  idMap: Record<string, string>;
  /** The new sink base (selected in 3D). */
  sinkHostId: string;
};

export type ConfiguratorNamespace = "cabinets" | "cabinetPlacement" | "composition";
export type ConfiguratorUnsubscribe = () => void;

type ConfiguratorEventData = {
  cabinets: { change: CabinetsState; selection: CabinetsState };
  cabinetPlacement: {
    change: CabinetDraftState | null;
    action: { status: "committed" | "cancelled"; sessionId: string; receipt?: ConfiguratorReceipt };
  };
  composition: { change: CompositionState };
};

export type ConfiguratorEventName<N extends ConfiguratorNamespace> = keyof ConfiguratorEventData[N] & string;
export type ConfiguratorEventPayload<N extends ConfiguratorNamespace, E extends ConfiguratorEventName<N>> = ConfiguratorEventData[N][E];

export type CabinetBeginAddInput = {
  definitionId: string;
  selection: CabinetSelection;
  initialPlacement?: CabinetPlacement;
  sessionId?: string;
};

export type CabinetBeginMoveInput = { productId: string; sessionId?: string };

export type CabinetPlacementOptionsInput = {
  definitionId: string;
  selection: CabinetSelection;
  operation?: "add";
  anchorCabinetId?: string;
};

export type ConfiguratorImportPresetInput = {
  preset: ConfiguratorPreset;
  anchorPositionM?: CabinetPositionM;
};

export type ConfiguratorCommandMetadata = ConfiguratorScope & {
  requestId: string;
  expectedCompositionRevision: number;
};

export interface ConfiguratorApi {
  presetProducts: (
    products: readonly ConfiguratorPresetProduct[],
    globalConfig?: Record<string, unknown>,
  ) => Promise<string[]>;
  addProduct: (productType: string, config: CabinetSelection) => Promise<string>;
  /** Present only in PlayCanvas builds with the draft overlay (feature-detect). */
  placementOverlay?: PlacementOverlayApi;
  /** Present only in PlayCanvas builds with the countertop Drag & Drop overlay (feature-detect). */
  countertopOverlay?: CountertopOverlayApi;
  /** Room height per open collection (ULH lowers the room). Newer builds only (feature-detect). */
  room?: RoomApi;
  /** Only the members the typed layer uses; the rest of the namespace is read by the countertop feature. */
  countertop?: {
    setLengthLimits?: (limits: CountertopLengthLimitsM | null) => unknown;
    /** Newer builds only: resize from one end, the other end fixed (also on a standard top). */
    resizeFrom?: (side: CountertopResizeSide, lengthM: number, options?: CountertopCommandOptions) => unknown;
  };
  cabinets: {
    getCapabilities(): Promise<ConfiguratorApiResult<ConfiguratorCapabilities>>;
    getCatalog(scope: ConfiguratorScope): Promise<ConfiguratorApiResult<CabinetCatalogEntry[]>>;
    getConfigurationOptions(
      input: ConfiguratorScope & { definitionId: string; selection: CabinetSelection },
    ): Promise<ConfiguratorApiResult<CabinetConfigurationOptions>>;
    getPlacementOptions(input: ConfiguratorScope & CabinetPlacementOptionsInput): Promise<ConfiguratorApiResult<CabinetPlacementOption[]>>;
    getState(scope: ConfiguratorScope): Promise<ConfiguratorApiResult<CabinetsState>>;
    select(scope: ConfiguratorScope, productId: string | null): Promise<ConfiguratorApiResult<{ selectedCabinetId: string | null }>>;
    /** Newer builds only (feature-detect). */
    moveSink?(input: ConfiguratorCommandMetadata & CabinetMoveSinkInput): Promise<ConfiguratorApiResult<CabinetMoveSinkReceipt>>;
    on(event: string, callback: (event: ConfiguratorEventEnvelope<unknown>) => void, options?: unknown): ConfiguratorUnsubscribe;
  };
  cabinetPlacement: {
    beginAdd(input: ConfiguratorCommandMetadata & CabinetBeginAddInput & { sessionId: string }): Promise<ConfiguratorApiResult<CabinetDraftState>>;
    beginMove(input: ConfiguratorCommandMetadata & CabinetBeginMoveInput & { sessionId: string }): Promise<ConfiguratorApiResult<CabinetDraftState>>;
    updateDraft(
      input: ConfiguratorScope & { sessionId: string; expectedCandidateRevision: number; placement: CabinetPlacement },
    ): Promise<ConfiguratorApiResult<CabinetDraftState>>;
    getState(scope: ConfiguratorScope, sessionId: string): Promise<ConfiguratorApiResult<CabinetDraftState>>;
    settleInput(scope: ConfiguratorScope, sessionId: string): Promise<ConfiguratorApiResult<CabinetDraftState>>;
    apply(
      input: ConfiguratorCommandMetadata & { sessionId: string; expectedCandidateRevision: number },
    ): Promise<ConfiguratorApiResult<ConfiguratorReceipt>>;
    cancel(scope: ConfiguratorScope, sessionId: string): Promise<ConfiguratorApiResult<CabinetDraftState>>;
    on(event: string, callback: (event: ConfiguratorEventEnvelope<unknown>) => void, options?: unknown): ConfiguratorUnsubscribe;
  };
  composition: {
    getState(scope: ConfiguratorScope): Promise<ConfiguratorApiResult<CompositionState>>;
    exportPreset(input: ConfiguratorScope & { anchorCabinetId: string }): Promise<ConfiguratorApiResult<ConfiguratorPreset>>;
    importPreset(input: ConfiguratorCommandMetadata & ConfiguratorImportPresetInput): Promise<ConfiguratorApiResult<ConfiguratorImportReceipt>>;
    exportCompactPreset?(
      input: ConfiguratorScope & { anchorCabinetId?: string },
    ): Promise<ConfiguratorApiResult<ConfiguratorCompactPreset>>;
    importCompactPreset?(
      input: ConfiguratorCommandMetadata & { preset: ConfiguratorCompactPreset; anchorPositionM?: CabinetPositionM },
    ): Promise<ConfiguratorApiResult<ConfiguratorImportReceipt>>;
    getCommandResult(scope: ConfiguratorScope, requestId: string): Promise<ConfiguratorApiResult<ConfiguratorCommandResult>>;
    on(event: string, callback: (event: ConfiguratorEventEnvelope<unknown>) => void, options?: unknown): ConfiguratorUnsubscribe;
  };
}

export type ConfiguratorClientErrorCode =
  | "API_UNAVAILABLE"
  | "API_METHOD_UNAVAILABLE"
  | "API_INVALID_RESPONSE"
  | "CONFIGURATOR_NOT_READY"
  | "CONFIGURATOR_READY_TIMEOUT"
  | "APPLY_UNAVAILABLE"
  | "EMPTY_COMPOSITION"
  | (string & {});

export type ConfiguratorErrorMetadata = {
  operation?: string;
  detail?: ConfiguratorApiErrorDetail | unknown;
  retryable?: boolean;
  requestId?: string;
  context?: ConfiguratorApiContext;
  cause?: unknown;
};

export class ConfiguratorError extends Error {
  readonly code: ConfiguratorClientErrorCode;
  readonly operation?: string;
  readonly detail?: ConfiguratorApiErrorDetail | unknown;
  readonly retryable: boolean;
  readonly requestId?: string;
  readonly context?: ConfiguratorApiContext;

  constructor(code: ConfiguratorClientErrorCode, message = code, metadata: ConfiguratorErrorMetadata = {}) {
    super(message, metadata.cause === undefined ? undefined : { cause: metadata.cause });
    this.name = "ConfiguratorError";
    this.code = code;
    this.operation = metadata.operation;
    this.detail = metadata.detail;
    this.retryable = metadata.retryable ?? false;
    this.requestId = metadata.requestId;
    this.context = metadata.context;
  }
}
