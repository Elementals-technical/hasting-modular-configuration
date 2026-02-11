export type ScreenBounds = {
  left: number;
  right: number;
  top: number;
  bottom: number;
  centerX: number;
  centerY: number;
};

/**
 * Project the world-space AABB of a named entity onto 2D screen coordinates.
 * Returns pixel values relative to the PlayCanvas canvas (i.e. the iframe viewport).
 */
export function getEntityScreenBounds(entityName: string): ScreenBounds | null {
  // @ts-ignore
  const containerRef = window.containerRef;
  const canvasIframe = containerRef?.current?.contentWindow as any;
  if (!canvasIframe) return null;

  const app = canvasIframe.ConfiguratorAPI?.config;
  const pc = canvasIframe.pc;
  if (!app || !pc) {
    console.warn("[getEntityScreenBounds] app or pc not available");
    return null;
  }

  // Find the camera entity
  const cameraEntity = app.root?.findByName?.("Camera") || app.root?.findComponent?.("camera")?.entity;
  const camera = cameraEntity?.camera;
  if (!camera?.worldToScreen) {
    console.warn("[getEntityScreenBounds] camera.worldToScreen not available");
    return null;
  }

  // Find the target entity in the scene graph
  const entity = app.root?.findByName?.(entityName);
  if (!entity) {
    console.warn("[getEntityScreenBounds] entity not found:", entityName);
    return null;
  }

  // Collect all mesh instances from this entity and its children
  const meshInstances: any[] = [];
  const collectMeshes = (node: any) => {
    const ri = node.render?.meshInstances ?? node.model?.meshInstances ?? [];
    for (const mi of ri) {
      if (mi.aabb) meshInstances.push(mi);
    }
    if (node.children) {
      for (const child of node.children) collectMeshes(child);
    }
  };
  collectMeshes(entity);

  if (meshInstances.length === 0) {
    console.warn("[getEntityScreenBounds] no mesh instances found for:", entityName);
    return null;
  }

  // Merge all mesh AABBs into one combined bounding box
  const first = meshInstances[0].aabb;
  let minX = first.center.x - first.halfExtents.x;
  let minY = first.center.y - first.halfExtents.y;
  let minZ = first.center.z - first.halfExtents.z;
  let maxX = first.center.x + first.halfExtents.x;
  let maxY = first.center.y + first.halfExtents.y;
  let maxZ = first.center.z + first.halfExtents.z;

  for (let i = 1; i < meshInstances.length; i++) {
    const aabb = meshInstances[i].aabb;
    const cx = aabb.center.x,
      cy = aabb.center.y,
      cz = aabb.center.z;
    const hx = aabb.halfExtents.x,
      hy = aabb.halfExtents.y,
      hz = aabb.halfExtents.z;
    minX = Math.min(minX, cx - hx);
    minY = Math.min(minY, cy - hy);
    minZ = Math.min(minZ, cz - hz);
    maxX = Math.max(maxX, cx + hx);
    maxY = Math.max(maxY, cy + hy);
    maxZ = Math.max(maxZ, cz + hz);
  }

  // 8 corners of the combined AABB
  const corners = [
    new pc.Vec3(minX, minY, minZ),
    new pc.Vec3(maxX, minY, minZ),
    new pc.Vec3(minX, maxY, minZ),
    new pc.Vec3(maxX, maxY, minZ),
    new pc.Vec3(minX, minY, maxZ),
    new pc.Vec3(maxX, minY, maxZ),
    new pc.Vec3(minX, maxY, maxZ),
    new pc.Vec3(maxX, maxY, maxZ),
  ];

  // Project each corner and find the 2D bounding rectangle
  let sMinX = Infinity,
    sMinY = Infinity,
    sMaxX = -Infinity,
    sMaxY = -Infinity;

  for (const corner of corners) {
    const screen = camera.worldToScreen(corner);
    if (!screen) continue;
    sMinX = Math.min(sMinX, screen.x);
    sMinY = Math.min(sMinY, screen.y);
    sMaxX = Math.max(sMaxX, screen.x);
    sMaxY = Math.max(sMaxY, screen.y);
  }

  if (!isFinite(sMinX)) {
    console.warn("[getEntityScreenBounds] projection failed for:", entityName);
    return null;
  }

  return {
    left: sMinX,
    right: sMaxX,
    top: sMinY,
    bottom: sMaxY,
    centerX: (sMinX + sMaxX) / 2,
    centerY: (sMinY + sMaxY) / 2,
  };
}
