import { isDragDropEnabled, type ProductProfile } from "@/entities/collection";
import type { SceneLayout } from "@/entities/configuration";
import { captureSceneLayout } from "@/features/playCanvasAdapter";

/**
 * Where the cabinets of a Drag & Drop collection (`ruleData.dragDrop`) stand, for undo and for saved
 * configurations. Other collections keep one row, which their product order already describes.
 */
export const captureFreeLayout = (profile: ProductProfile | null | undefined): Promise<SceneLayout | null> =>
  isDragDropEnabled(profile) ? captureSceneLayout() : Promise.resolve(null);
