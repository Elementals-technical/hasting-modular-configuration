import { useCallback, useEffect, useMemo, useRef } from "react";

import { selectAttribute } from "@/entities/collection";
import { getActiveProductProfile } from "@/entities/configuration/model/store/selectors";
import { useHistorySnapshot } from "@/entities/history/lib/useHistorySnapshot";
import {
  getDividersOption,
  getDividersStyle,
  getSelectedDividerType,
  getSelectedProducts,
  getSelectedSceneProduct,
} from "@/entities/product/model/store/selectors";
import {
  clearPlacedDividers,
  setDividersOption,
  setDividersStyle,
  setIsDrawerOpen,
} from "@/entities/product/model/store/slice";
import {
  buildUnavailableDividerWarning,
  getSharedDividerRuntimeAdapter,
  normalizeDividerType,
  shouldClearDividersOnOptionChange,
  useDividerController,
} from "@/features/dividers";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/store/redux";
import { usePlayCanvasReady } from "@/shared/hooks/usePlayCanvasReady";
import { exportCameraState, importCameraState, setAutoFraming } from "@/utils/functions/playcanvas/camera";
import {
  clearPlacedDividersInScene,
  recordDividerUiDebug,
  setVisibleDividerSlotButtons,
  warnDividerUiDebug,
  wrapExitTopView,
} from "@/utils/functions/playcanvas/dividers";
import { setVisibleDrawerButtons } from "@/utils/functions/playcanvas/setVisibleDrawerButtons";

import { installDrawerWidgets } from "./drawerWidgets";
import { dividerStyleOptionImages } from "./optionImages";

import type { FieldRuntimeState } from "@/entities/collection";

// One shared adapter: the scene's single top-view callbacks belong to it, it fans events out.
const dividerRuntimeAdapter = getSharedDividerRuntimeAdapter();

type DividersStateArgs = {
  styleField: FieldRuntimeState | undefined;
  isSectionOpen: boolean;
};

/** Divider option and style, the drawer top view with its camera, and the widgets the scene draws over drawers. */
export const useDividersState = ({ styleField, isSectionOpen }: DividersStateArgs) => {
  const dispatch = useAppDispatch();
  const saveSnapshot = useHistorySnapshot();
  const isPlayCanvasReady = usePlayCanvasReady();
  const activeProfile = useAppSelector(getActiveProductProfile);
  // "Nothing chosen" is the profile's noneValue, so no collection has to spell it "None".
  const dividersNoneValue = selectAttribute(activeProfile, "DividersOption")?.noneValue ?? "";
  const dividerSelection = useAppSelector(getDividersOption);
  const dividerStyle = useAppSelector(getDividersStyle);
  const selectedDividerType = useAppSelector(getSelectedDividerType);
  const selectedProducts = useAppSelector(getSelectedProducts);
  const selectedSceneProduct = useAppSelector(getSelectedSceneProduct);
  const drawerCameraStateRef = useRef<Record<string, unknown> | null>(null);
  const isDrawerCameraManagedRef = useRef(false);

  // The style catalogue keeps the label as its value: the store and the scene name a style by it.
  const styleCatalog = useMemo(
    () =>
      (styleField?.options ?? []).map((option) => ({
        id: option.value,
        name: option.value,
        title: option.label ?? option.value,
        isShortDesc: false,
        metadata: { image: dividerStyleOptionImages[option.value] },
      })),
    [styleField],
  );

  const divider = useDividerController({
    isPlayCanvasReady,
    dividerSelection,
    optionsSource: styleCatalog,
    saveSnapshot,
    fallbackCabinetId: selectedSceneProduct || null,
    shouldRestoreDrawerButtons: isSectionOpen,
  });

  useEffect(() => {
    if (isPlayCanvasReady) setVisibleDrawerButtons(isSectionOpen && dividerSelection === "Customize");
  }, [dividerSelection, isPlayCanvasReady, isSectionOpen]);

  useEffect(installDrawerWidgets, []);

  const restoreDrawerCamera = useCallback((applyCameraRestore = true) => {
    if (isDrawerCameraManagedRef.current && applyCameraRestore) {
      if (drawerCameraStateRef.current) importCameraState(drawerCameraStateRef.current);
      setAutoFraming(true);
    }
    drawerCameraStateRef.current = null;
    isDrawerCameraManagedRef.current = false;
  }, []);

  // The top view of a drawer keeps its own camera; the adapter's "exit" event restores it.
  useEffect(() => {
    if (!isPlayCanvasReady) return;

    return dividerRuntimeAdapter.onActiveContextChange((event) => {
      if (event.phase === "select") {
        recordDividerUiDebug("Accessories.Drawer", "Top view select", event.context);
        if (!isDrawerCameraManagedRef.current) {
          const state = exportCameraState() as Record<string, unknown> | null;
          drawerCameraStateRef.current = state ? (JSON.parse(JSON.stringify(state)) as Record<string, unknown>) : null;
          setAutoFraming(false);
          isDrawerCameraManagedRef.current = true;
        }
        dispatch(setIsDrawerOpen(true));
      } else if (event.phase === "exit") {
        restoreDrawerCamera(false);
        recordDividerUiDebug("Accessories.Drawer", "Top view exit", {});
        dispatch(setIsDrawerOpen(false));
      }
    });
  }, [dispatch, isPlayCanvasReady, restoreDrawerCamera]);

  useEffect(() => () => restoreDrawerCamera(), [restoreDrawerCamera]);

  const changeOption = async (value: string | null) => {
    recordDividerUiDebug("Accessories.DividerSelection", "Divider option change requested", {
      value,
      previous: dividerSelection,
    });
    if (!value) return;
    if (value === dividerSelection && value !== "None") return;

    divider.clearWarning();
    await saveSnapshot();

    if (shouldClearDividersOnOptionChange(value, dividerSelection, dividersNoneValue)) {
      await clearPlacedDividersInScene(selectedProducts);
      dispatch(clearPlacedDividers());
      const exitTopView = wrapExitTopView({});
      if (exitTopView) await Promise.resolve(exitTopView());
      else warnDividerUiDebug("Accessories.DividerSelection", "exitTopView not ready while switching to None");
    }

    if (value === "Customize") {
      setVisibleDrawerButtons(true);
    } else {
      setVisibleDrawerButtons(false);
      setVisibleDividerSlotButtons(false);
      dispatch(setIsDrawerOpen(false));
    }

    dispatch(setDividersOption(value));
    if (value !== "Customize") dispatch(setDividersStyle(""));
  };

  const changeStyle = async (value: string) => {
    if (!value) return;
    const dividerType = normalizeDividerType(value);
    const availableTypes = divider.availableTypes;
    if (availableTypes && dividerType && !availableTypes.includes(dividerType)) {
      divider.showWarning(buildUnavailableDividerWarning(dividerType, availableTypes));
      return;
    }
    if (value === dividerStyle) return;

    divider.clearWarning();
    await saveSnapshot();
    dispatch(setDividersStyle(value));
  };

  const onSectionToggle = (isOpen: boolean) => {
    if (isOpen) {
      setVisibleDrawerButtons(dividerSelection === "Customize");
      return;
    }
    setVisibleDrawerButtons(false);
    wrapExitTopView({})?.();
  };

  return {
    selection: dividerSelection,
    style: dividerStyle,
    styleOptions: divider.options,
    hasSelectedType: Boolean(selectedDividerType),
    warning: divider.warning,
    changeOption,
    changeStyle,
    onSectionToggle,
  };
};
