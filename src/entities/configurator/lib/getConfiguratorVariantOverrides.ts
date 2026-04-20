import grigioBromoImage from "@/shared/assets/images/materials/LacqueredMatte_Color_Grigio_Bromo_.jpg";

const SPECIAL_PROXY_NAME = "Cabinet Color";
const SPECIAL_VARIANT_NAME = "Grigio Bromo";
export const SPECIAL_VARIANT_FALLBACK_CODE = "DS MT";
export const SPECIAL_VARIANT_DISPLAY_VALUE = `${SPECIAL_VARIANT_NAME} ${SPECIAL_VARIANT_FALLBACK_CODE}`;
export const SPECIAL_VARIANT_DISPLAY_IMAGE = grigioBromoImage;

export const isHiddenConfiguratorDisplayValue = (value?: string | null): boolean =>
  value?.trim() === SPECIAL_VARIANT_DISPLAY_VALUE;

type ConfiguratorVariantLike = {
  name: string;
  image?: string | null;
  metadata?: Record<string, unknown>;
};

const pickString = (...values: unknown[]): string | undefined => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
};

export const getConfiguratorVariantOverrides = ({
  proxyName,
  variant,
}: {
  proxyName: string;
  variant: ConfiguratorVariantLike;
}): {
  label?: string;
  value?: string;
  image?: string;
} => {
  if (proxyName !== SPECIAL_PROXY_NAME) return {};
  if (variant.name.trim() !== SPECIAL_VARIANT_NAME) return {};

  const meta = (variant.metadata ?? {}) as Record<string, unknown>;
  const nested =
    typeof meta.metadata === "object" && meta.metadata
      ? (meta.metadata as Record<string, unknown>)
      : ({} as Record<string, unknown>);
  const codeColor =
    pickString(nested.codeColor, nested.codecolor, meta.codeColor, meta.codecolor) ?? SPECIAL_VARIANT_FALLBACK_CODE;
  const displayValue = `${SPECIAL_VARIANT_NAME} ${codeColor}`;

  return {
    label: displayValue,
    value: displayValue,
    image: SPECIAL_VARIANT_DISPLAY_IMAGE,
  };
};
