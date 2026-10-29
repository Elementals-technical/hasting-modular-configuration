import type { AppDispatch, RootState } from "@/app/store";
import type { OrganizerApplyResult, OrganizerProductState } from "@/entities/configuration";
import type { DrawerName } from "@/entities/configuration/model/drawerOrganizers";
import { getCabinetEntries, getStableKeyForRuntimeId } from "@/entities/configuration/model/store/selectors";
import { recordOrganizers, restoreConfigurationFragment } from "@/entities/configuration/model/store/slice";
import { restoreDividerOptions } from "@/entities/product/model/store/slice";
import { selectOrganizersUi } from "@/features/drawerOrganizers/model/store/selectors";
import { recordDerived } from "@/features/drawerOrganizers/model/store/slice";
import type { OrganizerAddress } from "@/features/drawerOrganizers/model/types";
import type { OrganizerPort } from "@/features/playCanvasAdapter/lib/createOrganizerPort";

import type { OrganizersMovePlan, OrganizerWrite } from "./planHistoryMove";

/**
 * The fast path of an undo/redo that changed only the Ph2 drawer organizers (step B, spec §4.2): the products
 * stay in the scene, each product whose organizers differ gets the target's `DrawerOrganizers` key back through
 * `organizers.setState`, and the state records what the scene answered. The two options the organizers panel
 * owns, and their configuration values, are put back as the target holds them.
 *
 * Nothing is rolled back. At the first product the scene does not take as sent it stops with `fallback`; the
 * caller then rebuilds the scene from the snapshot (the full path), which puts back everything, including what
 * this path already wrote. It never throws: an exception of the port is a `fallback` too.
 *
 * It does not touch what the full path resets (`restoreProductState`, the selected product, the style sidebar)
 * nor the camera. An open drawer view stays open; when the move changed another drawer than the one in view, the
 * view follows the change (`viewToFollow`), the way the Top | Bottom switch does, so the user sees what moved.
 *
 * Example: undo of "add a column to Top of cab-2" →
 *   plan.writes = [{ stableKey: "cab-2", runtimeId: "rt-2", state: { version: 1 } }]
 *   → one `setState` on rt-2, its receipt recorded for cab-2 → { status: "applied" }.
 */

/** What the fast path needs of the organizer port (`createOrganizerPort`). */
export type OrganizerHistoryPort = Pick<OrganizerPort, "isReady" | "apply" | "preview" | "whenSettled" | "enterView">;

export type RestoreOrganizersOnlyDeps = {
  dispatch: AppDispatch;
  getState: () => RootState;
  port: OrganizerHistoryPort;
};

/** `fallback.reason` is for the log only, e.g. "not-ready" or "setState rejected: ORGANIZERS_SLOT_LOCKED: …". */
export type RestoreOrganizersOnlyResult = { status: "applied" } | { status: "fallback"; reason: string };

const fallback = (reason: string): RestoreOrganizersOnlyResult => ({ status: "fallback", reason });

/** Why the scene did not take a `setState` as sent. */
const untakenReason = (result: OrganizerApplyResult): string => {
  if (result.status === "rejected") return `setState rejected: ${result.code}: ${result.message}`;
  if (result.status === "failed") return `setState failed: ${result.message}`;
  if (result.status === "not-ready") return "setState not-ready";

  // partial: the scene corrected the state, so it holds something other than the target.
  const correctionCodes = result.corrections.map(({ code }) => code).join(", ");
  return `setState ${result.status}: ${correctionCodes}`;
};

/**
 * Records what the scene now holds for each product of a receipt: the read-model entry and what 3D derived for
 * its drawers. Both come from the receipt, so the state does not wait for the scene's `change` event.
 */
const recordReceipt = (
  products: readonly OrganizerProductState[],
  { dispatch, getState }: Pick<RestoreOrganizersOnlyDeps, "dispatch" | "getState">,
) => {
  for (const { runtimeId, entry, drawers } of products) {
    const stableKey = getStableKeyForRuntimeId(getState(), runtimeId);
    // A product the state has no key for is not part of its composition: there is nothing to record it under.
    if (!stableKey) continue;

    dispatch(recordOrganizers({ stableKey, entry }));
    if (drawers) dispatch(recordDerived({ cabinetKey: stableKey, drawers }));
  }
};

export async function restoreOrganizersOnly(
  plan: OrganizersMovePlan,
  { dispatch, getState, port }: RestoreOrganizersOnlyDeps,
): Promise<RestoreOrganizersOnlyResult> {
  try {
    // 1. A scene that cannot take commands now: the full path decides (and reports) what to do.
    if (!port.isReady()) return fallback("not-ready");
    //    Commands sent before the move finish first, so a late receipt does not overwrite what is put back.
    await port.whenSettled();

    // 2. The editor's preview is a render-only layout that would cover the restored columns. Its answer does
    //    not matter: a scene without a preview has nothing to clear.
    await port.preview(null);

    // 3. One product after another, in composition order.
    for (const { runtimeId, state } of plan.writes) {
      const result = await port.apply({ kind: "setState", runtimeId, state });

      // The scene took the state with a correction, refused it or was not reached: the full path takes over.
      if (result.status !== "applied" && result.status !== "noop") return fallback(untakenReason(result));

      recordReceipt(result.products, { dispatch, getState });
    }

    // 4. The options the organizers panel owns, each one only when the target holds another value. A restore,
    //    not the command's setters: the command stays the one writer of these values (C06).
    if (plan.productOptions) dispatch(restoreDividerOptions(plan.productOptions));

    // 5. Their configuration values. The cabinets are the store's: the products were not rebuilt, so they keep
    //    the runtime ids they have now, not the ones the snapshot was taken with.
    if (plan.values) {
      dispatch(restoreConfigurationFragment({ cabinets: getCabinetEntries(getState()), values: plan.values }));
    }

    // 6. The view follows the change. Its answer does not matter: the state is already put back.
    const next = viewToFollow(selectOrganizersUi(getState()).view, plan.writes);
    if (next) await port.enterView(next);

    return { status: "applied" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return fallback(`error: ${message}`);
  }
}

/**
 * Where the view goes after the move: the one drawer the move changed when the drawer in view was not among
 * them; null to stay. Null when no drawer is in view (the move does not open one), when the drawer in view
 * changed too, or when the change is spread over several drawers (preferring the cabinet in view to pick one).
 *
 * Examples (view = cab-1 Bot):
 *   writes change cab-1 Top only        → { runtimeId: rt-1, drawer: "Top" }
 *   writes change cab-1 Top and Bot     → null (the drawer in view changed as well)
 *   writes change cab-2 Top only        → { runtimeId: rt-2, drawer: "Top" }
 *   writes change cab-1 Top, cab-2 Bot  → { runtimeId: rt-1, drawer: "Top" } (the cabinet in view first)
 *   writes change cab-2 Top and Bot     → null (nothing to pick)
 */
export function viewToFollow(
  view: OrganizerAddress | null,
  writes: readonly OrganizerWrite[],
): { runtimeId: string; drawer: DrawerName } | null {
  if (!view) return null;

  const changed = writes.flatMap(({ stableKey, runtimeId, drawers }) =>
    drawers.map((drawer) => ({ stableKey, runtimeId, drawer })),
  );
  if (changed.some(({ stableKey, drawer }) => stableKey === view.cabinetKey && drawer === view.drawer)) return null;

  const inViewCabinet = changed.filter(({ stableKey }) => stableKey === view.cabinetKey);
  const candidates = inViewCabinet.length > 0 ? inViewCabinet : changed;
  if (candidates.length !== 1) return null;

  const [{ runtimeId, drawer }] = candidates;
  return { runtimeId, drawer };
}
