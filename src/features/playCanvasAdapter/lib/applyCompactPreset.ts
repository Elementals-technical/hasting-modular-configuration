import { createConfiguratorClient } from "@/features/configuratorApi";
import type {
  CabinetPositionM,
  ConfiguratorClient,
  ConfiguratorCompactPreset,
  ConfiguratorImportReceipt,
} from "@/features/configuratorApi";

/** A collection preset entry that carries compact rows (format "ulh-compact-v1"). */
export type CompactPresetSource = {
  format?: string;
  collection?: string;
  shared?: Record<string, unknown>;
  rows?: ConfiguratorCompactPreset["rows"];
  top?: Record<string, unknown>;
  featureSettings?: Record<string, unknown>;
};

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
): Promise<ConfiguratorImportReceipt> => client.importCompactPreset(toCompactPreset(preset), anchorPositionM);

export type CompactPresetClient = Pick<ConfiguratorClient, "connect" | "importCompactPreset" | "dispose">;

/**
 * Applies a compact preset through a short-lived ConfiguratorClient (connect → import → dispose).
 * Resolves null without creating a client when the preset has no compact rows (flat presets).
 */
export const applyCompactPresetWithBridge = async (
  preset: CompactPresetSource | null | undefined,
  createClient: () => CompactPresetClient = createConfiguratorClient,
): Promise<ConfiguratorImportReceipt | null> => {
  if (!preset || !hasCompactRows(preset)) return null;
  const client = createClient();
  try {
    await client.connect();
    return await applyCompactPreset(client, preset);
  } finally {
    client.dispose();
  }
};
