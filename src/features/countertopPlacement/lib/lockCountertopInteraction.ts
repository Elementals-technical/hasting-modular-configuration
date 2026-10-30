/** Keep the editor and its canvas interactive while live preview owns the composition. */
export function lockCountertopInteraction(host: HTMLElement): () => void {
  const previous = new Map<Element, string | null>();
  const mark = (element: Element) => {
    if (previous.has(element)) return;
    previous.set(element, element.getAttribute("inert"));
    element.setAttribute("inert", "");
  };
  const apply = () => {
    for (const child of host.children) {
      if (child.tagName !== "IFRAME" && child.getAttribute("aria-label") !== "Countertop positioning") mark(child);
    }
    // Sidebar, navigation, quote/save controls, player toolbar and portal surfaces
    // may live at different ancestor levels. Never make the editor's ancestor inert.
    let branch: Element = host;
    while (branch.parentElement && branch !== document.body) {
      for (const sibling of branch.parentElement.children) {
        if (sibling !== branch && !["SCRIPT", "STYLE", "LINK"].includes(sibling.tagName)) mark(sibling);
      }
      branch = branch.parentElement;
    }
  };
  apply();
  const observer = new MutationObserver(apply);
  observer.observe(document.body, { childList: true, subtree: true });
  const beforeUnload = (event: BeforeUnloadEvent) => {
    event.preventDefault();
    event.returnValue = "";
  };
  window.addEventListener("beforeunload", beforeUnload);
  return () => {
    observer.disconnect();
    window.removeEventListener("beforeunload", beforeUnload);
    previous.forEach((value, element) => {
      if (value === null) element.removeAttribute("inert");
      else element.setAttribute("inert", value);
    });
  };
}
