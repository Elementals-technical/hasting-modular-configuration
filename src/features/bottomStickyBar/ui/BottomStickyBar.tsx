import { BaseButton } from "@/shared/ui/Buttons/BaseButton";

import s from "./BottomStickyBar.module.scss";
import { useLocation, useNavigate } from "react-router-dom";
import { CUSTOM_STEPS, PREBUILT_STEPS } from "@/shared/config/steps";
import { type PropsWithChildren, useEffect, useMemo, useState } from "react";
import { useAppSelector } from "@/shared/hooks/store/redux";
import { getActiveSkus, getPriceBySku, getPriceTotal } from "@/entities/product/model/store/selectors";

const formatPrice = (value?: number | null) => {
  if (typeof value !== "number") return "$—";

  return value.toLocaleString("en-US", { style: "currency", currency: "USD" });
};

type BottomStickyBarProps = PropsWithChildren<{
  flow?: "prebuilt" | "custom";
}>;

export const BottomStickyBar = ({ flow }: BottomStickyBarProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const steps = flow === "custom" ? CUSTOM_STEPS : PREBUILT_STEPS;

  const priceTotal = useAppSelector(getPriceTotal);
  const priceBySku = useAppSelector(getPriceBySku);
  const activeSkus = useAppSelector(getActiveSkus);

  const [isWaitingForPrice, setIsWaitingForPrice] = useState(false);

  const activeSkusKey = useMemo(() => activeSkus.join("|"), [activeSkus]);
  const hasAnyPriceForActive = useMemo(
    () => activeSkus.length > 0 && activeSkus.some((sku) => typeof priceBySku[sku] === "number"),
    [activeSkus, priceBySku],
  );

  useEffect(() => {
    if (activeSkus.length > 0) {
      setIsWaitingForPrice(true);
    } else {
      setIsWaitingForPrice(false);
    }
  }, [activeSkusKey, activeSkus.length]);

  useEffect(() => {
    if (isWaitingForPrice && hasAnyPriceForActive) {
      setIsWaitingForPrice(false);
    }
  }, [isWaitingForPrice, hasAnyPriceForActive]);

  const currentIndex = steps.findIndex((s) => location.pathname.startsWith(s.path));
  const nextStep = currentIndex >= 0 ? steps[currentIndex + 1] : undefined;

  const handleNavigate = () => {
    if (nextStep) navigate(nextStep?.path);
  };

  return (
    <div className={s.bottomBar}>
      <div className={s.total}>
        <span>Total</span>
        <span>
          {!activeSkus.length ? (
            "$0.00"
          ) : isWaitingForPrice && !hasAnyPriceForActive ? (
            <span className={s.priceSpinner} />
          ) : hasAnyPriceForActive ? (
            formatPrice(priceTotal)
          ) : (
            "0"
          )}
        </span>
      </div>
      <div className={s.nextStepWrapp}>
        <BaseButton onClick={handleNavigate} fullWidth={true}>
          Next: {nextStep?.label}
        </BaseButton>
      </div>
    </div>
  );
};
