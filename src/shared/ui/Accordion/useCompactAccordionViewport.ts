import { useEffect, useState } from "react";

const COMPACT_ACCORDION_MEDIA_QUERY = "(max-width: 1024px)";

const getIsCompactAccordionViewport = () =>
  typeof window !== "undefined" && window.matchMedia(COMPACT_ACCORDION_MEDIA_QUERY).matches;

export const useCompactAccordionViewport = () => {
  const [isCompact, setIsCompact] = useState(getIsCompactAccordionViewport);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia(COMPACT_ACCORDION_MEDIA_QUERY);
    const handleChange = () => setIsCompact(mediaQuery.matches);

    handleChange();
    mediaQuery.addEventListener("change", handleChange);

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);

  return isCompact;
};

export const useShouldCollapseAccordionByDefault = (itemCount: number, enabled = true) => {
  const isCompact = useCompactAccordionViewport();

  return enabled && isCompact && itemCount > 1;
};
