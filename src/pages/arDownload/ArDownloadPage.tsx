import { useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

export const ArDownloadPage = () => {
  const [searchParams] = useSearchParams();
  const glbUrl = useMemo(() => searchParams.get("glb") || "", [searchParams]);
  const usdzUrl = useMemo(() => searchParams.get("usdz") || "", [searchParams]);

  const isIOS = () =>
    /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  useEffect(() => {
    if (!glbUrl && !usdzUrl) return;

    const targetUrl = isIOS() ? usdzUrl || glbUrl : glbUrl || usdzUrl;
    if (!targetUrl) return;

    window.location.href = targetUrl;
  }, [glbUrl, usdzUrl]);

  if (!glbUrl && !usdzUrl) {
    return <div>Missing file URL.</div>;
  }
  return <div>Redirecting to download...</div>;
};
