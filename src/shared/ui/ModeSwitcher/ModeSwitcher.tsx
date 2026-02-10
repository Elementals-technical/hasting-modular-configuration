import { useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import s from "./ModeSwitcher.module.scss";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/store/redux";
import { getHasPrebuiltSelections, getSelectedProducts } from "@/entities/product/model/store/selectors";
import {
  reset,
  resetCabinetBuilderBootstrap,
  resetPrebuiltProducts,
} from "@/entities/product/model/store/slice";
import { removeAllProducts } from "@/utils/functions/playcanvas/removeAllProducts";
import { setConfigBatch } from "@/utils/functions/playcanvas/setConfigBatch";
import { ROUTES } from "@/shared";
import { AttentionPopup } from "@/shared/ui/Popups/ui/AttentionPopup/AttentionPopup";

type PendingAction = "toCustom" | "toPrebuilt" | null;

export const ModeSwitcher = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const hasPrebuiltSelections = useAppSelector(getHasPrebuiltSelections);
  const selectedProducts = useAppSelector(getSelectedProducts);
  const hasProducts = selectedProducts.length > 0;

  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const pendingActionRef = useRef<PendingAction>(null);

  const activeTab = useMemo<"prebuilt" | "custom">(
    () => (location.pathname.includes("/custom") ? "custom" : "prebuilt"),
    [location.pathname],
  );

  const navigateToCustom = async () => {
    removeAllProducts();
    await setConfigBatch({}, { TowelBar: "None", TowelBarSide: "both", TowelBarColor: "" });

    dispatch(reset());
    dispatch(resetPrebuiltProducts());
    dispatch(resetCabinetBuilderBootstrap());
    navigate(ROUTES.CUSTOM);
  };

  const navigateToPrebuilt = async () => {
    removeAllProducts();

    await setConfigBatch({}, { TowelBar: "None", TowelBarSide: "both", TowelBarColor: "" });
    await setConfigBatch({}, { SidePanel: "None" });

    dispatch(reset());
    dispatch(resetCabinetBuilderBootstrap());
    navigate(`${ROUTES.PREBUILT}/model`);
  };

  const handleClickTab = (tab: "prebuilt" | "custom") => {
    if (tab === activeTab) return;

    if (tab === "custom") {
      if (hasPrebuiltSelections) {
        pendingActionRef.current = "toCustom";
        setIsPopupOpen(true);
        return;
      }

      void navigateToCustom();
      return;
    }

    if (hasProducts) {
      pendingActionRef.current = "toPrebuilt";
      setIsPopupOpen(true);
      return;
    }

    navigate(`${ROUTES.PREBUILT}/model`);
  };

  const handleConfirmLeave = async () => {
    const action = pendingActionRef.current;
    pendingActionRef.current = null;
    setIsPopupOpen(false);

    if (action === "toCustom") {
      await navigateToCustom();
      return;
    }

    if (action === "toPrebuilt") {
      await navigateToPrebuilt();
    }
  };

  return (
    <>
      <div className={s.modeSwitcher}>
      <div
        className={`${s.modeSwitcher_tabItem} ${activeTab === "prebuilt" ? s.active : ""}`}
        onClick={() => handleClickTab("prebuilt")}
      >
        <div className={s.wrap}>
          <div className={s.title}>Pre-Built Models</div>
          <p className={s.description}>Customize your design from pre-made solutions</p>
        </div>
      </div>
      <div
        className={`${s.modeSwitcher_tabItem} ${activeTab === "custom" ? s.active : ""}`}
        onClick={() => handleClickTab("custom")}
      >
        <div className={s.wrap}>
          <div className={s.title}>Create Your Own</div>
          <p className={s.description}> Build your own custom, tailored concept</p>
        </div>
      </div>
      </div>

      <AttentionPopup
        isOpening={isPopupOpen}
        setIsOpening={setIsPopupOpen}
        onConfirm={handleConfirmLeave}
        onCancel={() => {
          pendingActionRef.current = null;
        }}
      />
    </>
  );
};
