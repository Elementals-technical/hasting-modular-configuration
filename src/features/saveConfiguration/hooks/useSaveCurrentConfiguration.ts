import { useCallback } from "react";
import { useLocation } from "react-router-dom";

import { useSaveConfigurationMutation } from "@/entities";
import { getRestoreState } from "@/entities/configuration/model/store/selectors";
import {
  getHasSubmittedCart,
  getIsAutofillEnabled,
  getManualSelectedMaterials,
  getSelectedMaterials,
} from "@/features/swatchOrder";
import { useAppSelector } from "@/shared/hooks/store/redux";

import { buildConfigurationMetadata, type ConfigurationMetadata } from "../lib/buildConfigurationMetadata";
import { buildConfigurationShareUrl } from "../lib/buildConfigurationShareUrl";
import { collectSceneConfiguration } from "../lib/collectSceneConfiguration";
import { isRestoreBlockingSave } from "../lib/restoreSaveGuard";
import { selectConfigurationSavePayload } from "../lib/selectSavePayload";

/**
 * One way to assemble and save the current configuration.
 *
 * Every save entry point used to build the same payload by hand — the scene configs, the
 * 24 UI fields, the swatch order — so adding a field meant five edits and one was always
 * missed. That is how `Handle`, `CabinetColorMaterial` and `CabinetColorFinish` came to
 * be dropped. They all go through here now, so the same state produces the same
 * configuration wherever Save happens.
 *
 * `hostUrl` is deliberately not part of the payload: `buildConfigurationShareUrl` reads
 * it from the query string or session storage, which is what makes a link opened inside
 * a parent page come back to that page.
 */

export type ConfigurationSaveRequest = {
  configuration: Record<string, unknown>;
  metadata: ConfigurationMetadata;
};

export type BuildConfigurationRequestOptions = {
  /** Overrides the saved path; defaults to the current route. */
  path?: string;
  /** Products to fall back to when the scene cannot report its composition order. */
  fallbackProductIds?: string[];
};

/**
 * Builds the request without sending it.
 *
 * Separate from saving so a caller that de-duplicates identical saves can compare
 * payloads before spending a request.
 */
export const useBuildConfigurationRequest = () => {
  const { pathname } = useLocation();

  const savePayload = useAppSelector(selectConfigurationSavePayload);
  const selectedMaterials = useAppSelector(getSelectedMaterials);
  const manualSelectedMaterials = useAppSelector(getManualSelectedMaterials);
  const isAutofillEnabled = useAppSelector(getIsAutofillEnabled);
  const hasSubmittedCart = useAppSelector(getHasSubmittedCart);

  return useCallback(
    async (options: BuildConfigurationRequestOptions = {}): Promise<ConfigurationSaveRequest | null> => {
      const { orderedProductIds, configuration } = await collectSceneConfiguration(options.fallbackProductIds);

      if (!orderedProductIds.length) return null;

      const metadata = buildConfigurationMetadata({
        path: options.path ?? pathname,
        orderedProductIds,
        uiState: savePayload.uiState,
        swatchOrder: {
          selectedMaterials,
          manualSelectedMaterials,
          isAutofillEnabled,
          hasSubmittedCart,
        },
        fragment: savePayload.fragment,
      });

      return { configuration, metadata };
    },
    [hasSubmittedCart, isAutofillEnabled, manualSelectedMaterials, pathname, savePayload, selectedMaterials],
  );
};

export type SaveCurrentConfigurationResult =
  | { ok: true; id: string; url: string; request: ConfigurationSaveRequest }
  | { ok: false; reason: "no-products" | "missing-id" | "restore-incomplete" };

export type SaveCurrentConfigurationOptions = BuildConfigurationRequestOptions;

export const useSaveCurrentConfiguration = () => {
  const buildRequest = useBuildConfigurationRequest();
  const [saveConfiguration] = useSaveConfigurationMutation();
  const restoreStatus = useAppSelector(getRestoreState).status;

  return useCallback(
    async (options: SaveCurrentConfigurationOptions = {}): Promise<SaveCurrentConfigurationResult> => {
      if (isRestoreBlockingSave(restoreStatus)) return { ok: false, reason: "restore-incomplete" };

      const request = await buildRequest(options);

      if (!request) return { ok: false, reason: "no-products" };

      const result = await saveConfiguration(request).unwrap();
      const configId = result?.id;

      if (configId === undefined || configId === null) {
        return { ok: false, reason: "missing-id" };
      }

      return {
        ok: true,
        id: String(configId),
        url: buildConfigurationShareUrl(configId),
        request,
      };
    },
    [buildRequest, restoreStatus, saveConfiguration],
  );
};

/**
 * Identity of a save request, ignoring the timestamp.
 *
 * `savedAt` changes on every build, so hashing the whole request never matches and a
 * de-duplication guard built on it silently saves every time.
 */
export const hashConfigurationRequest = ({ configuration, metadata }: ConfigurationSaveRequest): string => {
  const comparable = Object.fromEntries(Object.entries(metadata).filter(([key]) => key !== "savedAt"));

  return JSON.stringify({ configuration, metadata: comparable });
};
