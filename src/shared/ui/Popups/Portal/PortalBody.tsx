import { PropsWithChildren, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";

export const PortalBody: React.FC<PropsWithChildren> = ({ children }: PropsWithChildren) => {
  const container = useMemo(() => {
    const el = document.createElement("div");

    el.className = "portal-body";
    return el;
  }, []);

  useEffect(() => {
    document["body"].appendChild(container);
    return () => {
      document["body"].removeChild(container);
    };
  }, []);

  return createPortal(children, container);
};
