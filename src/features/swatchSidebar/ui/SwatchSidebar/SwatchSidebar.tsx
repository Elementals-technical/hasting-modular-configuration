import { useEffect, useMemo } from "react";

import { useGetConfiguratorQuery } from "@/entities";
import { CloseIcon } from "@/shared/assets/images/svg/CloseIcon";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/store/redux";

import { closeSwatchSidebar, toggleSwatchSelection } from "../../model/store/slice";
import { getIsSwatchSidebarOpen, getSelectedSwatches } from "../../model/store/selectors";

import s from "./SwatchSidebar.module.scss";

type SwatchOption = {
  id: string;
  value: string;
  label: string;
  desc: string;
  image?: string;
  hex?: string;
};

const THREEKIT_PREVIEW_BASE_URL = "https://preview.threekit.com";
const SWATCH_SLOTS = 6;

const buildImageSrc = (imagePath?: string) => {
  if (!imagePath) return undefined;
  if (imagePath.startsWith("http")) return imagePath;
  if (imagePath.startsWith("/api/")) return `${THREEKIT_PREVIEW_BASE_URL}${imagePath}`;
  return imagePath;
};

export const SwatchSidebar = () => {
  const dispatch = useAppDispatch();
  const isOpen = useAppSelector(getIsSwatchSidebarOpen);
  const selectedValues = useAppSelector(getSelectedSwatches);

  const { data: configuratorData, isFetching } = useGetConfiguratorQuery({
    id: 4,
    view: "full",
    serialize: true,
  });

  const options = useMemo<SwatchOption[]>(() => {
    const groups = (configuratorData?.availableOptions ?? []).filter((group) => group.proxyName === "Cabinet Color");
    if (!groups.length) return [];

    return groups
      .flatMap((group) =>
        group.options.flatMap((option) =>
          option.variants
            .filter((variant) => variant.enabled)
            .map((variant) => {
              const meta = (variant.metadata ?? {}) as Record<string, unknown>;
              const nested =
                typeof meta.metadata === "object" && meta.metadata
                  ? (meta.metadata as Record<string, unknown>)
                  : ({} as Record<string, unknown>);

              const pick = (...values: unknown[]): string | undefined => {
                for (const value of values) {
                  if (typeof value === "string" && value.trim()) return value;
                }
                return undefined;
              };

              const value = pick(meta.value, nested.value, variant.name) ?? variant.name;
              return {
                id: String(variant.id),
                value,
                label: pick(meta.label, meta.Label, nested.label, nested.Label, variant.name) ?? value,
                desc: String(option.name ?? group.proxyName ?? ""),
                image: buildImageSrc(pick(nested.image, meta.image, variant.image)),
                hex: pick(nested.hex, meta.hex),
              };
            }),
        ),
      )
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [configuratorData]);

  useEffect(() => {
    if (!isOpen) return;

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") dispatch(closeSwatchSidebar());
    };

    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [dispatch, isOpen]);

  return (
    <>
      <button
        type="button"
        aria-label="Close swatches sidebar backdrop"
        className={`${s.backdrop} ${isOpen ? s.backdropActive : ""}`}
        onClick={() => dispatch(closeSwatchSidebar())}
      />

      <aside className={`${s.sidebar} ${isOpen ? s.active : ""}`} aria-hidden={!isOpen}>
        <div className={s.header}>
          <div className={s.title}>Order free swatches</div>
          <button type="button" className={s.closeBtn} onClick={() => dispatch(closeSwatchSidebar())} aria-label="Close">
            <CloseIcon />
          </button>
        </div>

        <div className={s.body}>
          {isFetching ? (
            <div className={s.message}>Loading swatches...</div>
          ) : (
            <div className={s.grid}>
              {options.map((option) => {
                const isSelected = selectedValues.includes(option.value);
                return (
                  <button
                    type="button"
                    key={option.id}
                    className={`${s.card} ${isSelected ? s.cardSelected : ""}`}
                    onClick={() => dispatch(toggleSwatchSelection(option.value))}
                  >
                    <div className={s.media}>
                      {option.image ? (
                        <img src={option.image} alt={option.label} />
                      ) : (
                        <span className={s.hexFill} style={{ backgroundColor: option.hex ?? "#d8d8d8" }} />
                      )}
                      <span className={`${s.check} ${isSelected ? s.checkSelected : ""}`}>✓</span>
                    </div>
                    <span className={s.cardTitle}>{option.label}</span>
                    <span className={s.cardDesc}>{option.desc}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className={s.footer}>
          <div className={s.footerTitle}>Swatches list</div>
          <div className={s.previewList}>
            {Array.from({ length: SWATCH_SLOTS }).map((_, index) => {
              const selectedValue = selectedValues[index];
              const option = options.find((item) => item.value === selectedValue);
              if (!option) return <span key={`empty-${index}`} className={`${s.previewTile} ${s.previewTileEmpty}`} />;

              return (
                <span
                  key={selectedValue}
                  className={s.previewTile}
                  style={{
                    backgroundColor: option.hex ?? "#d8d8d8",
                    backgroundImage: option.image ? `url(${option.image})` : undefined,
                  }}
                />
              );
            })}
          </div>

          <button type="button" className={s.addBtn} onClick={() => dispatch(closeSwatchSidebar())}>
            Add Swatches To Cart
          </button>
        </div>
      </aside>
    </>
  );
};

