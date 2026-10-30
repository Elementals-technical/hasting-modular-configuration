import type { RootState } from "@/app/store";
import { getCabinetEntries, isSinkBase } from "@/entities/configuration";
import type { StableCabinetKey } from "@/entities/configuration";

/** The placed Sink Bases, in composition order. */
export const findSinkBaseKeys = (state: RootState): StableCabinetKey[] =>
  getCabinetEntries(state)
    .filter(({ runtimeId }) => isSinkBase(state, runtimeId))
    .map(({ stableKey }) => stableKey);

/** The placed Sink Base a basin value is addressed at, or undefined while none is placed. */
export const findSinkBaseKey = (state: RootState): StableCabinetKey | undefined => findSinkBaseKeys(state)[0];
