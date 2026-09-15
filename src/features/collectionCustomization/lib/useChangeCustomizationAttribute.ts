import { useCallback, useMemo } from "react";
import { useStore } from "react-redux";

import type { RootState } from "@/app/store";
import { useAppDispatch } from "@/shared/hooks/store/redux";
import { useActiveCollection, type CustomizationFlowId } from "@/entities/collection";
import { changeAttribute, type AttributeChange, type ChangeResult } from "@/features/configurationCommands";
import { createPlayCanvasRuntimePort } from "@/features/playCanvasAdapter";

export const useChangeCustomizationAttribute = (flow: CustomizationFlowId) => {
  const dispatch = useAppDispatch();
  const store = useStore<RootState>();
  const activeCollection = useActiveCollection();

  const runtime = useMemo(
    () =>
      createPlayCanvasRuntimePort({
        getBindings: () =>
          activeCollection.status === "ready" ? (activeCollection.data.catalog.runtimeBindings ?? null) : null,
      }),
    [activeCollection],
  );

  return useCallback(
    (change: AttributeChange): Promise<ChangeResult> =>
      changeAttribute(change, { getState: store.getState, dispatch, runtime, flow }),
    [store, dispatch, runtime, flow],
  );
};
