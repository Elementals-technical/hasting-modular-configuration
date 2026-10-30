import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { createConfiguratorBridge, type CabinetCoverColorState } from "@/features/configuratorApi";
import { usePlayCanvasReady } from "@/shared/hooks/usePlayCanvasReady";

/** Lower is a scene feature: read its applied colour and refresh while this colour step is mounted. */
export const useCabinetCoverColor = (enabled: boolean) => {
  const ready = usePlayCanvasReady();
  const bridge = useMemo(() => createConfiguratorBridge(), []);
  const [state, setState] = useState<CabinetCoverColorState | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const processingRef = useRef(false);
  const lifecycle = useRef(0);
  const colorRevision = useRef(0);

  useEffect(() => {
    const version = ++lifecycle.current;
    if (!enabled || !ready) return;
    let reading = false;
    const refresh = async () => {
      if (reading || processingRef.current) return;
      reading = true;
      const revision = colorRevision.current;
      try {
        const next = (await bridge.getCabinetCoverColorState?.()) ?? null;
        if (lifecycle.current === version && revision === colorRevision.current && !processingRef.current) {
          setState((previous) => (JSON.stringify(previous) === JSON.stringify(next) ? previous : next));
        }
      } catch {
        // Keep the last visible material during temporary scene work; the next read retries.
      } finally {
        reading = false;
      }
    };
    void refresh();
    const interval = window.setInterval(() => void refresh(), 1000);
    return () => {
      lifecycle.current = version + 1;
      window.clearInterval(interval);
    };
  }, [bridge, enabled, ready]);

  /** Resolves whether the pick repainted the cover: false when it already had that colour or kept its own. */
  const changeColor = useCallback(
    async (materialId: string): Promise<boolean> => {
      if (!enabled || !ready || processingRef.current || !bridge.setCabinetCoverColor) return false;
      const version = lifecycle.current;
      ++colorRevision.current;
      processingRef.current = true;
      setProcessing(true);
      setError(null);
      try {
        // A cover the scene cannot describe now counts as repainted once it takes the colour.
        const before = await Promise.resolve(bridge.getCabinetCoverColorState?.()).catch(() => null);
        const result = await bridge.setCabinetCoverColor(materialId);
        if (result.status !== "applied" && result.status !== "unchanged") throw new Error(result.status);
        const next = (await bridge.getCabinetCoverColorState?.()) ?? null;
        if (!next?.segments.length || next.segments.some((segment) => segment.materialId !== materialId)) {
          throw new Error("Cover material was not applied");
        }
        if (lifecycle.current === version) setState(next);
        return !before || before.segments.some((segment) => segment.materialId !== materialId);
      } catch {
        if (lifecycle.current === version) setError("Could not change the lower countertop color. Please try again.");
        return false;
      } finally {
        processingRef.current = false;
        if (lifecycle.current === version) setProcessing(false);
      }
    },
    [bridge, enabled, ready],
  );

  const segments = enabled && ready ? (state?.segments ?? []) : [];
  const firstColor = segments[0]?.materialId ?? null;
  return {
    available: segments.length > 0,
    segments,
    color: segments.every(({ materialId }) => materialId === firstColor) ? firstColor : null,
    processing,
    error,
    changeColor,
  };
};
