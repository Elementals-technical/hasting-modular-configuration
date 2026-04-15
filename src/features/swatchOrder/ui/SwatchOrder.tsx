import { useEffect, useMemo } from "react";
import { useGetConfiguratorQuery } from "@/entities";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/store/redux";
import { PortalBody } from "@/shared/ui/Popups/Portal/PortalBody";
import { useMount } from "@/shared/ui/Popups/hooks/useMount";
import {
  getCabinetColor,
  getHandleGrooveColor,
  getActiveCountertopColor,
  getTowelBarColor,
  getVesselColor,
} from "@/entities/product/model/store/selectors";
import { adaptThreekitConfig } from "../lib/adaptThreekitConfig";
import {
  closeSwatchOrder,
  markCartSubmitted,
  setAllMaterialsOptions,
  setCartMaterials,
  setPanelFilter,
} from "../model/store/slice";
import {
  getActiveProductElement,
  getIsAutofillEnabled,
  getIsSwatchOrderOpen,
  getSelectedMaterials,
} from "../model/store/selectors";
import type { AttributeValue, IThreekitConfiguration } from "../model/types";
import { MAX_SLOTS } from "../model/constants";
import { Filters } from "./Filters/Filters";
import { MaterialList } from "./MaterialList/MaterialList";
import { SwatchesList } from "./SwatchesList/SwatchesList";
import { CloseIconSVG } from "./icons/CloseIconSVG";
import s from "./SwatchOrder.module.scss";

const ANIMATION_MS = 250;

interface SwatchOrderProps {
  onSendData?: (selected: AttributeValue[]) => void;
  onSelectMaterial?: (item: AttributeValue) => void;
}

export const SwatchOrder = ({ onSendData, onSelectMaterial }: SwatchOrderProps) => {
  const dispatch = useAppDispatch();
  const isOpen = useAppSelector(getIsSwatchOrderOpen);
  const activeProductElement = useAppSelector(getActiveProductElement);
  const isAutofillEnabled = useAppSelector(getIsAutofillEnabled);
  const selectedMaterials = useAppSelector(getSelectedMaterials);
  const cabinetColor = useAppSelector(getCabinetColor);
  const handleGrooveColor = useAppSelector(getHandleGrooveColor);
  const countertopColor = useAppSelector(getActiveCountertopColor);
  const towelBarColor = useAppSelector(getTowelBarColor);
  const vesselColor = useAppSelector(getVesselColor);
  const { mounted } = useMount({ opened: isOpen, animationDurationMs: ANIMATION_MS });

  const { data, isFetching } = useGetConfiguratorQuery({
    id: 4,
    view: "full",
    serialize: true,
  });

  const mapped = useMemo(
    () => adaptThreekitConfig(data as unknown as IThreekitConfiguration | undefined),
    [data],
  );

  useEffect(() => {
    if (!mapped.productElementOptions.length) return;
    dispatch(setAllMaterialsOptions(mapped));
  }, [dispatch, mapped]);

  useEffect(() => {
    if (!mapped.productElementOptions.length) return;
    if (activeProductElement) {
      const match = mapped.productElementOptions.filter(
        (group) => group.value === activeProductElement,
      );
      dispatch(
        setPanelFilter({ attributes: match.length ? match : mapped.productElementOptions }),
      );
    } else {
      dispatch(setPanelFilter({ attributes: mapped.productElementOptions }));
    }
  }, [dispatch, mapped, activeProductElement]);

  useEffect(() => {
    if (!isOpen) return;
    if (!isAutofillEnabled) return;
    if (!mapped.allMaterialValues.length) return;

    const activeByElement: Record<string, string | undefined | null> = {
      "Cabinet Color": cabinetColor,
      "Handle Groove Color": handleGrooveColor,
      "Countertop Color": countertopColor,
      "Towel Bar Color": towelBarColor,
      Vessels: vesselColor,
    };

    const wanted: string[] = [];
    const push = (v?: string | null) => {
      if (typeof v === "string" && v.trim() && !wanted.includes(v)) wanted.push(v);
    };
    for (const value of Object.values(activeByElement)) push(value);

    const seen = new Set<string>();
    const resolved: AttributeValue[] = [];
    for (const value of wanted) {
      if (resolved.length >= MAX_SLOTS) break;
      const match = mapped.allMaterialValues.find((item) => {
        const key = item.metadata?.value ?? item.value ?? item.label;
        return key === value;
      });
      if (!match) continue;
      const dedupeKey = `${match.parentName}__${match.metadata?.label ?? match.label}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      resolved.push({ ...match, count: 1 });
    }

    dispatch(setCartMaterials(resolved));
  }, [
    dispatch,
    isOpen,
    isAutofillEnabled,
    mapped,
    cabinetColor,
    handleGrooveColor,
    countertopColor,
    towelBarColor,
    vesselColor,
  ]);

  useEffect(() => {
    if (!isOpen) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") dispatch(closeSwatchOrder());
    };
    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [dispatch, isOpen]);

  if (!mounted) return null;

  const handleClose = () => dispatch(closeSwatchOrder());

  const handleAddToCart = () => {
    dispatch(markCartSubmitted());
    onSendData?.(selectedMaterials);
    handleClose();
  };

  return (
    <PortalBody>
      <div className={`${s.root} ${isOpen ? s.rootOpen : ""}`} aria-hidden={!isOpen}>
        <button
          type="button"
          className={s.backdrop}
          onClick={handleClose}
          aria-label="Close swatches sidebar"
        />

        <aside
          className={`${s.panel} ${isOpen ? s.panelOpen : ""}`}
          role="dialog"
          aria-modal="true"
          aria-label="Order free swatches"
        >
          <header className={s.header}>
            <h2 className={s.title}>Order free swatches</h2>
            <button type="button" className={s.closeBtn} onClick={handleClose} aria-label="Close">
              <CloseIconSVG width={10} height={10} />
            </button>
          </header>

          <div className={s.body}>
            <div className={s.filtersDivider}>
              <Filters />
            </div>

            {isFetching && !mapped.allMaterialValues.length ? (
              <div className={s.loading}>Loading swatches…</div>
            ) : (
              <MaterialList onSelectMaterial={onSelectMaterial} />
            )}

            <SwatchesList />
          </div>

          <footer className={s.footer}>
            <button
              type="button"
              className={s.addBtn}
              onClick={handleAddToCart}
              disabled={selectedMaterials.length === 0}
            >
              ADD SWATCHES TO CART
            </button>
          </footer>
        </aside>
      </div>
    </PortalBody>
  );
};
