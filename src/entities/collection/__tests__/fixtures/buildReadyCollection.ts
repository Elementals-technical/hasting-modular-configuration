import {
  deriveCollectionNavigation,
  presetsSchema,
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
  const manifest = validateCollectionManifest(
    manifestDocument,
    collectionId,
    `${rootUrl}${collectionId}/manifest.json`,
    rootUrl,
  );
  const customization = readCustomizationSchema(uiDocument);

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
