import { createConfiguratorBridge } from "./bridge";
import type { ConfiguratorBridge, ConfiguratorBridgeOptions } from "./bridge";
import { ConfiguratorError } from "./types";
import type {
  ConfiguratorApiContext,
  ConfiguratorApiErrorDetail,
  ConfiguratorApiResult,
  CabinetBeginAddInput,
  CabinetBeginMoveInput,
  CabinetsState,
  ConfiguratorCapabilities,
  CabinetCatalogEntry,
  ConfiguratorCommandResult,
  CompositionState,
  CabinetConfigurationOptions,
  CabinetDraftState,
  ConfiguratorEventEnvelope,
  ConfiguratorEventName,
  ConfiguratorEventPayload,
  ConfiguratorImportPresetInput,
  ConfiguratorImportReceipt,
  ConfiguratorNamespace,
  CabinetPlacement,
  CabinetPlacementOption,
  CabinetPlacementOptionsInput,
  CabinetPositionM,
  ConfiguratorPreset,
  ConfiguratorPresetProduct,
  ConfiguratorReceipt,
  ConfiguratorScope,
  CabinetSelection,
  ConfiguratorUnsubscribe,
  PlacementOverlayFrame,
} from "./types";

export type ConfiguratorCapabilitiesOptions = { refresh?: boolean };

export type ConfiguratorClientOptions = ConfiguratorBridgeOptions & {
  bridge?: ConfiguratorBridge;
  timeoutMs?: number;
  pollIntervalMs?: number;
  createId?: () => string;
  sleep?: (milliseconds: number) => Promise<void>;
  now?: () => number;
};

export interface ConfiguratorClient {
  readonly scope: ConfiguratorScope | null;
  connect(): Promise<ConfiguratorClient>;
  getCapabilities(options?: ConfiguratorCapabilitiesOptions): Promise<ConfiguratorCapabilities>;
  refreshScope(): Promise<ConfiguratorScope>;

  presetProducts(
    products: readonly ConfiguratorPresetProduct[],
    globalConfig?: Record<string, unknown>,
  ): Promise<string[]>;
  addProduct(productType: string, config?: CabinetSelection): Promise<string>;

  getCatalog(): Promise<CabinetCatalogEntry[]>;
  getConfigurationOptions(definitionId: string, selection: CabinetSelection): Promise<CabinetConfigurationOptions>;
  getPlacementOptions(input: CabinetPlacementOptionsInput): Promise<CabinetPlacementOption[]>;
  getCabinetsState(): Promise<CabinetsState>;
  selectCabinet(productId: string | null): Promise<{ selectedCabinetId: string | null }>;

  beginAdd(definitionId: string, selection: CabinetSelection, initialPlacement?: CabinetPlacement): Promise<CabinetDraftState>;
  beginMove(productId: string): Promise<CabinetDraftState>;
  updateDraft(sessionId: string, expectedCandidateRevision: number, placement: CabinetPlacement): Promise<CabinetDraftState>;
  getPlacementState(sessionId: string): Promise<CabinetDraftState>;
  settle(sessionId: string): Promise<CabinetDraftState>;
  apply(sessionId: string): Promise<ConfiguratorReceipt>;
  cancel(sessionId: string): Promise<CabinetDraftState>;

  getCompositionState(): Promise<CompositionState>;
  getCompositionRevision(): Promise<number>;
  exportPreset(anchorCabinetId?: string): Promise<ConfiguratorPreset>;
  importPreset(preset: ConfiguratorPreset, anchorPositionM?: CabinetPositionM): Promise<ConfiguratorImportReceipt>;
  getCommandResult(requestId: string): Promise<ConfiguratorCommandResult>;

  on<N extends ConfiguratorNamespace, E extends ConfiguratorEventName<N>>(
    namespace: N,
    event: E,
    callback: (event: ConfiguratorEventEnvelope<ConfiguratorEventPayload<N, E>>) => void,
    options?: unknown,
  ): Promise<ConfiguratorUnsubscribe>;
  /** Draft overlay frames (anchors for the UI's icons). Resolves null when the build has none. */
  onPlacementOverlay(callback: (frame: PlacementOverlayFrame | null) => void): Promise<ConfiguratorUnsubscribe | null>;
  /** Switch PlayCanvas' temporary overlay icons on/off. Resolves false when the build has none. */
  setPlacementOverlayPlaceholders(enabled: boolean): Promise<boolean>;
  dispose(): void;
}

const defaultSleep = (milliseconds: number) => new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));

const defaultCreateId = (): string => {
  if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
  return `placement-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const unwrap = <T>(result: ConfiguratorApiResult<T>, operation: string): T => {
  if (!isRecord(result) || typeof result.ok !== "boolean") {
    throw new ConfiguratorError("API_INVALID_RESPONSE", `${operation} returned an invalid result.`, {
      operation,
      detail: result,
    });
  }

  if (result.ok) return result.data;

  const detail = isRecord(result.error) ? (result.error as ConfiguratorApiErrorDetail) : { code: "API_INVALID_RESPONSE" };
  const code = typeof detail.code === "string" ? detail.code : "API_INVALID_RESPONSE";
  throw new ConfiguratorError(code, detail.message ?? code, {
    operation,
    detail,
    retryable: detail.retryable === true,
    requestId: typeof detail.requestId === "string" ? detail.requestId : undefined,
    context: result.context,
  });
};

const isScopeMismatch = (error: unknown) => error instanceof ConfiguratorError && error.code === "SCOPE_MISMATCH";
const isTransientReadinessError = (error: unknown) =>
  error instanceof ConfiguratorError &&
  (error.code === "API_UNAVAILABLE" || error.code === "API_METHOD_UNAVAILABLE" || error.code === "NOT_READY");

class DefaultConfiguratorClient implements ConfiguratorClient {
  private readonly bridge: ConfiguratorBridge;
  private readonly timeoutMs: number;
  private readonly pollIntervalMs: number;
  private readonly createId: () => string;
  private readonly sleep: (milliseconds: number) => Promise<void>;
  private readonly now: () => number;
  private capabilities: ConfiguratorCapabilities | null = null;
  private activeScope: ConfiguratorScope | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private readonly subscriptions = new Set<ConfiguratorUnsubscribe>();
  private disposed = false;

  constructor(options: ConfiguratorClientOptions) {
    this.bridge = options.bridge ?? createConfiguratorBridge({ getApi: options.getApi });
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.pollIntervalMs = options.pollIntervalMs ?? 300;
    this.createId = options.createId ?? defaultCreateId;
    this.sleep = options.sleep ?? defaultSleep;
    this.now = options.now ?? Date.now;
  }

  get scope(): ConfiguratorScope | null {
    return this.activeScope ? { ...this.activeScope } : null;
  }

  connect(): Promise<ConfiguratorClient> {
    return this.enqueue(async () => {
      await this.waitUntilReady();
      return this;
    });
  }

  getCapabilities(options: ConfiguratorCapabilitiesOptions = {}): Promise<ConfiguratorCapabilities> {
    return this.enqueue(async () => {
      if (options.refresh === false && this.capabilities) return this.capabilities;
      return this.readCapabilities();
    });
  }

  refreshScope(): Promise<ConfiguratorScope> {
    return this.enqueue(() => this.waitUntilReady());
  }

  presetProducts(
    products: readonly ConfiguratorPresetProduct[],
    globalConfig?: Record<string, unknown>,
  ): Promise<string[]> {
    return this.enqueue(async () => {
      const args = globalConfig === undefined ? [products] : [products, globalConfig];
      const productIds = await this.bridge.callLegacy<string[]>("presetProducts", ...args);
      this.invalidateRuntimeCache();
      return productIds;
    });
  }

  addProduct(productType: string, config: CabinetSelection = {}): Promise<string> {
    return this.enqueue(async () => {
      const productId = await this.bridge.callLegacy<string>("addProduct", productType, config);
      this.invalidateRuntimeCache();
      return productId;
    });
  }

  getCatalog(): Promise<CabinetCatalogEntry[]> {
    return this.enqueue(() =>
      this.callScopedRead("cabinets.getCatalog", (scope) => this.namespace("cabinets", "getCatalog", scope)),
    );
  }

  getConfigurationOptions(definitionId: string, selection: CabinetSelection): Promise<CabinetConfigurationOptions> {
    return this.enqueue(() =>
      this.callScopedRead("cabinets.getConfigurationOptions", (scope) =>
        this.namespace("cabinets", "getConfigurationOptions", { ...scope, definitionId, selection }),
      ),
    );
  }

  getPlacementOptions(input: CabinetPlacementOptionsInput): Promise<CabinetPlacementOption[]> {
    return this.enqueue(() =>
      this.callScopedRead("cabinets.getPlacementOptions", (scope) =>
        this.namespace("cabinets", "getPlacementOptions", { operation: "add", ...scope, ...input }),
      ),
    );
  }

  getCabinetsState(): Promise<CabinetsState> {
    return this.enqueue(() => this.getCabinetsStateRaw());
  }

  selectCabinet(productId: string | null): Promise<{ selectedCabinetId: string | null }> {
    return this.enqueue(() =>
      this.callScopedOnce("cabinets.select", (scope) => this.namespace("cabinets", "select", scope, productId)),
    );
  }

  beginAdd(definitionId: string, selection: CabinetSelection, initialPlacement?: CabinetPlacement): Promise<CabinetDraftState> {
    const input: CabinetBeginAddInput = { definitionId, selection, initialPlacement };
    return this.enqueue(() => {
      const sessionId = input.sessionId ?? this.createId();
      return this.runRevisionCommand("cabinetPlacement.beginAdd", (command) =>
        this.namespace("cabinetPlacement", "beginAdd", {
          ...command,
          sessionId,
          definitionId: input.definitionId,
          selection: input.selection,
          ...(input.initialPlacement ? { initialPlacement: input.initialPlacement } : {}),
        }),
      );
    });
  }

  beginMove(productId: string): Promise<CabinetDraftState> {
    const input: CabinetBeginMoveInput = { productId };
    return this.enqueue(() => {
      const sessionId = input.sessionId ?? this.createId();
      return this.runRevisionCommand("cabinetPlacement.beginMove", (command) =>
        this.namespace("cabinetPlacement", "beginMove", { ...command, sessionId, productId: input.productId }),
      );
    });
  }

  updateDraft(sessionId: string, expectedCandidateRevision: number, placement: CabinetPlacement): Promise<CabinetDraftState> {
    return this.enqueue(() =>
      this.callScopedOnce("cabinetPlacement.updateDraft", (scope) =>
        this.namespace("cabinetPlacement", "updateDraft", {
          ...scope,
          sessionId,
          expectedCandidateRevision,
          placement,
        }),
      ),
    );
  }

  getPlacementState(sessionId: string): Promise<CabinetDraftState> {
    return this.enqueue(() => this.getPlacementStateRaw(sessionId));
  }

  settle(sessionId: string): Promise<CabinetDraftState> {
    return this.enqueue(() => this.settleRaw(sessionId));
  }

  apply(sessionId: string): Promise<ConfiguratorReceipt> {
    return this.enqueue(async () => {
      const draft = await this.settleRaw(sessionId);
      if (!draft.canApply) {
        throw new ConfiguratorError("APPLY_UNAVAILABLE", "The cabinet draft cannot be applied.", {
          operation: "cabinetPlacement.apply",
          detail: draft.validation,
        });
      }

      return this.callScopedOnce("cabinetPlacement.apply", (scope) =>
        this.namespace("cabinetPlacement", "apply", {
          ...scope,
          sessionId,
          requestId: this.createId(),
          expectedCompositionRevision: draft.baseCompositionRevision,
          expectedCandidateRevision: draft.candidateRevision,
        }),
      );
    });
  }

  cancel(sessionId: string): Promise<CabinetDraftState> {
    return this.enqueue(() =>
      this.callScopedOnce("cabinetPlacement.cancel", (scope) =>
        this.namespace("cabinetPlacement", "cancel", scope, sessionId),
      ),
    );
  }

  getCompositionState(): Promise<CompositionState> {
    return this.enqueue(() => this.getCompositionStateRaw());
  }

  getCompositionRevision(): Promise<number> {
    return this.enqueue(() => this.getCompositionRevisionRaw());
  }

  exportPreset(anchorCabinetId?: string): Promise<ConfiguratorPreset> {
    return this.enqueue(async () => {
      const anchor = anchorCabinetId ?? (await this.getCabinetsStateRaw()).cabinets[0]?.id;
      if (!anchor) {
        throw new ConfiguratorError("EMPTY_COMPOSITION", "A preset cannot be exported from an empty composition.", {
          operation: "composition.exportPreset",
        });
      }

      return this.callScopedRead("composition.exportPreset", (scope) =>
        this.namespace("composition", "exportPreset", { ...scope, anchorCabinetId: anchor }),
      );
    });
  }

  importPreset(preset: ConfiguratorPreset, anchorPositionM?: CabinetPositionM): Promise<ConfiguratorImportReceipt> {
    const input: ConfiguratorImportPresetInput = { preset, anchorPositionM };
    return this.enqueue(() =>
      this.runRevisionCommand("composition.importPreset", (command) =>
        this.namespace("composition", "importPreset", {
          ...command,
          preset: input.preset,
          ...(input.anchorPositionM ? { anchorPositionM: input.anchorPositionM } : {}),
        }),
      ),
    );
  }

  getCommandResult(requestId: string): Promise<ConfiguratorCommandResult> {
    return this.enqueue(() =>
      this.callScopedOnce("composition.getCommandResult", (scope) =>
        this.namespace("composition", "getCommandResult", scope, requestId),
      ),
    );
  }

  on<N extends ConfiguratorNamespace, E extends ConfiguratorEventName<N>>(
    namespace: N,
    event: E,
    callback: (event: ConfiguratorEventEnvelope<ConfiguratorEventPayload<N, E>>) => void,
    options?: unknown,
  ): Promise<ConfiguratorUnsubscribe> {
    return this.enqueue(async () => {
      const subscriptionScope = { ...(await this.ensureScope()) };
      let lastSequence = -1;
      let active = true;
      const filteredCallback = (rawEvent: unknown) => {
        if (!active || !isRecord(rawEvent)) return;
        const currentScope = this.activeScope;
        if (
          !currentScope ||
          currentScope.apiInstanceId !== subscriptionScope.apiInstanceId ||
          currentScope.compositionId !== subscriptionScope.compositionId ||
          rawEvent.apiInstanceId !== subscriptionScope.apiInstanceId ||
          rawEvent.compositionId !== subscriptionScope.compositionId ||
          typeof rawEvent.eventSequence !== "number" ||
          !Number.isFinite(rawEvent.eventSequence) ||
          rawEvent.eventSequence <= lastSequence
        ) {
          return;
        }
        lastSequence = rawEvent.eventSequence;
        callback(rawEvent as ConfiguratorEventEnvelope<ConfiguratorEventPayload<N, E>>);
      };
      const rawUnsubscribe = await this.bridge.subscribe(namespace, event, filteredCallback, options);
      const unsubscribe = () => {
        if (!active) return;
        active = false;
        this.subscriptions.delete(unsubscribe);
        rawUnsubscribe();
      };
      this.subscriptions.add(unsubscribe);
      return unsubscribe;
    });
  }

  onPlacementOverlay(callback: (frame: PlacementOverlayFrame | null) => void): Promise<ConfiguratorUnsubscribe | null> {
    return this.enqueue(async () => {
      if (!this.bridge.subscribePlacementOverlay) return null;
      let active = true;
      const rawUnsubscribe = await this.bridge.subscribePlacementOverlay((frame) => {
        if (active) callback(frame);
      });
      if (!rawUnsubscribe) return null;
      const unsubscribe = () => {
        if (!active) return;
        active = false;
        this.subscriptions.delete(unsubscribe);
        rawUnsubscribe();
      };
      this.subscriptions.add(unsubscribe);
      return unsubscribe;
    });
  }

  setPlacementOverlayPlaceholders(enabled: boolean): Promise<boolean> {
    return this.enqueue(async () => (await this.bridge.setPlacementOverlayPlaceholders?.(enabled)) ?? false);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const unsubscribe of [...this.subscriptions]) unsubscribe();
    this.subscriptions.clear();
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    if (this.disposed) {
      return Promise.reject(
        new ConfiguratorError("CLIENT_DISPOSED", "This configurator client has been disposed.", {
          operation: "client",
        }),
      );
    }

    const queued = this.queue.then(task, task);
    this.queue = queued.then(
      () => undefined,
      () => undefined,
    );
    return queued;
  }

  private async readCapabilities(): Promise<ConfiguratorCapabilities> {
    const result = await this.bridge.callNamespace<ConfiguratorApiResult<ConfiguratorCapabilities>>("cabinets", "getCapabilities");
    const capabilities = unwrap(result, "cabinets.getCapabilities");
    const scopeStillCurrent =
      capabilities.readiness === "ready" &&
      this.activeScope?.apiInstanceId === capabilities.apiInstanceId &&
      this.activeScope.compositionId === capabilities.activeCompositionId;
    if (!scopeStillCurrent) this.activeScope = null;
    this.capabilities = capabilities;
    return capabilities;
  }

  private invalidateRuntimeCache(): void {
    this.capabilities = null;
    this.activeScope = null;
  }

  private async waitUntilReady(): Promise<ConfiguratorScope> {
    const startedAt = this.now();

    for (;;) {
      let capabilities: ConfiguratorCapabilities;
      try {
        capabilities = await this.readCapabilities();
      } catch (error) {
        if (!isTransientReadinessError(error)) throw error;
        if (this.now() - startedAt >= this.timeoutMs) {
          throw new ConfiguratorError("CONFIGURATOR_READY_TIMEOUT", "Timed out waiting for the configurator API.", {
            operation: "cabinets.getCapabilities",
            detail: error,
            retryable: true,
            cause: error,
          });
        }
        await this.sleep(this.pollIntervalMs);
        continue;
      }

      if (capabilities.readiness === "ready") {
        if (!capabilities.apiInstanceId || !capabilities.activeCompositionId) {
          throw new ConfiguratorError("API_INVALID_RESPONSE", "Ready capabilities do not contain a valid scope.", {
            operation: "cabinets.getCapabilities",
            detail: capabilities,
          });
        }

        this.activeScope = {
          apiInstanceId: capabilities.apiInstanceId,
          compositionId: capabilities.activeCompositionId,
        };
        return this.activeScope;
      }

      if (capabilities.readiness !== "initializing") {
        throw new ConfiguratorError("CONFIGURATOR_NOT_READY", `configurator runtime is ${capabilities.readiness}.`, {
          operation: "cabinets.getCapabilities",
          detail: capabilities,
        });
      }

      if (this.now() - startedAt >= this.timeoutMs) {
        throw new ConfiguratorError("CONFIGURATOR_READY_TIMEOUT", "Timed out waiting for the configurator runtime.", {
          operation: "cabinets.getCapabilities",
          detail: capabilities,
          retryable: true,
        });
      }

      await this.sleep(this.pollIntervalMs);
    }
  }

  private async ensureScope(): Promise<ConfiguratorScope> {
    return this.activeScope ?? this.waitUntilReady();
  }

  private async callScopedRead<T>(
    operation: string,
    invoke: (scope: ConfiguratorScope) => Promise<ConfiguratorApiResult<T>>,
  ): Promise<T> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const scope = await this.ensureScope();
      try {
        return unwrap(await invoke(scope), operation);
      } catch (error) {
        if (attempt === 0 && isScopeMismatch(error)) {
          this.activeScope = null;
          await this.waitUntilReady();
          continue;
        }
        throw error;
      }
    }

    throw new ConfiguratorError("SCOPE_MISMATCH", "The configurator runtime scope changed.", {
      operation,
      retryable: true,
    });
  }

  private async callScopedOnce<T>(
    operation: string,
    invoke: (scope: ConfiguratorScope) => Promise<ConfiguratorApiResult<T>>,
  ): Promise<T> {
    const scope = await this.ensureScope();
    return unwrap(await invoke(scope), operation);
  }

  private async runRevisionCommand<T>(
    operation: string,
    invoke: (command: ConfiguratorScope & { requestId: string; expectedCompositionRevision: number }) => Promise<ConfiguratorApiResult<T>>,
  ): Promise<T> {
    const scope = await this.ensureScope();
    const expectedCompositionRevision = await this.getCompositionRevisionForScope(scope);
    return unwrap(
      await invoke({ ...scope, requestId: this.createId(), expectedCompositionRevision }),
      operation,
    );
  }

  private namespace<T>(namespace: ConfiguratorNamespace, method: string, ...args: unknown[]): Promise<ConfiguratorApiResult<T>> {
    return this.bridge.callNamespace<ConfiguratorApiResult<T>>(namespace, method, ...args);
  }

  private getCabinetsStateRaw(): Promise<CabinetsState> {
    return this.callScopedRead("cabinets.getState", (scope) => this.namespace("cabinets", "getState", scope));
  }

  private getPlacementStateRaw(sessionId: string): Promise<CabinetDraftState> {
    return this.callScopedOnce("cabinetPlacement.getState", (scope) =>
      this.namespace("cabinetPlacement", "getState", scope, sessionId),
    );
  }

  private settleRaw(sessionId: string): Promise<CabinetDraftState> {
    return this.callScopedOnce("cabinetPlacement.settleInput", (scope) =>
      this.namespace("cabinetPlacement", "settleInput", scope, sessionId),
    );
  }

  private getCompositionStateRaw(): Promise<CompositionState> {
    return this.callScopedRead("composition.getState", (scope) => this.namespace("composition", "getState", scope));
  }

  private async getCompositionRevisionForScope(scope: ConfiguratorScope): Promise<number> {
    const operation = "composition.getState";
    const result = await this.namespace<CompositionState>("composition", "getState", scope);
    unwrap(result, operation);
    const revision = (result.context as ConfiguratorApiContext | undefined)?.dependencies?.compositionRevision;
    if (typeof revision !== "number" || !Number.isFinite(revision)) {
      throw new ConfiguratorError("API_INVALID_RESPONSE", "composition.getState did not include a revision.", {
        operation,
        detail: result.context,
      });
    }
    return revision;
  }

  private async getCompositionRevisionRaw(): Promise<number> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const scope = await this.ensureScope();
      try {
        return await this.getCompositionRevisionForScope(scope);
      } catch (error) {
        if (attempt === 0 && isScopeMismatch(error)) {
          this.activeScope = null;
          await this.waitUntilReady();
          continue;
        }
        throw error;
      }
    }
    throw new ConfiguratorError("SCOPE_MISMATCH", "The configurator runtime scope changed.");
  }
}

export const createConfiguratorClient = (
  options: ConfiguratorClientOptions = {},
): ConfiguratorClient => new DefaultConfiguratorClient(options);
