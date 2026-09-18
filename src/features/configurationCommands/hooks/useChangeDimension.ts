import { useMemo } from "react";
import { useStore } from "react-redux";
import { useLocation } from "react-router-dom";

import type { RootState } from "@/app/store";
import { useActiveCollection, type RuntimeFlow } from "@/entities/collection";
import type { ConfigurationRuntimePort } from "@/entities/configuration";
import { createPlayCanvasRuntimePort } from "@/features/playCanvasAdapter";
import { useAppDispatch } from "@/shared/hooks/store/redux";

import { changeDimension } from "../lib/changeDimension";
import type { DimensionChange } from "../model/types";

export const useChangeDimension = ({ runtime: runtimeOverride }: { runtime?: ConfigurationRuntimePort } = {}) => {
  const store = useStore<RootState>();
  const dispatch = useAppDispatch();
  const { pathname } = useLocation();
  const flow: RuntimeFlow = pathname.includes("/custom") ? "custom" : "prebuilt";
  const collection = useActiveCollection();
  const bindings = collection.catalog.runtimeBindings ?? null;
  const configurator = collection.catalog.configurator;
  const runtime = useMemo(
    () => runtimeOverride ?? createPlayCanvasRuntimePort({ getBindings: () => bindings }),
    [bindings, runtimeOverride],
  );

  return useMemo(
    () => (change: DimensionChange) =>
      changeDimension(change, { getState: store.getState, dispatch, runtime, flow, configurator }),
    [configurator, dispatch, flow, runtime, store],
  );
};
