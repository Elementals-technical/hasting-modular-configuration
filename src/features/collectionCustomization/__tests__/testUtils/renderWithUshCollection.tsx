import type { ReactNode } from "react";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { render } from "@testing-library/react";

import { store } from "@/app/store";
import { ReadyCollectionContext, type ReadyCollectionData } from "@/entities/collection";
import { buildReadyCollection } from "@/entities/collection/__tests__/fixtures/buildReadyCollection";

import ushManifest from "../../../../../public/collections/urban-standard-height/manifest.json";
import ushPresets from "../../../../../public/collections/urban-standard-height/presets.json";
import ushUi from "../../../../../public/collections/urban-standard-height/ui.json";

export const buildReadyUshCollection = (overrides: { uiDocument?: unknown; presetsDocument?: unknown } = {}) =>
  buildReadyCollection(
    "urban-standard-height",
    ushManifest,
    overrides.uiDocument ?? ushUi,
    overrides.presetsDocument ?? ushPresets,
  );

export type RenderWithUshCollectionOptions = {
  initialPath?: string;
  uiDocument?: unknown;
  presetsDocument?: unknown;
  data?: ReadyCollectionData;
};

/** Same shape as renderWithFixtureCollection, for tests that need USH's own real ui.json. */
export const renderWithUshCollection = (
  children: ReactNode,
  { initialPath, uiDocument, presetsDocument, data }: RenderWithUshCollectionOptions = {},
): ReturnType<typeof render> => {
  const readyData = data ?? buildReadyUshCollection({ uiDocument, presetsDocument });
  const path = initialPath ?? "/?collectionId=urban-standard-height";

  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[path]}>
        <ReadyCollectionContext.Provider value={readyData}>{children}</ReadyCollectionContext.Provider>
      </MemoryRouter>
    </Provider>,
  );
};
