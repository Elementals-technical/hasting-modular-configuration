import type { ProductProfile } from "@/entities/collection";
import type { SceneLayout } from "@/entities/configuration";

/**
 * Reads where the products of the active collection (its profile) stand. Resolves null for a
 * collection that keeps one row, and whenever the scene cannot say; it never rejects for a busy scene.
 */
export type SceneLayoutCapture = (profile: ProductProfile | null) => Promise<SceneLayout | null>;

let capture: SceneLayoutCapture | null = null;

/** The app registers the scene's reader once at start; without one, snapshots carry no layout. */
export const setSceneLayoutCapture = (next: SceneLayoutCapture | null): void => {
  capture = next;
};

export const getSceneLayoutCapture = (): SceneLayoutCapture | null => capture;
