const DIVIDER_OPTION_NONE = "None";

export const shouldClearDividersOnOptionChange = (nextOption: string, currentOption: string): boolean =>
  nextOption === DIVIDER_OPTION_NONE && currentOption === DIVIDER_OPTION_NONE;
