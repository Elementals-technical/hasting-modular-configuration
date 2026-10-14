import type { ScenePlacementSlot, SceneRestoreIssue } from "@/entities/configuration";
import { createCommandPlacementId, createConfiguratorClient } from "@/features/configuratorApi";
import type { ConfiguratorClient } from "@/features/configuratorApi";

import { BUSY_CODES, errorCode } from "./sceneLayout";

/**
 * A cabinet placed at a place the scene offers by a placed one (I), in a collection whose rows
 * hold columns (Urban Duplex): a row end at the level the cabinet's height takes (`left`,
 * `right`), or the free place of a column, over a cabinet that stands alone on the floor (`top`)
 * or under one that hangs alone (`bottom`).
 *
 * The scene's placement options say where that place is and whether the cabinet fits it. The
 * draft opened there is applied at once, so the scene also checks its placement rules (nothing
 * on a sink base, …) and lays the row out as a drag would. The session carries the command
 * prefix: the Drag & Drop controls, which follow every session of the scene, leave it alone.
 */

export type SceneSlotRequest = {
  /** The product as the scene places it (the port translated its config). */
  sceneType: string;
  config: Record<string, unknown>;
  /** The cabinet the place is offered by. */
  anchorRuntimeId: string;
  slot: ScenePlacementSlot;
};

/**
 * - applied: the scene placed the cabinet as `runtimeId`;
 * - not-ready: the scene is busy and was not changed;
 * - rejected: there is no such place, or the cabinet does not fit it or its rules; nothing changed;
 * - failed: the scene refused before it changed.
 */
export type SceneSlotResult =
  | { status: "applied"; runtimeId: string }
  | { status: "not-ready" }
  | { status: "rejected"; issues: SceneRestoreIssue[] }
  | { status: "failed"; message: string };

export type SceneSlotClient = Pick<
  ConfiguratorClient,
  "connect" | "getPlacementOptions" | "beginAdd" | "apply" | "cancel" | "dispose"
>;

export type SceneSlotDeps = {
  createClient?: () => SceneSlotClient;
};

export type SceneSlotPlacer = (request: SceneSlotRequest) => Promise<SceneSlotResult>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** The texts of the reasons the scene gives: `DOES_NOT_FIT` on an option, a placement rule on a draft. */
const reasonTexts = (reasons: unknown): string[] =>
  Array.isArray(reasons)
    ? reasons.flatMap((reason) => {
        if (!isRecord(reason) || typeof reason.code !== "string") return [];
        return [typeof reason.message === "string" && reason.message.trim() ? reason.message : reason.code];
      })
    : [];

const unavailable = (fallback: string, reasons: unknown): SceneSlotResult => {
  const texts = reasonTexts(reasons);
  return {
    status: "rejected",
    issues: [{ code: "placement-unavailable", message: texts.length ? texts.join(" ") : fallback }],
  };
};

export const placeInSceneSlot = async (
  { sceneType, config, anchorRuntimeId, slot }: SceneSlotRequest,
  { createClient = () => createConfiguratorClient({ createId: createCommandPlacementId }) }: SceneSlotDeps = {},
): Promise<SceneSlotResult> => {
  let client: SceneSlotClient | null = null;
  let openSession: string | null = null;

  try {
    client = createClient();
    await client.connect();

    // One selection object for the options and the draft: an option is valid only for the
    // selection it was offered for.
    const options = await client.getPlacementOptions({
      definitionId: sceneType,
      selection: config,
      operation: "add",
      anchorCabinetId: anchorRuntimeId,
    });
    const option = options.find(
      (candidate) => candidate.kind === slot && candidate.anchorCabinetId === anchorRuntimeId,
    );
    if (!option) return unavailable(`No ${slot} place by ${anchorRuntimeId}.`, []);
    if (option.availability !== "available") {
      return unavailable(`The ${slot} place by ${anchorRuntimeId} is not available.`, option.reasons);
    }

    const draft = await client.beginAdd(sceneType, config, { kind: "option", optionId: option.id });
    openSession = draft.sessionId;
    const receipt = await client.apply(draft.sessionId);
    openSession = null;

    const [runtimeId] = receipt.addedProductIds;
    return runtimeId ? { status: "applied", runtimeId } : { status: "failed", message: "The scene placed no cabinet." };
  } catch (error) {
    // A draft the scene would not apply is put away: the composition stays as it was.
    if (client && openSession) await client.cancel(openSession).catch(() => undefined);

    const code = errorCode(error);
    if (code === "APPLY_UNAVAILABLE") {
      const detail = isRecord(error) ? error.detail : undefined;
      return unavailable(`The cabinet cannot go at the ${slot} place.`, isRecord(detail) ? detail.reasons : undefined);
    }
    if (BUSY_CODES.has(code)) return { status: "not-ready" };

    return { status: "failed", message: error instanceof Error ? error.message : code };
  } finally {
    client?.dispose();
  }
};
