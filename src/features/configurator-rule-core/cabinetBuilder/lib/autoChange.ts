import type { AutoChangeEntry, AutoChangeResult, OptionState, RuleContext, RuleResult } from "../model/types";

type PickFallback<T> = (options: OptionState<T>[], current: T) => OptionState<T> | undefined;

const firstEnabled = <T>(options: OptionState<T>[]): OptionState<T> | undefined =>
  options.find((option) => option.enabled);

/** The enabled height nearest the current one, so a cabinet moves as little as the rules allow. */
const nearestEnabled: PickFallback<number> = (options, current) =>
  options
    .filter((option) => option.enabled)
    .sort((left, right) => Math.abs(left.value - current) - Math.abs(right.value - current))[0];

const resolveValue = <T extends string | number>(
  options: OptionState<T>[],
  current: T,
  emptyFallback?: T | null,
  pickFallback: PickFallback<T> = firstEnabled,
): { next: T; changed: boolean } => {
  const currentOption = options.find((option) => option.value === current);

  if (currentOption?.enabled) {
    return { next: current, changed: false };
  }

  const fallback = pickFallback(options, current);

  if (!fallback) {
    const next = emptyFallback ?? current;
    return { next, changed: next !== current };
  }

  return { next: fallback.value, changed: true };
};

export const autoChange = (ruleResult: RuleResult, context: RuleContext): AutoChangeResult => {
  const { selection } = context;
  const { availableOptions } = ruleResult;

  const autoChanges: AutoChangeEntry[] = [];

  const update = <T extends string | number>(
    field: AutoChangeEntry["field"],
    current: T,
    options: OptionState<T>[],
    pickFallback?: PickFallback<T>,
  ): T => {
    const { next, changed } = resolveValue(options, current, undefined, pickFallback);

    if (changed) {
      autoChanges.push({ field, from: current, to: next });
    }

    return next;
  };

  const nextWidth = update("width", selection.width, availableOptions.width);
  const nextDepth = update("depth", selection.depth, availableOptions.depth);
  const nextHeight = update("height", selection.height, availableOptions.height, nearestEnabled);

  let nextDrawers: string | null | undefined = selection.drawers ?? null;
  if (availableOptions.drawers.length === 0) {
    if (selection.drawers !== null && selection.drawers !== undefined) {
      autoChanges.push({ field: "drawers", from: selection.drawers, to: null });
    }
    nextDrawers = null;
  } else if (selection.drawers !== null && selection.drawers !== undefined) {
    const { next, changed } = resolveValue(availableOptions.drawers, selection.drawers, null);
    if (changed) {
      autoChanges.push({ field: "drawers", from: selection.drawers, to: next });
    }
    nextDrawers = next;
  }

  return {
    nextSelection: {
      ...selection,
      width: nextWidth,
      depth: nextDepth,
      height: nextHeight,
      drawers: nextDrawers,
    },
    autoChanges,
  };
};
