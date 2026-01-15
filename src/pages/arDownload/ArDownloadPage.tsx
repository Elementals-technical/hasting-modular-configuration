import { useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

export const ArDownloadPage = () => {
  const [searchParams] = useSearchParams();
  const fileUrl = useMemo(() => searchParams.get("url") || "", [searchParams]);

  useEffect(() => {
    if (!fileUrl) return;
    window.location.href = fileUrl;
  }, [fileUrl]);

  if (!fileUrl) {
    return <div>Missing file URL.</div>;
  }
  return <div>Redirecting to download...</div>;
};
