import { LoggerService } from '../logger/logger-service.mjs';

/**
 * Camera Service для управління орбітальною камерою
 * Може працювати самостійно або через CameraStore для синхронізації
 */
export class CameraService {
    /**
     * @param {object} app - PlayCanvas app instance
     * @param {object} [store] - CameraStore для синхронізації (опціонально)
     */
    constructor(app, store = null) {
        this.app = app;
        this.store = store; // Опціональний стор для координації
        this._orbitCamera = null;
        this._defaultZoomStep = 0.2; // За замовчуванням крок зуму 0.2 одиниць
        this._minZoomStep = 0.05;
        this._maxZoomStep = 10;
    }

    /**
     * Ініціалізація сервісу - знаходить орбітальну камеру
     */
    initialize() {
        // Шукаємо entity з компонентом camera та скриптом orbitCamera
        const cameraEntity = this.app.root.findByName('Camera') || this._findOrbitCamera();

        if (cameraEntity && cameraEntity.script && cameraEntity.script.orbitCamera) {
            this._orbitCamera = cameraEntity.script.orbitCamera;

            LoggerService.log(this, '[CameraService] Orbit camera found and initialized');
        } else {
            LoggerService.warn(this, '[CameraService] Orbit camera not found');
        }
    }

    /**
     * Пошук камери з орбітальним скриптом
     * @private
     */
    _findOrbitCamera() {
        const cameras = this.app.root.findComponents('camera');
        for (const cam of cameras) {
            if (cam.entity.script && cam.entity.script.orbitCamera) {
                return cam.entity;
            }
        }
        return null;
    }

    /**
     * Перевірка доступності камери
     * @private
     */
    _checkCamera() {
        if (!this._orbitCamera) {
            LoggerService.error(this, '[CameraService] Orbit camera is not initialized');
            return false;
        }
        return true;
    }

    /**
     * Zoom In - наближення камери
     * @param {number} [step] - Крок зуму (опціонально)
     * @returns {number|null} Нова відстань або null якщо помилка
     */
    zoomIn(step) {
        if (!this._checkCamera()) return null;

        const zoomStep = step !== undefined ? step : this._defaultZoomStep;
        const currentDistance = this._orbitCamera.distance;
        const newDistance = Math.max(
            currentDistance - zoomStep,
            this._orbitCamera.distanceMin || 0
        );

        this._orbitCamera.distance = newDistance;
        LoggerService.log(this, `[CameraService] Zoom In: ${currentDistance.toFixed(2)} -> ${newDistance.toFixed(2)}`);

        return newDistance;
    }

    /**
     * Zoom Out - віддалення камери
     * @param {number} [step] - Крок зуму (опціонально)
     * @returns {number|null} Нова відстань або null якщо помилка
     */
    zoomOut(step) {
        if (!this._checkCamera()) return null;

        const zoomStep = step !== undefined ? step : this._defaultZoomStep;
        const currentDistance = this._orbitCamera.distance;
        const maxDistance = this._orbitCamera.distanceMax > 0
            ? this._orbitCamera.distanceMax
            : currentDistance + zoomStep * 2; // Якщо немає максимуму, додаємо подвійний крок

        const newDistance = Math.min(
            currentDistance + zoomStep,
            maxDistance
        );

        this._orbitCamera.distance = newDistance;
        LoggerService.log(this, `[CameraService] Zoom Out: ${currentDistance.toFixed(2)} -> ${newDistance.toFixed(2)}`);

        return newDistance;
    }

    /**
     * Встановити конкретну відстань камери
     * @param {number} distance - Бажана відстань
     * @returns {number|null} Встановлена відстань або null якщо помилка
     */
    setZoom(distance) {
        if (!this._checkCamera()) return null;

        const oldDistance = this._orbitCamera.distance;
        this._orbitCamera.distance = distance;
        const newDistance = this._orbitCamera.distance; // Може бути обмежена min/max

        LoggerService.log(this, `[CameraService] Set Zoom: ${oldDistance.toFixed(2)} -> ${newDistance.toFixed(2)}`);

        return newDistance;
    }

    /**
     * Отримати поточну відстань камери
     * @returns {number|null} Поточна відстань або null якщо помилка
     */
    getZoom() {
        if (!this._checkCamera()) return null;
        return this._orbitCamera.distance;
    }

    /**
     * Встановити крок зуму за замовчуванням
     * @param {number} step - Новий крок зуму
     */
    setZoomStep(step) {
        this._defaultZoomStep = Math.max(
            Math.min(step, this._maxZoomStep),
            this._minZoomStep
        );
        LoggerService.log(this, `[CameraService] Zoom step set to: ${this._defaultZoomStep}`);
    }

    /**
     * Отримати крок зуму за замовчуванням
     * @returns {number} Поточний крок зуму
     */
    getZoomStep() {
        return this._defaultZoomStep;
    }

    /**
     * Отримати інформацію про камеру
     * @returns {object|null} Об'єкт з інформацією про камеру
     */
    getCameraInfo() {
        if (!this._checkCamera()) return null;

        const info = {
            distance: this._orbitCamera.distance,
            distanceMin: this._orbitCamera.distanceMin,
            distanceMax: this._orbitCamera.distanceMax,
            pitch: this._orbitCamera.pitch,
            yaw: this._orbitCamera.yaw,
            zoomStep: this._defaultZoomStep
        };

        // Додаємо pivotPoint тільки якщо він ініціалізований
        if (this._orbitCamera.pivotPoint) {
            info.pivotPoint = {
                x: this._orbitCamera.pivotPoint.x,
                y: this._orbitCamera.pivotPoint.y,
                z: this._orbitCamera.pivotPoint.z
            };
        }

        return info;
    }

    /**
     * Отримати entity камери
     * @returns {object|null}
     */
    getCameraEntity() {
        return this._orbitCamera?.entity || null;
    }

    /**
     * Встановити ліміти відстані на orbitCamera
     * @param {number} min - Мінімальна відстань
     * @param {number} max - Максимальна відстань
     */
    setDistanceLimits(min, max) {
        if (!this._checkCamera()) return;

        this._orbitCamera.distanceMin = min;
        this._orbitCamera.distanceMax = max;
        LoggerService.log(this, `[CameraService] Distance limits set: ${min} - ${max}`);
    }

    /**
     * Reset камери до фокусу на entity або всю сцену
     * @param {object} [entity] - Entity для фокусування (опціонально)
     */
    focus(entity) {
        if (!this._checkCamera()) return;

        this._orbitCamera.focus(entity || this.app.root);
        LoggerService.log(this, '[CameraService] Camera focused');
    }

    /**
     * Reset камери до початкового стану
     * @param {number} yaw - Yaw angle
     * @param {number} pitch - Pitch angle
     * @param {number} distance - Distance
     */
    reset(yaw, pitch, distance) {
        if (!this._checkCamera()) return;

        this._orbitCamera.reset(yaw, pitch, distance);
        LoggerService.log(this, '[CameraService] Camera reset');
    }
}
