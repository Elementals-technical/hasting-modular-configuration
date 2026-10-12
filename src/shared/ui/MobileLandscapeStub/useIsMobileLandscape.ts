import { useEffect, useState } from "react";

// A phone held sideways: a short, wide touch viewport.
// max-height keeps tablets out (600px and taller in landscape).
// min-width keeps out a portrait phone whose on-screen keyboard shrinks the viewport height (480px wide at most).
export const MOBILE_LANDSCAPE_MEDIA_QUERY =
  "(orientation: landscape) and (pointer: coarse) and (max-height: 500px) and (min-width: 500px)";

const getIsMobileLandscape = () =>
  typeof window !== "undefined" && window.matchMedia(MOBILE_LANDSCAPE_MEDIA_QUERY).matches;

export const useIsMobileLandscape = () => {
  const [isMobileLandscape, setIsMobileLandscape] = useState(getIsMobileLandscape);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia(MOBILE_LANDSCAPE_MEDIA_QUERY);
    const handleChange = () => setIsMobileLandscape(mediaQuery.matches);

    handleChange();
    mediaQuery.addEventListener("change", handleChange);

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);

  return isMobileLandscape;
};
