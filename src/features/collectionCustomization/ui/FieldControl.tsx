import {
  ProductOptionsGrid,
  type ProductOptionData,
} from "@/entities/product/ui/ProductOptionsGrid/ProductOptionsGrid";
import { ProductSwatchesGrid } from "@/entities/product/ui/ProductSwatchesGrid/ProductSwatchesGrid";

import type { CustomizationFieldControl, FieldRuntimeState } from "@/entities/collection";

type FieldControlProps = {
  control: CustomizationFieldControl;
  field: FieldRuntimeState;
  onChange: (value: string) => void;
  /** Text next to a checkbox control; unused by the other controls. */
  label?: string;
  /** Class applied to a checkbox control's label, so a page keeps its own checkbox styling. */
  className?: string;
};

export const FieldControl = ({ control, field, onChange, label, className }: FieldControlProps) => {
  if (!field.visible) return null;

  if (control === "swatches") {
    const data = field.options
      .filter((option) => option.enabled)
      .map((option, index) => ({ id: index, title: option.label ?? option.value, value: option.value }));

    return (
      <ProductSwatchesGrid
        data={data}
        selectedValue={typeof field.value === "string" ? field.value : null}
        onSelectChange={(value) => {
          if (value) onChange(value);
        }}
      />
    );
  }

  if (control === "options-grid") {
    const data: ProductOptionData[] = field.options.map((option, index) => ({
      id: index,
      title: option.label ?? option.value,
      isAvailable: option.enabled,
      disabledReason: option.reason,
      disabledReasonCode: option.reasonCode,
      isShortDesc: false,
      metadata: { value: option.value, image: option.image },
    }));

    return (
      <ProductOptionsGrid
        data={data}
        activeValue={typeof field.value === "string" ? field.value : undefined}
        isLoading={field.loading}
        handleAdd={(name) => onChange(name)}
      />
    );
  }

  if (control === "checkbox") {
    const checked = field.value === "enabled" || field.value === true;

    return (
      <label className={className}>
        <input
          type="checkbox"
          checked={checked}
          disabled={!field.enabled}
          onChange={(event) => onChange(event.target.checked ? "enabled" : "")}
        />
        {label && <span>{label}</span>}
      </label>
    );
  }

  // "colors" is the colour grid of its section (ColorField), with the section's swatch order.
  return null;
};
