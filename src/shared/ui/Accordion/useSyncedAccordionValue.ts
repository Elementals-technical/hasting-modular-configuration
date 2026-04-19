import { useCallback, useMemo, useState } from "react";

type SyncedAccordionValue = string | undefined;

type UseSyncedAccordionValueParams = {
  values: string[];
  defaultValue?: string;
  requestedValue?: string | null;
};

type UserAccordionSelection = {
  value: string;
  requestedValue?: string | null;
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
}: UseSyncedAccordionValueParams): SyncedAccordionValue => {
  if (isAvailableValue(requestedValue ?? undefined, values)) {
    return requestedValue ?? undefined;
  }

  return resolveFallbackValue(defaultValue, values);
};

export const useSyncedAccordionValue = ({
  values,
  defaultValue,
  requestedValue,
}: UseSyncedAccordionValueParams) => {
  const [userSelection, setUserSelection] = useState<UserAccordionSelection | null>(null);

  const valuesKey = values.join(ACCORDION_VALUE_KEY_SEPARATOR);
  const availableValues = useMemo(
    () => (valuesKey ? valuesKey.split(ACCORDION_VALUE_KEY_SEPARATOR) : []),
    [valuesKey],
  );

  const value = useMemo(() => {
    const selection = userSelection;

    if (selection && selection.requestedValue === requestedValue) {
      if (
        selection.value === COLLAPSED_ACCORDION_VALUE ||
        isAvailableValue(selection.value, availableValues)
      ) {
        return selection.value;
      }
    }

    return resolveInitialValue({ values: availableValues, defaultValue, requestedValue });
  }, [availableValues, defaultValue, requestedValue, userSelection]);

  const handleValueChange = useCallback((nextValue: string) => {
    setUserSelection({ value: nextValue, requestedValue });
  }, [requestedValue]);

  return {
    value,
    onValueChange: handleValueChange,
  };
};
