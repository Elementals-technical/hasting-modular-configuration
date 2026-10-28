import { Color, OutlineRenderer, Shader } from "playcanvas";
import { OutlineDiagnostics } from "./outline-diagnostics.mjs";
import {
  DEFAULT_OUTLINE_CONFIGURATION,
  DEFAULT_OUTLINE_SEMANTIC_COLORS,
  OUTLINE_SEMANTIC_PRECEDENCE,
  OUTLINE_SEMANTIC_STATE
} from "./outline-configuration.mjs";

/**
 * Owner key of a semantic contribution that did not name one.
 *
 * Semantic outline contributions are keyed by owner so that several sources — a manipulation
 * instance, a collision observer, the countertop outline adapter — can hold state on one entity
 * at the same time, and so each of them releases only what it contributed itself.
 *
 * `SelectTool.setEntitySemanticState(entity, state)` forwards two arguments only, so an owner
 * travels inside the state payload as `{ owner, state }`, with `{ owner, state: null }` as that
 * owner's release. `state` there takes every shape `_normalizeSemanticStates` already accepts. A
 * caller that passes a bare semantic value keeps this default key and behaves exactly as before.
 */
const DEFAULT_SEMANTIC_OWNER = 'default';

/**
 * An owner key must be a non-empty string. Anything else — `''`, `0`, `false`, or a fresh object
 * per call — would install rows the caller can never name again to release them.
 */
const resolveSemanticOwner = (owner) => (
  typeof owner === 'string' && owner.length > 0 ? owner : DEFAULT_SEMANTIC_OWNER
);

/** Shared empty reduction for an entity that holds no contribution. Never mutated. */
const NO_SEMANTIC_STATES = new Set();

/**
 * Owns the complete selection-outline rendering lifecycle.
 *
 * SelectTool decides what is selected. This controller decides how that
 * selection is represented by PlayCanvas OutlineRenderer.
 */
export class SelectionOutlineController {
  _app = null;
  _renderer = null;
  _originalExtendFshader = null;
  _originalUpdateRenderTarget = null;
  _color = new Color(1, 1, 0, 1);
  _active = false;
  _configuration = { ...DEFAULT_OUTLINE_CONFIGURATION };
  _diagnostics = new OutlineDiagnostics();
  _isRenderableMeshInstance = () => true;
  _isInternalRenderProxy = () => false;
  _isDimensionRenderNode = () => false;
  _isSinkMountEntity = (entity) => entity?.name === 'Sink_Point';
  _selectedEntities = new Set();
  /** entity -> (owner key -> that owner's semantic values). */
  _semanticStates = new Map();
  _outlinedEntities = new Map();
  _outlinedMeshMaterials = new Map();
  _materialShaderBindings = new Map();
  _entityDestroyListeners = new Map();
  _semanticColors = null;

  constructor(app, options = {}) {
    this._app = app;
    this._color = options.color || this._color;
    this._configuration = {
      ...DEFAULT_OUTLINE_CONFIGURATION,
      ...options.configuration
    };
    if (options.radius != null) {
      this._configuration.radius = Math.round(options.radius);
    }
    this._isRenderableMeshInstance = options.isRenderableMeshInstance || this._isRenderableMeshInstance;
    this._isInternalRenderProxy = options.isInternalRenderProxy || this._isInternalRenderProxy;
    this._isDimensionRenderNode = options.isDimensionRenderNode || this._isDimensionRenderNode;
    this._isSinkMountEntity = options.isSinkMountEntity || this._isSinkMountEntity;
    this._semanticColors = {
      [OUTLINE_SEMANTIC_STATE.INVALID]: this._createColor(
        options.semanticColors?.[OUTLINE_SEMANTIC_STATE.INVALID],
        DEFAULT_OUTLINE_SEMANTIC_COLORS[OUTLINE_SEMANTIC_STATE.INVALID]
      ),
      [OUTLINE_SEMANTIC_STATE.EDITING]: this._createColor(
        options.semanticColors?.[OUTLINE_SEMANTIC_STATE.EDITING],
        DEFAULT_OUTLINE_SEMANTIC_COLORS[OUTLINE_SEMANTIC_STATE.EDITING]
      ),
      [OUTLINE_SEMANTIC_STATE.SELECTED]: this._color
    };
  }

  get renderer() {
    return this._renderer;
  }

  get radius() {
    return this._configuration.radius;
  }

  get active() {
    return this._active;
  }

  initialize() {
    if (this._renderer) return;

    const outlineLayer = this._app.scene.layers.getLayerByName("Outline");
    this._renderer = new OutlineRenderer(this._app, outlineLayer);
    this._originalExtendFshader = this._renderer.shaderExtend.definition.fshader;
    this._originalUpdateRenderTarget = this._renderer.updateRenderTarget;
    this._renderer.updateRenderTarget = (sceneCamera) => {
      this._updateScaledRenderTargets(sceneCamera);
    };
    this._applyRadius();
    this._syncActive(false);
  }

  destroy() {
    this._clearTrackedEntities();
    this._selectedEntities.clear();
    this._semanticStates.clear();
    if (this._renderer) {
      if (this._originalUpdateRenderTarget) {
        this._renderer.updateRenderTarget = this._originalUpdateRenderTarget;
      }
      this._renderer.destroy();
      this._renderer = null;
    }
    this._originalExtendFshader = null;
    this._originalUpdateRenderTarget = null;
    this._outlinedMeshMaterials.clear();
    this._materialShaderBindings.clear();
    this._active = false;
  }

  getConfiguration() {
    const effectiveRadius = this._getEffectiveRadius();
    return {
      ...this._configuration,
      effectiveRadius,
      upscaledRadius: effectiveRadius / this._configuration.resolutionScale
    };
  }

  getRuntimeState() {
    const renderer = this._renderer;
    const outlineCamera = renderer?.outlineCameraEntity?.camera;
    return {
      active: this._active,
      outlinedEntityCount: this._outlinedEntities.size,
      semanticOverrideCount: this._semanticStates.size,
      configuration: this.getConfiguration(),
      outlineCameraEnabled: Boolean(renderer?.outlineCameraEntity?.enabled),
      renderTargets: {
        outline: renderer?.rt
          ? { width: renderer.rt.width, height: renderer.rt.height }
          : null,
        temporary: renderer?.tempRt
          ? { width: renderer.tempRt.width, height: renderer.tempRt.height }
          : null,
        camera: outlineCamera?.renderTarget
          ? { width: outlineCamera.renderTarget.width, height: outlineCamera.renderTarget.height }
          : null
      }
    };
  }

  setColor(color, selectedEntities = []) {
    this._color = color;
    this._semanticColors[OUTLINE_SEMANTIC_STATE.SELECTED] = color;
    this.refresh(selectedEntities);
  }

  /**
   * Contribute a semantic outline state for one entity on behalf of one owner. A state can be one
   * of the exported OUTLINE_SEMANTIC_STATE values, an array/set of values, or a flags object, and
   * it can be wrapped as `{ owner, state }` / `{ owner, states }` to name the contributing owner.
   * A contribution replaces only that owner's previous one; contributions from other owners are
   * kept and reduced together using invalid > editing > selected.
   */
  setEntitySemanticState(entity, state) {
    if (!entity) return null;

    const { owner, semanticStates } = this._resolveSemanticContribution(state);
    if (semanticStates.size === 0) {
      this.clearEntitySemanticState(entity, owner);
      return null;
    }

    const contributions = this._semanticStates.get(entity) || new Map();
    contributions.set(owner, semanticStates);
    this._semanticStates.set(entity, contributions);
    this._ensureEntityDestroyListener(entity);
    this._reconcileEntity(entity);
    this._syncActive(this._hasOutlinedMeshes());
    return this._resolveEntitySemanticState(entity);
  }

  /**
   * Release one owner's contribution for this entity. Other owners keep theirs, so a gesture
   * release or a deselect never takes another instance's state down with it.
   */
  clearEntitySemanticState(entity, owner = DEFAULT_SEMANTIC_OWNER) {
    if (!entity) return false;

    const contributions = this._semanticStates.get(entity);
    const hadOverride = Boolean(contributions?.delete(resolveSemanticOwner(owner)));
    if (contributions && contributions.size === 0) this._semanticStates.delete(entity);
    this._reconcileEntity(entity);
    this._releaseEntityDestroyListenerIfUnused(entity);
    this._syncActive(this._hasOutlinedMeshes());
    return hadOverride;
  }

  setRadius(value) {
    this._configuration.radius = Math.round(value);
    this._applyRadius();
    return this._configuration.radius;
  }

  setResolutionScale(value) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return this._configuration.resolutionScale;

    this._configuration.resolutionScale = Math.min(1, Math.max(0.25, numericValue));
    this._applyRadius();
    return this._configuration.resolutionScale;
  }

  setDiagnosticsEnabled(enabled = true) {
    return this._diagnostics.setEnabled(enabled);
  }

  getDiagnostics() {
    return this._diagnostics.getReports();
  }

  clearDiagnostics() {
    this._diagnostics.clear();
  }

  clear() {
    this._clearTrackedEntities();
    this._selectedEntities.clear();
    this._semanticStates.clear();
    this._syncActive(false);
  }

  frameUpdate(cameraEntity) {
    if (!this._renderer) return;

    this._refreshTrackedEntities();
    if (!this._active || !cameraEntity) return;

    const immediateLayer = this._app.scene.layers.getLayerByName("Immediate");
    const blendLayer = immediateLayer || this._app.scene.layers.getLayerByName("World");
    this._renderer.frameUpdate(cameraEntity, blendLayer, false);
  }

  updateSelection(allSelected, added, removed) {
    if (!this._renderer) return;

    const diagnosticReport = this._diagnostics.beginSelection(
      allSelected,
      added,
      removed,
      this.getConfiguration(),
      this._renderer
    );

    const previousSelection = this._selectedEntities;
    const nextSelection = new Set((allSelected || []).filter(Boolean));
    const affectedEntities = new Set([
      ...previousSelection,
      ...nextSelection,
      ...this._semanticStates.keys()
    ]);

    this._selectedEntities = nextSelection;
    affectedEntities.forEach((entity) => {
      if (nextSelection.has(entity)) this._ensureEntityDestroyListener(entity);
      this._reconcileEntity(entity);
      this._releaseEntityDestroyListenerIfUnused(entity);
    });

    this._syncActive(this._hasOutlinedMeshes());

    if (diagnosticReport) {
      this._app.once('frameend', () => {
        this._diagnostics.finish(diagnosticReport, this._renderer);
      });
    }
  }

  refresh(selectedEntities = []) {
    if (!this._renderer) return;

    const previousSelection = this._selectedEntities;
    const nextSelection = new Set((selectedEntities || []).filter(Boolean));
    const affectedEntities = new Set([
      ...previousSelection,
      ...nextSelection,
      ...this._semanticStates.keys()
    ]);

    this._selectedEntities = nextSelection;
    affectedEntities.forEach((entity) => {
      if (nextSelection.has(entity)) this._ensureEntityDestroyListener(entity);
      this._reconcileEntity(entity, true);
      this._releaseEntityDestroyListenerIfUnused(entity);
    });
    this._syncActive(this._hasOutlinedMeshes());
  }

  _syncActive(hasOutlines) {
    this._active = this._configuration.idleSleep
      ? Boolean(hasOutlines)
      : true;

    const outlineCameraEntity = this._renderer?.outlineCameraEntity;
    if (outlineCameraEntity) {
      outlineCameraEntity.enabled = this._active;
    }
  }

  _applyRadius() {
    if (!this._renderer || !this._originalExtendFshader) return;

    const radius = this._getEffectiveRadius();
    let samples = '';
    for (let i = -radius; i <= radius; i++) {
      if (i === 0) continue;
      samples += `
        pixel = texture2D(source, vUv0 + uOffset * ${i.toFixed(1)});
        texel = max(texel, pixel);
        diff = max(diff, length(firstTexel.rgb - pixel.rgb));`;
    }

    const startMarker = 'float diff = texel.a * uSrcMultiplier;';
    const endMarker = 'gl_FragColor = vec4(texel.rgb';
    const startIdx = this._originalExtendFshader.indexOf(startMarker);
    const endIdx = this._originalExtendFshader.indexOf(endMarker);
    if (startIdx === -1 || endIdx === -1) return;

    const newFshader =
      this._originalExtendFshader.substring(0, startIdx + startMarker.length) +
      samples + '\n       ' +
      this._originalExtendFshader.substring(endIdx);

    const originalDefinition = this._renderer.shaderExtend.definition;
    const newDefinition = Object.assign({}, originalDefinition, {
      name: 'OutlineExtendCustom',
      fshader: newFshader
    });

    this._renderer.shaderExtend = new Shader(this._app.graphicsDevice, newDefinition);
  }

  _getEffectiveRadius() {
    return Math.max(
      1,
      Math.round(this._configuration.radius * this._configuration.resolutionScale)
    );
  }

  _updateScaledRenderTargets(sceneCamera) {
    const renderer = this._renderer;
    if (!renderer || !sceneCamera) return;

    const device = this._app.graphicsDevice;
    const sourceWidth = sceneCamera.renderTarget?.width ?? device.width;
    const sourceHeight = sceneCamera.renderTarget?.height ?? device.height;
    const scale = this._configuration.resolutionScale;
    const width = Math.max(1, Math.round(sourceWidth * scale));
    const height = Math.max(1, Math.round(sourceHeight * scale));

    if (renderer.rt.width !== width || renderer.rt.height !== height) {
      renderer.rt.resize(width, height);
      renderer.tempRt.resize(width, height);
    }
  }

  _createColor(value, fallback) {
    if (
      value &&
      Number.isFinite(value.r) &&
      Number.isFinite(value.g) &&
      Number.isFinite(value.b)
    ) {
      return value;
    }

    const channels = Array.isArray(value) ? value : fallback;
    return new Color(
      channels[0],
      channels[1],
      channels[2],
      channels[3] ?? 1
    );
  }

  _normalizeSemanticStates(state) {
    const states = new Set();
    const addState = (candidate) => {
      if (!OUTLINE_SEMANTIC_PRECEDENCE.includes(candidate)) {
        throw new RangeError(`Unsupported outline semantic state: ${candidate}`);
      }
      states.add(candidate);
    };

    if (state == null) return states;
    if (typeof state === 'string') {
      addState(state);
      return states;
    }
    if (Array.isArray(state) || state instanceof Set) {
      state.forEach(addState);
      return states;
    }
    if (typeof state === 'object') {
      OUTLINE_SEMANTIC_PRECEDENCE.forEach((candidate) => {
        if (state[candidate]) states.add(candidate);
      });
      return states;
    }

    throw new TypeError('Outline semantic state must be a string, collection, flags object, or null');
  }

  /**
   * Split a contribution payload into its owner key and its semantic values. Only a plain object
   * carrying an `owner` key names an owner, and its values are read from `state`; every other
   * shape stays on the default owner, which is what the two-argument SelectTool seam passes.
   */
  _resolveSemanticContribution(state) {
    const namesOwner =
      Boolean(state) &&
      typeof state === 'object' &&
      !Array.isArray(state) &&
      !(state instanceof Set) &&
      'owner' in state;

    if (!namesOwner) {
      return {
        owner: DEFAULT_SEMANTIC_OWNER,
        semanticStates: this._normalizeSemanticStates(state)
      };
    }

    return {
      owner: resolveSemanticOwner(state.owner),
      semanticStates: this._normalizeSemanticStates(state.state ?? null)
    };
  }

  /**
   * Reduce every owner's contribution for one entity into the set of active semantic values. The
   * single-owner case returns the stored set as is, so the per-frame refresh allocates nothing.
   */
  _reduceEntitySemanticStates(entity) {
    const contributions = this._semanticStates.get(entity);
    if (!contributions || contributions.size === 0) return NO_SEMANTIC_STATES;
    if (contributions.size === 1) return contributions.values().next().value;

    const reduced = new Set();
    contributions.forEach((semanticStates) => {
      semanticStates.forEach((semanticState) => reduced.add(semanticState));
    });
    return reduced;
  }

  _resolveEntitySemanticState(entity) {
    const semanticStates = this._reduceEntitySemanticStates(entity);
    if (semanticStates.has(OUTLINE_SEMANTIC_STATE.INVALID)) {
      return OUTLINE_SEMANTIC_STATE.INVALID;
    }
    if (!this._selectedEntities.has(entity)) return null;
    if (semanticStates.has(OUTLINE_SEMANTIC_STATE.EDITING)) {
      return OUTLINE_SEMANTIC_STATE.EDITING;
    }
    return OUTLINE_SEMANTIC_STATE.SELECTED;
  }

  _reconcileEntity(entity, force = false) {
    const previous = this._outlinedEntities.get(entity);
    const state = this._resolveEntitySemanticState(entity);
    const isAttached = entity === this._app.root || entity?.root === this._app.root;

    if (!state || !isAttached || !entity.enabled) {
      this._removeTrackedMeshes(entity);
      if (!isAttached) {
        this._selectedEntities.delete(entity);
        this._semanticStates.delete(entity);
        this._releaseEntityDestroyListener(entity);
      }
      return;
    }

    const meshInstances = this._collectFilteredMeshInstances(entity);
    if (
      !force &&
      previous?.state === state &&
      this._sameMeshInstances(previous.meshInstances, meshInstances)
    ) {
      return;
    }

    this._removeTrackedMeshes(entity);
    if (meshInstances.length === 0) return;

    const trackedMeshes = this._addMeshInstances(
      entity,
      meshInstances,
      this._semanticColors[state]
    );
    this._outlinedEntities.set(entity, {
      state,
      meshInstances: trackedMeshes
    });
  }

  _collectFilteredMeshInstances(entity) {
    const enabledMeshes = [];
    const uniqueMeshes = new Set();

    const collect = (node) => {
      if (!node || !node.enabled) return;
      if (this._isInternalRenderProxy(node)) return;
      if (this._isDimensionRenderNode(node)) return;
      if (node !== entity && this._isSinkMountEntity(node)) return;

      const addMeshes = (meshInstances) => {
        meshInstances?.forEach((meshInstance) => {
          if (
            this._isRenderableMeshInstance(meshInstance) &&
            !uniqueMeshes.has(meshInstance)
          ) {
            uniqueMeshes.add(meshInstance);
            enabledMeshes.push(meshInstance);
          }
        });
      };

      addMeshes(node.render?.meshInstances);
      addMeshes(node.model?.meshInstances);
      for (const child of node.children) collect(child);
    };

    collect(entity);
    return enabledMeshes;
  }

  _addMeshInstances(entity, enabledMeshes, color) {
    const renderer = this._renderer;
    if (!renderer || enabledMeshes.length === 0) return [];

    const collectionStartedAt = this._diagnostics.enabled
      ? performance.now()
      : 0;

    this._diagnostics.recordEntity(
      entity,
      enabledMeshes,
      collectionStartedAt ? performance.now() - collectionStartedAt : 0
    );

    const { StandardMaterialOptions } = pc;
    enabledMeshes.forEach((meshInstance) => {
      if (meshInstance.material instanceof pc.StandardMaterial) {
        const outlineShaderPass = renderer.outlineShaderPass;
        const material = meshInstance.material;
        let shaderBinding = this._materialShaderBindings.get(material);

        if (!shaderBinding) {
          const originalOnUpdateShader = material.onUpdateShader;
          const outlineOnUpdateShader = (options) => {
            const originalOptions = typeof originalOnUpdateShader === 'function'
              ? originalOnUpdateShader(options) || options
              : options;

            if (originalOptions.pass === outlineShaderPass) {
              this._diagnostics.recordShaderOptions(material, originalOptions);
              const opts = new StandardMaterialOptions();
              opts.defines = originalOptions.defines;
              opts.opacityMap = originalOptions.opacityMap;
              opts.opacityMapUv = originalOptions.opacityMapUv;
              opts.opacityMapChannel = originalOptions.opacityMapChannel;
              opts.opacityMapTransform = originalOptions.opacityMapTransform;
              opts.opacityVertexColor = originalOptions.opacityVertexColor;
              opts.opacityVertexColorChannel = originalOptions.opacityVertexColorChannel;
              opts.litOptions.vertexColors = originalOptions.litOptions.vertexColors;
              opts.litOptions.alphaTest = originalOptions.litOptions.alphaTest;
              opts.litOptions.skin = originalOptions.litOptions.skin;
              opts.litOptions.batch = originalOptions.litOptions.batch;
              opts.litOptions.useInstancing = originalOptions.litOptions.useInstancing;
              opts.litOptions.useMorphPosition = originalOptions.litOptions.useMorphPosition;
              opts.litOptions.useMorphNormal = originalOptions.litOptions.useMorphNormal;
              opts.litOptions.useMorphTextureBasedInt = originalOptions.litOptions.useMorphTextureBasedInt;
              opts.litOptions.opacityFadesSpecular = originalOptions.litOptions.opacityFadesSpecular;
              return opts;
            }
            return originalOptions;
          };

          shaderBinding = {
            count: 0,
            originalOnUpdateShader,
            outlineOnUpdateShader
          };
          this._materialShaderBindings.set(material, shaderBinding);
          material.onUpdateShader = outlineOnUpdateShader;
        }

        shaderBinding.count++;
        this._outlinedMeshMaterials.set(meshInstance, material);

        const tempColor = new Color();
        tempColor.linear(color);
        const colArray = new Float32Array([tempColor.r, tempColor.g, tempColor.b]);
        // PlayCanvas 2.21 removed per-pass MeshInstance parameter flags.
        // OutlineRenderer now consumes this dedicated parameter, so it cannot
        // leak the outline color into the regular scene material.
        meshInstance.setParameter('pcOutlineColor', colArray);
      }
    });

    renderer.renderingLayer.addMeshInstances(enabledMeshes, true);
    return enabledMeshes;
  }

  _removeTrackedMeshes(entity) {
    const tracked = this._outlinedEntities.get(entity);
    if (!tracked) return;

    this._renderer?.renderingLayer.removeMeshInstances(tracked.meshInstances, true);
    tracked.meshInstances.forEach((meshInstance) => {
      const material = this._outlinedMeshMaterials.get(meshInstance);
      if (!material) return;

      meshInstance.deleteParameter?.('pcOutlineColor');
      this._outlinedMeshMaterials.delete(meshInstance);

      const shaderBinding = this._materialShaderBindings.get(material);
      if (!shaderBinding) return;
      shaderBinding.count--;
      if (shaderBinding.count > 0) return;

      if (material.onUpdateShader === shaderBinding.outlineOnUpdateShader) {
        material.onUpdateShader = shaderBinding.originalOnUpdateShader;
      }
      this._materialShaderBindings.delete(material);
    });
    this._outlinedEntities.delete(entity);
  }

  _clearTrackedEntities() {
    this._outlinedEntities.forEach((_tracked, entity) => {
      this._removeTrackedMeshes(entity);
    });
    this._renderer?.removeAllEntities();
    this._entityDestroyListeners.forEach((handle) => {
      handle.off?.();
    });
    this._entityDestroyListeners.clear();
  }

  _sameMeshInstances(previous, current) {
    if (previous.length !== current.length) return false;
    const currentSet = new Set(current);
    return previous.every((meshInstance) => currentSet.has(meshInstance));
  }

  _refreshTrackedEntities() {
    const entities = new Set([
      ...this._selectedEntities,
      ...this._semanticStates.keys()
    ]);
    entities.forEach((entity) => this._reconcileEntity(entity));
    this._syncActive(this._hasOutlinedMeshes());
  }

  _hasOutlinedMeshes() {
    return this._outlinedEntities.size > 0;
  }

  _ensureEntityDestroyListener(entity) {
    if (!entity?.once || this._entityDestroyListeners.has(entity)) return;

    const handle = entity.once('destroy', () => {
      this._selectedEntities.delete(entity);
      this._semanticStates.delete(entity);
      this._removeTrackedMeshes(entity);
      this._entityDestroyListeners.delete(entity);
      this._syncActive(this._hasOutlinedMeshes());
    });
    this._entityDestroyListeners.set(entity, handle);
  }

  _releaseEntityDestroyListenerIfUnused(entity) {
    if (
      this._selectedEntities.has(entity) ||
      this._semanticStates.has(entity)
    ) {
      return;
    }
    this._releaseEntityDestroyListener(entity);
  }

  _releaseEntityDestroyListener(entity) {
    const handle = this._entityDestroyListeners.get(entity);
    if (!handle) return;
    handle.off?.();
    this._entityDestroyListeners.delete(entity);
  }
}
