import { LoggerService } from '../logger/logger-service.mjs';
import { CameraStore } from './camera-store.mjs';
import { CameraService } from './camera-service.mjs';
import { CameraFramingService } from '../cameraFraming/camera-framing-service.mjs';

/**
 * Головний контролер камери
 * Координує роботу між manual zoom та auto-framing
 */ class CameraController {
    /**
   * Ініціалізація
   */ initialize() {
        this.manualService.initialize();
    }
    /**
   * Manual Zoom In
   */ zoomIn(step) {
        const result = this.manualService.zoomIn(step);
        if (result !== null) {
            this.store.setDistance(result, 'manual');
        }
        return result;
    }
    /**
   * Manual Zoom Out
   */ zoomOut(step) {
        const result = this.manualService.zoomOut(step);
        if (result !== null) {
            this.store.setDistance(result, 'manual');
        }
        return result;
    }
    /**
   * Встановити конкретну відстань (manual)
   */ setZoom(distance) {
        const result = this.manualService.setZoom(distance);
        if (result !== null) {
            this.store.setDistance(result, 'manual');
        }
        return result;
    }
    /**
   * Auto-framing на entities
   * Враховує, чи був недавній manual zoom
   */ focusOnEntities(entities, cameraEntity, options = {}) {
        const force = options.force || false;
        // Перевірка: auto-framing вимкнений глобально
        if (!force && !this._autoFramingEnabled) {
            LoggerService.log(this, '[CameraController] Auto-framing disabled');
            return false;
        }
        // Перевірка: чи можна виконати auto-framing (cooldown після manual zoom)?
        if (!force && !this.store.canAutoFrame()) {
            LoggerService.log(this, '[CameraController] Auto-framing skipped (recent manual zoom)');
            return false;
        }
        // Виконуємо framing
        const result = this.framingService.focusOnEntities(entities, cameraEntity);
        if (result) {
            // Оновлюємо стор з результатами framing
            const info = this.manualService.getCameraInfo();
            if (info) {
                this.store.setDistance(info.distance, 'auto-frame');
                if (info.pivotPoint) {
                    this.store.setPivotPoint(info.pivotPoint);
                }
            }
        }
        return result;
    }
    /**
   * Отримати поточний zoom
   * Завжди бере значення безпосередньо з камери
   */ getZoom() {
        return this.manualService.getZoom();
    }
    /**
   * Встановити крок зуму
   */ setZoomStep(step) {
        const result = this.store.setZoomStep(step);
        this.manualService.setZoomStep(result);
        return result;
    }
    /**
   * Отримати крок зуму
   */ getZoomStep() {
        return this.store.getState().zoomStep;
    }
    /**
   * Отримати повну інформацію про камеру
   */ getCameraInfo() {
        const info = this.manualService.getCameraInfo();
        const state = this.store.getState();
        return {
            ...info,
            // Додаємо дані зі стору
            isManualControl: state.isManualControl,
            canAutoFrame: this.store.canAutoFrame(),
            lastManualZoomTime: state.lastManualZoomTime,
            lastAutoFrameTime: state.lastAutoFrameTime
        };
    }
    /**
   * Отримати entity камери
   * @returns {object|null}
   */ getCameraEntity() {
        return this.manualService.getCameraEntity();
    }
    /**
   * Фокус на entity або сцену
   */ focus(entity) {
        this.manualService.focus(entity);
        // Оновлюємо стор
        const info = this.manualService.getCameraInfo();
        if (info) {
            this.store.setDistance(info.distance, 'focus');
            if (info.pivotPoint) {
                this.store.setPivotPoint(info.pivotPoint);
            }
        }
    }
    /**
   * Reset камери
   */ reset(yaw, pitch, distance) {
        this.manualService.reset(yaw, pitch, distance);
        // Оновлюємо стор
        this.store.updateState({
            distance,
            pitch,
            yaw,
            isManualControl: false
        });
    }
    /**
   * Конфігурація framing service
   * @param {object} config
   * @param {number} [config.paddingWide] - Множник відстані для широких сцен (default: 1.2)
   * @param {number} [config.paddingTall] - Множник відстані для вузьких сцен (default: 1.6)
   * @param {number} [config.minDistance] - Мінімальна відстань камери
   * @param {number} [config.maxDistance] - Максимальна відстань камери
   */ configureFraming(config) {
        this.framingService.configure(config);
        LoggerService.log(this, '[CameraController] Framing config updated', config);
    }
    /**
   * Отримати поточну конфігурацію framing
   * @returns {object} { paddingWide, paddingTall, minDistance, maxDistance, autoFramingEnabled }
   */ getFramingConfig() {
        return {
            ...this.framingService.config,
            autoFramingEnabled: this._autoFramingEnabled
        };
    }
    /**
   * Увімкнути/вимкнути auto-framing при addProduct/removeProduct/preset
   * @param {boolean} enabled
   */ setAutoFraming(enabled) {
        this._autoFramingEnabled = enabled;
        LoggerService.log(this, `[CameraController] Auto-framing ${enabled ? 'enabled' : 'disabled'}`);
    }
    /**
   * Встановити ліміти зуму (синхронізує store, framing service та orbitCamera)
   * @param {number} min - Мінімальна відстань
   * @param {number} max - Максимальна відстань
   */ setZoomLimits(min, max) {
        // 1. Store
        this.store.setDistanceLimits(min, max);
        // 2. Framing service
        this.framingService.configure({
            minDistance: min,
            maxDistance: max
        });
        // 3. OrbitCamera (PlayCanvas)
        this.manualService.setDistanceLimits(min, max);
        LoggerService.log(this, `[CameraController] Zoom limits set: ${min} - ${max}`);
    }
    /**
   * Увімкнути/вимкнути debug mode для framing
   */ setFramingDebug(enabled) {
        this.framingService.configure({
            debug: enabled
        });
    }
    /**
   * Експорт стану для збереження
   */ exportState() {
        return this.store.export();
    }
    /**
   * Імпорт збереженого стану
   */ importState(savedState) {
        this.store.import(savedState);
        // Застосовуємо до камери
        if (savedState.distance !== undefined) {
            this.manualService.setZoom(savedState.distance);
        }
        if (savedState.pitch !== undefined && savedState.yaw !== undefined && savedState.distance !== undefined) {
            this.manualService.reset(savedState.yaw, savedState.pitch, savedState.distance);
        }
    }
    /**
   * Обробник змін стану
   * @private
   */ _onStateChange(newState, oldState) {
        // Можна додати додаткову логіку при змінах стану
        // Наприклад, автоматичне збереження в localStorage
        if (newState.distance !== oldState.distance) {
            LoggerService.log(this, `[CameraController] Distance changed: ${oldState.distance?.toFixed(2)} -> ${newState.distance?.toFixed(2)}`);
        }
    }
    /**
   * Скинути cooldown manual control (для тестування)
   */ resetManualCooldown() {
        this.store.updateState({
            lastManualZoomTime: 0
        });
    }
    /**
   * Встановити позицію камери з об'єкта getCameraInfo()
   * @param {object} cameraInfo - Об'єкт з інформацією про камеру
   * @param {number} [cameraInfo.distance] - Відстань камери
   * @param {number} [cameraInfo.pitch] - Pitch angle
   * @param {number} [cameraInfo.yaw] - Yaw angle
   * @param {object} [cameraInfo.pivotPoint] - Точка обертання {x, y, z}
   * @param {object} [options] - Додаткові опції
   * @param {boolean} [options.immediate] - Застосувати без інерції (миттєво)
   * @returns {boolean} Успішність встановлення
   */ setCameraPosition(cameraInfo, options = {}) {
        if (!cameraInfo || typeof cameraInfo !== 'object') {
            LoggerService.error(this, '[CameraController] Invalid cameraInfo object');
            return false;
        }
        const orbitCamera = this.manualService._orbitCamera;
        if (!orbitCamera) {
            LoggerService.error(this, '[CameraController] OrbitCamera not initialized');
            return false;
        }
        try {
            // Для immediate — вимикаємо інерцію перед зміною
            let oldInertia;
            if (options.immediate) {
                this._clearInertiaTimer();
                oldInertia = orbitCamera.inertiaFactor;
                orbitCamera.inertiaFactor = 0;
            }
            // Встановлюємо distance
            if (cameraInfo.distance !== undefined) {
                orbitCamera.distance = cameraInfo.distance;
            }
            // Встановлюємо pitch
            if (cameraInfo.pitch !== undefined) {
                orbitCamera.pitch = cameraInfo.pitch;
            }
            // Встановлюємо yaw
            if (cameraInfo.yaw !== undefined) {
                orbitCamera.yaw = cameraInfo.yaw;
            }
            // Встановлюємо pivotPoint
            if (cameraInfo.pivotPoint) {
                const { x, y, z } = cameraInfo.pivotPoint;
                if (x !== undefined) orbitCamera.pivotPoint.x = x;
                if (y !== undefined) orbitCamera.pivotPoint.y = y;
                if (z !== undefined) orbitCamera.pivotPoint.z = z;
            }
            // Для immediate — примусовий update та відкладене відновлення інерції
            if (options.immediate) {
                if (orbitCamera.update) orbitCamera.update(0);
                this._inertiaTimer = setTimeout(()=>{
                    if (orbitCamera) orbitCamera.inertiaFactor = oldInertia;
                    this._inertiaTimer = null;
                }, 100);
            }
            // Оновлюємо стор
            this.store.updateState({
                distance: cameraInfo.distance,
                pitch: cameraInfo.pitch,
                yaw: cameraInfo.yaw,
                isManualControl: false
            });
            if (cameraInfo.pivotPoint) {
                this.store.setPivotPoint(cameraInfo.pivotPoint);
            }
            LoggerService.log(this, '[CameraController] Camera position set successfully');
            return true;
        } catch (error) {
            LoggerService.error(this, '[CameraController] Failed to set camera position:', error);
            return false;
        }
    }
    /**
   * Очистити таймер інерції
   * @private
   */ _clearInertiaTimer() {
        if (this._inertiaTimer) {
            clearTimeout(this._inertiaTimer);
            this._inertiaTimer = null;
        }
    }
    /**
   * Очистити ресурси контролера
   */ destroy() {
        this._clearInertiaTimer();
    }
    /**
   * @param {object} app - PlayCanvas app instance
   */ constructor(app){
        this.app = app;
        // Єдиний стор для всіх операцій з камерою
        this.store = new CameraStore();
        // Сервіси
        this.manualService = new CameraService(app, this.store);
        this.framingService = new CameraFramingService(app, this.store);
        // Конфігурація framing
        this.framingService.configure({
            paddingTall: 1.6,
            paddingWide: 1.2,
            minDistance: 1,
            maxDistance: 1000
        });
        // Підписка на зміни стору для синхронізації
        this.store.subscribe((newState, oldState)=>{
            this._onStateChange(newState, oldState);
        });
        // Auto-framing увімкнений за замовчуванням
        this._autoFramingEnabled = true;
        // Timer для відновлення інерції камери
        this._inertiaTimer = null;
        LoggerService.log(this, '[CameraController] Initialized with unified store');
    }
}

export { CameraController };
