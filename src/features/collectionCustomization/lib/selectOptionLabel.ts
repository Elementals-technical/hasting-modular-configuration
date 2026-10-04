import { useCallback } from "react";

import { normalizeOptionValue, selectOption } from "@/entities/collection";
import { getActiveProductProfile } from "@/entities/configuration";
import { useAppSelector } from "@/shared/hooks/store/redux";

import type { ProductProfile } from "@/entities/collection";

/** Label of the profile option a stored value (canonical or legacy spelling) belongs to; the value itself otherwise. */
export const selectOptionLabel = (
  profile: ProductProfile | null,
  attributeId: string,
  value: string | null | undefined,
): string => {
  const canonical = normalizeOptionValue(profile, attributeId, value);
  return (canonical && selectOption(profile, attributeId, canonical)?.label) || value || "";
};

export const useOptionLabel = () => {
  const profile = useAppSelector(getActiveProductProfile);

  return useCallback(
    (attributeId: string, value: string | null | undefined) => selectOptionLabel(profile, attributeId, value),
    [profile],
  );
};
