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

import { resolveRestoreNavigation } from "./lib/resolveRestoreNavigation";

const RESTORE_TARGET = {
  prebuilt: ROUTES.PREBUILT,
  custom: ROUTES.CUSTOM,
} as const;

const resolveRestoreTarget = (sourcePath: unknown): string => {
  if (typeof sourcePath === "string") {
    if (sourcePath.startsWith(ROUTES.CUSTOM)) return RESTORE_TARGET.custom;
    if (sourcePath.startsWith(ROUTES.PREBUILT)) return RESTORE_TARGET.prebuilt;
  }

  return RESTORE_TARGET.prebuilt;
};

/** A restore that changes the collection starts a new session, so it reloads the app. */
const reloadInto = (url: string) => window.location.assign(url);

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

        const savedCollectionId = readSavedCollectionId(result?.metadata);
        const pathname = resolveRestoreTarget(result?.metadata?.path);
        const search = buildConfigurationRestoreSearch({ configId, hostUrl, collectionId: savedCollectionId });
        const navigation = resolveRestoreNavigation({
          sessionCollectionId: searchParams.get("collectionId"),
          savedCollectionId,
        });

        if (navigation.kind === "reload") {
          reloadInto(`${pathname}${search}`);
          return;
        }

        navigate({ pathname, search }, { replace: true });
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
  }, [configId, dispatch, hostUrl, navigate, restoreConfiguration, searchParams]);

  return null;
};
