import { captureQuotePreviewImage } from "./captureQuotePreviewImage";

type PrintQuoteOptions = {
  previewImage?: string | null;
};

const applyQuotePreviewImage = (root: HTMLElement, previewImage?: string | null) => {
  if (!previewImage) return;

  root.querySelectorAll<HTMLImageElement>("[data-quote-preview-image]").forEach((image) => {
    image.src = previewImage;
  });
};

export const printQuote = async (options: PrintQuoteOptions = {}) => {
  const content = document.getElementById("quote-print-root") ?? document.getElementById("summary-content");
  if (!content) return;

  const clone = content.cloneNode(true) as HTMLElement;
  applyQuotePreviewImage(clone, options.previewImage);
  clone.id = "summary-print-clone";
  document.body.appendChild(clone);

  const restore = () => {
    clone.remove();
    window.removeEventListener("afterprint", restore);
  };
  window.addEventListener("afterprint", restore);

  const images = Array.from(clone.querySelectorAll("img"));
  if (images.length) {
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
  }

  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  window.print();
};

export const printQuoteWithCurrentPreview = async () => {
  const previewImage = await captureQuotePreviewImage();
  await printQuote({ previewImage });
};
