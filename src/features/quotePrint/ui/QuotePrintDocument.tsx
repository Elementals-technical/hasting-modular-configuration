import hastingsLogoUrl from "@/shared/assets/images/svg/logo/hastings-logo.svg";

import s from "./QuotePrintDocument.module.scss";

type PrintSwatch = {
  value: string;
  color: string;
  image?: string;
};

type PrintItem = {
  id: string;
  title: string;
  subtitle?: string;
  sku?: string;
  price?: string;
  swatch?: {
    label: string;
    value: string;
    color: string;
    image?: string;
  };
  description?: Record<string, unknown>;
};

type PrintSection = {
  id: string;
  title: string;
  items: PrintItem[];
};

type QuotePrintDocumentProps = {
  summarySections: PrintSection[];
  previewImage?: string;
  modelName: string;
  configurationCode: string;
  generatedDate: string;
  configurationLink: string;
  isSwatchesEnabled: boolean;
  swatchesPreview: PrintSwatch[];
};

const sectionDisplayMap: Record<string, string> = {
  cabinet: "Cabinet",
  countertop: "Countertop",
  accessories: "Accessories",
  faucet: "Faucet",
  basin: "Basin",
};

const joinValues = (values: Array<string | null | undefined>, separator = " | ") =>
  values
    .map((value) => (typeof value === "string" ? value.trim() : value))
    .filter(Boolean)
    .join(separator);

const resolveMaterialText = (item: PrintItem) => {
  const elements = item.description?.elements;
  if (Array.isArray(elements)) {
    const lines = elements
      .map((entry) => {
        if (!entry || typeof entry !== "object") return null;
        const record = entry as Record<string, unknown>;
        const left = typeof record["Product Elements"] === "string" ? record["Product Elements"] : null;
        const material = typeof record.Material === "string" ? record.Material : null;
        const colorCode = typeof record["Color Code"] === "string" ? record["Color Code"] : null;

        const line = joinValues([left && `${left}:`, material, colorCode], " | ");
        return line || null;
      })
      .filter(Boolean);
    if (lines.length) return lines.join("\n");
  }

  const material =
    typeof item.description?.Material === "string" && item.description.Material.trim()
      ? item.description.Material.trim()
      : null;
  const colorCode =
    typeof item.description?.["Color Code"] === "string" && item.description["Color Code"].trim()
      ? item.description["Color Code"].trim()
      : null;
  if (material || colorCode) {
    const category =
      typeof item.description?.["Product Category"] === "string" && item.description["Product Category"].trim()
        ? item.description["Product Category"].trim()
        : item.title;
    if (category === "Towel Bar") {
      return joinValues([material, colorCode], " | ");
    }
    return joinValues([`${category}:`, material, colorCode], " | ");
  }

  if (item.swatch?.value) return `${item.swatch.label}: ${item.swatch.value}`;

  if (item.title === "Countertop Style" || item.title === "Basin") return "";

  return "—";
};

const isLineItem = (item: PrintItem) => Boolean(item.sku || item.price) && item.title !== "Countertop Style";

const sectionById = (sections: PrintSection[], id: string) => sections.find((section) => section.id === id);

const parsePriceValue = (price?: string): number => {
  if (!price) return 0;
  const normalized = price.replace(/[^0-9,.-]/g, "").trim();
  if (!normalized) return 0;

  const hasComma = normalized.includes(",");
  const hasDot = normalized.includes(".");

  if (hasComma && hasDot) {
    const lastComma = normalized.lastIndexOf(",");
    const lastDot = normalized.lastIndexOf(".");
    const decimalSeparator = lastComma > lastDot ? "," : ".";
    const cleaned =
      decimalSeparator === ","
        ? normalized.replace(/\./g, "").replace(",", ".")
        : normalized.replace(/,/g, "");
    const value = Number.parseFloat(cleaned);
    return Number.isFinite(value) ? value : 0;
  }

  if (hasComma && !hasDot) {
    const maybeDecimal = /,\d{1,2}$/.test(normalized);
    const cleaned = maybeDecimal ? normalized.replace(",", ".") : normalized.replace(/,/g, "");
    const value = Number.parseFloat(cleaned);
    return Number.isFinite(value) ? value : 0;
  }

  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) ? value : 0;
};

const formatTotalPrice = (value: number) => value.toLocaleString("en-US", { style: "currency", currency: "USD" });

const formatInchesFromCm = (value: unknown): string | null => {
  const parsed =
    typeof value === "number" ? value : typeof value === "string" ? Number.parseFloat(value.trim()) : NaN;
  if (!Number.isFinite(parsed)) return null;

  const inches = Math.round((parsed / 2.54) * 10) / 10;
  const normalized = Number.isInteger(inches) ? String(inches) : inches.toFixed(1);
  return normalized.startsWith("0.") ? normalized.slice(1) : normalized;
};

const toTitleCase = (value: string): string =>
  value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");

const resolveCountertopDimsLine = (item: PrintItem): string | null => {
  if (item.title !== "Countertop") return null;

  const description = item.description ?? {};
  const styleRaw = typeof description.Style === "string" ? description.Style.trim() : "";
  const style = styleRaw ? toTitleCase(styleRaw) : null;
  const width = formatInchesFromCm(description.Width);
  const height = formatInchesFromCm(description.Thickness);
  const depth = formatInchesFromCm(description.Depth);

  if (!style || !width || !height || !depth) return null;
  return `${style} | ${width}W-${height}H-${depth}D`;
};

const resolveBasinStyleLine = (item: PrintItem): string | null => {
  if (item.title !== "Basin") return null;
  const value = item.description?.["Basin Style"];
  if (typeof value !== "string" || !value.trim()) return null;
  return value.trim();
};

const resolveCabinetDetails = (item: PrintItem) => {
  const toDisplayValue = (value: unknown): string | null => {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (trimmed.toLowerCase() === "none") return null;
    return trimmed;
  };

  const description = item.description ?? {};

  const handleStyle = toDisplayValue(description["Handle Style"]);
  const drawerPanelFluting = toDisplayValue(description["Drawer Panel Fluting"]);
  const grainDirection = toDisplayValue(description["Grain Direction"]);

  const details: Array<{ label: string; value: string }> = [];
  if (handleStyle) details.push({ label: "Handle Style", value: handleStyle });
  if (drawerPanelFluting) details.push({ label: "Drawer Panel Fluting", value: drawerPanelFluting });
  if (grainDirection) details.push({ label: "Grain Direction", value: grainDirection });

  return details;
};

const renderRows = (section?: PrintSection) => {
  if (!section || !section.items.length) return null;

  const lines = section.items.filter(isLineItem);
  if (!lines.length) return null;
  const isCabinetSection = section.id === "cabinet";
  const resolvePriceText = (price?: string) => {
    if (!price) return "";
    if (section.id === "faucet" && price === "$0") return "0";
    return price === "$0" ? "" : price;
  };

  return (
    <div className={s.specSection}>
      <div className={s.sectionName}>{sectionDisplayMap[section.id] ?? section.title}</div>
      {lines.map((item) => {
        const cabinetDetails = isCabinetSection ? resolveCabinetDetails(item) : [];
        const normalizedSubtitle = item.subtitle?.trim();
        const normalizedSku = item.sku?.trim();
        const shouldShowSubtitle = Boolean(normalizedSubtitle) && normalizedSubtitle !== normalizedSku;
        const countertopDimsLine = resolveCountertopDimsLine(item);
        const basinStyleLine = resolveBasinStyleLine(item);
        const shouldHideSubtitle = item.title === "Countertop" && Boolean(countertopDimsLine);

        return (
          <div className={s.row} key={item.id}>
            <div>
            <div className={s.prodName}>{item.title}</div>
            {basinStyleLine ? <div className={s.prodSub}>{basinStyleLine}</div> : null}
            {shouldShowSubtitle && !shouldHideSubtitle ? <div className={s.prodSub}>{item.subtitle}</div> : null}
            {countertopDimsLine ? <div className={s.prodSub}>{countertopDimsLine}</div> : null}
            {item.sku ? <div className={s.sku}>{item.sku}</div> : null}
            </div>
            <div className={s.material}>
              <div>{resolveMaterialText(item)}</div>
              {cabinetDetails.length ? (
                <div className={s.cabinetDetailsInMaterial}>
                  {cabinetDetails.map((detail) => (
                    <div className={s.cabinetDetailsLine} key={detail.label}>
                      {detail.label}: {detail.value}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
            <div className={s.price}>{resolvePriceText(item.price)}</div>
          </div>
        );
      })}
    </div>
  );
};

export const QuotePrintDocument = ({
  summarySections,
  previewImage,
  modelName,
  configurationCode,
  generatedDate,
  configurationLink,
  isSwatchesEnabled,
  swatchesPreview,
}: QuotePrintDocumentProps) => {
  const totalPrice = summarySections.reduce((acc, section) => {
    const sectionSum = section.items.reduce((sum, item) => sum + parsePriceValue(item.price), 0);
    return acc + sectionSum;
  }, 0);

  const cabinetSection = sectionById(summarySections, "cabinet");
  const cabinetOptions = sectionById(summarySections, "cabinet-options");
  const countertopSection = sectionById(summarySections, "countertop");
  const accessoriesSection = sectionById(summarySections, "accessories");
  const faucetSection = sectionById(summarySections, "faucet");
  const basinSection = sectionById(summarySections, "basin");

  return (
    <div id="quote-print-root" className={s.root} data-print-doc="quote">
      <div className={s.doc}>
        <section className={`${s.page} ${s.coverPage}`}>
          <div className={s.logoWrap}>
            <img className={s.logo} src={hastingsLogoUrl} alt="Hastings" />
          </div>

          <div className={s.heroWrap}>
            {previewImage ? <img className={s.heroImage} src={previewImage} alt={modelName} /> : null}
          </div>

          <footer className={s.coverFooter}>
            <div>Hastings Quotation</div>
            <a className={s.configLink} href={configurationLink}>
              Configuration link
            </a>
          </footer>
        </section>

        <section className={s.page}>
          <div className={s.titleRow}>
            <div className={s.thumbWrap}>
              {previewImage ? <img className={s.thumb} src={previewImage} alt={modelName} /> : null}
            </div>
            <div>
              <h1 className={s.productName}>Urban Standard Height</h1>
              <p className={s.metaHint}>Country or Orgin: Italy</p>
              <p className={s.metaHint}>Lead Time: 10-12 weeks (from sign-off)</p>
            </div>
          </div>

          <div className={s.metaCard}>
            <div className={s.metaRow}>
              <strong>Configuration code:</strong>
              <span>{configurationCode}</span>
            </div>
            <div className={s.metaRow}>
              <strong>Date Generated:</strong>
              <span>{generatedDate}</span>
            </div>
          </div>

          <div className={s.footer}>
            Hastings Bath Collection | 800-351-0038 | Sales: info@hastingsbath.com | Support: cs@hastingsbath.com
          </div>
        </section>

        <section className={s.page}>
          {/* <h2 className={s.specTitle}>Product Details & Specifications</h2> */}
          <div className={s.specHeader}>
            <div />
            <div>Material/Color</div>
            <div>Price</div>
          </div>
          {renderRows(cabinetSection)}

          {cabinetOptions?.items?.length ? (
            <div className={s.details}>
              <div className={s.detailsTitle}>Cabinet Details</div>
              {cabinetOptions.items.map((item) => (
                <div className={s.detailsLine} key={item.id}>
                  - {item.title}: {item.subtitle ?? "If applicable"}
                </div>
              ))}
            </div>
          ) : null}

          {renderRows(countertopSection)}
          {renderRows(basinSection)}

          <div className={s.footer}>
            Hastings Bath Collection | 800-351-0038 | Sales: info@hastingsbath.com | Support: cs@hastingsbath.com
          </div>
        </section>

        <section className={s.page}>
          {/* <h2 className={s.specTitle}>Accessories & Additional Items</h2> */}
          <div className={s.specHeader}>
            <div />
            <div>Material/Color</div>
            <div>Price</div>
          </div>
          {renderRows(accessoriesSection)}
          {renderRows(faucetSection)}

          <div className={s.totalRow}>
            <span className={s.totalLabel}>Total</span>
            <span className={s.totalValue}>{formatTotalPrice(totalPrice)}</span>
          </div>

          {isSwatchesEnabled ? (
            <div className={s.specSection}>
              <div className={s.sectionName}>Swatches</div>
              <div className={s.swatchGrid}>
                {Array.from({ length: 6 }).map((_, index) => {
                  const swatch = swatchesPreview[index];
                  return (
                    <div className={s.swatchItem} key={`${swatch?.value ?? "empty"}-${index}`}>
                      {swatch ? (
                        <span
                          className={s.swatchFill}
                          style={{
                            backgroundColor: swatch.color,
                            backgroundImage: swatch.image ? `url(${swatch.image})` : undefined,
                          }}
                        />
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className={s.footer}>
            Hastings Bath Collection | 800-351-0038 | Sales: info@hastingsbath.com | Support: cs@hastingsbath.com
          </div>
        </section>
      </div>
    </div>
  );
};
