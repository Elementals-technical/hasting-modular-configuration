import { useEffect, useState } from "react";

export const usePlayCanvasReady = () => {
  const [ready, setReady] = useState(() => Boolean((window as any).playCanvasReady));

  useEffect(() => {
    if (ready) return;

    const handleReady = () => setReady(true);

    window.addEventListener("playcanvas-ready", handleReady);
    return () => window.removeEventListener("playcanvas-ready", handleReady);
  }, [ready]);

  return ready;
};
