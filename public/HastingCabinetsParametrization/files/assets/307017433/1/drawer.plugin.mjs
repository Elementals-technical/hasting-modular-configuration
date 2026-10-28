import { LoggerService } from '../../services/logger/logger-service.mjs';
import { DividerDebugLogger } from '../../services/drawer-divider/diagnostics/DividerDebugLogger.mjs';

/**
 * Drawer Plugin для ConfiguratorAPI.
 *
 * Інкапсулює Drawer View (top view) та Drawer Animation методи.
 * Методи доступні через ConfiguratorAPI.*
 */
export class DrawerPlugin {
  /**
   * @param {{ app: object, bridge: object }} ctx
   * @returns {object}
   */
  static create(ctx) {
    const { app, bridge } = ctx;

    /** Helper: повертає DrawerViewService або null */
    const _viewSvc = () => {
      if (!app.drawerViewService) {
        LoggerService.error(bridge, '[Bridge] DrawerViewService not initialized');
        return null;
      }
      return app.drawerViewService;
    };

    /** Helper: повертає DrawerAnimationService або null */
    const _animSvc = () => {
      if (!app.drawerAnimationService) {
        LoggerService.error(bridge, '[Bridge] DrawerAnimationService not initialized');
        return null;
      }
      return app.drawerAnimationService;
    };

    return {

      // ======================== Drawer View ========================

      /**
       * Show top view of a drawer
       * @param {string} cabinetId - Cabinet ID
       * @param {string} drawer - 'Top' or 'Bot'
       * @returns {boolean}
       */
      showTopView: async (cabinetId, drawer) => {
        const svc = _viewSvc();
        if (!svc) return false;
        const traceId = DividerDebugLogger.nextTraceId('drawer-top-view');
        DividerDebugLogger.log('ResizeOverlayCase.showTopViewStart', 'Drawer top view show requested', {
          traceId,
          cabinetId,
          drawer,
          runtimeBefore: DividerDebugLogger.summarizeDrawerRuntime(app, cabinetId, drawer)
        });
        const result = await svc.showTopView(cabinetId, drawer);
        DividerDebugLogger.log('ResizeOverlayCase.showTopViewDone', 'Drawer top view show completed', {
          traceId,
          cabinetId,
          drawer,
          result,
          runtimeAfter: DividerDebugLogger.summarizeDrawerRuntime(app, cabinetId, drawer)
        });
        return result ?? true;
      },

      /**
       * Exit top view mode
       */
      exitTopView: async () => {
        const svc = _viewSvc();
        if (!svc) return false;
        const traceId = DividerDebugLogger.nextTraceId('drawer-top-view-exit');
        DividerDebugLogger.log('ResizeOverlayCase.exitTopViewStart', 'Drawer top view exit requested', {
          traceId,
          runtimeBefore: DividerDebugLogger.summarizeDrawerRuntime(app)
        });
        const result = await svc.exitTopView();
        DividerDebugLogger.log('ResizeOverlayCase.exitTopViewDone', 'Drawer top view exit completed', {
          traceId,
          result,
          runtimeAfter: DividerDebugLogger.summarizeDrawerRuntime(app)
        });
        return result ?? true;
      },

      /**
       * Check if top view is active
       * @returns {boolean}
       */
      isTopViewActive: () => {
        return app.drawerViewService?.isTopViewActive() || false;
      },

      // ======================== Drawer Animation ========================

      /**
       * Встановити конфігурацію анімацій шухляд
       * @param {object} config
       * @returns {boolean}
       */
      setDrawerAnimationConfig: (config) => {
        const svc = _animSvc();
        if (!svc) return false;
        svc.setConfig(config);
        return true;
      },

      /**
       * Відкрити шухляду з анімацією
       * @param {string} cabinetId
       * @param {string} drawerType - 'Top' | 'TopFull' | 'Bot'
       * @returns {Promise<boolean>}
       */
      openDrawer: async (cabinetId, drawerType) => {
        const svc = _animSvc();
        if (!svc) return false;
        const traceId = DividerDebugLogger.nextTraceId('drawer-open');
        DividerDebugLogger.log('ResizeOverlayCase.openDrawerStart', 'Drawer open requested', {
          traceId,
          cabinetId,
          drawerType,
          runtimeBefore: DividerDebugLogger.summarizeDrawerRuntime(app, cabinetId, drawerType)
        });
        const result = await svc.openDrawer(cabinetId, drawerType);
        app.drawerOverlaySystem?.rescan();
        DividerDebugLogger.log('ResizeOverlayCase.openDrawerDone', 'Drawer open completed', {
          traceId,
          cabinetId,
          drawerType,
          result,
          runtimeAfter: DividerDebugLogger.summarizeDrawerRuntime(app, cabinetId, drawerType)
        });
        return result;
      },

      /**
       * Закрити шухляду з анімацією
       * @param {string} cabinetId
       * @param {string} drawerType - 'Top' | 'TopFull' | 'Bot'
       * @returns {Promise<boolean>}
       */
      closeDrawer: async (cabinetId, drawerType) => {
        const svc = _animSvc();
        if (!svc) return false;
        const traceId = DividerDebugLogger.nextTraceId('drawer-close');
        DividerDebugLogger.log('ResizeOverlayCase.closeDrawerStart', 'Drawer close requested', {
          traceId,
          cabinetId,
          drawerType,
          runtimeBefore: DividerDebugLogger.summarizeDrawerRuntime(app, cabinetId, drawerType)
        });
        const result = await svc.closeDrawer(cabinetId, drawerType);
        // Rescan overlay після завершення анімації закриття
        app.drawerOverlaySystem?.rescan();
        DividerDebugLogger.log('ResizeOverlayCase.closeDrawerDone', 'Drawer close completed', {
          traceId,
          cabinetId,
          drawerType,
          result,
          runtimeAfter: DividerDebugLogger.summarizeDrawerRuntime(app, cabinetId, drawerType)
        });
        return result;
      },

      /**
       * Toggle шухляду (відкрити/закрити)
       * @param {string} cabinetId
       * @param {string} drawerType - 'Top' | 'TopFull' | 'Bot'
       * @returns {Promise<boolean>}
       */
      toggleDrawer: async (cabinetId, drawerType) => {
        const svc = _animSvc();
        if (!svc) return false;
        const traceId = DividerDebugLogger.nextTraceId('drawer-toggle');
        DividerDebugLogger.log('ResizeOverlayCase.toggleDrawerStart', 'Drawer toggle requested', {
          traceId,
          cabinetId,
          drawerType,
          runtimeBefore: DividerDebugLogger.summarizeDrawerRuntime(app, cabinetId, drawerType)
        });
        const result = await svc.toggleDrawer(cabinetId, drawerType);
        app.drawerOverlaySystem?.rescan();
        DividerDebugLogger.log('ResizeOverlayCase.toggleDrawerDone', 'Drawer toggle completed', {
          traceId,
          cabinetId,
          drawerType,
          result,
          runtimeAfter: DividerDebugLogger.summarizeDrawerRuntime(app, cabinetId, drawerType)
        });
        return result;
      },

      /**
       * Перевірити чи шухляда відкрита
       * @param {string} cabinetId
       * @param {string} drawerType
       * @returns {boolean}
       */
      isDrawerOpen: (cabinetId, drawerType) => {
        return app.drawerAnimationService?.isDrawerOpen(cabinetId, drawerType) || false;
      },

      /**
       * Закрити всі шухляди миттєво (без анімації)
       */
      closeAllDrawers: () => {
        app.drawerAnimationService?.closeAllImmediate();
      },

      // ======================== Drawer Indicator ========================

      /**
       * Кастомний renderer для Open Drawer widget (indicator + button).
       * Фронтенд повністю контролює DOM.
       * @param {Function|null} callback - (drawerInfo, parentEl) => void, або null для дефолту
       * @example
       * ConfiguratorAPI.onDrawerWidgetRender((info, el) => {
       *     el.innerHTML = `
       *         ${info.hasOccupiedDividers ? '<div class="my-check">✓</div>' : ''}
       *         <button onclick="ConfiguratorAPI.showTopView('${info.cabinetId}', '${info.drawerType}')">Open</button>
       *     `;
       * });
       * // Скинути на дефолт:
       * ConfiguratorAPI.onDrawerWidgetRender(null);
       */
      onDrawerWidgetRender: (callback) => {
        if (!app.drawerOverlaySystem) return;
        app.drawerOverlaySystem.setWidgetRenderer(callback);
      },

      /**
       * Кастомний renderer для Close widget.
       * @param {Function|null} callback - (drawerInfo, parentEl) => void, або null для дефолту
       */
      onDrawerCloseWidgetRender: (callback) => {
        if (!app.drawerOverlaySystem) return;
        app.drawerOverlaySystem.setCloseWidgetRenderer(callback);
      }
    };
  }
}
