import { useEffect, useState } from "react";

import { installConfiguratorApiLogger } from "@/utils/functions/playcanvas/apiLogger";

export const usePlayCanvasReady = () => {
  const [ready, setReady] = useState(() => Boolean((window as any).playCanvasReady));

  useEffect(() => {
    if (ready) return;

    const handleReady = () => setReady(true);

    window.addEventListener("playcanvas-ready", handleReady);
    return () => window.removeEventListener("playcanvas-ready", handleReady);
  }, [ready]);

  useEffect(() => {
    if (!ready) return;
    if (installConfiguratorApiLogger()) return;
    // ConfiguratorAPI may be assigned slightly after the ready event — retry briefly.
    const interval = window.setInterval(() => {
      if (installConfiguratorApiLogger()) window.clearInterval(interval);
    }, 100);
    const timeout = window.setTimeout(() => window.clearInterval(interval), 5000);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [ready]);

  return ready;
};
