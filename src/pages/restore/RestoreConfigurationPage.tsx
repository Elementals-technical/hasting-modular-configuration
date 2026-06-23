import { useEffect } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

import { useLazyRestoreConfigurationQuery } from "@/entities";
import {
  CONFIGURATION_ID_QUERY_PARAM,
  HOST_URL_QUERY_PARAM,
  persistHostUrlFromSearch,
  readHostUrlFromSearch,
} from "@/features/saveConfiguration";
import { ROUTES } from "@/shared";

const RESTORE_TARGET = {
  prebuilt: `${ROUTES.PREBUILT}/model`,
  custom: `${ROUTES.CUSTOM}/cabinet-builder`,
} as const;

const resolveRestoreTarget = (sourcePath: unknown): string => {
  if (typeof sourcePath === "string") {
    if (sourcePath.startsWith(ROUTES.CUSTOM)) return RESTORE_TARGET.custom;
    if (sourcePath.startsWith(ROUTES.PREBUILT)) return RESTORE_TARGET.prebuilt;
  }

  return RESTORE_TARGET.prebuilt;
};

const buildRestoreSearch = (configId: string, hostUrl: string | null): string => {
  const params = new URLSearchParams();
  params.set(CONFIGURATION_ID_QUERY_PARAM, configId);

  if (hostUrl) {
    params.set(HOST_URL_QUERY_PARAM, hostUrl);
  }

  return `?${params.toString()}`;
};

export const RestoreConfigurationPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [restoreConfiguration] = useLazyRestoreConfigurationQuery();
  const configId = searchParams.get(CONFIGURATION_ID_QUERY_PARAM)?.trim() ?? "";
  const hostUrl = readHostUrlFromSearch(location.search);

  useEffect(() => {
    if (hostUrl) {
      persistHostUrlFromSearch(location.search);
    }
  }, [hostUrl, location.search]);

  useEffect(() => {
    let isCancelled = false;

    const resolveConfigurationRoute = async () => {
      if (!configId) {
        navigate(RESTORE_TARGET.prebuilt, { replace: true });
        return;
      }

      const restoreSearch = buildRestoreSearch(configId, hostUrl);

      try {
        const result = await restoreConfiguration(configId).unwrap();
        if (isCancelled) return;

        navigate(
          {
            pathname: resolveRestoreTarget(result?.metadata?.path),
            search: restoreSearch,
          },
          { replace: true },
        );
      } catch (error) {
        console.error("[Restore] Failed to resolve configuration route", error);
        if (isCancelled) return;

        navigate(
          {
            pathname: RESTORE_TARGET.prebuilt,
            search: restoreSearch,
          },
          { replace: true },
        );
      }
    };

    void resolveConfigurationRoute();

    return () => {
      isCancelled = true;
    };
  }, [configId, hostUrl, navigate, restoreConfiguration]);

  return null;
};
