import type { UnknownAction } from "@reduxjs/toolkit";

import type { RootState } from "@/app/store";
import { findByStableKey, recordOrganizers } from "@/entities/configuration";
import type { ConfigurationOrganizerPort, OrganizerPortCommand, StableCabinetKey } from "@/entities/configuration";
import type { Correction, DrawerName } from "@/entities/configuration/model/drawerOrganizers";
import {
  getCabinetEntries,
  getOrganizersByCabinet,
  getStableKeyForRuntimeId,
} from "@/entities/configuration/model/store/selectors";
import { createOrganizerPort } from "@/features/playCanvasAdapter/lib/createOrganizerPort";

/**
 * Changes the Ph2 drawer organizers of placed products and records what the scene took (concept §6.2).
 *
 * The scene owns the `DrawerOrganizers` key and every rule: this command addresses a product by its stable
 * key, sends the command through the organizer port, and records the scene's answer in the read-model
 * (`configuration.organizersByCabinet`). It writes no value of its own and no history: the caller wraps it in
 * `runStep(() => changeDrawerOrganizers(…), isApplied)`, since the history fingerprint does not include the
 * read-model, so a step is written only for an applied or partial answer.
 */

type ColumnFields = { cabinetId: StableCabinetKey; drawer: DrawerName; slot: number };

export type OrganizerChange =
  | (ColumnFields & { kind: "addColumn"; style?: string })
  | (ColumnFields & { kind: "removeColumn" })
  | (ColumnFields & { kind: "setColumnLayout"; positions: readonly number[] })
  | { kind: "setStyle"; cabinetId: StableCabinetKey; drawer: DrawerName; style: string }
  /** Without `cabinetIds`: every cabinet the read-model holds organizers for. */
  | { kind: "clear"; cabinetIds?: readonly StableCabinetKey[] };

export type OrganizerChangeResult =
  | { status: "applied" | "partial" | "noop"; corrections: Correction[] }
  /** The scene refused the command; `code` is the contract's (ORGANIZERS_…). Nothing was recorded. */
  | { status: "rejected"; code: string; message: string }
  | { status: "error"; code: "runtime-not-ready" | "runtime-failed" | "unknown-target"; message: string };

export type ChangeDrawerOrganizersDeps = {
  dispatch: (action: UnknownAction) => unknown;
  getState: () => RootState;
  /** Tests pass a stand-in; the app sends the commands through the PlayCanvas adapter. */
  port?: ConfigurationOrganizerPort;
};

/** The command with each stable key turned into the runtime id the scene knows, or null for an unknown cabinet. */
const toPortCommand = (change: OrganizerChange, state: RootState): OrganizerPortCommand | null => {
  const entries = getCabinetEntries(state);
  const runtimeIdOf = (cabinetId: StableCabinetKey) => findByStableKey(entries, cabinetId)?.runtimeId ?? null;

  if (change.kind === "clear") {
    const cabinetIds = change.cabinetIds ?? Object.keys(getOrganizersByCabinet(state));
    const runtimeIds = cabinetIds.map(runtimeIdOf);
    if (runtimeIds.some((runtimeId) => runtimeId === null)) return null;
    return { kind: "clear", runtimeIds: runtimeIds as string[] };
  }

  const { cabinetId, ...command } = change;
  const runtimeId = runtimeIdOf(cabinetId);
  return runtimeId === null ? null : { ...command, runtimeId };
};

export const changeDrawerOrganizers = async (
  change: OrganizerChange,
  { dispatch, getState, port = createOrganizerPort() }: ChangeDrawerOrganizersDeps,
): Promise<OrganizerChangeResult> => {
  const command = toPortCommand(change, getState());
  if (!command) {
    return { status: "error", code: "unknown-target", message: "The cabinet is not placed in the scene." };
  }
  // No cabinet holds organizers: there is nothing to clear and nothing to ask the scene.
  if (command.kind === "clear" && command.runtimeIds.length === 0) return { status: "noop", corrections: [] };

  const result = await port.apply(command);

  // Nothing reached the scene, or nothing is known to have changed: nothing is recorded.
  if (result.status === "not-ready") {
    return { status: "error", code: "runtime-not-ready", message: "The scene is not ready yet." };
  }
  if (result.status === "failed") {
    return { status: "error", code: "runtime-failed", message: result.message };
  }
  if (result.status === "rejected") return result;

  // What the scene holds now, for each product it answered about. A cabinet removed meanwhile is skipped.
  for (const { runtimeId, entry } of result.products) {
    const stableKey = getStableKeyForRuntimeId(getState(), runtimeId);
    if (stableKey) dispatch(recordOrganizers({ stableKey, entry }));
  }

  return { status: result.status, corrections: result.corrections };
};
