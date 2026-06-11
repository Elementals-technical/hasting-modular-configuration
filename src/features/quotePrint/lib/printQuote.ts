import html2canvas from "html2canvas";
import jsPDF from "jspdf";

import { captureQuotePreviewImage } from "./captureQuotePreviewImage";
import { formatQuoteGeneratedDate } from "./formatQuoteGeneratedDate";

type PrintQuoteOptions = {
  previewImage?: string | null;
  fileName?: string;
};

const PDF_SOURCE_PAGE_WIDTH = 1684;
const PDF_SOURCE_PAGE_HEIGHT = 1190;
const PDF_A4_WIDTH_MM = 297;
const PDF_A4_HEIGHT_MM = 210;
const PDF_A4_RASTER_WIDTH = PDF_SOURCE_PAGE_WIDTH * 2;
const CANVAS_SCALE = PDF_A4_RASTER_WIDTH / PDF_SOURCE_PAGE_WIDTH;
const PDF_IMAGE_FORMAT = "JPEG";
const PDF_IMAGE_QUALITY = 0.98;

let activePrintQuotePromise: Promise<void> | null = null;

const applyQuotePreviewImage = (root: HTMLElement, previewImage?: string | null) => {
  if (!previewImage) return;

  root.querySelectorAll<HTMLImageElement>("[data-quote-preview-image]").forEach((image) => {
    image.src = previewImage;
  });
};

const waitForImages = async (container: HTMLElement) => {
  const images = Array.from(container.querySelectorAll("img"));
  if (!images.length) return;

  await Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete && img.naturalWidth > 0) {
            resolve();
            return;
          }
          const done = () => {
            img.removeEventListener("load", done);
            img.removeEventListener("error", done);
            resolve();
          };
          img.addEventListener("load", done, { once: true });
          img.addEventListener("error", done, { once: true });
        }),
    ),
  );
};

const waitForFonts = async () => {
  if (typeof document === "undefined" || !document.fonts?.ready) return;
  try {
    await document.fonts.ready;
  } catch {
    // ignore — proceed with whatever fonts are available
  }
};

const buildFileName = (custom?: string) => {
  if (custom?.trim()) return custom.trim();
  return `Hastings-Quote-${formatQuoteGeneratedDate()}.pdf`;
};

const resolvePageElements = (clone: HTMLElement): HTMLElement[] => {
  const docNode = clone.firstElementChild;
  if (!(docNode instanceof HTMLElement)) return [clone];

  const children = Array.from(docNode.children).filter((child): child is HTMLElement => child instanceof HTMLElement);
  return children.length ? children : [clone];
};

const isHyperlinkHref = (href: string | null): href is string => {
  if (!href) return false;
  const trimmed = href.trim();
  if (!trimmed || trimmed.startsWith("#")) return false;
  return true;
};

const addAnchorAnnotations = (pdf: jsPDF, pageElement: HTMLElement) => {
  const pageRect = pageElement.getBoundingClientRect();
  if (pageRect.width <= 0 || pageRect.height <= 0) return;

  const anchors = pageElement.querySelectorAll<HTMLAnchorElement>("a[href]");
  anchors.forEach((anchor) => {
    const href = anchor.getAttribute("href");
    if (!isHyperlinkHref(href)) return;

    const rect = anchor.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const scaleX = PDF_A4_WIDTH_MM / pageRect.width;
    const scaleY = PDF_A4_HEIGHT_MM / pageRect.height;
    const x = (rect.left - pageRect.left) * scaleX;
    const y = (rect.top - pageRect.top) * scaleY;

    pdf.link(x, y, rect.width * scaleX, rect.height * scaleY, { url: href });
  });
};

const generateQuotePdf = async (options: PrintQuoteOptions = {}) => {
  const content = document.getElementById("quote-print-root") ?? document.getElementById("summary-content");
  if (!content) return;

  const previewImage = options.previewImage === undefined ? await captureQuotePreviewImage() : options.previewImage;
  const clone = content.cloneNode(true) as HTMLElement;
  applyQuotePreviewImage(clone, previewImage);
  clone.removeAttribute("id");
  clone.style.display = "block";

  const host = document.createElement("div");
  host.setAttribute("data-quote-pdf-host", "true");
  host.style.position = "fixed";
  host.style.top = "0";
  host.style.left = "-100000px";
  host.style.width = `${PDF_SOURCE_PAGE_WIDTH}px`;
  host.style.pointerEvents = "none";
  host.style.zIndex = "-1";

  host.appendChild(clone);
  document.body.appendChild(host);

  try {
    await waitForFonts();
    await waitForImages(clone);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    const pageElements = resolvePageElements(clone);
    if (!pageElements.length) return;

    const pdf = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4",
    });

    for (let index = 0; index < pageElements.length; index += 1) {
      const pageElement = pageElements[index];
      const canvas = await html2canvas(pageElement, {
        width: PDF_SOURCE_PAGE_WIDTH,
        height: PDF_SOURCE_PAGE_HEIGHT,
        scale: CANVAS_SCALE,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
      });

      const imageData = canvas.toDataURL("image/jpeg", PDF_IMAGE_QUALITY);
      if (index > 0) {
        pdf.addPage("a4", "landscape");
      }
      pdf.addImage(imageData, PDF_IMAGE_FORMAT, 0, 0, PDF_A4_WIDTH_MM, PDF_A4_HEIGHT_MM);
      addAnchorAnnotations(pdf, pageElement);
    }

    pdf.save(buildFileName(options.fileName));
  } catch (error) {
    console.error("[QuotePrint] Failed to generate PDF", error);
  } finally {
    host.remove();
  }
};

export const printQuote = async (options: PrintQuoteOptions = {}) => {
  if (activePrintQuotePromise) return activePrintQuotePromise;

  activePrintQuotePromise = generateQuotePdf(options)
    .catch((error) => {
      console.error("[QuotePrint] Failed to generate PDF", error);
    })
    .finally(() => {
      activePrintQuotePromise = null;
    });

  return activePrintQuotePromise;
};

export const printQuoteWithCurrentPreview = async () => {
  await printQuote();
};
