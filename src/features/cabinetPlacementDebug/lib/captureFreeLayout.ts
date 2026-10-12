import type { SceneLayout } from "@/entities/configuration";
import { captureSceneLayout } from "@/features/playCanvasAdapter";

import { isDragDropCollection } from "./resolveCabinetDebugSelection";

/**
 * Where the cabinets of a Drag & Drop collection stand, for undo and for saved configurations.
 * Other collections keep one row, which their product order already describes.
 */
export const captureFreeLayout = (collectionId: string | null | undefined): Promise<SceneLayout | null> =>
  isDragDropCollection(collectionId) ? captureSceneLayout() : Promise.resolve(null);
