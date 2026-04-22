interface ResolveSwatchesSummaryStateArgs<T> {
  items: T[];
  autofillItemsCount: number;
  isAutofillEnabled: boolean;
  isEnabledInSummary: boolean;
}

export const resolveSwatchesSummaryState = <T>({
  items,
  autofillItemsCount,
  isAutofillEnabled,
  isEnabledInSummary,
}: ResolveSwatchesSummaryStateArgs<T>) => {
  const hasItems = items.length > 0;
  const isBlockVisible = hasItems || autofillItemsCount > 0;
  const isAutofillChecked = isAutofillEnabled && isEnabledInSummary && hasItems;
  const shouldShowItems = hasItems && (!isAutofillEnabled || isEnabledInSummary);

  return {
    hasItems,
    isBlockVisible,
    isAutofillChecked,
    displayedItems: shouldShowItems ? items : [],
    canEnableAutofill: isBlockVisible,
    isQuoteEnabled: shouldShowItems,
  };
};
