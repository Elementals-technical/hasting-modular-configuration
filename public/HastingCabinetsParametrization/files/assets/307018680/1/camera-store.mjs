import { LoggerService } from '../logger/logger-service.mjs';

/**
 * Єдиний стор для стану камери
 * Забезпечує консистентність між різними сервісами камери
 */
export class CameraStore {
  constructor() {
    this._state = {
      // Поточний стан камери
      distance: null,
      pivotPoint: null,
      pitch: null,
      yaw: null,
      
      // Налаштування
      zoomStep: 0.2,
      distanceMin: 1,
      distanceMax: 1000,
      
      // Режими
      isAutoFraming: false,  // Чи активний auto-framing
      isManualControl: false, // Чи користувач керує вручну
      
      // Таймстемп останньої операції
      lastManualZoomTime: 0,
      lastAutoFrameTime: 0,
    };
    
    // Підписники на зміни
    this._subscribers = new Set();
    
    // Cooldown для auto-framing після manual zoom (мс)
    this.MANUAL_CONTROL_COOLDOWN = 3000;
  }

  /**
   * Отримати поточний стан
   */
  getState() {
    return { ...this._state };
  }

  /**
   * Оновити стан камери
   */
  updateState(updates) {
    const oldState = { ...this._state };
    Object.assign(this._state, updates);
    
    // Повідомити підписників
    this._notifySubscribers(oldState, this._state);
  }

  /**
   * Встановити distance з перевіркою лімітів
   */
  setDistance(distance, source = 'unknown') {
    const clamped = Math.max(
      this._state.distanceMin,
      Math.min(distance, this._state.distanceMax)
    );
    
    const isManual = source === 'manual';
    
    this.updateState({
      distance: clamped,
      isManualControl: isManual,
      lastManualZoomTime: isManual ? Date.now() : this._state.lastManualZoomTime,
      lastAutoFrameTime: !isManual ? Date.now() : this._state.lastAutoFrameTime,
    });
    
    LoggerService.log(
      this,
      `[CameraStore] Distance set to ${clamped.toFixed(2)} (source: ${source})`
    );
    
    return clamped;
  }

  /**
   * Чи можна виконати auto-framing?
   * (не можна якщо нещодавно був manual zoom)
   */
  canAutoFrame() {
    const timeSinceManual = Date.now() - this._state.lastManualZoomTime;
    return timeSinceManual > this.MANUAL_CONTROL_COOLDOWN;
  }

  /**
   * Встановити pivot point камери
   */
  setPivotPoint(point) {
    this.updateState({
      pivotPoint: point ? { x: point.x, y: point.y, z: point.z } : null
    });
  }

  /**
   * Встановити кути камери
   */
  setAngles(pitch, yaw) {
    this.updateState({ pitch, yaw });
  }

  /**
   * Встановити крок зуму
   */
  setZoomStep(step) {
    const clamped = Math.max(0.05, Math.min(step, 10));
    this.updateState({ zoomStep: clamped });
    return clamped;
  }

  /**
   * Встановити ліміти відстані
   */
  setDistanceLimits(min, max) {
    this.updateState({
      distanceMin: min,
      distanceMax: max > 0 ? max : 1000
    });
  }

  /**
   * Скинути manual control (після певного часу)
   */
  resetManualControl() {
    this.updateState({ isManualControl: false });
  }

  /**
   * Підписатися на зміни стану
   */
  subscribe(callback) {
    this._subscribers.add(callback);
    return () => this._subscribers.delete(callback); // unsubscribe
  }

  /**
   * Повідомити підписників про зміни
   * @private
   */
  _notifySubscribers(oldState, newState) {
    this._subscribers.forEach(callback => {
      try {
        callback(newState, oldState);
      } catch (error) {
        LoggerService.error(this, '[CameraStore] Subscriber error:', error);
      }
    });
  }

  /**
   * Експортувати стан для збереження
   */
  export() {
    return {
      distance: this._state.distance,
      pivotPoint: this._state.pivotPoint,
      pitch: this._state.pitch,
      yaw: this._state.yaw,
      zoomStep: this._state.zoomStep,
    };
  }

  /**
   * Імпортувати збережений стан
   */
  import(savedState) {
    this.updateState({
      distance: savedState.distance ?? this._state.distance,
      pivotPoint: savedState.pivotPoint ?? this._state.pivotPoint,
      pitch: savedState.pitch ?? this._state.pitch,
      yaw: savedState.yaw ?? this._state.yaw,
      zoomStep: savedState.zoomStep ?? this._state.zoomStep,
    });
  }
}
