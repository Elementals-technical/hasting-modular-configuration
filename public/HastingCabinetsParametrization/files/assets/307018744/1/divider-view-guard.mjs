import { DividerDebugLogger } from "../../services/drawer-divider/diagnostics/DividerDebugLogger.mjs";

/**
 * Guard для автоматичного save/restore стану divider view.
 *
 * Divider view ізолює сцену та вимикає render components.
 * Якщо правила виконуються в цьому стані — MeshInstance.mesh
 * може стати null, що крешить ForwardRenderer.
 *
 * Використання:
 * ```js
 * const result = await DividerViewGuard.withSuspendedView(app, async () => {
 *     // основна логіка (divider view гарантовано вимкнений)
 *     return { success: true };
 * });
 * ```
 */
export class DividerViewGuard {
  /**
   * Виконує async операцію з автоматичним suspend/restore divider view.
   * @param {object} app - PlayCanvas app instance
   * @param {Function} asyncFn - Async функція з основною логікою
   * @returns {Promise<*>} Результат asyncFn
   */
  static async withSuspendedView(app, asyncFn) {
    const traceId = DividerDebugLogger.nextTraceId('divider-view');
    const drawerViewService = app.drawerViewService;
    const overlaySystem = app.dividerSlotOverlaySystem;
    const drawerAnimationService = app.drawerAnimationService;
    const wasActive = drawerViewService?.isTopViewActive();
    let savedState = null;

    DividerDebugLogger.log('DividerViewGuard.withSuspendedView', 'Divider view guard entered', {
      traceId,
      wasActive,
      activeCabinetId: overlaySystem?._activeCabinetId,
      activeDrawerType: overlaySystem?._activeDrawerType,
      overlayActive: overlaySystem?._isActive
    });
    DividerDebugLogger.log('ResizeOverlayCase.guardEnter', 'Resize overlay guard entered', {
      traceId,
      runtime: DividerDebugLogger.summarizeDrawerRuntime(app)
    });

    // Save & suspend
    if (wasActive) {
      const cabinetId = overlaySystem?._activeCabinetId || drawerViewService?.getActiveCabinetId?.();
      const drawerType = overlaySystem?._activeDrawerType || drawerViewService?.getActiveDrawerType?.();
      savedState = {
        cabinetId,
        drawerType,
        wasDrawerOpen: drawerAnimationService?.isDrawerOpen(cabinetId, drawerType) ?? false,
        overlayWasActive: Boolean(overlaySystem?._isActive),
        activeOverlayOptions: overlaySystem?._activeOverlayOptions
          ? { ...overlaySystem._activeOverlayOptions }
          : {}
      };
      DividerDebugLogger.log('DividerViewGuard.withSuspendedView', 'Suspending divider top view', {
        traceId,
        savedState
      });
      DividerDebugLogger.log('ResizeOverlayCase.guardSuspend', 'Suspending top view before guarded config update', {
        traceId,
        savedState,
        runtimeBeforeSuspend: DividerDebugLogger.summarizeDrawerRuntime(app, cabinetId, drawerType)
      });
      if (overlaySystem?._isActive) overlaySystem.deactivate();
      drawerAnimationService?.closeAllImmediate();
      await drawerViewService.exitTopView();
      DividerDebugLogger.log('ResizeOverlayCase.guardSuspended', 'Top view suspended before guarded config update', {
        traceId,
        savedState,
        runtimeAfterSuspend: DividerDebugLogger.summarizeDrawerRuntime(app, cabinetId, drawerType)
      });
    }

    try {
      const result = await asyncFn();
      DividerDebugLogger.log('DividerViewGuard.withSuspendedView', 'Guarded operation completed', {
        traceId,
        result
      });
      return result;
    } catch (error) {
      DividerDebugLogger.error('DividerViewGuard.withSuspendedView', 'Guarded operation failed', {
        traceId,
        error
      });
      throw error;
    } finally {
      // Restore
      if (wasActive && savedState?.cabinetId && savedState?.drawerType) {
        DividerDebugLogger.log('DividerViewGuard.withSuspendedView', 'Restoring divider top view', {
          traceId,
          savedState
        });
        DividerDebugLogger.log('ResizeOverlayCase.guardRestoreBefore', 'Restoring top view after guarded config update', {
          traceId,
          savedState,
          runtimeBeforeRestore: DividerDebugLogger.summarizeDrawerRuntime(app, savedState.cabinetId, savedState.drawerType)
        });
        await drawerViewService.showTopView(savedState.cabinetId, savedState.drawerType);
        if (overlaySystem && savedState.overlayWasActive) {
          overlaySystem.activateDrawer(savedState.cabinetId, savedState.drawerType, {
            ...savedState.activeOverlayOptions,
            debugRequestId: savedState.activeOverlayOptions?.debugRequestId || traceId
          });
        } else if (overlaySystem) {
          DividerDebugLogger.log('ResizeOverlayCase.guardRestoreSkippedOverlay', 'Overlay restore skipped because it was not active before suspend', {
            traceId,
            savedState,
            runtimeAfterTopViewRestore: DividerDebugLogger.summarizeDrawerRuntime(app, savedState.cabinetId, savedState.drawerType)
          });
        }
        // Відновлюємо анімацію відкриття шухляди
        if (savedState.wasDrawerOpen && drawerAnimationService) {
          await drawerAnimationService.openDrawer(savedState.cabinetId, savedState.drawerType);
        }
        DividerDebugLogger.log('DividerViewGuard.withSuspendedView', 'Divider top view restored', {
          traceId,
          savedState
        });
        DividerDebugLogger.log('ResizeOverlayCase.guardRestoreAfter', 'Top view restored after guarded config update', {
          traceId,
          savedState,
          runtimeAfterRestore: DividerDebugLogger.summarizeDrawerRuntime(app, savedState.cabinetId, savedState.drawerType)
        });
      }
    }
  }
}
