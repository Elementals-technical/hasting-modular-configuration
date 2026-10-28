import { Script, Vec3, Color, Ray, platform } from '../../../../../../playcanvas-stable.min.mjs';
import { SelectionService } from '../../../services/selectionService/selection-service.mjs';
import { ProductRegistry_V2 } from '../../product/registry/product-registry-v2.mjs';
import { SelectionOutlineController } from './selection-outline-controller.mjs';
import { createOutlineConfigurationForPlatform, DEFAULT_OUTLINE_CONFIGURATION } from './outline-configuration.mjs';
import { isTandemCountertopProduct, isCabinetCoverProduct, resolveBasinTopProduct } from '../../countertop/countertop-role.mjs';

function _define_property(obj, key, value) {
    if (key in obj) {
        Object.defineProperty(obj, key, {
            value: value,
            enumerable: true,
            configurable: true,
            writable: true
        });
    } else {
        obj[key] = value;
    }
    return obj;
}
const DIMENSION_ROOT_ENTITY_NAME = 'dim';
class SelectTool extends Script {
    initialize() {
        this.app.selectTool = this;
        this._outlineConfiguration = createOutlineConfigurationForPlatform(platform);
        this._outlineController = new SelectionOutlineController(this.app, {
            color: this._highlightColor,
            radius: this._outlineRadius,
            configuration: this._outlineConfiguration,
            isRenderableMeshInstance: (meshInstance)=>this._isRenderableMeshInstance(meshInstance),
            isInternalRenderProxy: (entity)=>this._isInternalRenderProxy(entity),
            isDimensionRenderNode: (entity)=>this._isDimensionRenderNode(entity),
            isSinkMountEntity: (entity)=>this._isSinkMountEntity(entity)
        });
        this._outlineController.initialize();
        this.service.on("select", this._onSelectionChanged, this);
        if (!this._cameraEntity) {
            this._cameraEntity = this.app.root.findByName("Camera") || this.app.root.findComponent("camera")?.entity;
        }
        if (this.app.mouse) {
            this.app.mouse.on("mousedown", this._onMouseDown, this);
        }
        if (this.app.touch) {
            this.app.touch.on("touchstart", this._onTouchStart, this);
        }
        this.app.fire("select-tool:ready", this);
        this._onPrerender = ()=>{
            this._outlineController?.frameUpdate(this._cameraEntity);
        };
        this.app.on("prerender", this._onPrerender, this);
        this.on("destroy", ()=>{
            if (this.app.mouse) this.app.mouse.off("mousedown", this._onMouseDown, this);
            if (this.app.touch) this.app.touch.off("touchstart", this._onTouchStart, this);
            if (this._onPrerender) this.app.off("prerender", this._onPrerender, this);
            this.service.deselectAll();
            this.service.off("select", this._onSelectionChanged, this);
            this._outlineController?.destroy();
            this._outlineController = null;
            if (this.app.selection === this.service) this.app.selection = null;
            if (this.app.selectTool === this) this.app.selectTool = null;
            this.app.fire("select-tool:destroyed", this);
        });
    }
    // --- Attributes ---
    /**
   * Backward-compatible access for existing scene-manager and bridge plugins.
   * New outline code should use the controller through SelectTool's public API.
   */ get outlineRenderer() {
        return this._outlineController?.renderer || null;
    }
    /**
   * @attribute
   * @title Camera Entity
   * @type {Entity}
   */ get cameraEntity() {
        return this._cameraEntity;
    }
    set cameraEntity(value) {
        this._cameraEntity = value;
    }
    /**
   * @attribute
   * @title Highlight Color
   * @type {Color}
   * @default [1, 1, 0, 1]
   */ get highlightColor() {
        return this._highlightColor;
    }
    set highlightColor(value) {
        this._highlightColor = value;
        this._outlineController?.setColor(value, this.service.getSelection());
    }
    /**
   * @attribute
   * @title Outline Radius
   * @type {number}
   * @default 4
   * @range [1, 10]
   * @precision 0
   */ get outlineRadius() {
        return this._outlineRadius;
    }
    set outlineRadius(value) {
        this._outlineRadius = Math.round(value);
        this._outlineController?.setRadius(this._outlineRadius);
    }
    resetOutlineDefaults() {
        this.outlineRadius = 1;
    }
    // --- Selection ---
    setSelectionMode(mode) {
        this.service.setMode(mode);
    }
    getSelectionMode() {
        return this.service.getMode();
    }
    getSelected() {
        return this.service.getSelection();
    }
    getSelectionInfo() {
        this._lastSelectionInfo = this.service.getSelection().map((entity)=>this._buildSelectionInfo(entity)).filter(Boolean);
        return this._lastSelectionInfo.map((info)=>({
                ...info,
                actions: info.actions?.map((action)=>({
                        ...action
                    })) || []
            }));
    }
    setSelectedByName(names, options) {
        const nameList = Array.isArray(names) ? names : names ? [
            names
        ] : [];
        const entities = [];
        nameList.forEach((name)=>{
            const found = this.app.root.findByName(name);
            if (found && found.enabled) entities.push(found);
        });
        this.service.select(entities, options);
    }
    setSelected(entities, options) {
        this.service.select(entities, options);
    }
    deselectAll() {
        this.service.deselectAll();
    }
    /**
   * Enable lightweight outline diagnostics without changing outline behavior.
   * It can also be enabled before boot using ?outlineDiag=1 or
   * localStorage.outlineDiag = "1".
   */ setOutlineDiagnosticsEnabled(enabled = true) {
        return this._outlineController?.setDiagnosticsEnabled(enabled) || false;
    }
    getOutlineDiagnostics() {
        return this._outlineController?.getDiagnostics() || [];
    }
    clearOutlineDiagnostics() {
        this._outlineController?.clearDiagnostics();
    }
    getOutlineConfiguration() {
        return this._outlineController?.getConfiguration() || {
            ...this._outlineConfiguration || DEFAULT_OUTLINE_CONFIGURATION,
            radius: this._outlineRadius,
            effectiveRadius: Math.max(1, Math.round(this._outlineRadius * (this._outlineConfiguration || DEFAULT_OUTLINE_CONFIGURATION).resolutionScale)),
            upscaledRadius: this._outlineRadius
        };
    }
    getOutlineRuntimeState() {
        return this._outlineController?.getRuntimeState() || null;
    }
    setOutlineResolutionScale(value) {
        return this._outlineController?.setResolutionScale(value) ?? (this._outlineConfiguration || DEFAULT_OUTLINE_CONFIGURATION).resolutionScale;
    }
    /**
   * Refresh outline for all selected entities.
   * Call this after mesh instances have been rebuilt (e.g. SmartStretch, setConfig).
   */ refreshOutline() {
        this._outlineController?.refresh(this.service.getSelection());
    }
    /**
   * Scoped semantic state seam for domain adapters. The existing selection
   * outline controller remains the only renderer/resource owner.
   */ setEntitySemanticState(entity, state) {
        return this._outlineController?.setEntitySemanticState(entity, state) ?? null;
    }
    clearEntitySemanticState(entity) {
        return this._outlineController?.clearEntitySemanticState(entity) || false;
    }
    clearOutline() {
        this._outlineController?.clear();
        this.app.fire("selection:outline-cleared");
    }
    _onSelectionChanged(allSelected, added, removed) {
        this._outlineController?.updateSelection(allSelected, added, removed);
        const selectionInfo = this.getSelectionInfo();
        this.fire("select", allSelected, selectionInfo);
        this.app.fire("selection:change", allSelected, selectionInfo);
    }
    _isRenderableMeshInstance(meshInstance) {
        return Boolean(meshInstance && meshInstance.mesh && meshInstance.node && meshInstance.material);
    }
    _onMouseDown(e) {
        if (e.button === 0) {
            // Let the shared spatial-manipulation input router reserve its candidate before
            // selection mutates, regardless of PlayCanvas listener registration order.
            this.app.spatialManipulationInput?.handleMouseDown?.(e);
            if (this._isSelectionBlockedByManipulation()) return;
            this._triggerSelection(e.x, e.y, e);
        }
    }
    _onTouchStart(e) {
        if (e.touches.length === 1) {
            // The spatial-manipulation router reserves a touch candidate before selection.
            this.app.spatialManipulationInput?.handleTouchStart?.(e);
            if (this.app.spatialManipulationInput?.blocksSelection?.()) return;
            this._triggerSelection(e.touches[0].x, e.touches[0].y, null);
        }
    }
    /**
   * Manipulation arbitration seam: a spatial-manipulation owner blocks selection (spec AC-23).
   */ _isSelectionBlockedByManipulation() {
        return Boolean(this.app.spatialManipulationInput?.blocksSelection?.());
    }
    _triggerSelection(x, y, event) {
        const pickedTarget = this.getSelectionTargetAt(x, y);
        if (pickedTarget) {
            this._selectEntity(pickedTarget, event);
        } else {
            const isModifierPressed = event && (event.ctrlKey || event.metaKey || event.shiftKey);
            if (!isModifierPressed) {
                this.service.deselectAll();
            }
        }
    }
    /** Read-only picking seam used by gesture candidates before selection. */ getSelectionTargetAt(x, y) {
        if (!this._cameraEntity || !this._cameraEntity.camera) return null;
        const camera = this._cameraEntity.camera;
        camera.screenToWorld(x, y, camera.farClip, this._ray.direction);
        this._ray.origin.copy(camera.entity.getPosition());
        this._ray.direction.sub(this._ray.origin).normalize();
        const pickedSinkHit = this._getNearestSinkBasinHit(this._ray);
        const pickedMeshHit = this._getNearestMeshInstanceHit(this._ray);
        const pickedMeshTarget = pickedMeshHit ? this._resolveMeshInstanceSelectionTarget(pickedMeshHit.meshInstance) : null;
        const pickedSinkTarget = pickedSinkHit ? this._resolveSinkClickTarget(pickedSinkHit.entity, pickedSinkHit.meshInstance?.node) : null;
        return pickedSinkTarget && this._shouldUseSinkHit(pickedSinkHit, pickedMeshHit, pickedMeshTarget, this._ray) ? pickedSinkTarget : pickedMeshTarget;
    }
    _selectEntity(entity, event) {
        let opMode = "replace";
        const currentMode = this.service.getMode();
        const currentSelection = this.service.getSelection();
        if (currentMode === "multi" && event) {
            if (event.ctrlKey || event.metaKey) {
                opMode = "toggle";
            } else if (event.shiftKey) {
                opMode = "add";
            }
        } else if (currentMode === "single" && currentSelection.length === 1 && currentSelection[0] === entity) {
            // A repeated click is an explicit deselect. Countertop drag candidates
            // reserve selection before this method, so starting a drag on an already
            // selected countertop is not toggled off here.
            opMode = "toggle";
        }
        this.service.select(entity, {
            mode: opMode
        });
    }
    _findRootEntity(node) {
        let current = node;
        // В режимі Divider View зупиняємось на рівні drawer (_Point),
        // а не піднімаємось до кабінету
        const drawerView = this.app.drawerViewService;
        if (drawerView && drawerView.isTopViewActive()) {
            while(current.parent && !this._isRootNode(current.parent)){
                if (this._isDrawerPoint(current)) return current;
                current = current.parent;
            }
            return current;
        }
        while(current.parent && !this._isRootNode(current.parent)){
            current = current.parent;
        }
        return current;
    }
    _isRootNode(node) {
        return node === this.app.root || node?.name === "Root";
    }
    /**
   * Перевіряє чи entity є drawer point (TopDrawer_Point / BotDrawer_Point).
   * @param {Entity} node
   * @returns {boolean}
   */ _isDrawerPoint(node) {
        const name = node?.name;
        return name === 'TopDrawer_Point' || name === 'BotDrawer_Point';
    }
    /**
   * Перевіряє чи node є sink mesh (має tag basin_sink або є нащадком collection sink mount).
   */ _isSinkMesh(node) {
        if (node.tags?.has('basin_sink')) return true;
        let current = node;
        while(current){
            if (this._isSinkMountEntity(current)) return true;
            current = current.parent;
        }
        return false;
    }
    /**
   * Returns the sub-product root for any basin under a collection sink mount.
   */ _findSinkBasinEntity(node) {
        return this._findSinkPointChild(node);
    }
    _findSinkPointChild(node) {
        let current = node;
        while(current?.parent){
            if (this._isSinkMountEntity(current.parent)) return current;
            current = current.parent;
        }
        return null;
    }
    _getNearestSinkBasinEntity(ray) {
        return this._getNearestSinkBasinHit(ray)?.entity || null;
    }
    _getNearestSinkBasinHit(ray) {
        let closestSurfaceDist = Infinity;
        let closestSurfaceHit = null;
        let closestProxyDist = Infinity;
        let closestProxyHit = null;
        const hitPoint = new Vec3();
        const sinkPoints = this.app.root.find((entity)=>this._isSinkMountEntity(entity));
        sinkPoints.forEach((sinkPoint)=>{
            if (!sinkPoint.enabled || sinkPoint.children.length === 0) return;
            const sinkEntity = sinkPoint.children[0];
            if (!sinkEntity.enabled) return;
            const meshInstances = this._collectEnabledMeshInstances(sinkEntity);
            meshInstances.forEach((meshInstance)=>{
                if (!this._isRenderableMeshInstance(meshInstance) || !meshInstance.visible || !meshInstance.aabb) return;
                if (meshInstance.aabb.intersectsRay(ray, hitPoint)) {
                    const dist = hitPoint.distance(ray.origin);
                    const hit = {
                        entity: sinkEntity,
                        meshInstance,
                        distance: dist
                    };
                    if (this._isExplicitSinkSurfaceHit(meshInstance.node, sinkEntity)) {
                        if (dist < closestSurfaceDist) {
                            closestSurfaceDist = dist;
                            closestSurfaceHit = hit;
                        }
                    } else if (dist < closestProxyDist) {
                        closestProxyDist = dist;
                        closestProxyHit = hit;
                    }
                }
            });
        });
        return closestSurfaceHit || closestProxyHit;
    }
    _isSinkMountEntity(entity) {
        return ProductRegistry_V2.instance.isSinkAnchorName(entity?.name);
    }
    _resolveSinkClickTarget(sinkBasin, hitNode = null) {
        if (!sinkBasin || !sinkBasin.enabled) return null;
        const sinkType = this._detectSinkType(sinkBasin);
        if (this._isVisibleVesselSinkType(sinkType)) return sinkBasin;
        if (this._isExplicitSinkSurfaceHit(hitNode, sinkBasin)) return sinkBasin;
        // Integrated/top sinks are only a click proxy for the countertop.
        const countertop = this._findCountertopEntity();
        if (countertop && countertop.enabled) return countertop;
        return null;
    }
    _resolveMeshInstanceSelectionTarget(meshInstance) {
        if (!meshInstance) return null;
        let rootEntity = this._findRootEntity(meshInstance.node);
        if (!rootEntity || !rootEntity.enabled) return null;
        if (this._isDerivedCoverEntity(rootEntity)) return null;
        // A tandem top is derived from the basin top (countertop/tandem/): like a cover, it is not selected itself.
        if (isTandemCountertopProduct(this._getCompositionProductConfig(rootEntity.name))) return null;
        // Vessel sinks remain separately selectable; integrated/top sinks resolve to countertop actions.
        // Without countertop resolution, fall through to normal mesh/root selection.
        if (this._isSinkMesh(meshInstance.node)) {
            const sinkBasin = this._findSinkBasinEntity(meshInstance.node);
            const sinkTarget = this._resolveSinkClickTarget(sinkBasin, meshInstance.node);
            if (sinkTarget && sinkTarget.enabled) return sinkTarget;
            const countertop = this._findCountertopEntity();
            if (countertop && countertop.enabled) return countertop;
        }
        return rootEntity;
    }
    _shouldUseSinkHit(sinkHit, meshHit, meshTarget, ray) {
        if (!sinkHit) return false;
        if (!meshHit || !meshTarget) return true;
        const sinkTarget = this._resolveSinkClickTarget(sinkHit.entity, sinkHit.meshInstance?.node);
        if (!sinkTarget) return false;
        if (sinkTarget === meshTarget) return true;
        if (this._isSameOrDescendant(meshHit.meshInstance?.node, sinkHit.entity)) return true;
        if (!this._isCountertopEntity(sinkTarget) && this._isCountertopEntity(meshTarget)) {
            return !this._hasCountertopTriangleHitBeforeSink(meshHit.meshInstance, ray, sinkHit.distance);
        }
        const tolerance = this._getSinkOcclusionTolerance(meshTarget, sinkTarget);
        return sinkHit.distance <= meshHit.distance + tolerance;
    }
    _hasCountertopTriangleHitBeforeSink(meshInstance, ray, sinkDistance) {
        const distance = this._getExactMeshRayDistance(meshInstance, ray, sinkDistance + 0.001);
        return distance !== null && distance <= sinkDistance + 0.001;
    }
    _getSinkOcclusionTolerance(meshTarget, sinkTarget) {
        if (sinkTarget && !this._isCountertopEntity(sinkTarget)) return 0.001;
        return this._isCountertopEntity(meshTarget) ? 0.03 : 0.001;
    }
    _isCountertopEntity(entity) {
        if (!entity) return false;
        const basin = this._resolveActiveBasinTop();
        return basin?.productId === entity.name && entity.parent === this.app?.root;
    }
    _isDerivedCoverEntity(entity) {
        return isCabinetCoverProduct(this._getCompositionProductConfig(entity?.name));
    }
    _isSameOrDescendant(node, ancestor) {
        let current = node;
        while(current){
            if (current === ancestor) return true;
            current = current.parent;
        }
        return false;
    }
    _isExplicitSinkSurfaceHit(hitNode, sinkBasin) {
        let current = hitNode;
        while(current && current !== sinkBasin.parent){
            if (current !== sinkBasin && /^Sink_/i.test(current.name || '')) return true;
            current = current.parent;
        }
        return false;
    }
    _getExactMeshRayDistance(meshInstance, ray, maxDistance = Infinity) {
        const mesh = meshInstance?.mesh;
        const node = meshInstance?.node;
        if (!mesh || !node || !ray) return null;
        const positions = [];
        try {
            mesh.getPositions(positions);
        } catch (error) {
            return null;
        }
        if (positions.length < 9) return null;
        const indices = [];
        try {
            mesh.getIndices(indices);
        } catch (error) {
        // Non-indexed meshes are handled by reading positions sequentially.
        }
        const hasIndices = indices.length >= 3;
        const triangleCount = hasIndices ? Math.floor(indices.length / 3) : Math.floor(positions.length / 9);
        if (triangleCount === 0) return null;
        const transform = node.getWorldTransform();
        const local = new Vec3();
        const v0 = new Vec3();
        const v1 = new Vec3();
        const v2 = new Vec3();
        const edge1 = new Vec3();
        const edge2 = new Vec3();
        const pvec = new Vec3();
        const tvec = new Vec3();
        const qvec = new Vec3();
        let closest = maxDistance;
        const setWorldVertex = (vertexIndex, out)=>{
            const offset = vertexIndex * 3;
            local.set(positions[offset], positions[offset + 1], positions[offset + 2]);
            transform.transformPoint(local, out);
        };
        for(let i = 0; i < triangleCount; i++){
            const base = i * 3;
            const i0 = hasIndices ? indices[base] : base;
            const i1 = hasIndices ? indices[base + 1] : base + 1;
            const i2 = hasIndices ? indices[base + 2] : base + 2;
            setWorldVertex(i0, v0);
            setWorldVertex(i1, v1);
            setWorldVertex(i2, v2);
            const distance = this._intersectRayTriangleDistance(ray, v0, v1, v2, edge1, edge2, pvec, tvec, qvec);
            if (distance !== null && distance < closest) {
                closest = distance;
            }
        }
        return closest < maxDistance ? closest : null;
    }
    _intersectRayTriangleDistance(ray, v0, v1, v2, edge1, edge2, pvec, tvec, qvec) {
        const epsilon = 1e-7;
        edge1.sub2(v1, v0);
        edge2.sub2(v2, v0);
        pvec.cross(ray.direction, edge2);
        const det = edge1.dot(pvec);
        if (Math.abs(det) < epsilon) return null;
        const invDet = 1 / det;
        tvec.sub2(ray.origin, v0);
        const u = tvec.dot(pvec) * invDet;
        if (u < 0 || u > 1) return null;
        qvec.cross(tvec, edge1);
        const v = ray.direction.dot(qvec) * invDet;
        if (v < 0 || u + v > 1) return null;
        const distance = edge2.dot(qvec) * invDet;
        return distance >= 0 ? distance : null;
    }
    _collectEnabledMeshInstances(entity) {
        const meshInstances = [];
        const collect = (node)=>{
            if (!node || !node.enabled) return;
            if (this._isInternalRenderProxy(node)) return;
            if (node.render?.meshInstances) meshInstances.push(...node.render.meshInstances.filter((mi)=>this._isRenderableMeshInstance(mi)));
            if (node.model?.meshInstances) meshInstances.push(...node.model.meshInstances.filter((mi)=>this._isRenderableMeshInstance(mi)));
            node.children.forEach(collect);
        };
        collect(entity);
        return meshInstances;
    }
    _isInternalRenderProxy(entity) {
        return !!entity?._ssaoLocalMaskProxy || !!entity?.render?._ssaoLocalMaskProxy || !!entity?._ssaoNormalPrepassProxy || !!entity?.render?._ssaoNormalPrepassProxy || this._isCountertopBooleanHelper(entity) || /^__ssao_(local_mask|normal_prepass)_proxy__/i.test(entity?.name || '');
    }
    _isCountertopBooleanHelper(entity) {
        const name = String(entity?.name || '');
        return name.includes('BoolB_') || name === 'Vessel_BoolCut' || name.startsWith('Vessel_BoolCut_Clone_');
    }
    _isDimensionRenderNode(entity) {
        let current = entity;
        while(current){
            if (current.name === DIMENSION_ROOT_ENTITY_NAME && current.parent === this.app.root) return true;
            current = current.parent;
        }
        return false;
    }
    _detectSinkType(entity) {
        const sinkEntity = this._findSinkPointChild(entity);
        if (!sinkEntity) return null;
        const productRoot = this._findProductRootEntity(sinkEntity);
        const productConfig = this._getCompositionProductConfig(productRoot?.name);
        const configuredSinkType = productConfig?.sinkType;
        if (typeof configuredSinkType === 'string' && configuredSinkType) return configuredSinkType;
        return ProductRegistry_V2.instance.detectProductType(sinkEntity.name || '');
    }
    _isVisibleVesselSinkType(sinkType) {
        return typeof sinkType === 'string' && sinkType.startsWith('Vessel_');
    }
    _buildSelectionInfo(entity) {
        if (this._isDerivedCoverEntity(entity)) {
            return {
                entityName: entity.name,
                selectionType: 'derived-cover',
                productId: entity.name,
                productType: 'Cabinet_Cover',
                actions: []
            };
        }
        const sinkInfo = this._buildSinkBasinSelectionInfo(entity);
        if (sinkInfo) return sinkInfo;
        if (this._isCountertopEntity(entity)) {
            const countertopState = this.app.compositionManager?.countertopCompositionAdapter?.getState?.();
            const binding = this.app.compositionManager?.countertopCompositionAdapter?.binding;
            const isActiveCountertop = countertopState?.readiness === 'ready' && (binding?.assembly?.countertop?.root === entity || countertopState.productId === entity.name);
            // Resizing is offered only while the countertop is moved off its composition.
            return {
                entityName: entity.name,
                selectionType: 'countertop',
                productId: entity.name,
                productType: 'Top_Solid',
                actions: isActiveCountertop && countertopState.canResize ? [
                    {
                        id: 'edit-size',
                        label: 'Edit size',
                        target: 'countertop',
                        status: 'ready'
                    }
                ] : []
            };
        }
        const productType = ProductRegistry_V2.instance.detectProductType(entity.name);
        const productConfig = this._getCompositionProductConfig(entity.name);
        return {
            entityName: entity.name,
            selectionType: 'product',
            productId: entity.name,
            productType,
            actions: this._buildProductSelectionActions(entity, productType, productConfig)
        };
    }
    _buildSinkBasinSelectionInfo(entity) {
        const sinkType = this._detectSinkType(entity);
        if (!sinkType) return null;
        const productRoot = this._findProductRootEntity(entity);
        const productId = productRoot?.name || null;
        const productConfig = this._getCompositionProductConfig(productId);
        const resolvedSinkType = productConfig?.sinkType || sinkType;
        const isVessel = this._isVisibleVesselSinkType(resolvedSinkType);
        return {
            entityName: entity.name,
            selectionType: isVessel ? 'vessel-basin' : 'sink-basin',
            displayName: isVessel ? 'Vessel Basin' : 'Sink Basin',
            productId,
            productType: productConfig?.productType || ProductRegistry_V2.instance.detectProductType(productId || ''),
            sinkType: resolvedSinkType,
            isVessel,
            colorConfigKey: isVessel ? 'VesselColor' : null,
            actions: isVessel ? [
                {
                    id: 'color',
                    label: 'Color',
                    configKey: 'VesselColor',
                    productId
                },
                {
                    id: 'delete',
                    label: 'Delete',
                    method: 'setConfig',
                    productId,
                    config: {
                        sinkType: 'Vessel',
                        VesselColor: ''
                    }
                }
            ] : []
        };
    }
    _buildProductSelectionActions(entity, productType, productConfig) {
        const openAction = this._buildDrawerOpenAction(entity, productType, productConfig);
        return openAction ? [
            openAction
        ] : [];
    }
    _buildDrawerOpenAction(entity, productType, productConfig) {
        if (!entity || !productConfig) return null;
        const registryConfig = ProductRegistry_V2.instance.getProductConfig(productType);
        const category = productConfig.category || registryConfig?.category;
        if (category !== 'cabinets') return null;
        const drawerType = this._getSingleDrawerOpenType(productConfig);
        if (!drawerType) return null;
        const pointName = drawerType === 'Bot' ? 'BotDrawer_Point' : 'TopDrawer_Point';
        const drawerPoint = entity.findByName?.(pointName);
        if (!this._isEnabledInHierarchy(drawerPoint, entity)) return null;
        return {
            id: 'open',
            label: 'Open',
            method: 'openDrawer',
            productId: entity.name,
            productType,
            drawerType
        };
    }
    _getSingleDrawerOpenType(productConfig) {
        const drawers = String(productConfig.Drawers || '').trim().toUpperCase();
        switch(drawers){
            case '1D':
            case '1':
                return 'Bot';
            case '1DWID':
            case '1+INNER':
                return 'Bot';
            default:
                return null;
        }
    }
    _isEnabledInHierarchy(entity, stopAt = null) {
        if (!entity) return false;
        let current = entity;
        while(current){
            if (!current.enabled) return false;
            if (current === stopAt) return true;
            current = current.parent;
        }
        return true;
    }
    _findProductRootEntity(node) {
        let current = node;
        while(current?.parent && !this._isRootNode(current.parent)){
            current = current.parent;
        }
        return current || null;
    }
    _getCompositionProductConfig(productId) {
        if (!productId) return null;
        const composition = this.app.compositionManager?.getActiveComposition?.();
        return composition?.getProduct?.(productId) || null;
    }
    _resolveActiveBasinTop() {
        const composition = this.app?.compositionManager?.getActiveComposition?.();
        if (!composition) return null;
        const resolution = resolveBasinTopProduct(composition.getAllProducts?.());
        return resolution.status === 'found' ? resolution : null;
    }
    /** Resolve the active composition's unique basin root, never the first top in scene order. */ _findCountertopEntity() {
        const basin = this._resolveActiveBasinTop();
        if (!basin) return null;
        return (this.app?.root?.children ?? []).find((child)=>child.name === basin.productId) ?? null;
    }
    _getNearestMeshInstance(ray) {
        return this._getNearestMeshInstanceHit(ray)?.meshInstance || null;
    }
    _getNearestMeshInstanceHit(ray) {
        let closestDist = Infinity;
        let closestHit = null;
        const layerList = this.app.scene.layers.layerList;
        const hitPoint = new Vec3();
        for(let i = 0; i < layerList.length; i++){
            const layer = layerList[i];
            if (layer.name === "Skybox" || layer.name === "UI" || layer.name === "Outline" || layer.name === "SSAO Normal Prepass") continue;
            const meshInstances = layer.meshInstances;
            for(let j = 0; j < meshInstances.length; j++){
                const mi = meshInstances[j];
                if (!this._isRenderableMeshInstance(mi)) continue;
                if (this._isInternalRenderProxy(mi?.node)) continue;
                if (this._isDimensionRenderNode(mi?.node)) continue;
                if (!mi.visible || !mi.aabb) continue;
                const intersect = mi.aabb.intersectsRay(ray, hitPoint);
                if (intersect) {
                    const dist = hitPoint.distance(ray.origin);
                    if (dist < closestDist) {
                        closestDist = dist;
                        closestHit = {
                            meshInstance: mi,
                            distance: dist
                        };
                    }
                }
            }
        }
        return closestHit;
    }
    constructor(...args){
        super(...args), _define_property(this, "_cameraEntity", null), _define_property(this, "_highlightColor", new Color(1, 1, 0, 1)), _define_property(this, "_outlineRadius", DEFAULT_OUTLINE_CONFIGURATION.radius), _define_property(this, "_ray", new Ray()), _define_property(this, "service", new SelectionService()), _define_property(this, "_outlineController", null), _define_property(this, "_outlineConfiguration", null), _define_property(this, "_lastSelectionInfo", []);
    }
}
_define_property(SelectTool, "scriptName", "selectTool");

export { SelectTool };
