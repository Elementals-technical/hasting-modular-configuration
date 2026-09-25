import type { RootState } from "@/app/store";
import { resolveCabinetTypeOfRuntimeId } from "@/entities/collection";
import { getActiveProductProfile, getActiveRuntimeBindings, getCabinetEntries } from "@/entities/configuration";
import type { StableCabinetKey } from "@/entities/configuration";

/**
 * Whether a placed product is a Sink Base. The scene names a product after its scene type
 * (`Sink-Base-…` in Urban, `Mako-sink-cabinet-…` in Mako); the runtime bindings map it back.
 */
export const isSinkBase = (state: RootState, runtimeId: string): boolean =>
  resolveCabinetTypeOfRuntimeId(getActiveProductProfile(state), getActiveRuntimeBindings(state), runtimeId) ===
  "Sink-Base";

/** The placed Sink Base a basin value is addressed at, or undefined while none is placed. */
export const findSinkBaseKey = (state: RootState): StableCabinetKey | undefined =>
  getCabinetEntries(state).find(({ runtimeId }) => isSinkBase(state, runtimeId))?.stableKey;
