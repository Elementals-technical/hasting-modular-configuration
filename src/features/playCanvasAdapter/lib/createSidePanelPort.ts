import type { ScenePatch } from "@/entities/collection";
import type { ConfigurationSidePanelPort, SidePanelApplyResult, SidePanelPlacement } from "@/entities/configuration";
import { applySceneConfig, isSceneReady } from "@/utils/functions/playcanvas/sceneBridge";
import { rememberSidePanelSelection } from "@/utils/functions/playcanvas/sidePanels";

import type { SceneBridge } from "./createPlayCanvasRuntimePort";

/**
 * The side panels of the composition over the scene's add-on API (C06, I).
 *
 * The scene takes a panel type together with its side (`SidePanel` + `SidePanelSide`), so a
 * panel is placed per side rather than sent as one bound value. Rules kept from the legacy
 * wrapper: a single cabinet is both edges, and removing both panels is sent side by side, as
 * the scene does not remove "both" at once. The remembered panels, which the eligibility check
 * reads, follow what the scene took.
 */

export type SidePanelPortDeps = {
  /** Tests pass a fake; the app uses sceneBridge. Only `isReady` and `apply` are used. */
  scene?: Pick<SceneBridge, "isReady" | "apply">;
  /** Called for every placement the scene took. */
  remember?: (panel: string, side: SidePanelPlacement["side"]) => void;
};

const defaultScene: Pick<SceneBridge, "isReady" | "apply"> = { isReady: isSceneReady, apply: applySceneConfig };

const toPatches = (panel: string, side: SidePanelPlacement["side"]): ScenePatch[] =>
  panel === "None" && side === "both"
    ? [
        { SidePanel: "None", SidePanelSide: "left" },
        { SidePanel: "None", SidePanelSide: "right" },
      ]
    : [{ SidePanel: panel, SidePanelSide: side }];

export const createSidePanelPort = ({
  scene = defaultScene,
  remember = rememberSidePanelSelection,
}: SidePanelPortDeps = {}): ConfigurationSidePanelPort => ({
  async apply(placements, cabinetCount): Promise<SidePanelApplyResult> {
    if (placements.length === 0) return { status: "applied" };
    if (!scene.isReady()) return { status: "not-ready" };

    let sceneChanged = false;

    for (const { panel, side } of placements) {
      const effectiveSide = cabinetCount === 1 ? "both" : side;

      for (const patch of toPatches(panel, effectiveSide)) {
        const result = await scene.apply({}, patch);

        if (result.status === "not-ready") {
          return sceneChanged
            ? { status: "partial", message: "The scene stopped being ready." }
            : { status: "not-ready" };
        }

        if (result.status === "failed") {
          return sceneChanged
            ? { status: "partial", message: result.message }
            : { status: "failed", message: result.message };
        }

        sceneChanged = true;
      }

      remember(panel, effectiveSide);
    }

    return { status: "applied" };
  },
});
