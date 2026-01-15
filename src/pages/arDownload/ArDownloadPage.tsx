import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

type DownloadStatus = "idle" | "downloading" | "done" | "error";

const getFilename = (url: string) => {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname;
    const lastPart = pathname.split("/").pop();
    return lastPart || "ar-file";
  } catch {
    const lastPart = url.split("/").pop();
    return lastPart || "ar-file";
  }
};

export const ArDownloadPage = () => {
  const [searchParams] = useSearchParams();
  const fileUrl = useMemo(() => searchParams.get("url") || "", [searchParams]);
  const [status, setStatus] = useState<DownloadStatus>("idle");

  useEffect(() => {
    if (!fileUrl) return;

    let revokedUrl: string | null = null;
    setStatus("downloading");

    fetch(fileUrl)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to download: ${response.status}`);
        }
        return response.blob();
      })
      .then((blob) => {
        const filename = getFilename(fileUrl);
        const link = document.createElement("a");
        revokedUrl = URL.createObjectURL(blob);

        link.href = revokedUrl;
        link.download = filename;

        document.body.appendChild(link);

        link.click();
        link.remove();

        setStatus("done");
      })
      .catch(() => {
        setStatus("error");
      })
      .finally(() => {
        if (revokedUrl) URL.revokeObjectURL(revokedUrl);
      });
  }, [fileUrl]);

  if (!fileUrl) {
    return <div>Missing file URL.</div>;
  }

  if (status === "error") {
    return <div>Download failed. Please try again.</div>;
  }

  if (status === "done") {
    return <div>Download started.</div>;
  }

  return <div>Downloading...</div>;
};
