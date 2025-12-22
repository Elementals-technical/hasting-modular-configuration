import type { AutoChangeEntry, AutoChangeResult, OptionState, RuleContext, RuleResult } from "../model/types";

const resolveValue = <T extends string | number>(
  options: OptionState<T>[],
  current: T,
  emptyFallback?: T | null,
): { next: T; changed: boolean } => {
  const currentOption = options.find((option) => option.value === current);

  if (currentOption?.enabled) {
    return { next: current, changed: false };
  }

  const fallback = options.find((option) => option.enabled);

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
    emptyFallback?: T | null,
  ): T => {
    const { next, changed } = resolveValue(options, current, emptyFallback);

    if (changed) {
      autoChanges.push({ field, from: current, to: next });
    }

    return next;
  };

  const nextWidth = update("width", selection.width, availableOptions.width);
  const nextDepth = update("depth", selection.depth, availableOptions.depth);
  const nextHeight = update("height", selection.height, availableOptions.height);

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
