import { useEffect } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

import { clearRestore, useLazyRestoreConfigurationQuery } from "@/entities";
import {
  CONFIGURATION_ID_QUERY_PARAM,
  buildConfigurationRestoreSearch,
  persistHostUrlFromSearch,
  readHostUrlFromSearch,
  readSavedCollectionId,
} from "@/features/saveConfiguration";
import { ROUTES } from "@/shared";
import { useAppDispatch } from "@/shared/hooks/store/redux";

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

export const RestoreConfigurationPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
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

      // Opening a link is a new restore, even of a configuration restored earlier in this session.
      dispatch(clearRestore());

      try {
        const result = await restoreConfiguration(configId).unwrap();
        if (isCancelled) return;

        navigate(
          {
            pathname: resolveRestoreTarget(result?.metadata?.path),
            search: buildConfigurationRestoreSearch({
              configId,
              hostUrl,
              collectionId: readSavedCollectionId(result?.metadata),
            }),
          },
          { replace: true },
        );
      } catch (error) {
        console.error("[Restore] Failed to resolve configuration route", error);
        if (isCancelled) return;

        navigate(
          {
            pathname: RESTORE_TARGET.prebuilt,
            search: buildConfigurationRestoreSearch({ configId, hostUrl, collectionId: null }),
          },
          { replace: true },
        );
      }
    };

    void resolveConfigurationRoute();

    return () => {
      isCancelled = true;
    };
  }, [configId, dispatch, hostUrl, navigate, restoreConfiguration]);

  return null;
};
