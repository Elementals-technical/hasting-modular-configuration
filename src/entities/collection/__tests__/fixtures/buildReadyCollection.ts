import {
  deriveCollectionNavigation,
  presetsSchema,
  validateCollectionManifest,
  validateCustomizationSchema,
  type ReadyCollectionData,
} from "@/entities/collection";

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
  const customization = validateCustomizationSchema(uiDocument);
  if (!customization.ok) {
    throw new Error(`Expected a valid ${collectionId} UI schema, got diagnostics: ${JSON.stringify(customization)}`);
  }

  return {
    id: collectionId,
    manifest,
    diagnostics: [],
    sources: { local: { ui: customization.schema }, remote: {} },
    catalog: {
      customization: customization.schema,
      navigation: deriveCollectionNavigation(customization.schema),
      presets: presetsDocument ? presetsSchema.parse(presetsDocument) : undefined,
      configurator: { groups: [], groupsByName: {} },
    },
  };
};
