import manifestDocument from "../../../../public/collections/urban-standard-height/manifest.json";
import { validateCollectionManifest, type ReadyCollectionData } from "@/entities/collection";

const rootUrl = "https://app.test/collections/";
const manifest = validateCollectionManifest(
  manifestDocument,
  "urban-standard-height",
  `${rootUrl}urban-standard-height/manifest.json`,
  rootUrl,
);

export const readyCollectionFixture: ReadyCollectionData = {
  id: manifest.id,
  manifest,
  diagnostics: [],
  sources: { local: {}, remote: {} },
  catalog: { configurator: { groups: [], groupsByName: {} } },
};
