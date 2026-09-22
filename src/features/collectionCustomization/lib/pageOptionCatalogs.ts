import { selectBasinOptions, selectOptions, type ProductProfile } from "@/entities/collection";

import {
  basinOptionImages,
  basinShortDescValues,
  countertopStyleOptionImages,
  dividerStyleOptionImages,
  sidePanelOptionImages,
} from "./pageOptionImages";

/**
 * Option lists of the countertop and accessories steps, read from the active collection's
 * profile (B06). Each list keeps the shape the pages used when these were constants, so the
 * pages only change where the list comes from. `id` is only a React key.
 */

const withImage = (image: string | undefined) => (image ? { image } : {});

/** CountertopStyle: `name` is the style value the command takes, `title` its label. */
export const buildCountertopStyleOptions = (profile: ProductProfile | null) =>
  selectOptions(profile, "CountertopStyle").map((option, index) => ({
    id: 2001 + index,
    title: option.label,
    name: option.value,
    isShortDesc: false,
    metadata: withImage(countertopStyleOptionImages[option.value]),
  }));

/** Integrated basins, then vessel sinks: `name` is the sinkType value, `title` its label. */
export const buildBasinOptions = (profile: ProductProfile | null) =>
  [...selectBasinOptions(profile, "integrated"), ...selectBasinOptions(profile, "vessel")].map((option, index) => ({
    id: 3001 + index,
    title: option.label,
    name: option.value,
    isShortDesc: basinShortDescValues.has(option.value),
    metadata: withImage(basinOptionImages[option.value]),
  }));

/** Thickness: `value` is the stored thickness, `title` its label. */
export const buildThicknessOptions = (profile: ProductProfile | null) =>
  selectOptions(profile, "Thickness").map((option, index) => ({
    id: 10 + index,
    title: option.label,
    value: option.value,
    isShortDesc: false as const,
    isSwatchWithHint: false as const,
  }));

/** SidePanels: the value lives in `metadata.value`, as the page reads it. */
export const buildSidePanelOptions = (profile: ProductProfile | null) =>
  selectOptions(profile, "SidePanels").map((option, index) => ({
    id: 9001 + index,
    title: option.label,
    isShortDesc: false,
    metadata: { value: option.value, ...withImage(sidePanelOptionImages[option.value]) },
  }));

/** DividersOption: the value equals the label. */
export const buildDividerModeOptions = (profile: ProductProfile | null) =>
  selectOptions(profile, "DividersOption").map((option, index) => ({ id: 3001 + index, title: option.label }));

/**
 * DividersStyle: `title` is the label the divider state stores ("Option A"); the picture is
 * found by the style value ("A").
 */
export const buildDividerStyleOptions = (profile: ProductProfile | null) =>
  selectOptions(profile, "DividersStyle").map((option, index) => ({
    id: 5000 + index,
    title: option.label,
    isShortDesc: false,
    metadata: withImage(dividerStyleOptionImages[option.value]),
  }));

/** TowelBarOption: the value equals the label. */
export const buildTowelBarOptions = (profile: ProductProfile | null) =>
  selectOptions(profile, "TowelBarOption").map((option, index) => ({ id: 4001 + index, title: option.label }));
