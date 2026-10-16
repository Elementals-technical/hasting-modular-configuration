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
