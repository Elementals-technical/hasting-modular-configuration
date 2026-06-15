import { getZoom, setZoom } from "@/utils/functions/playcanvas/camera";

const DRAWER_TOP_VIEW_ZOOM_OUT_DISTANCE_DELTA = 0.4;

export const applyDrawerTopViewDefaultZoomOut = () => {
  const currentZoom = getZoom();
  if (currentZoom === null) return;

  setZoom(currentZoom + DRAWER_TOP_VIEW_ZOOM_OUT_DISTANCE_DELTA);
};
