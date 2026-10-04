/**
 * Whether picking a divider option clears the dividers already placed.
 *
 * Re-applying "no dividers" is how the step clears them; leaving Customize through it keeps
 * them. The value that means "none" is the one the collection declares as the attribute's
 * `noneValue`, so the rule holds for a collection that spells it differently.
 */
export const shouldClearDividersOnOptionChange = (
  nextOption: string,
  currentOption: string,
  noneValue: string,
): boolean => nextOption === noneValue && currentOption === noneValue;
