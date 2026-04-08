export const printQuote = async () => {
  const content = document.getElementById("quote-print-root") ?? document.getElementById("summary-content");
  if (!content) return;

  const clone = content.cloneNode(true) as HTMLElement;
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
