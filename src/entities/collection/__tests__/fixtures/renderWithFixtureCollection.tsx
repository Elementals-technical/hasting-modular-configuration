import type { ReactNode } from "react";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { render } from "@testing-library/react";

import { store } from "@/app/store";
import {
  deriveCollectionNavigation,
  presetsSchema,
  validateCollectionManifest,
  validateCustomizationSchema,
  ReadyCollectionContext,
  type ReadyCollectionData,
} from "@/entities/collection";

import fixtureUiManifest from "./collections/fixture-ui/manifest.json";
import fixtureUiPresets from "./collections/fixture-ui/presets.json";
import fixtureUiUi from "./collections/fixture-ui/ui.json";

import fixtureRulesManifest from "./collections/fixture-rules/manifest.json";
import fixtureRulesUi from "./collections/fixture-rules/ui.json";

const rootUrl = "https://app.test/collections/";

const EMPTY_CONFIGURATOR = { groups: [], groupsByName: {} };

export type FixtureCollectionId = "fixture-ui" | "fixture-rules";

const FIXTURES: Record<FixtureCollectionId, { manifestDocument: unknown; uiDocument: unknown; presetsDocument?: unknown }> = {
  "fixture-ui": { manifestDocument: fixtureUiManifest, uiDocument: fixtureUiUi, presetsDocument: fixtureUiPresets },
  "fixture-rules": { manifestDocument: fixtureRulesManifest, uiDocument: fixtureRulesUi },
};

export const buildReadyFixtureCollection = (
  collectionId: FixtureCollectionId,
  overrides: { uiDocument?: unknown; presetsDocument?: unknown } = {},
): ReadyCollectionData => {
  const fixture = FIXTURES[collectionId];
  const uiDocument = overrides.uiDocument ?? fixture.uiDocument;
  const presetsDocument = overrides.presetsDocument ?? fixture.presetsDocument;

  const manifest = validateCollectionManifest(
    fixture.manifestDocument,
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
      configurator: EMPTY_CONFIGURATOR,
    },
  };
};

export type RenderWithFixtureCollectionOptions = {
  collectionId: FixtureCollectionId;
  initialPath?: string;
  uiDocument?: unknown;
  presetsDocument?: unknown;
};

export const renderWithFixtureCollection = (
  children: ReactNode,
  { collectionId, initialPath, uiDocument, presetsDocument }: RenderWithFixtureCollectionOptions,
): ReturnType<typeof render> => {
  const data = buildReadyFixtureCollection(collectionId, { uiDocument, presetsDocument });
  const path = initialPath ?? `/?collectionId=${collectionId}`;

  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[path]}>
        <ReadyCollectionContext.Provider value={data}>{children}</ReadyCollectionContext.Provider>
      </MemoryRouter>
    </Provider>,
  );
};
