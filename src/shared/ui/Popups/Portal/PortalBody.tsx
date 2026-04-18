import { type PropsWithChildren, useLayoutEffect, useMemo } from "react";
import { createPortal } from "react-dom";

export const PortalBody: React.FC<PropsWithChildren> = ({ children }: PropsWithChildren) => {
  const container = useMemo(() => {
    const el = document.createElement("div");

    el.className = "portal-body";
    return el;
  }, []);

  // Attach synchronously (before paint) so consumers' useLayoutEffect can
  // measure portal content on the same render.
  useLayoutEffect(() => {
    document.body.appendChild(container);
    return () => {
      document.body.removeChild(container);
    };
  }, [container]);

  return createPortal(children, container);
};
