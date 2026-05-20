import html2canvas from "html2canvas";
import jsPDF from "jspdf";

import { captureQuotePreviewImage } from "./captureQuotePreviewImage";
import { formatQuoteGeneratedDate } from "./formatQuoteGeneratedDate";

type PrintQuoteOptions = {
  previewImage?: string | null;
  fileName?: string;
};

const PDF_PAGE_WIDTH = 1684;
const PDF_PAGE_HEIGHT = 1190;
const CANVAS_SCALE = 2;

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

export const printQuote = async (options: PrintQuoteOptions = {}) => {
  const content = document.getElementById("quote-print-root") ?? document.getElementById("summary-content");
  if (!content) return;

  const clone = content.cloneNode(true) as HTMLElement;
  applyQuotePreviewImage(clone, options.previewImage);
  clone.removeAttribute("id");
  clone.style.display = "block";

  const host = document.createElement("div");
  host.setAttribute("data-quote-pdf-host", "true");
  host.style.position = "fixed";
  host.style.top = "0";
  host.style.left = "-100000px";
  host.style.width = `${PDF_PAGE_WIDTH}px`;
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
      unit: "px",
      format: [PDF_PAGE_WIDTH, PDF_PAGE_HEIGHT],
      hotfixes: ["px_scaling"],
    });

    for (let index = 0; index < pageElements.length; index += 1) {
      const pageElement = pageElements[index];
      const canvas = await html2canvas(pageElement, {
        width: PDF_PAGE_WIDTH,
        height: PDF_PAGE_HEIGHT,
        scale: CANVAS_SCALE,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
      });

      const imageData = canvas.toDataURL("image/png");
      if (index > 0) {
        pdf.addPage([PDF_PAGE_WIDTH, PDF_PAGE_HEIGHT], "landscape");
      }
      pdf.addImage(imageData, "PNG", 0, 0, PDF_PAGE_WIDTH, PDF_PAGE_HEIGHT);
    }

    pdf.save(buildFileName(options.fileName));
  } catch (error) {
    console.error("[QuotePrint] Failed to generate PDF", error);
  } finally {
    host.remove();
  }
};

export const printQuoteWithCurrentPreview = async () => {
  const previewImage = await captureQuotePreviewImage();
  await printQuote({ previewImage });
};
