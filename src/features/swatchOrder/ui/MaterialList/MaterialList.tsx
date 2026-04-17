import { useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer, type VirtualItem } from "@tanstack/react-virtual";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/store/redux";
import {
  getAllMaterialValues,
  getMaterialSelectStateFilters,
  getSelectedMaterials,
} from "../../model/store/selectors";
import { setSelectedMaterial } from "../../model/store/slice";
import { splitMetadataList } from "../../lib/SwatchesServices";
import type { AttributeValue } from "../../model/types";
import { MAX_SLOTS } from "../../model/constants";
import { SwatchLimitModal } from "../SwatchLimitModal/SwatchLimitModal";
import { MaterialListItem } from "./MaterialListItem";
import s from "./MaterialList.module.scss";

const ROW_HEIGHT_DESKTOP = 224;
const ROW_HEIGHT_MOBILE = 210;
const DESKTOP_COLS = 3;
const MOBILE_COLS = 2;
const DESKTOP_QUERY = "(min-width: 640px)";

const matchValue = (item: AttributeValue): string =>
  item.metadata?.value ?? item.value ?? item.label;

interface MaterialListProps {
  onSelectMaterial?: (item: AttributeValue) => void;
}

export const MaterialList = ({ onSelectMaterial }: MaterialListProps) => {
  const dispatch = useAppDispatch();
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const allMaterialsValues = useAppSelector(getAllMaterialValues);
  const selectedMaterials = useAppSelector(getSelectedMaterials);
  const filters = useAppSelector(getMaterialSelectStateFilters);

  const [isShowLimit, setIsShowLimit] = useState(false);
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(DESKTOP_QUERY).matches : false,
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia(DESKTOP_QUERY);
    const onChange = (event: MediaQueryListEvent) => setIsDesktop(event.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const cartCount = useMemo(
    () => selectedMaterials.reduce((sum, item) => sum + (item.count ?? 0), 0),
    [selectedMaterials],
  );

  const filteredItems = useMemo(() => {
    return allMaterialsValues.filter((item) => {
      const finishOk =
        filters.Finish.length === 0 ||
        filters.Finish.some(
          (finish) => item.metadata?.Finish === finish || item.metadata?.Material === finish,
        );
      if (!finishOk) return false;

      const colorTokens = splitMetadataList(item.metadata?.Color);
      const colorOk =
        filters.Color.length === 0 ||
        filters.Color.some((color) => colorTokens.includes(color));
      if (!colorOk) return false;

      const lookTokens = splitMetadataList(item.metadata?.Look);
      const lookOk =
        filters.Look.length === 0 || filters.Look.some((look) => lookTokens.includes(look));
      return lookOk;
    });
  }, [allMaterialsValues, filters]);

  const cols = isDesktop ? DESKTOP_COLS : MOBILE_COLS;
  const rowCount = Math.ceil(filteredItems.length / cols);
  const rowHeight = isDesktop ? ROW_HEIGHT_DESKTOP : ROW_HEIGHT_MOBILE;

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: 4,
  });

  const handleSelect = (item: AttributeValue) => {
    const itemValue = matchValue(item);
    const isSelected = selectedMaterials.some(
      (m) => matchValue(m) === itemValue && m.parentName === item.parentName,
    );
    if (!isSelected && cartCount + 1 > MAX_SLOTS) {
      setIsShowLimit(true);
      return;
    }
    onSelectMaterial?.(item);
    dispatch(setSelectedMaterial({ selectedMaterial: { ...item, count: 1 } }));
  };

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();

  return (
    <div ref={scrollRef} className={s.scroll}>
      <SwatchLimitModal
        header="You've reached your maximum number of swatches!"
        body="If you'd like to add another swatch please remove an existing swatch from your cart"
        isOpen={isShowLimit}
        onClose={() => setIsShowLimit(false)}
      />

      {filteredItems.length === 0 ? (
        <div className={s.empty}>No swatches match the selected filters.</div>
      ) : (
        <div className={s.inner} style={{ height: totalSize + 20 }}>
          {virtualRows.map((virtualRow: VirtualItem) => {
            const rowIndex = virtualRow.index;
            const startIndex = rowIndex * cols;
            const rowItems = filteredItems.slice(startIndex, startIndex + cols);

            return (
              <div
                key={virtualRow.key}
                className={s.row}
                style={{ transform: `translateY(${virtualRow.start}px)` }}
              >
                <div
                  className={s.grid}
                  style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
                >
                  {rowItems.map((val) => {
                    const value = matchValue(val);
                    const isSelected = selectedMaterials.some(
                      (elem) => matchValue(elem) === value && elem.parentName === val.parentName,
                    );
                    const key = `${val.parentName}__${val.optionName ?? ""}__${value}`;

                    return (
                      <MaterialListItem
                        key={key}
                        val={val}
                        isSelected={isSelected}
                        onClick={handleSelect}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
