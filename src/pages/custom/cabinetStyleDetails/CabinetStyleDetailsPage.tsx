import { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { ArrowLeft } from "@/shared/assets/images/svg/ArrowLeft";
import { useAppSelector } from "@/shared/hooks/store/redux";
import { resolveCabinetStyleImage } from "@/entities/product/lib/resolveCabinetImages";
import {
  getCountertopStyle,
  getDimensionOptions,
  getSelectedDimensions,
  getSinkType,
} from "@/entities/product/model/store/selectors";
import { filterDepthValuesByCountertopRules } from "@/features/configurator-rule-core/countertop";
import { ROUTES } from "@/shared";

import s from "./CabinetStyleDetailsPage.module.scss";

const CHARACTERISTICS = [
  "Soft-close, ergonomic drawer system",
  "Metal drawer glide structure",
  "Anthracite internal drawer base finish",
  "Non-slip, scratch resistant base",
  "Melamine cabinet structure",
  "Carb2 compliant materials",
];

const PRODUCTION = [
  "Italian-made, designed and built-to-order",
  "Eco-conscious production standards",
  "Max weight capacity 88lb per cabinet",
  "Rigorous material testing for ease of upkeep",
];

const SINK_BASE_DETAILS: Record<
  string,
  {
    about: string;
    widthsText: string;
    depthsText: string;
  }
> = {
  "2": {
    about:
      "Designed for modern living, this 2-drawer sink base cabinet brings together clean aesthetics, precision Italian craftsmanship, and smart, lifestyle-driven storage to stow your bathroom essentials in style.",
    widthsText: '23.6", 27.5", 31.5", 41.3" and 47.3"',
    depthsText: '18.1" or 19.7"',
  },
  "1": {
    about:
      "Designed for modern living, this extra deep 1-drawer sink base cabinet brings together clean aesthetics, precision Italian craftsmanship, and smart, lifestyle-driven storage to stow your bathroom essentials in style.",
    widthsText: '23.6", 27.5", 31.5", 41.3" and 47.3"',
    depthsText: '18.1" or 19.7"',
  },
  "1+inner": {
    about:
      "Crafted for modern living, this extra-deep sink base cabinet with built-in inner drawer combines sleek aesthetics, precision Italian craftsmanship, and thoughtful, lifestyle-focused storage - keeping your bathroom essentials organized in style.",
    widthsText: '23.6", 27.5", 31.5", 41.3" and 47.3"',
    depthsText: '18.1" or 19.7"',
  },
};

const SIDE_CABINET_DETAILS: Record<
  string,
  {
    about: string;
    widthsText: string;
    depthsText: string;
  }
> = {
  "2": {
    about:
      "Designed for modern living, this 2-drawer side cabinet brings together clean aesthetics, precision Italian craftsmanship, and smart, lifestyle-driven storage to stow your bathroom essentials in style.",
    widthsText: '9.8", 13.8", 19.7", 23.6", 27.5", 31.5", 41.3" and 47.3"',
    depthsText: '18.1" or 19.7"',
  },
  "1": {
    about:
      "Designed for modern living, this extra deep 1-drawer side cabinet brings together clean aesthetics, precision Italian craftsmanship, and smart, lifestyle-driven storage to stow your bathroom essentials in style.",
    widthsText: '9.8", 13.8", 19.7", 23.6", 27.5", 31.5", 41.3" and 47.3"',
    depthsText: '18.1" or 19.7"',
  },
  "1+inner": {
    about:
      "Crafted for modern living, this extra-deep side cabinet with built-in inner drawer combines sleek aesthetics, precision Italian craftsmanship, and thoughtful, lifestyle-focused storage.",
    widthsText: '9.8", 13.8", 19.7", 23.6", 27.5", 31.5", 41.3" and 47.3"',
    depthsText: '18.1" or 19.7"',
  },
};

const styleToLabel = (style?: string | null) => {
  if (style === "1") return "1-Drawer";
  if (style === "2") return "2-Drawer";
  if (style === "1+inner") return "1-Drawer With Inner Drawer";
  return "Cabinet Style";
};

const styleToDescription = (style?: string | null) => {
  if (style === "1") return "1-drawer";
  if (style === "2") return "2-drawer";
  if (style === "1+inner") return "1-drawer with inner drawer";
  return "drawer";
};

const cmToInches = (cm: number) => Number((cm / 2.54).toFixed(1));

export const CabinetStyleDetailsPage = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const selectedDimensions = useAppSelector(getSelectedDimensions);
  const dimensionOptions = useAppSelector(getDimensionOptions);
  const countertopStyle = useAppSelector(getCountertopStyle);
  const sinkType = useAppSelector(getSinkType);

  const style = params.get("style");
  const cabinetType = params.get("cabinetType");
  const imageFromQuery = params.get("image");

  const title = params.get("title")?.trim() || styleToLabel(style);

  const displayTitle = useMemo(() => {
    if (title.toLowerCase().includes("drawer")) {
      return title.replace(/\s+Drawer/gi, "-Drawer");
    }

    return title;
  }, [title]);

  const currentHeight = Number(params.get("height") ?? selectedDimensions.height ?? 56);

  const previewImage =
    imageFromQuery || resolveCabinetStyleImage(style ?? undefined, currentHeight, cabinetType ?? undefined, undefined);

  const widthsInches = useMemo(() => {
    const values = dimensionOptions.width
      .filter((option) => !option.disabled)
      .map((option) => Number(option.value))
      .filter((value) => Number.isFinite(value));

    const uniqSorted = Array.from(new Set(values)).sort((a, b) => a - b);
    return uniqSorted.map(cmToInches);
  }, [dimensionOptions.width]);

  const depthsInches = useMemo(() => {
    const values = filterDepthValuesByCountertopRules({
      values: dimensionOptions.depth.filter((option) => !option.disabled).map((option) => option.value),
      activeMaterialTokens: [],
      rules: [],
      activeCountertopStyle: countertopStyle ?? null,
      activeBasinStyle: sinkType ?? null,
    })
      .map((option) => Number(option))
      .filter((value) => Number.isFinite(value));

    const uniqSorted = Array.from(new Set(values)).sort((a, b) => a - b);
    return uniqSorted.map(cmToInches);
  }, [countertopStyle, dimensionOptions.depth, sinkType]);

  const cabinetLabel =
    cabinetType === "Sink-Base"
      ? "sink base cabinet"
      : cabinetType === "Sink-Cabinet" || cabinetType === "Side-Cabinet"
        ? "side cabinet"
        : "cabinet";

  const styleDetails =
    cabinetType === "Sink-Base"
      ? SINK_BASE_DETAILS[style ?? ""]
      : cabinetType === "Side-Cabinet" || cabinetType === "Sink-Cabinet"
        ? SIDE_CABINET_DETAILS[style ?? ""]
        : null;

  const description =
    styleDetails?.about ??
    `Designed for modern living, this ${styleToDescription(style)} ${cabinetLabel} brings together clean aesthetics, precision Italian craftsmanship, and smart, lifestyle-driven storage to stow your bathroom essentials in style.`;

  const widthsText =
    styleDetails?.widthsText ?? (widthsInches.length ? widthsInches.map((value) => `${value}"`).join(", ") : "N/A");
  const filteredDepthsText = depthsInches.length ? depthsInches.map((value) => `${value}"`).join(" or ") : "N/A";
  const depthsText =
    sinkType === "Top_Ocritech_Oly55" ? filteredDepthsText : styleDetails?.depthsText ?? filteredDepthsText;

  return (
    <div className={s.page}>
      <button
        type="button"
        className={s.backButton}
        onClick={() => navigate(`${ROUTES.CUSTOM}/cabinet-builder?accordion=cabinet-style`)}
      >
        <ArrowLeft width="18" height="18" />
        <span>{displayTitle}</span>
      </button>

      <div className={s.topSection}>
        <div className={s.previewCard}>
          {previewImage ? (
            <img src={previewImage} alt={displayTitle} />
          ) : (
            <div className={s.previewPlaceholder}>No image</div>
          )}
        </div>

        <div className={s.aboutPanel}>
          <h3>About</h3>
          <p>{description}</p>

          <div className={s.sizesBox}>
            <h4>Available Sizes</h4>
            <p>- Widths: {widthsText}</p>
            <p>- Depths: {depthsText}</p>
          </div>
        </div>
      </div>

      <div className={s.bottomSection}>
        <div>
          <h4>Cabinet Characteristics</h4>
          <ul>
            {CHARACTERISTICS.map((item) => (
              <li key={item}>- {item}</li>
            ))}
          </ul>
        </div>

        <div>
          <h4>Production | Capacity</h4>
          <ul>
            {PRODUCTION.map((item) => (
              <li key={item}>- {item}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};
