import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useGetConfiguratorQuery } from "@/entities";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/store/redux";
import { PortalBody } from "@/shared/ui/Popups/Portal/PortalBody";
import { useMount } from "@/shared/ui/Popups/hooks/useMount";
import {
  getCabinetColor,
  getCountertopColorSku,
  getHandleGrooveColor,
  getActiveCountertopColor,
  getTowelBarColor,
  getVesselColor,
} from "@/entities/product/model/store/selectors";
import { getCountertopMaterialTokensBySku } from "@/shared/lib/sku";
import { adaptThreekitConfig } from "../lib/adaptThreekitConfig";
import {
  closeSwatchOrder,
  markCartSubmitted,
  setAllMaterialsOptions,
  setCartMaterials,
  setMaterialSelect,
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
import { MultiSelect } from "./MultiSelect/MultiSelect";
import HubspotForm from "@/shared/ui/Popups/HowToBuyPopup/HubspotForm/HubspotForm";
import {
  areSameMaterialLists,
  deriveAutofillMaterials,
  mergeAutofillWithSelectedMaterials,
} from "../lib/deriveAutofillMaterials";
import { useCountertopRules } from "@/features/configurator-rule-core/countertop";
import s from "./SwatchOrder.module.scss";

const ANIMATION_MS = 250;
const COUNTERTOP_PRODUCT_ELEMENT = "Countertop Color";
const EXCLUDED_COUNTERTOP_SWATCH_MATERIALS = new Set(["lacqueredmt", "lacqueredgl"]);
const SWATCHES_HUBSPOT_PORTAL_ID = "21569224";
const SWATCHES_HUBSPOT_FORM_ID = "e4617ef8-a06b-4dc4-8341-c697ff220008";
const SWATCHES_HUBSPOT_FIELD_NAME = "swatches_data";

type SwatchAnalyticsEventName =
  | "hastings_swatch_order_add_to_cart"
  | "hastings_swatch_order_form_ready"
  | "hastings_swatch_order_form_submit";

type SwatchAnalyticsPayload = {
  event: SwatchAnalyticsEventName;
  swatch_order: {
    form_id: string;
    portal_id: string;
    field_name: string;
    swatch_count: number;
    total_quantity: number;
    swatches_data_length: number;
    product_elements: string[];
    finishes: string[];
    materials: string[];
    colors: string[];
    looks: string[];
    items: Array<Record<string, string | number>>;
  };
};

declare global {
  interface Window {
    dataLayer?: SwatchAnalyticsPayload[];
  }
}

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

const getTextValue = (value: unknown) => {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const normalized = String(value).trim();
  return normalized.length ? normalized : null;
};

const uniqueValues = (values: Array<string | null>) => Array.from(new Set(values.filter((value): value is string => Boolean(value))));

const compactAnalyticsItem = (item: Record<string, string | number | null>) =>
  Object.fromEntries(Object.entries(item).filter(([, value]) => value !== null && value !== "")) as Record<
    string,
    string | number
  >;

const buildSwatchAnalyticsPayload = (
  event: SwatchAnalyticsEventName,
  items: AttributeValue[],
  swatchesDataText: string,
): SwatchAnalyticsPayload => {
  const analyticsItems = items.map((item, index) => {
    const metadata = item.metadata ?? {};
    const productInformation = (
      item as AttributeValue & {
        productInformation?: { assetId?: unknown; name?: unknown };
      }
    ).productInformation;

    return compactAnalyticsItem({
      index: index + 1,
      label: getTextValue(metadata.label) ?? getTextValue(item.label) ?? getTextValue(item.name),
      value: getTextValue(metadata.value) ?? getTextValue(item.value),
      option: getTextValue(item.optionName),
      parent: getTextValue(item.parentName),
      count: item.count ?? 1,
      finish: getTextValue(metadata.Finish),
      material: getTextValue(metadata.Material),
      color: getTextValue(metadata.Color),
      look: getTextValue(metadata.Look),
      sku: getTextValue(metadata.sku),
      product: getTextValue(productInformation?.name) ?? getTextValue(item.name),
      asset_id: getTextValue(productInformation?.assetId) ?? getTextValue(item.assetId),
      selection_source: getTextValue(item.selectionSource),
    });
  });

  return {
    event,
    swatch_order: {
      form_id: SWATCHES_HUBSPOT_FORM_ID,
      portal_id: SWATCHES_HUBSPOT_PORTAL_ID,
      field_name: SWATCHES_HUBSPOT_FIELD_NAME,
      swatch_count: items.length,
      total_quantity: items.reduce((total, item) => total + (item.count ?? 1), 0),
      swatches_data_length: swatchesDataText.length,
      product_elements: uniqueValues(items.map((item) => getTextValue(item.parentName) ?? getTextValue(item.optionName))),
      finishes: uniqueValues(items.map((item) => getTextValue(item.metadata?.Finish))),
      materials: uniqueValues(items.map((item) => getTextValue(item.metadata?.Material))),
      colors: uniqueValues(items.flatMap((item) => String(item.metadata?.Color ?? "").split(",").map(getTextValue))),
      looks: uniqueValues(items.map((item) => getTextValue(item.metadata?.Look))),
      items: analyticsItems,
    },
  };
};

const trackSwatchOrderAnalytics = (
  event: SwatchAnalyticsEventName,
  items: AttributeValue[],
  swatchesDataText: string,
) => {
  const payload = buildSwatchAnalyticsPayload(event, items, swatchesDataText);
  window.dataLayer = window.dataLayer ?? [];
  window.dataLayer.push(payload);
  window.dispatchEvent(new CustomEvent(event, { detail: payload }));
};

const formatSwatchesDataAsText = (items: AttributeValue[]) => {
  if (!items.length) return "";

  return items
    .map((item, index) => {
      const metadata = item.metadata ?? {};
      const productInformation = (
        item as AttributeValue & {
          productInformation?: { assetId?: unknown; name?: unknown };
        }
      ).productInformation;

      return [
        `Swatch ${index + 1}`,
        `Label: ${getTextValue(metadata.label) ?? getTextValue(item.label) ?? getTextValue(item.name) ?? ""}`,
        `Value: ${getTextValue(metadata.value) ?? getTextValue(item.value) ?? ""}`,
        `Option: ${getTextValue(item.optionName) ?? ""}`,
        `Parent: ${getTextValue(item.parentName) ?? ""}`,
        `Count: ${item.count ?? 1}`,
        `Finish: ${getTextValue(metadata.Finish) ?? ""}`,
        `Material: ${getTextValue(metadata.Material) ?? ""}`,
        `Color: ${getTextValue(metadata.Color) ?? ""}`,
        `Look: ${getTextValue(metadata.Look) ?? ""}`,
        `SKU: ${getTextValue(metadata.sku) ?? ""}`,
        `Product: ${getTextValue(productInformation?.name) ?? getTextValue(item.name) ?? ""}`,
        `Asset ID: ${getTextValue(productInformation?.assetId) ?? getTextValue(item.assetId) ?? ""}`,
      ]
        .filter((line) => !line.endsWith(": "))
        .join("\n");
    })
    .join("\n\n");
};

const setSwatchesDataFieldValue = (value: string) => {
  const field = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(
    `[name="${SWATCHES_HUBSPOT_FIELD_NAME}"]`,
  );
  if (!field) return;

  field.value = value;
  field.dispatchEvent(new Event("input", { bubbles: true }));
  field.dispatchEvent(new Event("change", { bubbles: true }));
};

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
  const countertopColorSku = useAppSelector(getCountertopColorSku);
  const towelBarColor = useAppSelector(getTowelBarColor);
  const vesselColor = useAppSelector(getVesselColor);
  const [activeElements, setActiveElements] = useState<string[] | null>(null);
  const [isFormStep, setIsFormStep] = useState(false);
  const trackedFormStepRef = useRef(false);
  const { mounted } = useMount({ opened: isOpen, animationDurationMs: ANIMATION_MS });
  const countertopRules = useCountertopRules({ skip: !isOpen });

  const { data, isFetching } = useGetConfiguratorQuery({
    id: 4,
    view: "full",
    serialize: true,
  });

  const mapped = useMemo(
    () =>
      adaptThreekitConfig(data as unknown as IThreekitConfiguration | undefined, {
        countertopRules,
      }),
    [data, countertopRules],
  );
  const autofillMaterials = useMemo(
    () =>
      deriveAutofillMaterials({
        allMaterialValues: mapped.allMaterialValues,
        values: [
          { value: cabinetColor, preferredParentName: "Cabinet Color" },
          { value: handleGrooveColor, preferredParentName: "Handle Groove Color" },
          {
            value: countertopColor,
            preferredParentName: COUNTERTOP_PRODUCT_ELEMENT,
            preferredMaterialTokens: getCountertopMaterialTokensBySku(countertopColorSku),
          },
          { value: towelBarColor, preferredParentName: "Towel Bar Color" },
          { value: vesselColor, preferredParentName: "Vessels" },
        ],
      }),
    [
      mapped.allMaterialValues,
      cabinetColor,
      handleGrooveColor,
      countertopColor,
      countertopColorSku,
      towelBarColor,
      vesselColor,
    ],
  );
  const mergedAutofillMaterials = useMemo(
    () =>
      mergeAutofillWithSelectedMaterials({
        autofillMaterials,
        selectedMaterials: manualSelectedMaterials,
      }),
    [autofillMaterials, manualSelectedMaterials],
  );
  const swatchesDataText = useMemo(() => formatSwatchesDataAsText(selectedMaterials), [selectedMaterials]);
  const trackSwatchEvent = useCallback(
    (event: SwatchAnalyticsEventName) => {
      trackSwatchOrderAnalytics(event, selectedMaterials, swatchesDataText);
    },
    [selectedMaterials, swatchesDataText],
  );
  const syncSwatchesDataField = useCallback(() => {
    setSwatchesDataFieldValue(swatchesDataText);
  }, [swatchesDataText]);
  const handleSwatchesFormReady = useCallback(() => {
    syncSwatchesDataField();
    window.setTimeout(syncSwatchesDataField, 250);
    trackSwatchEvent("hastings_swatch_order_form_ready");
  }, [syncSwatchesDataField, trackSwatchEvent]);
  const handleSwatchesFormSubmit = useCallback(() => {
    syncSwatchesDataField();
    trackSwatchEvent("hastings_swatch_order_form_submit");
  }, [syncSwatchesDataField, trackSwatchEvent]);

  useEffect(() => {
    if (!mapped.productElementOptions.length) return;
    dispatch(setAllMaterialsOptions(mapped));
  }, [dispatch, mapped]);

  const activeSections = useMemo(() => {
    const activeByElement: Record<string, string | undefined | null> = {
      "Cabinet Color": cabinetColor,
      "Handle Groove Color": handleGrooveColor,
      "Countertop Color": countertopColor,
      "Towel Bar Color": towelBarColor,
      Vessels: vesselColor,
    };
    return mapped.productElementOptions.filter(
      (group) => Boolean(activeByElement[group.value]),
    );
  }, [mapped.productElementOptions, cabinetColor, handleGrooveColor, countertopColor, towelBarColor, vesselColor]);

  const activeElementValues = useMemo(
    () => activeElements ?? activeSections.map((group) => group.value),
    [activeElements, activeSections],
  );

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
    } else if (activeElementValues.length > 0) {
      const match = mapped.productElementOptions.filter(
        (group) => activeElementValues.includes(group.value),
      );
      dispatch(
        setPanelFilter({ attributes: match.length ? match : mapped.productElementOptions }),
      );
    } else {
      dispatch(setPanelFilter({ attributes: filterPanelAttributes(mapped.productElementOptions) }));
    }
  }, [dispatch, mapped, activeProductElement, activeElementValues]);

  const resetPanelState = useCallback(() => {
    setActiveElements(null);
    setIsFormStep(false);
    trackedFormStepRef.current = false;
  }, []);

  const handleClose = useCallback(() => {
    resetPanelState();
    dispatch(closeSwatchOrder());
  }, [dispatch, resetPanelState]);

  useEffect(() => {
    if (isOpen) return;

    const frameId = window.requestAnimationFrame(resetPanelState);
    return () => window.cancelAnimationFrame(frameId);
  }, [isOpen, resetPanelState]);

  useEffect(() => {
    if (!isFormStep) return;

    if (!trackedFormStepRef.current) {
      trackSwatchEvent("hastings_swatch_order_add_to_cart");
      trackedFormStepRef.current = true;
    }

    const frameId = window.requestAnimationFrame(syncSwatchesDataField);
    const timeoutId = window.setTimeout(syncSwatchesDataField, 350);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(timeoutId);
    };
  }, [isFormStep, syncSwatchesDataField, trackSwatchEvent]);

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
      if (event.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [handleClose, isOpen]);

  if (!mounted) return null;

  const handleElementsChange = (values: string[]) => {
    setActiveElements(values);
    dispatch(setMaterialSelect({ filterName: "Finish", values: [] }));
    dispatch(setMaterialSelect({ filterName: "Color", values: [] }));
    dispatch(setMaterialSelect({ filterName: "Look", values: [] }));
  };

  const handleAddToCart = () => {
    dispatch(markCartSubmitted());
    onSendData?.(selectedMaterials);
    setIsFormStep(true);
  };

  const handleBackToSwatches = () => {
    trackedFormStepRef.current = false;
    setIsFormStep(false);
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
          aria-label={isFormStep ? "Complete swatch order" : "Order free swatches"}
        >
          <header className={s.header}>
            <h2 className={s.title}>{isFormStep ? "Complete swatch order" : "Order free swatches"}</h2>
            <button type="button" className={s.closeBtn} onClick={handleClose} aria-label="Close">
              <CloseIconSVG width={10} height={10} />
            </button>
          </header>

          <div className={s.body}>
            {isFormStep ? (
              <div className={s.formStep}>
                <HubspotForm
                  portalId={SWATCHES_HUBSPOT_PORTAL_ID}
                  formId={SWATCHES_HUBSPOT_FORM_ID}
                  region="na1"
                  onFormReady={handleSwatchesFormReady}
                  onFormSubmit={handleSwatchesFormSubmit}
                  onFormSubmitted={handleClose}
                  customStyle={true}
                />
              </div>
            ) : (
              <>
                {!activeProductElement && activeSections.length > 0 && (
                  <div className={s.sectionSelect}>
                    <span className={s.sectionLabel}>Product element</span>
                    <MultiSelect
                      options={activeSections.map((g) => ({ value: g.value, label: g.label }))}
                      values={activeElementValues}
                      onValueChange={handleElementsChange}
                      placeholder="All product elements"
                      align="end"
                    />
                  </div>
                )}

                <div className={s.filtersDivider}>
                  <Filters />
                </div>

                {isFetching && !mapped.allMaterialValues.length ? (
                  <div className={s.loading}>Loading swatches…</div>
                ) : (
                  <MaterialList onSelectMaterial={onSelectMaterial} />
                )}

                <SwatchesList />
              </>
            )}
          </div>

          <footer className={s.footer}>
            {isFormStep ? (
              <button type="button" className={s.editBtn} onClick={handleBackToSwatches}>
                EDIT SWATCHES
              </button>
            ) : (
              <button
                type="button"
                className={s.addBtn}
                onClick={handleAddToCart}
                disabled={selectedMaterials.length === 0}
              >
                ADD SWATCHES TO CART
              </button>
            )}
          </footer>
        </aside>
      </div>
    </PortalBody>
  );
};
