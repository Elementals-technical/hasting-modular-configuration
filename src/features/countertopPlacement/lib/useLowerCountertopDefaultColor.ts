import { useEffect, useMemo, useRef } from "react";

import { selectDefaultValue, useActiveCollection } from "@/entities/collection";
import { getActiveProductProfile, getCompositionValues } from "@/entities/configuration";
import { createConfiguratorBridge } from "@/features/configuratorApi";
import { useAppSelector } from "@/shared/hooks/store/redux";
import { useCabinetCovers } from "@/shared/hooks/useCabinetCovers";

/**
 * The Lower takes the colour its collection names for it until another is chosen (Urban Duplex: the
 * Lateral Panel's, `cabinetCover.defaultColorAttributeId`). The scene keeps the Lower's colour with the
 * composition: one it names no colour for, or still in the colour it last followed, is asked for that
 * attribute's colour; a colour chosen on the Lower tab stays.
 */
export const useLowerCountertopDefaultColor = () => {
  const attributeId = useActiveCollection(
    (collection) => collection.catalog.skuProfile?.cabinetCover?.defaultColorAttributeId ?? null,
  );
  // The composition's value of that attribute, else the collection's default.
  const defaultColor = useAppSelector((state) => {
    if (!attributeId) return null;
    const value = getCompositionValues(state)[attributeId];
    if (typeof value === "string" && value.trim()) return value;
    return selectDefaultValue(getActiveProductProfile(state), attributeId) || null;
  });
  const covers = useCabinetCovers();
  const bridge = useMemo(() => createConfiguratorBridge(), []);
  // The colour the Lower was last asked to follow.
  const followed = useRef<string | null>(null);

  useEffect(() => {
    if (!covers?.length || !defaultColor) return;
    let cancelled = false;

    void (async () => {
      try {
        const state = (await bridge.getCabinetCoverColorState?.()) ?? null;
        if (cancelled || !state) return;
        const requested = state.requestedMaterialId;
        if (requested === defaultColor) {
          followed.current = defaultColor;
          return;
        }
        if (requested !== null && requested !== followed.current) return;

        const result = await bridge.setCabinetCoverColor?.(defaultColor);
        if (!cancelled && (result?.status === "applied" || result?.status === "unchanged")) {
          followed.current = defaultColor;
        }
      } catch (error) {
        console.warn("[cabinet-cover] the Lower could not take its default colour", error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [bridge, covers, defaultColor]);
};
