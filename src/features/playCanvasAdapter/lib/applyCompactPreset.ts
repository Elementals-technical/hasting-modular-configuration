import type { PrebuiltModelTransferableOverrides } from "@/entities/product/lib/prebuiltModelTransferableFields";
import { createConfiguratorClient } from "@/features/configuratorApi";
import type {
  CabinetPositionM,
  ConfiguratorClient,
  ConfiguratorCompactPreset,
  ConfiguratorCompactPresetRow,
  ConfiguratorImportReceipt,
  CabinetsState,
} from "@/features/configuratorApi";

/** A collection preset entry that carries compact rows (format "ulh-compact-v1"). */
export type CompactPresetSource = {
  format?: string;
  collection?: string;
  shared?: Record<string, unknown>;
  rows?: ConfiguratorCompactPresetRow[];
  top?: Record<string, unknown>;
  featureSettings?: Record<string, unknown>;
};

/** Builds the document the scene imports from a collection preset entry. */
export type CompactPresetDocumentBuilder = (preset: CompactPresetSource) => ConfiguratorCompactPreset;

export const hasCompactRows = (preset: CompactPresetSource | null | undefined): boolean =>
  Array.isArray(preset?.rows) && preset.rows.length > 0;

/** Builds the runtime compact document from a collection preset entry (UI-only fields are dropped). */
export const toCompactPreset = (preset: CompactPresetSource, fallbackCollection = "ULH"): ConfiguratorCompactPreset => ({
  format: "ulh-compact-v1",
  collection: preset.collection ?? fallbackCollection,
  ...(preset.shared && Object.keys(preset.shared).length ? { shared: preset.shared } : {}),
  rows: preset.rows ?? [],
  ...(preset.top ? { top: preset.top as ConfiguratorCompactPreset["top"] } : {}),
  ...(preset.featureSettings && Object.keys(preset.featureSettings).length
    ? { featureSettings: preset.featureSettings }
    : {}),
});

/** The user's selections every cabinet of a compact preset takes from `shared`. */
const SHARED_TRANSFERABLE_FIELDS = ["CabinetColor", "HandleGrooveColor", "CountertopColor"] as const;

const hasNothingToCarry = (overrides: PrebuiltModelTransferableOverrides): boolean =>
  Object.values(overrides).every((value) => value === undefined);

const pickSharedOverrides = (overrides: PrebuiltModelTransferableOverrides): Record<string, unknown> => {
  const shared: Record<string, unknown> = {};
  for (const field of SHARED_TRANSFERABLE_FIELDS) {
    const value = overrides[field];
    if (value !== undefined) shared[field] = value;
  }
  return shared;
};

/** Replaces only the fields the values already record: a value of their own would otherwise beat `shared`. */
const replaceRecordedFields = <Values extends Record<string, unknown>>(
  values: Values,
  overrides: PrebuiltModelTransferableOverrides,
): Values => {
  const replaced: Record<string, unknown> = { ...values };
  for (const [field, value] of Object.entries(overrides)) {
    const isRecorded = field in values;
    if (isRecorded && value !== undefined) replaced[field] = value;
  }
  return replaced as Values;
};

/**
 * Carries the user's selections into a compact preset, as the flat path carries them into every
 * preset product. The input preset is not changed.
 *
 * Example (ULH), overrides `{ CabinetColor: "Oak TKQ", CountertopColor: "Nero TFA", sinkType: "Top_Ceramic" }`:
 *   shared `{ CountertopColor: "Bianco Male TFA", CabinetColor: "Rox Black TKQ", … }`
 *     → `{ CountertopColor: "Nero TFA", CabinetColor: "Oak TKQ", … }`
 *   top `{ CountertopColor: "Bianco Male TFA", sinkType: "Top_HPL/Fenix_Cover_Gres", … }`
 *     → `{ CountertopColor: "Nero TFA", sinkType: "Top_Ceramic", … }`
 *   rows `[{ name: "ULH-sink-cabinet", sinkType: "Top_HPL/Fenix_Cover_Gres" }]`, `[{ name: "ULH-side-cabinet" }]`
 *     → `[{ name: "ULH-sink-cabinet", sinkType: "Top_Ceramic" }]`, `[{ name: "ULH-side-cabinet" }]`
 */
export const mergeCompactPresetOverrides = (
  preset: CompactPresetSource,
  overrides: PrebuiltModelTransferableOverrides,
): CompactPresetSource => {
  // Nothing to carry over: the caller keeps the very same preset.
  if (hasNothingToCarry(overrides)) return preset;

  // 1. Colors go to `shared`, which every cabinet of the preset takes.
  const merged: CompactPresetSource = { ...preset, shared: { ...preset.shared, ...pickSharedOverrides(overrides) } };

  // 2. A cabinet's own field would beat `shared`, so it is replaced there; sinkType stays on the sink cabinet only.
  if (preset.rows) {
    merged.rows = preset.rows.map((row) => ({
      ...row,
      products: row.products.map((product) => replaceRecordedFields(product, overrides)),
    }));
  }

  // 3. The countertop records its own color and basin, so they are replaced the same way.
  if (preset.top) merged.top = replaceRecordedFields(preset.top, overrides);

  return merged;
};

/** Replaces the composition with a compact preset via composition.importCompactPreset. */
export const applyCompactPreset = (
  client: Pick<ConfiguratorClient, "importCompactPreset">,
  preset: CompactPresetSource,
  anchorPositionM?: CabinetPositionM,
  toDocument: CompactPresetDocumentBuilder = toCompactPreset,
): Promise<ConfiguratorImportReceipt> => client.importCompactPreset(toDocument(preset), anchorPositionM);

export type CompactPresetClient = Pick<ConfiguratorClient, "connect" | "importCompactPreset" | "dispose"> &
  Partial<Pick<ConfiguratorClient, "getCabinetsState">>;

/**
 * Applies a compact preset through a short-lived ConfiguratorClient (connect → import → dispose).
 * Optional onImported adopts the actual primary cabinets into the caller's UI/pricing state; the
 * receipt names the product each cabinet of the document became. A collection whose scene takes
 * another document builds it with `toDocument`.
 * Resolves null without creating a client when the preset has no compact rows (flat presets).
 */
export const applyCompactPresetWithBridge = async (
  preset: CompactPresetSource | null | undefined,
  createClient: () => CompactPresetClient = createConfiguratorClient,
  onImported?: (state: CabinetsState, receipt: ConfiguratorImportReceipt) => Promise<void>,
  toDocument: CompactPresetDocumentBuilder = toCompactPreset,
): Promise<ConfiguratorImportReceipt | null> => {
  if (!preset || !hasCompactRows(preset)) return null;
  const client = createClient();
  try {
    await client.connect();
    const receipt = await applyCompactPreset(client, preset, undefined, toDocument);
    if (onImported) {
      if (!client.getCabinetsState) throw new Error("Imported compact cabinets cannot be read for pricing.");
      await onImported(await client.getCabinetsState(), receipt);
    }
    return receipt;
  } finally {
    client.dispose();
  }
};
