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
  getManualSelectedMaterials,
  getIsSwatchOrderOpen,
  getSelectedMaterials,
} from "../model/store/selectors";
import type { AttributeValue, IProductElementOption, IThreekitConfiguration } from "../model/types";
import { Filters } from "./Filters/Filters";
import { MaterialList } from "./MaterialList/MaterialList";
import { SwatchesList } from "./SwatchesList/SwatchesList";
import { CloseIconSVG } from "./icons/CloseIconSVG";
import {
  areSameMaterialLists,
  deriveAutofillMaterials,
  mergeAutofillWithSelectedMaterials,
} from "../lib/deriveAutofillMaterials";
import s from "./SwatchOrder.module.scss";

const ANIMATION_MS = 250;
const COUNTERTOP_PRODUCT_ELEMENT = "Countertop Color";
const EXCLUDED_COUNTERTOP_SWATCH_MATERIALS = new Set(["lacqueredmt", "lacqueredgl"]);

const normalizeMaterialToken = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

const filterPanelAttributes = (attributes: IProductElementOption[]): IProductElementOption[] =>
  attributes
    .map((group) => {
      if (group.value !== COUNTERTOP_PRODUCT_ELEMENT) return group;

      return {
        ...group,
        valuesArray: group.valuesArray.filter((item) => {
          const material = item.metadata?.Material ?? item.metadata?.Finish ?? "";
          return !EXCLUDED_COUNTERTOP_SWATCH_MATERIALS.has(normalizeMaterialToken(material));
        }),
      };
    })
    .filter((group) => group.valuesArray.length > 0);

interface SwatchOrderProps {
  onSendData?: (selected: AttributeValue[]) => void;
  onSelectMaterial?: (item: AttributeValue) => void;
}

export const SwatchOrder = ({ onSendData, onSelectMaterial }: SwatchOrderProps) => {
  const dispatch = useAppDispatch();
  const isOpen = useAppSelector(getIsSwatchOrderOpen);
  const activeProductElement = useAppSelector(getActiveProductElement);
  const isAutofillEnabled = useAppSelector(getIsAutofillEnabled);
  const manualSelectedMaterials = useAppSelector(getManualSelectedMaterials);
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
  const autofillMaterials = useMemo(
    () =>
      deriveAutofillMaterials({
        allMaterialValues: mapped.allMaterialValues,
        values: [cabinetColor, handleGrooveColor, countertopColor, towelBarColor, vesselColor],
      }),
    [mapped.allMaterialValues, cabinetColor, handleGrooveColor, countertopColor, towelBarColor, vesselColor],
  );
  const mergedAutofillMaterials = useMemo(
    () =>
      mergeAutofillWithSelectedMaterials({
        autofillMaterials,
        selectedMaterials: manualSelectedMaterials,
      }),
    [autofillMaterials, manualSelectedMaterials],
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
        setPanelFilter({
          attributes: filterPanelAttributes(match.length ? match : mapped.productElementOptions),
        }),
      );
    } else {
      dispatch(setPanelFilter({ attributes: filterPanelAttributes(mapped.productElementOptions) }));
    }
  }, [dispatch, mapped, activeProductElement]);

  useEffect(() => {
    if (!isOpen) return;
    if (!isAutofillEnabled) return;
    if (!mergedAutofillMaterials.length) return;
    if (areSameMaterialLists(selectedMaterials, mergedAutofillMaterials)) return;

    dispatch(setCartMaterials(mergedAutofillMaterials));
  }, [
    dispatch,
    isOpen,
    isAutofillEnabled,
    selectedMaterials,
    mergedAutofillMaterials,
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
