import { useCallback } from "react";
import { useLocation } from "react-router-dom";

import { getSelectedProducts } from "@/entities/product/model/store/selectors";
import { useAppSelector } from "@/shared/hooks/store/redux";

import { buildConfigurationShareUrl } from "../lib/buildConfigurationShareUrl";
import { resolveConfigurationIdFromSearch } from "../lib/configurationUrlParams";
import { getSaveFailureMessage } from "../lib/saveFailureMessage";
import { useSaveCurrentConfiguration } from "./useSaveCurrentConfiguration";

export type CurrentConfigurationLink = {
  id: string;
  url: string;
};

/**
 * Share link for the current configuration.
 *
 * A configuration opened from an existing link keeps that link instead of saving a
 * second copy of the same state; otherwise the shared save path produces a new one.
 */
export const useCurrentConfigurationLink = () => {
  const location = useLocation();
  const selectedProducts = useAppSelector(getSelectedProducts);
  const saveCurrentConfiguration = useSaveCurrentConfiguration();

  const createCurrentConfigurationLink = useCallback(async (): Promise<CurrentConfigurationLink> => {
    const existingConfigId = resolveConfigurationIdFromSearch(location.search);
    if (existingConfigId) {
      return {
        id: existingConfigId,
        url: buildConfigurationShareUrl(existingConfigId),
      };
    }

    const result = await saveCurrentConfiguration({ fallbackProductIds: selectedProducts });

    if (!result.ok) {
      throw new Error(getSaveFailureMessage(result.reason));
    }

    return { id: result.id, url: result.url };
  }, [location.search, saveCurrentConfiguration, selectedProducts]);

  return { createCurrentConfigurationLink };
};
