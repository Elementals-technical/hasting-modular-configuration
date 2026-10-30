import { useCallback } from "react";
import { useLocation, useNavigate, type NavigateOptions, type To } from "react-router-dom";

import { COLLECTION_ID_QUERY_PARAM } from "@/features/saveConfiguration";

export const withPreservedCollectionId = (path: string, currentSearch: string): To => {
  const collectionId = new URLSearchParams(currentSearch).get(COLLECTION_ID_QUERY_PARAM);
  if (!collectionId) return path;

  const [pathname, search = ""] = path.split("?");
  const params = new URLSearchParams(search);
  if (!params.has(COLLECTION_ID_QUERY_PARAM)) params.set(COLLECTION_ID_QUERY_PARAM, collectionId);

  return { pathname, search: params.toString() };
};

export const useStepNavigate = () => {
  const navigate = useNavigate();
  const location = useLocation();

  return useCallback(
    (path: string, options?: NavigateOptions) => navigate(withPreservedCollectionId(path, location.search), options),
    [navigate, location.search],
  );
};
