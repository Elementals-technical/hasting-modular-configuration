import manifestDocument from "../../../../public/collections/urban-standard-height/manifest.json";
import uiDocument from "../../../../public/collections/urban-standard-height/ui.json";
import { buildReadyCollection } from "@/entities/collection/__tests__/fixtures/buildReadyCollection";

export const readyCollectionFixture = buildReadyCollection("urban-standard-height", manifestDocument, uiDocument);
