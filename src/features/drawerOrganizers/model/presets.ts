import type { CustomizationDrawerOrganizers } from "@/entities/collection/model/customizationSchema";

export type OrganizerPreset = {
  id: string;
  label: string;
  /** Pressed cells of the column, 1 = the back cell. */
  positions: readonly number[];
  order: number;
  /** Config number of the client's sheet, null for the preset the sheet does not number. */
  sheetConfig: number | null;
};

export type OrganizerProfileTable = {
  positionCount: number;
  maxActive: number;
  codec: "cells-v1";
  /** Styles the profile does not offer, with the message key that says why. */
  unavailableStyles: Readonly<Record<string, string>>;
  presets: readonly OrganizerPreset[];
};

/**
 * Organizer profiles by id: the canon of the preset positions and of their default labels (Q-O3).
 * `ui.json` only overrides the labels. At run time the limits come from 3D (`derived.profile`); a test
 * compares this table with the shared fixtures.
 */
export const ORGANIZER_PROFILES: Readonly<Record<string, OrganizerProfileTable>> = {
  "ROW-MTL-43": {
    positionCount: 5,
    // Up to every cell (28.10, Andriy): the kit ships two inserts, but the editor does not cap at the kit.
    maxActive: 5,
    codec: "cells-v1",
    // Q-K3: Oak is off in v1.
    unavailableStyles: { Oak: "organizer.oakPending" },
    // Config 5 of the sheet is not a preset: it is removing the column.
    presets: [
      { id: "empty", label: "Empty", positions: [], order: 0, sheetConfig: null },
      { id: "preset-1", label: "Preset 1", positions: [2], order: 10, sheetConfig: 1 },
      { id: "preset-2", label: "Preset 2", positions: [4], order: 20, sheetConfig: 2 },
      { id: "preset-3", label: "Preset 3", positions: [3], order: 30, sheetConfig: 3 },
      { id: "preset-4", label: "Preset 4", positions: [2, 4], order: 40, sheetConfig: 4 },
    ],
  },
};

const CUSTOM = "custom";

const setKey = (positions: readonly number[]) => [...new Set(positions)].sort((a, b) => a - b).join(",");

/** Id of the preset with the same set of positions (order and repeats do not matter), or "custom". */
export const matchPreset = (positions: readonly number[], presets: readonly OrganizerPreset[]): string => {
  const key = setKey(positions);
  return presets.find((preset) => setKey(preset.positions) === key)?.id ?? CUSTOM;
};

export type PresetCardModel = { id: string; label: string; positions: readonly number[] };

/** The preset cards by `order`; a non-blank label in `ui.json` replaces the default one. */
export const buildPresetCards = (table: OrganizerProfileTable, ui?: CustomizationDrawerOrganizers): PresetCardModel[] =>
  [...table.presets]
    .sort((a, b) => a.order - b.order)
    .map(({ id, label, positions }) => {
      const override = ui?.presets?.[id]?.label;
      return { id, label: override?.trim() ? override : label, positions };
    });
