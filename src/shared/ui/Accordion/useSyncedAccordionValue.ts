import { useCallback, useMemo, useState } from "react";

type SyncedAccordionValue = string | undefined;

type UseSyncedAccordionValueParams = {
  values: string[];
  defaultValue?: string;
  requestedValue?: string | null;
  requestKey?: string;
  collapseByDefault?: boolean;
};

type UserAccordionSelection = {
  value: string;
  requestedValue?: string | null;
  requestKey?: string;
};

const COLLAPSED_ACCORDION_VALUE = "";
const ACCORDION_VALUE_KEY_SEPARATOR = "\u001f";

const isAvailableValue = (value: SyncedAccordionValue, values: string[]) =>
  typeof value === "string" && value.length > 0 && values.includes(value);

const resolveFallbackValue = (defaultValue: SyncedAccordionValue, values: string[]): SyncedAccordionValue => {
  if (isAvailableValue(defaultValue, values)) {
    return defaultValue;
  }

  return values[0];
};

const resolveInitialValue = ({
  values,
  defaultValue,
  requestedValue,
  collapseByDefault,
}: UseSyncedAccordionValueParams): SyncedAccordionValue => {
  if (isAvailableValue(requestedValue ?? undefined, values)) {
    return requestedValue ?? undefined;
  }

  if (collapseByDefault && values.length > 1) {
    return COLLAPSED_ACCORDION_VALUE;
  }

  return resolveFallbackValue(defaultValue, values);
};

export const useSyncedAccordionValue = ({
  values,
  defaultValue,
  requestedValue,
  requestKey,
  collapseByDefault = false,
}: UseSyncedAccordionValueParams) => {
  const [userSelection, setUserSelection] = useState<UserAccordionSelection | null>(null);

  const valuesKey = values.join(ACCORDION_VALUE_KEY_SEPARATOR);
  const availableValues = useMemo(
    () => (valuesKey ? valuesKey.split(ACCORDION_VALUE_KEY_SEPARATOR) : []),
    [valuesKey],
  );

  const value = useMemo(() => {
    const selection = userSelection;

    if (selection && selection.requestedValue === requestedValue && selection.requestKey === requestKey) {
      if (
        selection.value === COLLAPSED_ACCORDION_VALUE ||
        isAvailableValue(selection.value, availableValues)
      ) {
        return selection.value;
      }
    }

    return resolveInitialValue({ values: availableValues, defaultValue, requestedValue, collapseByDefault });
  }, [availableValues, defaultValue, requestedValue, requestKey, userSelection, collapseByDefault]);

  const handleValueChange = useCallback((nextValue: string) => {
    setUserSelection({ value: nextValue, requestedValue, requestKey });
  }, [requestedValue, requestKey]);

  return {
    value,
    onValueChange: handleValueChange,
  };
};
