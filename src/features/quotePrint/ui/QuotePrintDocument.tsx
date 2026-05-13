import hastingsLogoUrl from "@/shared/assets/images/svg/logo/hastings-logo.svg";
import { ArrowTopRight } from "@/shared/assets/images/svg/ArrowTopRight";
import { formatCountertopThicknessLabel } from "@/entities/countertop";

import s from "./QuotePrintDocument.module.scss";

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
  generatedDate: string;
  configurationLink: string;
};

const EMPTY_PREVIEW_IMAGE =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

const sectionDisplayMap: Record<string, string> = {
  cabinet: "Cabinet",
  countertop: "Countertop",
  accessories: "Accessories",
  faucet: "Faucet",
  basin: "Basin",
};

const footerItems = [
  "Hastings Bath Collection",
  "800-351-0031",
  "Sales: info@hastingsbath.com",
  "Support: cs@hastingsbath.com",
] as const;

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

        const valueText = joinValues([material, colorCode], " | ");
        const line = joinValues([left && valueText ? `${left}: ${valueText}` : left, !left ? valueText : null], " | ");
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

type RowSectionBlock = {
  kind: "rows";
  section: PrintSection;
  items: PrintItem[];
  showTitle: boolean;
};

type DetailsBlock = {
  kind: "details";
  section: PrintSection;
};

type TotalBlock = {
  kind: "total";
};

type PrintPageBlock = RowSectionBlock | DetailsBlock | TotalBlock;

const FIRST_SPEC_PAGE_CAPACITY = 430;
const SPEC_PAGE_CAPACITY = 955;
const SECTION_HEADER_HEIGHT = 74;
const ROW_VERTICAL_GAP = 16;
const DETAILS_HEADER_HEIGHT = 46;
const DETAILS_ROW_HEIGHT = 32;
const DETAILS_BLOCK_VERTICAL_PADDING = 50;
const TOTAL_BLOCK_HEIGHT = 76;
const TOTAL_FIT_TOLERANCE = 160;

const estimateTextLines = (value: string | null | undefined, charsPerLine: number) => {
  if (!value?.trim()) return 0;

  return value
    .split("\n")
    .reduce((sum, line) => sum + Math.max(1, Math.ceil(line.trim().length / charsPerLine)), 0);
};

const estimateRowHeight = (section: PrintSection, item: PrintItem) => {
  const normalizedSubtitle = item.subtitle?.trim();
  const normalizedSku = item.sku?.trim();
  const shouldShowSubtitle = Boolean(normalizedSubtitle) && normalizedSubtitle !== normalizedSku;
  const countertopDimsLine = resolveCountertopDimsLine(item);
  const basinStyleLine = resolveBasinStyleLine(item);
  const vesselDimsLine = resolveVesselDimsLine(item);
  const isDuplicateBasinSubtitle = Boolean(basinStyleLine && normalizedSubtitle === basinStyleLine);
  const shouldHideSubtitle =
    (item.title === "Countertop" && Boolean(countertopDimsLine)) || isDuplicateBasinSubtitle;
  const productLines =
    estimateTextLines(item.title, 36) +
    (basinStyleLine ? estimateTextLines(basinStyleLine, 34) : 0) +
    (shouldShowSubtitle && !shouldHideSubtitle ? estimateTextLines(item.subtitle, 34) : 0) +
    (countertopDimsLine ? estimateTextLines(countertopDimsLine, 34) : 0) +
    (vesselDimsLine ? estimateTextLines(vesselDimsLine, 34) : 0);
  const productHeight = Math.max(32, productLines * 32) + (item.sku ? estimateTextLines(item.sku, 42) * 24 + 6 : 0);

  const materialLines = estimateTextLines(resolveMaterialText(item), 42);
  const cabinetDetailsLines = section.id === "cabinet" ? resolveCabinetDetails(item).length : 0;
  const materialHeight = Math.max(24, materialLines * 24 + cabinetDetailsLines * 24);

  return Math.max(productHeight, materialHeight, 32) + ROW_VERTICAL_GAP;
};

const estimateRowsBlockHeight = (block: RowSectionBlock) =>
  (block.showTitle ? SECTION_HEADER_HEIGHT : 0) +
  block.items.reduce((sum, item) => sum + estimateRowHeight(block.section, item), 0);

const estimateDetailsBlockHeight = (section: PrintSection) =>
  DETAILS_BLOCK_VERTICAL_PADDING + DETAILS_HEADER_HEIGHT + section.items.length * DETAILS_ROW_HEIGHT;

const estimateBlockHeight = (block: PrintPageBlock) => {
  if (block.kind === "rows") return estimateRowsBlockHeight(block);
  if (block.kind === "details") return estimateDetailsBlockHeight(block.section);
  return TOTAL_BLOCK_HEIGHT;
};

const getPageCapacity = (pageIndex: number) => (pageIndex === 0 ? FIRST_SPEC_PAGE_CAPACITY : SPEC_PAGE_CAPACITY);

const getPageUsedHeight = (page: PrintPageBlock[]) =>
  page.reduce((sum, pageBlock) => sum + estimateBlockHeight(pageBlock), 0);

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

const formatThicknessLabel = (value: unknown): string | null => {
  if (typeof value !== "string" && typeof value !== "number") return null;
  return formatCountertopThicknessLabel(value);
};

const formatDisplayDimension = (value: unknown): string | null => {
  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized || null;
  }

  return formatInchesFromCm(value);
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
  const height = formatThicknessLabel(description.Thickness);
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

const resolveVesselDimsLine = (item: PrintItem): string | null => {
  const category = item.description?.["Product Category"];
  if (category !== "Vessel") return null;

  const description = item.description ?? {};
  const width = formatDisplayDimension(description.Width);
  const height = formatDisplayDimension(description.Height);
  const depth = formatDisplayDimension(description.Depth);
  const line = joinValues([width ? `${width}W` : null, height ? `${height}H` : null, depth ? `${depth}D` : null], "-");

  return line || null;
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

const renderProductName = (title: string) => {
  const separatorIndex = title.indexOf(":");
  if (separatorIndex === -1) return `${title}:`;

  const label = title.slice(0, separatorIndex + 1);
  const specification = title.slice(separatorIndex + 1).trim();
  if (!specification) return title;

  return (
    <>
      <span className={s.prodNameLabel}>{label}</span>{" "}
      <span className={s.prodNameSpec}>{specification}</span>
    </>
  );
};

const renderRows = (section?: PrintSection, itemsOverride?: PrintItem[], showTitle = true) => {
  if (!section || !section.items.length) return null;

  const lines = (itemsOverride ?? section.items).filter(isLineItem);
  if (!lines.length) return null;
  const isCabinetSection = section.id === "cabinet";
  const resolvePriceText = (price?: string) => {
    if (!price) return "";
    if (section.id === "faucet" && price === "$0") return "$0.00";
    return price === "$0" ? "" : price;
  };

  return (
    <div className={`${s.specSection} ${!showTitle ? s.specSectionContinuation : ""}`}>
      {showTitle ? <div className={s.sectionName}>{sectionDisplayMap[section.id] ?? section.title}</div> : null}
      {lines.map((item) => {
        const cabinetDetails = isCabinetSection ? resolveCabinetDetails(item) : [];
        const normalizedSubtitle = item.subtitle?.trim();
        const normalizedSku = item.sku?.trim();
        const shouldShowSubtitle = Boolean(normalizedSubtitle) && normalizedSubtitle !== normalizedSku;
        const countertopDimsLine = resolveCountertopDimsLine(item);
        const basinStyleLine = resolveBasinStyleLine(item);
        const vesselDimsLine = resolveVesselDimsLine(item);
        const isDuplicateBasinSubtitle = Boolean(basinStyleLine && normalizedSubtitle === basinStyleLine);
        const shouldHideSubtitle =
          (item.title === "Countertop" && Boolean(countertopDimsLine)) || isDuplicateBasinSubtitle;

        return (
          <div className={s.row} key={item.id}>
            <div className={s.productCell}>
              <div className={s.prodNameRow}>
                <div className={s.prodName}>{renderProductName(item.title)}</div>
                {basinStyleLine ? <div className={s.prodSub}>{basinStyleLine}</div> : null}
                {shouldShowSubtitle && !shouldHideSubtitle ? <div className={s.prodSub}>{item.subtitle}</div> : null}
                {countertopDimsLine ? <div className={s.prodSub}>{countertopDimsLine}</div> : null}
                {vesselDimsLine ? <div className={s.prodSub}>{vesselDimsLine}</div> : null}
              </div>
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

const SpecHeader = () => (
  <div className={s.specHeader}>
    <div>Product</div>
    <div>Material/Color</div>
    <div>Price</div>
  </div>
);

const renderCabinetDetails = (section?: PrintSection) => {
  if (!section?.items.length) return null;

  return (
    <div className={s.details}>
      <div className={s.detailsTitle}>Cabinet Details</div>
      {section.items.map((item) => (
        <div className={s.detailsLine} key={item.id}>
          - {item.title}: {item.subtitle ?? "If applicable"}
        </div>
      ))}
    </div>
  );
};

const CoverLinkArrow = () => (
  <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M11.6666 11.6667H28.3333M28.3333 11.6667V28.3333M28.3333 11.6667L11.6666 28.3333"
      stroke="#AC5331"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const QuoteFooter = () => (
  <footer className={s.footer}>
    {footerItems.flatMap((item, index) => {
      const nodes = [
        <span className={s.footerItem} key={item}>
          {item}
        </span>,
      ];

      if (index < footerItems.length - 1) {
        nodes.push(
          <span className={s.footerDivider} key={`${item}-divider`}>
            |
          </span>,
        );
      }

      return nodes;
    })}
  </footer>
);

const addBlockToPages = (pages: PrintPageBlock[][], block: PrintPageBlock) => {
  let pageIndex = Math.max(pages.length - 1, 0);
  if (!pages.length) pages.push([]);

  const blockHeight = estimateBlockHeight(block);

  while (true) {
    const capacity = getPageCapacity(pageIndex);
    const used = getPageUsedHeight(pages[pageIndex]);

    if (!pages[pageIndex].length || used + blockHeight <= capacity) {
      pages[pageIndex].push(block);
      return;
    }

    pages.push([]);
    pageIndex += 1;
  }
};

const addTotalBlockToPages = (pages: PrintPageBlock[][]) => {
  if (!pages.length) pages.push([]);

  const pageIndex = Math.max(pages.length - 1, 0);
  const page = pages[pageIndex];
  const used = getPageUsedHeight(page);
  const capacity = getPageCapacity(pageIndex);

  if (!page.length || used + TOTAL_BLOCK_HEIGHT <= capacity + TOTAL_FIT_TOLERANCE) {
    page.push({ kind: "total" });
    return;
  }

  pages.push([{ kind: "total" }]);
};

const addRowSectionToPages = (pages: PrintPageBlock[][], section?: PrintSection) => {
  if (!section) return;

  const rows = section.items.filter(isLineItem);
  if (!rows.length) return;

  let currentItems: PrintItem[] = [];
  let shouldShowTitle = true;

  rows.forEach((item) => {
    const nextBlock: RowSectionBlock = { kind: "rows", section, items: [...currentItems, item], showTitle: shouldShowTitle };
    const pageIndex = Math.max(pages.length - 1, 0);
    const capacity = getPageCapacity(pageIndex);
    const used = getPageUsedHeight(pages[pageIndex] ?? []);
    const canFit = currentItems.length === 0 || used + estimateRowsBlockHeight(nextBlock) <= capacity;

    if (canFit) {
      currentItems = nextBlock.items;
      return;
    }

    addBlockToPages(pages, { kind: "rows", section, items: currentItems, showTitle: shouldShowTitle });
    currentItems = [item];
    shouldShowTitle = false;
  });

  if (currentItems.length) {
    addBlockToPages(pages, { kind: "rows", section, items: currentItems, showTitle: shouldShowTitle });
  }
};

const buildSpecPages = (sections: PrintSection[]) => {
  const pages: PrintPageBlock[][] = [[]];
  const cabinetSection = sectionById(sections, "cabinet");
  const cabinetOptions = sectionById(sections, "cabinet-options");
  const countertopSection = sectionById(sections, "countertop");
  const basinSection = sectionById(sections, "basin");
  const accessoriesSection = sectionById(sections, "accessories");
  const faucetSection = sectionById(sections, "faucet");

  addRowSectionToPages(pages, cabinetSection);

  if (cabinetOptions?.items.length) {
    addBlockToPages(pages, { kind: "details", section: cabinetOptions });
  }

  addRowSectionToPages(pages, countertopSection);
  addRowSectionToPages(pages, basinSection);
  addRowSectionToPages(pages, accessoriesSection);
  addRowSectionToPages(pages, faucetSection);
  addTotalBlockToPages(pages);

  return pages.filter((page) => page.length);
};

const renderSpecBlock = (block: PrintPageBlock, totalPrice: number) => {
  if (block.kind === "rows") return renderRows(block.section, block.items, block.showTitle);
  if (block.kind === "details") return renderCabinetDetails(block.section);

  return (
    <div className={s.totalRow}>
      <span className={s.totalLabel}>Total:</span>
      <span className={s.totalValue}>{formatTotalPrice(totalPrice)}</span>
    </div>
  );
};

export const QuotePrintDocument = ({
  summarySections,
  previewImage,
  modelName,
  generatedDate,
  configurationLink,
}: QuotePrintDocumentProps) => {
  const previewImageSrc = previewImage || EMPTY_PREVIEW_IMAGE;
  const totalPrice = summarySections.reduce((acc, section) => {
    const sectionSum = section.items.reduce((sum, item) => sum + parsePriceValue(item.price), 0);
    return acc + sectionSum;
  }, 0);
  const specPages = buildSpecPages(summarySections);

  return (
    <div id="quote-print-root" className={s.root} data-print-doc="quote">
      <div className={s.doc}>
        <section className={`${s.page} ${s.coverPage}`}>
          <div className={s.logoWrap}>
            <img className={s.logo} src={hastingsLogoUrl} alt="Hastings" />
          </div>

          <div className={s.heroWrap}>
            <img className={s.heroImage} src={previewImageSrc} alt={modelName} data-quote-preview-image />
          </div>

          <footer className={s.coverFooter}>
            <div>Hastings Quotation</div>
            <a className={`${s.configLink} ${s.coverLink}`} href={configurationLink}>
              Configuration Link <CoverLinkArrow />
            </a>
          </footer>
        </section>

        {specPages.map((pageBlocks, pageIndex) => (
          <section className={`${s.page} ${s.contentPage}`} key={`spec-page-${pageIndex}`}>
            {pageIndex === 0 ? (
              <>
                <div className={s.titleRow}>
                  <div className={s.productIntro}>
                    <h1 className={s.productName}>{modelName}</h1>
                    <p className={s.metaHint}>
                      <span className={s.metaLabel}>Country of Origin:</span> <span className={s.metaValue}>Italy</span>
                    </p>
                    <p className={s.metaHint}>
                      <span className={s.metaLabel}>Lead Time:</span>{" "}
                      <span className={s.metaValue}>10-12 Weeks (from sign-off)</span>
                    </p>

                    <div className={s.metaCard}>
                      <div className={s.metaRow}>
                        <span className={s.metaLabel}>Configuration Link:</span>
                        <a className={s.configLink} href={configurationLink}>
                          Link <ArrowTopRight color="currentColor" />
                        </a>
                      </div>
                      <div className={s.metaRow}>
                        <span className={s.metaLabel}>Date Generated:</span>
                        <span className={s.metaValue}>{generatedDate}</span>
                      </div>
                    </div>
                  </div>

                  <div className={s.thumbWrap}>
                    <img className={s.thumb} src={previewImageSrc} alt={modelName} data-quote-preview-image />
                  </div>
                </div>

                <h2 className={s.specTitle}>Product Details &amp; Specifications</h2>
              </>
            ) : null}

            <SpecHeader />
            {pageBlocks.map((block, blockIndex) => (
              <div className={s.printBlock} key={`${block.kind}-${blockIndex}`}>
                {renderSpecBlock(block, totalPrice)}
              </div>
            ))}

            <QuoteFooter />
          </section>
        ))}
      </div>
    </div>
  );
};
