import {
  deriveCollectionNavigation,
  presetsSchema,
  resolveCustomizationImageUrls,
  validateCollectionManifest,
  type ReadyCollectionData,
} from "@/entities/collection";

import { readCustomizationSchema } from "./readCustomizationSchema";

const rootUrl = "https://app.test/collections/";

export const buildReadyCollection = (
  collectionId: string,
  manifestDocument: unknown,
  uiDocument: unknown,
  presetsDocument?: unknown,
): ReadyCollectionData => {
  const manifestUrl = `${rootUrl}${collectionId}/manifest.json`;
  const manifest = validateCollectionManifest(manifestDocument, collectionId, manifestUrl, rootUrl);
  // Resolved as the loader resolves it, so a fixture sees the same URLs a page sees.
  const customization = resolveCustomizationImageUrls(readCustomizationSchema(uiDocument), manifestUrl, rootUrl);

  return {
    id: collectionId,
    manifest,
    diagnostics: [],
    sources: { local: { ui: customization }, remote: {} },
    catalog: {
      customization,
      navigation: deriveCollectionNavigation(customization),
      presets: presetsDocument ? presetsSchema.parse(presetsDocument) : undefined,
      configurator: { groups: [], groupsByName: {} },
    },
  };
};
