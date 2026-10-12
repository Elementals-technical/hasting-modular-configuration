import type { SceneLayout } from "@/entities/configuration";
import { createConfiguratorClient } from "@/features/configuratorApi";
import type { Cabinet, ConfiguratorClient, ConfiguratorPreset } from "@/features/configuratorApi";

/**
 * The layout of a free composition, read from and given back to the scene.
 *
 * The scene writes a composition down as one document: where each cabinet stands, the rows, the
 * countertop's position and length, and what the top carries. Importing that document replaces
 * the composition and puts everything back exactly, under new runtime ids. It is the only way
 * the scene offers to rebuild more than one row.
 *
 * A capture never fails loudly: a scene that cannot export (another collection, an open draft,
 * a change under way) yields null, and the caller goes on without a layout.
 */

export type SceneLayoutClient = Pick<
  ConfiguratorClient,
  "connect" | "getCompositionRevision" | "getCabinetsState" | "exportPreset" | "importPreset" | "dispose"
>;

export type SceneLayoutDeps = {
  createClient?: () => SceneLayoutClient;
};

export type SceneLayoutCaptureDeps = SceneLayoutDeps & {
  /** How long a capture may take; a slower scene yields no layout. */
  budgetMs?: number;
};

/**
 * - imported: the scene now holds the layout; `runtimeIds` gives the new id of every saved one;
 * - not-ready: the scene is busy and was not touched, the same request can be sent again later;
 * - unusable: the scene cannot take this layout, the caller rebuilds without it.
 */
export type SceneLayoutImport =
  | { status: "imported"; runtimeIds: Record<string, string> }
  | { status: "not-ready"; code: string }
  | { status: "unusable"; code: string };

const CAPTURE_BUDGET_MS = 2000;

/** The scene refused because it is in the middle of something; nothing was changed. */
const BUSY_CODES = new Set([
  "COMPOSITION_BUSY",
  "LEGACY_WRITERS_BUSY",
  "STALE_COMPOSITION",
  "NOT_READY",
  "SCOPE_MISMATCH",
  "API_UNAVAILABLE",
  "CONFIGURATOR_NOT_READY",
  "CONFIGURATOR_READY_TIMEOUT",
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isSceneDocument = (value: unknown): value is ConfiguratorPreset =>
  isRecord(value) &&
  typeof value.presetSchemaVersion === "number" &&
  isRecord(value.collection) &&
  Array.isArray(value.presetProducts) &&
  isRecord(value.presetLayout);

const documentKeys = (document: ConfiguratorPreset): string[] =>
  document.presetProducts.flatMap((product) =>
    isRecord(product) && typeof product.key === "string" && product.key ? [product.key] : [],
  );

const errorCode = (error: unknown): string =>
  isRecord(error) && typeof error.code === "string" && error.code ? error.code : "scene-error";

/** A layout as it was stored: a saved configuration is checked before it reaches the scene. */
export const parseSceneLayout = (value: unknown): SceneLayout | null => {
  if (!isRecord(value) || value.version !== 1 || !isSceneDocument(value.document) || !isRecord(value.cabinetIds)) {
    return null;
  }

  const entries = Object.entries(value.cabinetIds);
  const ids = entries.map(([, id]) => id);
  if (entries.length === 0 || !ids.every((id): id is string => typeof id === "string" && id.length > 0)) return null;
  if (new Set(ids).size !== ids.length) return null;

  const known = new Set(documentKeys(value.document));
  if (!entries.every(([key]) => known.has(key))) return null;

  return { version: 1, document: value.document, cabinetIds: Object.fromEntries(entries) as Record<string, string> };
};

/**
 * The scene numbers the cabinets of a document in the order it lists them, so the two lists are
 * paired by position. A different length or type means the pairing cannot be trusted.
 */
const pairCabinetKeys = (document: ConfiguratorPreset, cabinets: readonly Cabinet[]): Record<string, string> | null => {
  if (document.presetProducts.length !== cabinets.length) return null;

  const cabinetIds: Record<string, string> = {};
  for (const [index, product] of document.presetProducts.entries()) {
    const cabinet = cabinets[index];
    if (!isRecord(product) || typeof product.key !== "string" || !product.key) return null;
    if (product.definitionId !== cabinet.definitionId || Object.hasOwn(cabinetIds, product.key)) return null;
    cabinetIds[product.key] = cabinet.id;
  }

  return cabinetIds;
};

const readLayout = async (client: SceneLayoutClient): Promise<SceneLayout | null> => {
  await client.connect();

  // The cabinets and the document are two reads; they describe the same composition only when
  // nothing changed between them.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const before = await client.getCompositionRevision();
    const { cabinets } = await client.getCabinetsState();
    if (cabinets.length === 0) return null;

    const document = await client.exportPreset(cabinets[0].id);
    if ((await client.getCompositionRevision()) !== before) continue;
    if (!isSceneDocument(document)) return null;

    const cabinetIds = pairCabinetKeys(document, cabinets);
    return cabinetIds ? { version: 1, document, cabinetIds } : null;
  }

  return null;
};

export const captureSceneLayout = async ({
  // The scene is either ready now or the action goes on without a layout: a capture never waits.
  createClient = () => createConfiguratorClient({ timeoutMs: 0 }),
  budgetMs = CAPTURE_BUDGET_MS,
}: SceneLayoutCaptureDeps = {}): Promise<SceneLayout | null> => {
  let client: SceneLayoutClient | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    client = createClient();
    const overBudget = new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), budgetMs);
    });
    return await Promise.race([readLayout(client).catch(() => null), overBudget]);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    client?.dispose();
  }
};

/**
 * Replaces the composition by a captured layout. `sourceIds` are the products the caller is
 * about to restore: a layout written for other products is not sent to the scene.
 */
export const importSceneLayout = async (
  layout: SceneLayout,
  sourceIds: readonly string[],
  { createClient = createConfiguratorClient }: SceneLayoutDeps = {},
): Promise<SceneLayoutImport> => {
  const entries = Object.entries(layout.cabinetIds);
  const saved = new Set(entries.map(([, id]) => id));
  if (!isSceneDocument(layout.document) || saved.size !== sourceIds.length || !sourceIds.every((id) => saved.has(id))) {
    return { status: "unusable", code: "layout-mismatch" };
  }

  const document = layout.document;
  let client: SceneLayoutClient | null = null;

  try {
    client = createClient();
    await client.connect();

    const send = () => (client as SceneLayoutClient).importPreset(document);
    const receipt = await send().catch((error: unknown) => {
      // The client reads the revision again on the second attempt.
      if (errorCode(error) !== "STALE_COMPOSITION") throw error;
      return send();
    });

    const runtimeIds: Record<string, string> = {};
    for (const [key, sourceId] of entries) {
      const runtimeId = receipt.keyToProductId?.[key];
      if (typeof runtimeId !== "string" || !runtimeId) return { status: "unusable", code: "layout-receipt-incomplete" };
      runtimeIds[sourceId] = runtimeId;
    }

    return { status: "imported", runtimeIds };
  } catch (error) {
    const code = errorCode(error);
    return { status: BUSY_CODES.has(code) ? "not-ready" : "unusable", code };
  } finally {
    client?.dispose();
  }
};
