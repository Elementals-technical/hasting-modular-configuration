type MeshArrayKey =
  | "meshInstances"
  | "_meshInstances"
  | "opaqueMeshInstances"
  | "_opaqueMeshInstances"
  | "transparentMeshInstances"
  | "_transparentMeshInstances"
  | "shadowCasters"
  | "_shadowCasters";

type ConfiguratorApiWithApp = {
  config?: {
    root?: unknown;
    scene?: {
      layers?: unknown;
    };
    on?: (eventName: string, callback: () => void) => unknown;
  };
};

type WindowWithContainerRef = Window & {
  containerRef?: {
    current?: HTMLIFrameElement | null;
  };
};

type PlayCanvasWindow = Window & {
  ConfiguratorAPI?: ConfiguratorApiWithApp;
};

const MESH_ARRAY_KEYS: MeshArrayKey[] = [
  "meshInstances",
  "_meshInstances",
  "opaqueMeshInstances",
  "_opaqueMeshInstances",
  "transparentMeshInstances",
  "_transparentMeshInstances",
  "shadowCasters",
  "_shadowCasters",
];
const SANITIZER_INSTALLED_KEY = "__taggingMeshInstanceSanitizerInstalled";
const DEFAULT_RENDER_SANITIZER_FRAME_COUNT = 240;

let activeRenderSanitizerFrames = 0;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

type SetLike = {
  forEach: (callback: (item: unknown) => void) => void;
  delete: (item: unknown) => unknown;
  size: number;
};

type IterableCollectionLike = {
  forEach: (callback: (item: unknown) => void) => void;
  size: number;
};

const isSetLike = (value: unknown): value is SetLike =>
  isRecord(value) &&
  typeof value.forEach === "function" &&
  typeof value.delete === "function" &&
  typeof value.size === "number";

const isIterableCollectionLike = (value: unknown): value is IterableCollectionLike =>
  isRecord(value) && typeof value.forEach === "function" && typeof value.size === "number";

const getPlayCanvasApp = (): ConfiguratorApiWithApp["config"] | null => {
  const containerRef = (window as WindowWithContainerRef).containerRef;
  const contentWindow = containerRef?.current?.contentWindow as PlayCanvasWindow | null | undefined;
  return contentWindow?.ConfiguratorAPI?.config ?? null;
};

const isInvalidMeshInstance = (value: unknown): boolean => {
  if (!isRecord(value) || !("mesh" in value)) return false;
  return value.mesh === null || value.mesh === undefined;
};

const replaceArrayContents = (items: unknown[], nextItems: unknown[]): void => {
  items.splice(0, items.length, ...nextItems);
};

const sanitizeMeshArrayValue = (value: unknown): number => {
  if (Array.isArray(value)) {
    const nextItems = value.filter((item) => !isInvalidMeshInstance(item));
    const removedCount = value.length - nextItems.length;
    if (removedCount > 0) replaceArrayContents(value, nextItems);
    return removedCount;
  }

  if (isSetLike(value)) {
    let removedCount = 0;
    const staleItems: unknown[] = [];
    value.forEach((item) => {
      if (isInvalidMeshInstance(item)) {
        staleItems.push(item);
      }
    });
    staleItems.forEach((item) => {
      value.delete(item);
      removedCount += 1;
    });
    return removedCount;
  }

  if (isRecord(value) && Array.isArray(value.list)) {
    const list = value.list;
    const nextItems = list.filter((item) => !isInvalidMeshInstance(item));
    const removedCount = list.length - nextItems.length;
    if (removedCount > 0) replaceArrayContents(list, nextItems);
    return removedCount;
  }

  return 0;
};

const sanitizeMeshContainer = (value: unknown): number => {
  if (!isRecord(value)) return 0;

  return MESH_ARRAY_KEYS.reduce((removedCount, key) => removedCount + sanitizeMeshArrayValue(value[key]), 0);
};

const sanitizeEntityTree = (entity: unknown): number => {
  if (!isRecord(entity)) return 0;

  let removedCount = sanitizeMeshContainer(entity.render) + sanitizeMeshContainer(entity.model);

  const children = entity.children;
  if (Array.isArray(children)) {
    for (const child of children) {
      removedCount += sanitizeEntityTree(child);
    }
  }

  return removedCount;
};

const collectLayerCandidates = (value: unknown, layers: Set<unknown>): void => {
  if (!value) return;

  if (Array.isArray(value)) {
    value.forEach((item) => layers.add(item));
    return;
  }

  if (isIterableCollectionLike(value)) {
    value.forEach((item) => layers.add(item));
    return;
  }

  if (isRecord(value)) {
    Object.values(value).forEach((item) => layers.add(item));
  }
};

const sanitizeLayers = (layersRoot: unknown): number => {
  if (!isRecord(layersRoot)) return 0;

  const layers = new Set<unknown>();
  collectLayerCandidates(layersRoot.layerList, layers);
  collectLayerCandidates(layersRoot._layerList, layers);
  collectLayerCandidates(layersRoot._layers, layers);

  let removedCount = 0;
  for (const layer of layers) {
    removedCount += sanitizeMeshContainer(layer);
    if (isRecord(layer)) {
      removedCount += sanitizeMeshContainer(layer.instances);
    }
  }

  return removedCount;
};

const sanitizePlayCanvasAppMeshInstances = (app: ConfiguratorApiWithApp["config"] | null): number => {
  if (!app) return 0;

  const removedCount = sanitizeEntityTree(app.root) + sanitizeLayers(app.scene?.layers);
  if (removedCount > 0) {
    console.warn("[PlayCanvas] Removed stale mesh instances before render", { removedCount });
  }

  return removedCount;
};

const installRenderSanitizer = (app: ConfiguratorApiWithApp["config"]): void => {
  if (!isRecord(app) || typeof app.on !== "function") return;

  const appRecord = app as Record<string, unknown>;
  if (appRecord[SANITIZER_INSTALLED_KEY] === true) return;

  const sanitizeBeforeRender = () => {
    if (activeRenderSanitizerFrames <= 0) return;
    activeRenderSanitizerFrames -= 1;
    sanitizePlayCanvasAppMeshInstances(app);
  };

  app.on("update", sanitizeBeforeRender);
  app.on("prerender", sanitizeBeforeRender);
  appRecord[SANITIZER_INSTALLED_KEY] = true;
};

export const watchPlayCanvasMeshInstancesDuringRender = (
  frameCount = DEFAULT_RENDER_SANITIZER_FRAME_COUNT,
): void => {
  const app = getPlayCanvasApp();
  if (!app) return;

  activeRenderSanitizerFrames = Math.max(activeRenderSanitizerFrames, frameCount);
  installRenderSanitizer(app);
};

export const sanitizePlayCanvasMeshInstances = (): number => sanitizePlayCanvasAppMeshInstances(getPlayCanvasApp());
