import type { AppDispatch } from "@/app/store";
import { configuratorApi } from "@/entities/configurator/api/configuratorApi";
import { countertopApi } from "@/entities/countertop/api/countertopApi";
import { productApi } from "@/entities/product/api/productApi";

import type { RemoteCollectionLoader } from "../model/types";

type RtkRequest = {
  unwrap: () => Promise<unknown>;
  abort: () => void;
  unsubscribe: () => void;
};

const unwrapRequest = async (request: RtkRequest, signal: AbortSignal): Promise<unknown> => {
  const abort = () => request.abort();
  signal.addEventListener("abort", abort, { once: true });
  try {
    return await request.unwrap();
  } finally {
    signal.removeEventListener("abort", abort);
    request.unsubscribe();
  }
};

export const createRtkCollectionRemoteLoader = (dispatch: AppDispatch): RemoteCollectionLoader => ({
  loadConfigurator: (reference, signal) =>
    unwrapRequest(
      dispatch(
        configuratorApi.endpoints.getConfigurator.initiate({
          id: reference?.id ?? "",
          view: reference?.view ?? "full",
          serialize: reference?.serialize ?? true,
        }),
      ),
      signal,
    ),
  loadCountertopTable: (id, signal) =>
    unwrapRequest(dispatch(countertopApi.endpoints.getCountertopDatatable.initiate(id)), signal),
  loadCabinetTable: (id, signal) =>
    unwrapRequest(dispatch(productApi.endpoints.getProductDatatable.initiate(id)), signal),
});
