import { BoundingBox, Vec3, math } from '../../../../../playcanvas-stable.min.mjs';
import { LoggerService } from '../logger/logger-service.mjs';
import { SceneEntityHelper } from '../../helpers/scene-entity-helper.mjs';

class DrawerViewService {
    /**
     * Встановити сервіс анімації шухляд
     * @param {import('../drawer-animation/drawer-animation-service.mjs').DrawerAnimationService} animationService
     */ setAnimationService(animationService) {
        this._animationService = animationService;
    }
    /**
     * Підписка на зміну стану (для UI менеджера)
     * @param {Function} callback - (isActive, cabinetId, drawerType) => void
     */ subscribe(callback) {
        this._onStateChange = callback;
    }
    _notifyStateChange(cabinetId = null, drawerType = null) {
        if (this._onStateChange) {
            this._onStateChange(this._isActive, cabinetId, drawerType);
        }
    }
    async showTopView(cabinetId, drawerType) {
        const cabinet = this.app.root.findByName(cabinetId);
        if (!cabinet) {
            LoggerService.error(this, `❌ [DrawerView] Cabinet ${cabinetId} not found`);
            return;
        }
        const drawerPointName = drawerType === 'Top' || drawerType === 'TopFull' ? 'TopDrawer_Point' : 'BotDrawer_Point';
        const drawerPoint = cabinet.findByName(drawerPointName);
        if (!drawerPoint) {
            LoggerService.error(this, `❌ [DrawerView] ${drawerPointName} not found`);
            return;
        }
        if (this._isActive) {
            await this.exitTopView();
        }
        LoggerService.log(this, `🔭 [DrawerView] Focusing on ${cabinetId} -> ${drawerType}`);
        this._isolateDrawer(drawerPoint);
        this._setupCamera(drawerPoint);
        this._isActive = true;
        this._activeCabinetId = cabinetId;
        this._activeDrawerType = drawerType;
        this._activeDrawerEntity = drawerPoint;
        // Скидаємо outline при переході в Divider View
        if (this.app.selectTool) {
            this.app.selectTool.deselectAll();
        }
        // Уведомляем UI, что мы вошли в режим
        this._notifyStateChange(cabinetId, drawerType);
    }
    async exitTopView() {
        if (!this._isActive) return;
        this._activeCabinetId;
        this._activeDrawerType;
        // Відновлення видимості
        for(let i = this._restoreList.length - 1; i >= 0; i--){
            const record = this._restoreList[i];
            try {
                if (record.obj && (record.obj.destroy !== undefined || record.type === 'component')) {
                    if (record.obj.enabled !== undefined) {
                        record.obj.enabled = record.prevEnabled;
                    }
                }
            } catch (e) {
                LoggerService.warn(this, `⚠️ [DrawerView] Failed to restore object during exit: ${e.message}`);
            }
        }
        this._restoreList = [];
        // Відновлення камери
        if (this.app.sceneManager && typeof this.app.sceneManager.frameAllProducts === 'function') {
            this.app.sceneManager.frameAllProducts();
        } else if (this._savedCameraState) {
            this._restoreCamera();
        }
        this._restoreOrbitCameraLimits();
        this._savedCameraState = null;
        // Скидаємо outline при виході з Divider View
        if (this.app.selectTool) {
            this.app.selectTool.deselectAll();
        }
        this._isActive = false;
        this._activeCabinetId = null;
        this._activeDrawerType = null;
        this._activeDrawerEntity = null;
        LoggerService.log(this, `👋 [DrawerView] Exited top view`);
        this._notifyStateChange(null, null);
    }
    isTopViewActive() {
        return this._isActive;
    }
    getActiveCabinetId() {
        return this._activeCabinetId;
    }
    getActiveDrawerType() {
        return this._activeDrawerType;
    }
    // ================= PRIVATE METHODS =================
    _getOrbitCamera() {
        return this._cameraController?.manualService?._orbitCamera || null;
    }
    _isolateDrawer(targetEntity) {
        this._restoreList = [];
        const ancestors = new Set();
        let curr = targetEntity;
        while(curr){
            ancestors.add(curr.guid);
            curr = curr.parent;
        }
        const processNode = (node)=>{
            if (this._isProtectedViewNode(node)) {
                return;
            }
            if (node === targetEntity) {
                return;
            }
            if (ancestors.has(node.guid) || this._hasProtectedViewDescendant(node)) {
                if (node.name.includes('Divider_') && node.name.includes('_Generated') && node.render?.enabled === true) {
                    this._restoreList.push({
                        type: 'component',
                        obj: node.render,
                        prevEnabled: true
                    });
                    node.render.enabled = false;
                }
                if (node.render && node.render.enabled) {
                    this._restoreList.push({
                        type: 'component',
                        obj: node.render,
                        prevEnabled: true
                    });
                    node.render.enabled = false;
                }
                if (node.model && node.model.enabled) {
                    this._restoreList.push({
                        type: 'component',
                        obj: node.model,
                        prevEnabled: true
                    });
                    node.model.enabled = false;
                }
                node.children.forEach((child)=>processNode(child));
                return;
            }
            if (node.enabled) {
                this._restoreList.push({
                    type: 'entity',
                    obj: node,
                    prevEnabled: true
                });
                node.enabled = false;
            }
        };
        this.app.root.children.forEach((child)=>processNode(child));
        const result = SceneEntityHelper.collectByPredicate(targetEntity, (node)=>node.name.includes('Divider_') && node.name.includes('_Generated'));
        result.map((node)=>{
            // this._restoreList.push({ type: 'component', obj: node.render, prevEnabled: false });
            if (node.render) {
                node.render.enabled = true;
            }
        });
    }
    _isProtectedViewNode(node) {
        return Boolean(node?.camera || node?.light || this._safeList.some((name)=>node?.name?.includes(name)));
    }
    _hasProtectedViewDescendant(node) {
        return Boolean(node?.children?.some((child)=>this._isProtectedViewNode(child) || this._hasProtectedViewDescendant(child)));
    }
    _setupCamera(targetEntity) {
        if (!this._cameraController) return;
        // Зберігаємо поточний стан камери через контролер
        this._savedCameraState = this._cameraController.getCameraInfo();
        this._allowTopDownPitch();
        let boundsEntity = targetEntity;
        const walls = targetEntity.findByName('TopDrawerWalls') || targetEntity.findByName('BotDrawerWalls') || targetEntity.findByName('TopDrawerFloor');
        if (walls) boundsEntity = walls;
        const aabb = this._calculateAABB(boundsEntity);
        // Розраховуємо ідеальну відстань через camera component
        const cameraEntity = this._cameraController.getCameraEntity();
        const cameraComponent = cameraEntity?.camera;
        const distance = cameraComponent ? this._calculateIdealDistance(aabb, cameraComponent) : 2.0;
        // Застосовуємо top-down вигляд через контролер
        this._cameraController.setCameraPosition({
            pivotPoint: {
                x: aabb.center.x,
                y: aabb.center.y,
                z: aabb.center.z
            },
            pitch: -90,
            yaw: 0,
            distance
        }, {
            immediate: true
        });
    }
    _allowTopDownPitch() {
        const orbitCamera = this._getOrbitCamera();
        if (!orbitCamera) return;
        if (!this._savedOrbitCameraLimits) {
            this._savedOrbitCameraLimits = {
                pitchAngleMax: orbitCamera.pitchAngleMax
            };
        }
        if (Number(orbitCamera.pitchAngleMax) < 90) {
            orbitCamera.pitchAngleMax = 90;
        }
    }
    _restoreOrbitCameraLimits() {
        const orbitCamera = this._getOrbitCamera();
        if (!orbitCamera || !this._savedOrbitCameraLimits) return;
        orbitCamera.pitchAngleMax = this._savedOrbitCameraLimits.pitchAngleMax;
        this._savedOrbitCameraLimits = null;
    }
    _restoreCamera() {
        if (!this._cameraController || !this._savedCameraState) return;
        this._cameraController.setCameraPosition({
            pivotPoint: this._savedCameraState.pivotPoint,
            pitch: this._savedCameraState.pitch,
            yaw: this._savedCameraState.yaw,
            distance: this._savedCameraState.distance
        }, {
            immediate: true
        });
    }
    _calculateAABB(entity) {
        if (SceneEntityHelper && SceneEntityHelper.traverseAabb) {
            const box = SceneEntityHelper.traverseAabb(entity);
            if (box) return box;
        }
        return new BoundingBox(entity.getPosition(), new Vec3(0.3, 0.1, 0.3));
    }
    _calculateIdealDistance(aabb, cameraComponent) {
        const fov = (cameraComponent.fov || 45) * math.DEG_TO_RAD;
        const maxDim = Math.max(aabb.halfExtents.x, aabb.halfExtents.z);
        const padding = 1.2;
        let distance = maxDim / Math.tan(fov / 2);
        const aspect = cameraComponent.aspectRatio || window.innerWidth / window.innerHeight;
        if (aspect < 1) distance = distance / aspect;
        return distance * padding;
    }
    /**
     * @param {object} app - PlayCanvas app instance
     * @param {import('../camera/camera-controller.mjs').CameraController} cameraController
     */ constructor(app, cameraController){
        this.app = app;
        this._cameraController = cameraController;
        this._restoreList = [];
        this._savedCameraState = null;
        this._savedOrbitCameraLimits = null;
        this._isActive = false;
        this._activeCabinetId = null;
        this._activeDrawerType = null;
        this._activeDrawerEntity = null;
        this._safeList = [
            'Camera',
            'Directional Light',
            'Sun',
            'Environment',
            'SkyBox',
            'OrbitCamera'
        ];
        this._onStateChange = null;
        /** @type {import('../drawer-animation/drawer-animation-service.mjs').DrawerAnimationService|null} */ this._animationService = null;
    }
}

export { DrawerViewService };
