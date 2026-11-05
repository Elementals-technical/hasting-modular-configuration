import { useEffect, useMemo, useRef } from "react";

import { sceneValueOf, selectDefaultValue, semanticValueOf, useActiveCollection } from "@/entities/collection";
import { getActiveProductProfile, getActiveRuntimeBindings, getCompositionValues } from "@/entities/configuration";
import { resolveConfiguratorOptions } from "@/features/collectionCustomization/lib/resolveSectionState";
import { createConfiguratorBridge } from "@/features/configuratorApi";
import type { RootState } from "@/app/store";
import { useAppSelector } from "@/shared/hooks/store/redux";
import { useCabinetCovers } from "@/shared/hooks/useCabinetCovers";
import { CABINET_COVER_COLOR_ATTRIBUTE_ID } from "@/shared/lib/sku";

// The composition's value of an attribute, else the collection's default.
const colorOf = (state: RootState, attributeId: string): string | null => {
  const value = getCompositionValues(state)[attributeId];
  if (typeof value === "string" && value.trim()) return value;
  return selectDefaultValue(getActiveProductProfile(state), attributeId) || null;
};

/**
 * The Lower comes in the Upper's colours and stands, until another is chosen, in the colour the scene
 * paints it — its own cabinet's (user, 2026-11-05; it followed the Upper's between 2026-10-28 and then).
 * A collection that names a colour of its own for it (Urban Duplex: the Lateral Panel's,
 * `cabinetCover.defaultColorAttributeId`) is followed while that colour is one of the Upper's; named by
 * no collection, or off the Upper's palette, nothing is asked of the scene and each Lower keeps its
 * cabinet's colour. A colour chosen on the Lower tab stays.
 */
export const useLowerCountertopDefaultColor = () => {
  const hasCover = useActiveCollection((collection) => Boolean(collection.catalog.skuProfile?.cabinetCover));
  const attributeId = useActiveCollection(
    (collection) => collection.catalog.skuProfile?.cabinetCover?.defaultColorAttributeId ?? null,
  );
  const configurator = useActiveCollection((collection) => collection.catalog.configurator);
  const profile = useAppSelector(getActiveProductProfile);
  const bindings = useAppSelector(getActiveRuntimeBindings);
  const named = useAppSelector((state) => (hasCover && attributeId ? colorOf(state, attributeId) : null));
  const palette = useMemo(
    () =>
      new Set(
        hasCover
          ? resolveConfiguratorOptions(profile, CABINET_COVER_COLOR_ATTRIBUTE_ID, configurator).map(
              ({ value }) => value,
            )
          : [],
      ),
    [configurator, hasCover, profile],
  );
  const defaultColor = named !== null && palette.has(named) ? named : null;
  const covers = useCabinetCovers();
  const bridge = useMemo(() => createConfiguratorBridge(), []);
  // The scene material the Lower was last asked to follow.
  const followed = useRef<string | null>(null);

  useEffect(() => {
    if (!covers?.length || !defaultColor) return;
    let cancelled = false;
    const material = sceneValueOf(bindings, CABINET_COVER_COLOR_ATTRIBUTE_ID, defaultColor);

    void (async () => {
      try {
        const state = (await bridge.getCabinetCoverColorState?.()) ?? null;
        if (cancelled || !state) return;
        const requested = state.requestedMaterialId;
        if (requested === material) {
          followed.current = material;
          return;
        }
        // A material that is one of the Upper's colours reads as itself, any other by its binding.
        const requestedColor =
          requested === null || palette.has(requested)
            ? requested
            : semanticValueOf(bindings, CABINET_COVER_COLOR_ATTRIBUTE_ID, requested);
        if (requestedColor !== null && requested !== followed.current && palette.has(requestedColor)) return;

        const result = await bridge.setCabinetCoverColor?.(material);
        if (!cancelled && (result?.status === "applied" || result?.status === "unchanged")) {
          followed.current = material;
        }
      } catch (error) {
        console.warn("[cabinet-cover] the Lower could not take its default colour", error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [bindings, bridge, covers, defaultColor, palette]);
};
