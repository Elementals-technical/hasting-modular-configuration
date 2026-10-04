import { useCallback } from "react";
import { useLocation, useNavigate, type NavigateOptions, type To } from "react-router-dom";

import { COLLECTION_ID_QUERY_PARAM } from "@/features/saveConfiguration";

import { withPreservedCollectionId } from "./useStepNavigate";

/**
 * Navigation that keeps the collection of the session.
 *
 * The collection is fixed when the app starts and lives in the URL, so a client navigation
 * that drops `collectionId` reads as an identity change and is blocked by
 * CollectionReadinessGate. Every in-app navigation goes through this hook; a target that
 * names a collection of its own keeps it, which is what restore needs.
 */
export const useCollectionNavigate = () => {
  const navigate = useNavigate();
  const location = useLocation();

  return useCallback(
    (to: To | number, options?: NavigateOptions) => {
      if (typeof to === "number") return navigate(to);

      if (typeof to === "string") return navigate(withPreservedCollectionId(to, location.search), options);

      const search = to.search ?? "";
      const params = new URLSearchParams(search);
      const collectionId = new URLSearchParams(location.search).get(COLLECTION_ID_QUERY_PARAM);

      if (collectionId && !params.has(COLLECTION_ID_QUERY_PARAM)) {
        params.set(COLLECTION_ID_QUERY_PARAM, collectionId);
      }

      return navigate({ ...to, search: params.toString() }, options);
    },
    [navigate, location.search],
  );
};
