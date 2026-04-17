import type { Dispatch, UnknownAction } from "@reduxjs/toolkit";

import { hydrateSwatchOrder, resetSwatchOrder } from "../model/store/slice";
import type { AttributeValue } from "../model/types";

type SwatchOrderMeta = {
  selectedMaterials?: AttributeValue[];
  manualSelectedMaterials?: AttributeValue[];
  isAutofillEnabled?: boolean;
  hasSubmittedCart?: boolean;
};

export const applySwatchOrderFromMetadata = (
  metadata: Record<string, unknown> | undefined,
  dispatch: Dispatch<UnknownAction>,
): void => {
  const meta = metadata?.swatchOrder as SwatchOrderMeta | undefined;

  if (meta) {
    dispatch(
      hydrateSwatchOrder({
        selectedMaterials: meta.selectedMaterials ?? [],
        manualSelectedMaterials: meta.manualSelectedMaterials ?? [],
        isAutofillEnabled: Boolean(meta.isAutofillEnabled),
        hasSubmittedCart: Boolean(meta.hasSubmittedCart),
      }),
    );
  } else {
    dispatch(resetSwatchOrder());
  }
};
