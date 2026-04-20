const formatInches = (cm: number): string => {
  const inches = Math.round((cm / 2.54) * 10) / 10;
  if (Number.isInteger(inches)) return String(inches);
  const str = inches.toFixed(1);
  return str.startsWith("0.") ? str.slice(1) : str;
};

const SIDE_PANEL_TOOLTIP_DEPTH_MAP: Record<number, number> = {
  46: 45.5,
  50.5: 50,
};

const formatSidePanelDepthInches = (cm: number): string => {
  return formatInches(SIDE_PANEL_TOOLTIP_DEPTH_MAP[cm] ?? cm);
};

export const buildInfoTooltip = (desc: Record<string, unknown>): string => {
  const str = (key: string) => {
    const v = desc[key];
    return typeof v === "string" ? v : typeof v === "number" ? String(v) : null;
  };
  const categoryLabelMap: Record<string, string> = {
    "Side Panel": "Side panel",
    Divider: "Divider",
  };

  const elements = Array.isArray(desc.elements) ? (desc.elements as Record<string, string>[]) : [];
  const cabinetEl = elements.find((e) => e["Product Elements"] === "Cabinet");
  const handleEl = elements.find((e) => e["Product Elements"] === "Handle");

  const category = str("Product Category");

  if (category === "Vanity") {
    const widthIn = desc.Width != null ? formatInches(Number(desc.Width)) : null;
    const heightIn = desc.Height != null ? formatInches(Number(desc.Height)) : null;
    const depthIn = desc.Depth != null ? formatInches(Number(desc.Depth)) : null;

    const parts = [
      `${str("Products") ?? "Urban Standard"} Height cabinet: ${str("Cabinet Type") ?? "Cabinet"} unit`,
      str("Cabinet Style"),
      str("Handle Style") ? `${str("Handle Style")} handle` : null,
      widthIn ? `${widthIn}" W` : null,
      heightIn ? `${heightIn}" H` : null,
      depthIn ? `${depthIn}" D` : null,
    ].filter(Boolean);

    const colors = [
      cabinetEl ? `Cabinet Color: ${cabinetEl.Material} | ${cabinetEl["Color Code"]}` : null,
      handleEl ? `Handle Color: ${handleEl.Material} | ${handleEl["Color Code"]}` : null,
    ].filter(Boolean);

    return colors.length > 0 ? `${parts.join(", ")} - ${colors.join(", ")}` : parts.join(", ");
  }

  if (category === "Countertop") {
    const widthIn = desc.Width != null ? formatInches(Number(desc.Width)) : null;
    const parts = [
      str("Style") ? `Style: ${str("Style")}` : null,
      widthIn ? `${widthIn}" W` : null,
      str("Thickness") ? `Thickness: ${str("Thickness")}` : null,
      str("Depth") ? `Depth: ${formatInches(Number(desc.Depth))}"` : null,
      str("Material") ? `Material: ${str("Material")}` : null,
      str("Color Code") ? `Color: ${str("Color Code")}` : null,
    ].filter(Boolean);
    return `Countertop - ${parts.join(", ")}`;
  }

  if (category === "Basin") {
    const parts = [str("Basin Style") ? `Style: ${str("Basin Style")}` : null].filter(Boolean);
    return parts.length > 0 ? `Basin - ${parts.join(", ")}` : "Basin";
  }

  if (category === "Side Panel") {
    const widthIn = desc.Width != null ? formatInches(Number(desc.Width)) : null;
    const heightIn = desc.Height != null ? formatInches(Number(desc.Height)) : null;
    const depthIn = desc.Depth != null ? formatSidePanelDepthInches(Number(desc.Depth)) : null;

    const parts = [
      str("Panel Type") ? `Panel Type: ${str("Panel Type")}` : null,
      str("Side") ? `Side: ${str("Side")}` : null,
      widthIn ? `${widthIn}" W` : null,
      heightIn ? `${heightIn}" H` : null,
      depthIn ? `${depthIn}" D` : null,
    ].filter(Boolean);

    const colors = [
      str("Cabinet Color") ? `Cabinet Color: ${str("Cabinet Color")}` : null,
      str("Groove Color") ? `Groove Color: ${str("Groove Color")}` : null,
    ].filter(Boolean);

    return colors.length > 0
      ? `Side panel - ${parts.join(", ")} - ${colors.join(", ")}`
      : `Side panel - ${parts.join(", ")}`;
  }

  if (category === "Towel Bar") {
    const widthIn = desc.Width != null ? formatInches(Number(desc.Width)) : null;
    const heightIn = desc.Height != null ? formatInches(Number(desc.Height)) : null;
    const depthIn = desc.Depth != null ? formatInches(Number(desc.Depth)) : null;

    const parts = [
      str("Side") ? `Side: ${str("Side")}` : null,
      widthIn ? `${widthIn}" W` : null,
      heightIn ? `${heightIn}" H` : null,
      depthIn ? `${depthIn}" D` : null,
      str("Material") ? `Material: ${str("Material")}` : null,
      str("Color Code") ? `Color: ${str("Color Code")}` : null,
    ].filter(Boolean);

    return `Towel Bar - ${parts.join(", ")}`;
  }

  const details = Object.entries(desc)
    .filter(([k, v]) => k !== "Product Category" && v != null && v !== "" && typeof v !== "object")
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ");

  if (!category) return details;

  const categoryLabel = categoryLabelMap[category] ?? category;
  return details ? `${categoryLabel}: ${details}` : categoryLabel;
};
